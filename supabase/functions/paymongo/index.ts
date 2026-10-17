// Supabase Edge Function: "paymongo"
// Folder in VS Code: supabase/functions/paymongo/index.ts
//
// Deploy:   npx supabase functions deploy paymongo --no-verify-jwt
// Secret:   npx supabase secrets set PAYMONGO_SECRET_KEY=sk_test_xxxxxxxx   (TEST key only)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
//
// Actions (POST JSON body):
//   { action: "create", booking_id, method: "gcash" | "qrph", return_url } -> { checkout_url }
//   { action: "verify", booking_id }                                        -> { status, booking, payment }
//
// Works with the bookings module (bookings + payments tables, status 'Pending Payment' -> 'Reserved').

import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYMONGO_API = 'https://api.paymongo.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
type Any = any

// Only what the receipt needs (no email / phone)
function receiptBooking(b: Any) {
  return {
    id: b.id,
    reference_number: b.reference_number,
    status: b.status,
    start_time: b.start_time,
    end_time: b.end_time,
    player_count: b.player_count,
    paddle_rental_count: b.paddle_rental_count,
    ball_rental_count: b.ball_rental_count,
    total_amount: b.total_amount,
  }
}

async function latestPayment(db: Any, bookingId: string) {
  const { data } = await db
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// ---------------------------------------------------------------------------
// 1. Start a PayMongo checkout for a "Pending Payment" booking
// ---------------------------------------------------------------------------
async function createCheckout(db: Any, auth: string, body: Any): Promise<Response> {
  const { booking_id, method, return_url } = body
  if (!booking_id || !return_url) return json({ error: 'Missing booking_id or return_url' }, 400)

  const { data: b, error } = await db.from('bookings').select('*').eq('id', booking_id).single()
  if (error || !b) return json({ error: 'Booking not found' }, 404)
  if (b.status !== 'Pending Payment') {
    return json({ error: 'This booking is no longer awaiting payment. Please book again.' }, 400)
  }
  if (b.expires_at && new Date(b.expires_at) < new Date()) {
    return json({ error: 'Your slot hold expired. Please book again.' }, 400)
  }

  const type = method === 'qrph' ? 'qrph' : 'gcash'
  const sep = String(return_url).includes('?') ? '&' : '?'

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            name: b.customer_name,
            email: b.customer_email || undefined,
            phone: b.customer_phone || undefined,
          },
          line_items: [
            {
              name: `Court Rental (${b.reference_number})`,
              amount: Math.round(Number(b.total_amount) * 100), // PayMongo uses centavos
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: [type],
          reference_number: b.reference_number,
          description: `Saranay Pickleball Court booking ${b.reference_number}`,
          show_description: true,
          show_line_items: true,
          send_email_receipt: false,
          success_url: `${return_url}${sep}payment=success&booking=${b.id}`,
          cancel_url: `${return_url}${sep}payment=cancelled&booking=${b.id}`,
        },
      },
    }),
  })
  const out = await res.json()
  if (!res.ok) {
    return json({ error: out?.errors?.[0]?.detail || 'Could not start PayMongo checkout.' }, 400)
  }

  // Remember the checkout on the booking's payment row
  const pay = await latestPayment(db, b.id)
  if (pay) {
    await db
      .from('payments')
      .update({
        paymongo_checkout_id: out.data.id,
        payment_method: type === 'qrph' ? 'QR Ph' : 'GCash',
      })
      .eq('id', pay.id)
  }

  // Give the customer time to finish the PayMongo page
  await db
    .from('bookings')
    .update({ expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })
    .eq('id', b.id)
    .eq('status', 'Pending Payment')

  return json({ checkout_url: out.data.attributes.checkout_url })
}

// ---------------------------------------------------------------------------
// 2. After PayMongo sends the customer back: check if it was paid
// ---------------------------------------------------------------------------
async function verifyCheckout(db: Any, auth: string, body: Any): Promise<Response> {
  const { booking_id } = body
  if (!booking_id) return json({ error: 'Missing booking_id' }, 400)

  const { data: b, error } = await db.from('bookings').select('*').eq('id', booking_id).single()
  if (error || !b) return json({ error: 'Booking not found' }, 404)

  const pay = await latestPayment(db, b.id)

  // Already confirmed earlier (e.g. page refreshed)
  if (b.status === 'Reserved' && pay?.payment_status === 'Paid') {
    return json({
      status: 'confirmed',
      booking: receiptBooking(b),
      payment: { payment_method: pay.payment_method, paid_at: pay.paid_at },
    })
  }
  if (!pay?.paymongo_checkout_id) return json({ status: 'pending', booking: receiptBooking(b) })

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions/${pay.paymongo_checkout_id}`, {
    headers: { Authorization: auth, accept: 'application/json' },
  })
  const out = await res.json()
  if (!res.ok) return json({ error: out?.errors?.[0]?.detail || 'Could not check payment.' }, 400)

  const attrs = out.data.attributes
  const paidPayment = (attrs.payments || []).find((p: Any) => p?.attributes?.status === 'paid')
  const paid = Boolean(paidPayment) || attrs.payment_intent?.attributes?.status === 'succeeded'
  if (!paid) return json({ status: 'pending', booking: receiptBooking(b) })

  const paidAt = paidPayment?.attributes?.paid_at
    ? new Date(paidPayment.attributes.paid_at * 1000).toISOString()
    : new Date().toISOString()

  // Confirm the booking. If the 15/30-minute hold ran out, the database may have
  // released it in the same step, so check and try once more.
  let bookingError: Any = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: upErr } = await db
      .from('bookings')
      .update({ status: 'Reserved', expires_at: null })
      .eq('id', b.id)
    if (upErr) {
      bookingError = upErr
      break
    }
    const { data: check } = await db.from('bookings').select('status').eq('id', b.id).single()
    if (check?.status === 'Reserved') break
  }

  // Always record the payment (the customer WAS charged)
  await db
    .from('payments')
    .update({
      payment_status: 'Paid',
      paid_at: paidAt,
      paymongo_payment_id: paidPayment?.id || null,
      notes: bookingError ? 'Paid, but the time slot was taken. Contact the customer.' : null,
    })
    .eq('id', pay.id)

  if (bookingError) {
    return json({
      status: 'conflict',
      error:
        'Payment was received, but the time slot is no longer available. Please contact the court with your reference number so they can help you.',
      booking: receiptBooking(b),
    })
  }

  const { data: fresh } = await db.from('bookings').select('*').eq('id', b.id).single()
  return json({
    status: 'confirmed',
    booking: receiptBooking(fresh || { ...b, status: 'Reserved' }),
    payment: { payment_method: pay.payment_method, paid_at: paidAt },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secret = Deno.env.get('PAYMONGO_SECRET_KEY')
    if (!secret) return json({ error: 'PAYMONGO_SECRET_KEY is not set in Edge Function secrets.' }, 500)
    if (secret.startsWith('sk_live_') && Deno.env.get('ALLOW_LIVE_PAYMENTS') !== 'true') {
      return json({ error: 'Live PayMongo key detected. Use the sk_test_ key while testing.' }, 500)
    }

    const auth = 'Basic ' + btoa(secret + ':')
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json()
    if (body.action === 'create') return await createCheckout(db, auth, body)
    if (body.action === 'verify') return await verifyCheckout(db, auth, body)
    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500)
  }
})