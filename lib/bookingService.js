// lib/bookingService.js
// All booking logic in one place: pricing, time slots, and database calls.
// Matches supabase/migrations 20261017000007–09 (bookings module + policy update).

import { supabase } from './supabase_client'

// ---------------------------------------------------------------------
// Business rules (same as pricing_rules + migration 07)
// ---------------------------------------------------------------------
export const RULES = {
  courtId: 'COURT-1',
  dayRate: 200,
  nightRate: 300,
  nightStartHour: 16,   // 4:00 PM (nighttime rate 4:00 PM – 2:00 AM)
  openHour: 6,          // 6:00 AM
  closeHour: 26,        // 2:00 AM the next day (24 + 2)
  dayMinHours: 2,       // daytime (6 AM – 4 PM) start: minimum 2 hours
  nightMinHours: 1,     // nighttime (4 PM – 2 AM) start: minimum 1 hour
  enforceDayMinimum: true,
  bookingWindowDays: 30, // bookings open up to 30 days ahead (owner's rule)
  changeCutoffHours: 24, // customers cancel / reschedule at least 24 hours before
  basePlayers: 4,       // per hour, up to 3 hours (4 / 8 / 12)
  extraPlayerFee: 100,
  paddleFee: 100,
  ballFee: 50,
}

const MANILA_OFFSET = 8
const HOUR_MS = 60 * 60 * 1000

// Statuses that count as an active booking in the admin table
const VISIBLE_STATUSES = ['Reserved', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show']

// Only bookings that were actually paid. Unpaid online checkouts that expired
// are saved as Cancelled too, but they were never real bookings, so hide them.
const isPaidBooking = (b) =>
  (b.payments || []).some((p) => p.payment_status === 'Paid' || p.payment_status === 'Refunded')

// Cancellation reasons that mean the CUSTOMER asked for it (not the court)
const CUSTOMER_SIDE_REASONS = ['Customer requested cancellation', 'Duplicate booking', 'Payment hold expired']

// ---------------------------------------------------------------------
// Time helpers ("business hours" 6..25: 24 = 12:00 AM, 25 = 1:00 AM)
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')

export function parseHour(label) {
  const m = String(label).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) throw new Error(`Invalid time: ${label}`)
  let h = parseInt(m[1], 10) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return h
}

export function toBusinessHour(h) {
  return h < RULES.openHour ? h + 24 : h
}

export function hourLabel(h) {
  const hh = h % 24
  const mer = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:00 ${mer}`
}

function normalizeDate({ year, month, day }) {
  const d = new Date(Date.UTC(year, month, day))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() }
}

function manilaTime({ year, month, day }, businessHour) {
  return new Date(Date.UTC(year, month, day, businessHour - MANILA_OFFSET))
}

// Exact start/end for a business date + start label + duration
export function buildSlot(dateObj, startLabel, duration) {
  const date = normalizeDate(dateObj)
  const bh = toBusinessHour(parseHour(startLabel))
  if (bh + duration > RULES.closeHour) {
    throw new Error('That booking would end after closing time (2:00 AM).')
  }
  const start = manilaTime(date, bh)
  const end = new Date(start.getTime() + duration * HOUR_MS)
  return {
    bookingDate: `${date.year}-${pad(date.month + 1)}-${pad(date.day)}`,
    businessHour: bh,
    start,
    end,
  }
}

// ---------------------------------------------------------------------
// Booking window (today .. today + 30 days, Manila time)
// ---------------------------------------------------------------------
// Today's date in Manila as { year, month, day }
export function manilaToday(now = new Date()) {
  const m = new Date(now.getTime() + MANILA_OFFSET * HOUR_MS)
  return { year: m.getUTCFullYear(), month: m.getUTCMonth(), day: m.getUTCDate() }
}

// Last date that can be booked, as { year, month, day }
export function maxBookableDate(now = new Date()) {
  const t = manilaToday(now)
  return normalizeDate({ ...t, day: t.day + RULES.bookingWindowDays })
}

// For calendars: is this date outside "today .. today + 30 days"?
// Accepts { year, month, day } or { year, month, dayNumber }.
export function isOutsideBookingWindow(dateObj, now = new Date()) {
  const day = dateObj.day ?? dateObj.dayNumber
  const value = Date.UTC(dateObj.year, dateObj.month, day)
  const t = manilaToday(now)
  const max = maxBookableDate(now)
  return value < Date.UTC(t.year, t.month, t.day) || value > Date.UTC(max.year, max.month, max.day)
}

// Minimum hours for a start time: 2 for daytime starts, 1 for nighttime starts.
// Accepts a label ("2:00 PM") or an hour number.
export function minDurationFor(start) {
  if (start === null || start === undefined || start === '') return RULES.nightMinHours
  const h = typeof start === 'number' ? start : parseHour(start)
  const bh = toBusinessHour(h)
  return RULES.enforceDayMinimum && bh < RULES.nightStartHour ? RULES.dayMinHours : RULES.nightMinHours
}

const fmtDate = (d) =>
  d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
const fmtTime = (d) =>
  d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const peso = (n) => `₱ ${Number(n || 0).toLocaleString('en-PH')}`

// ---------------------------------------------------------------------
// Pricing (mirrors calculate_booking_quote in the database:
// each hour is priced by its own band, capacity 4 / 8 / 12)
// ---------------------------------------------------------------------
export function capacityFor(duration) {
  return RULES.basePlayers * Math.min(Math.max(Math.ceil(duration), 1), 3)
}

export function calculatePrice({ startHour = RULES.openHour, duration = 1, players = 1, paddles = 0, balls = 0 }) {
  const bh = toBusinessHour(startHour)
  let dayHours = 0
  let nightHours = 0
  for (let h = bh; h < bh + duration; h++) {
    if (h % 24 >= RULES.openHour && h < RULES.nightStartHour) dayHours += 1
    else nightHours += 1
  }
  const courtFee = dayHours * RULES.dayRate + nightHours * RULES.nightRate
  const extraPlayers = Math.max(0, players - capacityFor(duration))
  const extraPlayerFee = extraPlayers * RULES.extraPlayerFee
  const paddleFee = paddles * RULES.paddleFee
  const ballFee = balls * RULES.ballFee
  return {
    night: bh >= RULES.nightStartHour, // based on the start time (used for labels + the 2-hour rule)
    dayHours,
    nightHours,
    ratePerHour: duration ? courtFee / duration : 0,
    courtFee,
    extraPlayers,
    extraPlayerFee,
    paddleFee,
    ballFee,
    total: courtFee + extraPlayerFee + paddleFee + ballFee,
  }
}

// "Court Rate (2 hr x ₱ 200)" or, when it crosses 4 PM,
// "Court Rate (1 hr x ₱ 200 + 1 hr x ₱ 300)"
export function courtRateLabel(price) {
  const parts = []
  if (price.dayHours) parts.push(`${price.dayHours} hr x ₱ ${RULES.dayRate}`)
  if (price.nightHours) parts.push(`${price.nightHours} hr x ₱ ${RULES.nightRate}`)
  return `Court Rate (${parts.join(' + ') || '0 hr'})`
}

// ---------------------------------------------------------------------
// Status shown in the UI
// ---------------------------------------------------------------------
export function displayStatus(status, start, end, now = new Date()) {
  if (status === 'Cancelled') return 'Cancelled'
  if (status === 'Completed') return 'Completed'
  if (status === 'No Show') return 'No Show'
  if (status === 'In Progress') return 'On-going'
  if (status === 'Reserved' || status === 'Confirmed') {
    if (end && now >= end) return 'Completed'
    if (start && now >= start) return 'On-going'
    return 'Reserved'
  }
  return null // Pending Payment is hidden
}

// ---------------------------------------------------------------------
// Errors -> readable messages
// ---------------------------------------------------------------------
export function friendlyError(error) {
  if (!error) return new Error('Something went wrong.')
  if (error.code === '23P01') return new Error('That time slot is already booked. Please choose another time.')
  if (error.code === '42501' || /row-level security|permission denied/i.test(error.message || '')) {
    return new Error('Not allowed. Please make sure you are logged in with a staff account.')
  }
  if (error.code === '23514') return new Error(`Invalid booking details: ${error.message}`)
  return new Error(error.message || 'Something went wrong.')
}

// ---------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------
// [{ label, hour, available, reason, minDuration, maxHours }]
// maxHours = how many hours can be booked from that start before the next booking / closing
// options.ignore = { start, end } of the booking being rescheduled
// options.allowStarted = true lets staff book the hour currently running (walk-ins)
// options.strictDuration = true keeps the exact duration (used by Reschedule, where the
//   duration can't change). Otherwise daytime starts are checked as at least 2 hours,
//   because the duration is bumped up to 2 automatically when one is picked.
export async function getAvailableStartTimes(
  dateObj,
  duration,
  { ignore, allowStarted = false, strictDuration = false } = {}
) {
  const date = normalizeDate(dateObj)

  // Beyond the 30-day window (or before today): nothing is open
  if (isOutsideBookingWindow(date)) {
    const max = maxBookableDate()
    const reason =
      Date.UTC(date.year, date.month, date.day) > Date.UTC(max.year, max.month, max.day) ? 'Not yet open' : 'Passed'
    const times = []
    for (let bh = RULES.openHour; bh < RULES.closeHour; bh++) {
      times.push({ label: hourLabel(bh), hour: bh, available: false, reason, minDuration: minDurationFor(bh) })
    }
    return times
  }

  const dayStart = manilaTime(date, RULES.openHour)
  const dayEnd = manilaTime(date, RULES.closeHour)

  const { data, error } = await supabase.rpc('get_booked_slots', {
    p_from: dayStart.toISOString(),
    p_to: dayEnd.toISOString(),
  })
  if (error) throw friendlyError(error)

  const busy = (data || [])
    .map((r) => ({ start: new Date(r.slot_start), end: new Date(r.slot_end) }))
    .filter(
      (r) => !(ignore && r.start.getTime() === ignore.start?.getTime() && r.end.getTime() === ignore.end?.getTime())
    )

  const now = Date.now()
  const times = []
  for (let bh = RULES.openHour; bh < RULES.closeHour; bh++) {
    const minDuration = minDurationFor(bh)
    const tooShort = duration < minDuration
    const hours = strictDuration ? duration : Math.max(duration, minDuration)
    const start = manilaTime(date, bh)
    const end = new Date(start.getTime() + hours * HOUR_MS)
    const cutoff = allowStarted ? start.getTime() + HOUR_MS : start.getTime()

    let reason = null
    if (bh + hours > RULES.closeHour) reason = 'Past closing'
    else if (cutoff <= now) reason = 'Passed'
    else if (busy.some((b) => b.start < end && start < b.end)) reason = 'Booked'
    else if (strictDuration && tooShort) reason = `Min ${minDuration} hrs`

    // Longest booking possible from this start (until the next booking or 2:00 AM closing)
    let maxHours = 0
    if (cutoff > now) {
      for (let h = bh; h < RULES.closeHour; h++) {
        const hs = manilaTime(date, h)
        const he = new Date(hs.getTime() + HOUR_MS)
        if (busy.some((b) => b.start < he && hs < b.end)) break
        maxHours += 1
      }
    }

    times.push({ label: hourLabel(bh), hour: bh, available: !reason, reason, minDuration, maxHours })
  }
  return times
}

// ---------------------------------------------------------------------
// ADMIN / STAFF: walk-in / phone booking (already paid in person)
// Booking Source and Payment Method labels match the database enums.
// ---------------------------------------------------------------------
export async function createStaffBooking(form) {
  const {
    date, startTime, duration, players, paddles = 0, balls = 0,
    customerName, contactNumber, email, bookingSource, paymentMethod, notes,
  } = form

  if (!date || !startTime) throw new Error('Please select a date and start time.')
  if (!duration || duration < 1) throw new Error('Duration must be at least 1 hour.')
  if (!players || players < 1) throw new Error('Please enter the number of players.')
  if (!customerName?.trim()) throw new Error('Please enter the customer name.')
  if (String(contactNumber || '').replace(/\D/g, '').length < 10) throw new Error('Please enter a valid contact number.')
  if (!bookingSource) throw new Error('Please select a booking source.')
  if (!paymentMethod) throw new Error('Please select a payment method.')

  if (duration < minDurationFor(startTime)) {
    throw new Error(`Daytime bookings (6:00 AM – 4:00 PM) need at least ${RULES.dayMinHours} hours.`)
  }
  if (isOutsideBookingWindow(date)) {
    throw new Error(`Bookings are only open up to ${RULES.bookingWindowDays} days in advance.`)
  }

  const slot = buildSlot(date, startTime, duration)

  const { data, error } = await supabase.rpc('create_staff_booking', {
    p_start_time: slot.start.toISOString(),
    p_end_time: slot.end.toISOString(),
    p_customer_name: customerName,
    p_customer_email: email || '',
    p_customer_phone: contactNumber,
    p_player_count: players,
    p_paddle_count: paddles,
    p_ball_count: balls,
    p_payment_method: paymentMethod,  // 'Cash' | 'GCash' | 'Maya' | 'Bank Transfer'
    p_booking_source: bookingSource,  // 'Walk-in' | 'Phone' | 'Social Media'
    p_notes: notes || null,
  })
  if (error) throw friendlyError(error)
  return data
}

// ---------------------------------------------------------------------
// ADMIN: list bookings
// ---------------------------------------------------------------------
export function toBookingRow(b, now = new Date()) {
  const start = b.start_time ? new Date(b.start_time) : null
  const end = b.end_time ? new Date(b.end_time) : null
  const payments = b.payments || []
  const payment = payments.find((p) => p.payment_status === 'Paid') || payments[0]
  const paddles = b.paddle_rental_count || 0
  const balls = b.ball_rental_count || 0
  const addOns =
    [paddles ? `${paddles}x Paddle Rental` : null, balls ? `${balls}x Ball Rental` : null].filter(Boolean).join(', ') ||
    'None'

  return {
    id: b.id,
    ref: b.reference_number,
    customer: b.customer_name || '—',
    contact: [b.customer_phone, b.customer_email].filter(Boolean).join(' • ') || '—',
    date: start ? fmtDate(start) : '—',
    time: start && end ? `${fmtTime(start)} – ${fmtTime(end)}` : '—',
    pax: String(b.player_count ?? ''),
    amount: peso(b.total_amount),
    status: displayStatus(b.status, start, end, now),
    bookingSource: b.booking_source || '—',
    paymentMethod: payment?.payment_method || '—',
    notes: b.notes || 'None',
    cancelReason: b.cancellation_reason || null,
    addOns,
    breakdown: {
      courtRate: Number(b.court_rate_amount || 0),
      additionalPlayers: Number(b.extra_players_amount || 0),
      additionalPlayersCount: Math.round(Number(b.extra_players_amount || 0) / RULES.extraPlayerFee),
      paddleRental: paddles * RULES.paddleFee,
      paddleCount: paddles,
      ballRental: balls * RULES.ballFee,
      ballCount: balls,
    },
    bookedDate: b.created_at ? fmtDate(new Date(b.created_at)) : '—',
    lastUpdated: b.updated_at ? fmtDate(new Date(b.updated_at)) : '—',
    start,
    end,
    duration: Number(b.duration_hours) || (start && end ? Math.round((end - start) / HOUR_MS) : 1),
    raw: b,
  }
}

export async function fetchAdminBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, payments(payment_method, payment_status, paid_at)')
    .in('status', VISIBLE_STATUSES)
    .order('start_time', { ascending: false })
  if (error) throw friendlyError(error)
  const now = new Date()
  return (data || []).filter(isPaidBooking).map((b) => toBookingRow(b, now))
}

// ---------------------------------------------------------------------
// ADMIN: cancel / reschedule (changes are logged automatically in audit_logs)
// ---------------------------------------------------------------------
export async function cancelBooking(row, { reason, notes } = {}) {
  const note = ['Cancelled' + (reason ? `: ${reason}` : ''), notes].filter(Boolean).join(' — ')
  const existing = row.raw?.notes ? `${row.raw.notes} | ` : ''

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Cancelled', expires_at: null, cancellation_reason: reason || null, notes: existing + note })
    .eq('id', row.id)
  if (error) throw friendlyError(error)
}

// Keeps the ORIGINAL duration and price; only the date/time moves.
// Also works for Cancelled bookings (brings them back to Reserved).
export async function rescheduleBooking(row, { date, startTime, reason, notes } = {}) {
  if (!date || !startTime) throw new Error('Please select a new date and start time.')
  const slot = buildSlot(date, startTime, row.duration)
  if (slot.start <= new Date()) throw new Error('Please choose a future date and time.')
  if (isOutsideBookingWindow(date)) {
    throw new Error(`Bookings are only open up to ${RULES.bookingWindowDays} days in advance.`)
  }

  const note = ['Rescheduled' + (reason ? `: ${reason}` : ''), notes].filter(Boolean).join(' — ')
  const existing = row.raw?.notes ? `${row.raw.notes} | ` : ''

  const { error } = await supabase
    .from('bookings')
    .update({
      start_time: slot.start.toISOString(),
      end_time: slot.end.toISOString(),
      status: 'Reserved',
      notes: existing + note,
    })
    .eq('id', row.id)
  if (error) throw friendlyError(error)
}

// =====================================================================
// CUSTOMER PORTAL
// =====================================================================

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

async function functionError(error) {
  try {
    const body = await error.context.json()
    return new Error(body?.error || error.message)
  } catch {
    return new Error(error.message || 'Something went wrong.')
  }
}

// Creates the booking as "Pending Payment" (slot held 15 minutes).
// The price is recalculated on the server.
export async function createOnlineBooking({
  date, startTime, duration, players, paddles = 0, balls = 0, name, email, phone, method = 'gcash',
}) {
  if (!date || !startTime) throw new Error('Please go back and pick a date and start time.')
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    throw new Error('Please fill in your full name, email address and contact number.')
  }
  if (String(phone).replace(/\D/g, '').length < 10) throw new Error('Please enter a valid contact number.')

  if (duration < minDurationFor(startTime)) {
    throw new Error(`Daytime bookings (6:00 AM – 4:00 PM) need at least ${RULES.dayMinHours} hours.`)
  }
  if (isOutsideBookingWindow(date)) {
    throw new Error(`Bookings are only open up to ${RULES.bookingWindowDays} days in advance.`)
  }

  const slot = buildSlot(date, startTime, duration)

  const { data, error } = await supabase.rpc('create_booking_reservation', {
    p_court_id: RULES.courtId,
    p_start_time: slot.start.toISOString(),
    p_end_time: slot.end.toISOString(),
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone,
    p_player_count: players,
    p_paddle_count: paddles,
    p_ball_count: balls,
    p_payment_method: method === 'qrph' ? 'QR Ph' : 'GCash',
    p_booking_source: 'Online / App',
    p_notes: null,
  })
  if (error) throw friendlyError(error)

  return {
    booking_id: data.booking_id,
    ref: data.reference_number,
    amount: Number(data.total_amount),
    hold_until: data.expires_at,
  }
}

// PayMongo (real checkout). NOTE: the "paymongo" Edge Function must be
// updated to this schema before switching off simulated payments.
export async function startPayMongoCheckout(bookingId, method) {
  const returnUrl = window.location.origin + window.location.pathname
  const { data, error } = await supabase.functions.invoke('paymongo', {
    body: { action: 'create', booking_id: bookingId, method, return_url: returnUrl },
  })
  if (error) throw await functionError(error)
  if (data?.error) throw new Error(data.error)
  return data.checkout_url
}

export async function verifyPayMongoPayment(bookingId) {
  const { data, error } = await supabase.functions.invoke('paymongo', {
    body: { action: 'verify', booking_id: bookingId },
  })
  if (error) throw await functionError(error)
  if (data?.error && data.status !== 'conflict') throw new Error(data.error)
  return data
}

// Props for Receipt.jsx from a booking row (bookings table shape)
export function toReceiptProps(booking, payment) {
  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const manila = new Date(start.getTime() + MANILA_OFFSET * HOUR_MS)
  const paidAt = payment?.paid_at ? new Date(payment.paid_at) : new Date()

  return {
    bookingData: {
      day: manila.getUTCDate(),
      month: MONTHS_LONG[manila.getUTCMonth()],
      year: manila.getUTCFullYear(),
      startTime: fmtTime(start),
      duration: Math.round((end - start) / HOUR_MS),
      players: booking.player_count,
      paddles: booking.paddle_rental_count,
      balls: booking.ball_rental_count,
      referenceNumber: booking.reference_number,
    },
    paymentDetails: {
      referenceNumber: booking.reference_number,
      paymentMethod: payment?.payment_method || 'GCash',
      paidAt: `Paid ${fmtDate(paidAt)} • ${fmtTime(paidAt)}`,
    },
    calculatedTotal: Number(booking.total_amount),
  }
}

// ---------------------------------------------------------------------
// DEV ONLY: simulated payment (VITE_SIMULATED_PAYMENT=true in .env.local)
// ---------------------------------------------------------------------
export const SIMULATED_PAYMENT = import.meta.env.VITE_SIMULATED_PAYMENT === 'true'

export async function simulatePayment(bookingId, method) {
  const { data, error } = await supabase.rpc('dev_simulate_payment', {
    p_booking_id: bookingId,
    p_method: method,
  })
  if (error) throw friendlyError(error)
  return data // { booking, payment }
}

// ---------------------------------------------------------------------
// "Find your booking" with ONLY the reference number (temporary, until OTP).
// Returns no contact details and a shortened name.
// ---------------------------------------------------------------------
export async function findBookingByReference(reference) {
  if (!reference?.trim()) throw new Error('Please enter your reference number.')
  const { data, error } = await supabase.rpc('lookup_booking_by_reference', {
    p_reference_number: reference.trim(),
  })
  if (error) throw friendlyError(error)
  if (!data) return null
  return toBookingRow({
    ...data,
    payments: [{ payment_method: data.payment_method, payment_status: data.payment_status, paid_at: data.paid_at }],
  })
}

// ---------------------------------------------------------------------
// "Find your booking" for guests (reference number AND email/phone)
// Use this one once OTP / contact verification is added.
// ---------------------------------------------------------------------
export async function findGuestBooking(reference, contact) {
  if (!reference?.trim() || !contact?.trim()) {
    throw new Error('Please enter your reference number and the email or phone number you used.')
  }
  const { data, error } = await supabase.rpc('lookup_guest_booking', {
    p_reference_number: reference.trim(),
    p_contact: contact.trim(),
  })
  if (error) throw friendlyError(error)
  if (!data) return null
  return toBookingRow({
    ...data,
    payments: [{ payment_method: data.payment_method, payment_status: data.payment_status, paid_at: data.paid_at }],
  })
}

// =====================================================================
// CUSTOMER: My Bookings (logged-in customers)
// =====================================================================

// Adds what the customer is allowed to do with each booking:
//  - canCancel / canReschedule: Reserved and at least 24 hours away (policy)
//  - needsAttention: cancelled by the court (e.g. rain) -> can reschedule for free
//  - changesClosed: Reserved but less than 24 hours away
export function toCustomerBookingRow(b, now = new Date()) {
  const row = toBookingRow(b, now)
  const hoursAway = row.start ? (row.start.getTime() - now.getTime()) / HOUR_MS : -1
  const canChange = row.status === 'Reserved' && hoursAway >= RULES.changeCutoffHours
  const cancelledByCourt =
    b.status === 'Cancelled' &&
    Boolean(b.cancelled_by) &&
    b.cancelled_by !== b.customer_id &&
    !CUSTOMER_SIDE_REASONS.includes(b.cancellation_reason || '')

  return {
    ...row,
    canCancel: canChange,
    canReschedule: canChange || cancelledByCourt,
    needsAttention: cancelledByCourt,
    changesClosed: row.status === 'Reserved' && !canChange,
  }
}

export async function fetchMyBookings(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('bookings')
    .select('*, payments(payment_method, payment_status, paid_at)')
    .eq('customer_id', userId)
    .neq('status', 'Pending Payment')
    .order('start_time', { ascending: false })
  if (error) throw friendlyError(error)
  const now = new Date()
  return (data || []).filter(isPaidBooking).map((b) => toCustomerBookingRow(b, now))
}

// The database checks ownership and the 24-hour rule again.
export async function customerCancelBooking(row, { reason, notes } = {}) {
  const { error } = await supabase.rpc('customer_cancel_booking', {
    p_booking_id: row.id,
    p_reason: reason || null,
    p_notes: notes || null,
  })
  if (error) throw friendlyError(error)
}

// Keeps the original duration and price. Returns the new { start, end }.
export async function customerRescheduleBooking(row, { date, startTime, reason, notes } = {}) {
  if (!date || !startTime) throw new Error('Please select a new date and start time.')
  const slot = buildSlot(date, startTime, row.duration)
  if (slot.start <= new Date()) throw new Error('Please choose a future date and time.')

  const { error } = await supabase.rpc('customer_reschedule_booking', {
    p_booking_id: row.id,
    p_start_time: slot.start.toISOString(),
    p_reason: reason || null,
    p_notes: notes || null,
  })
  if (error) throw friendlyError(error)
  return { start: slot.start, end: slot.end }
}

// =====================================================================
// DASHBOARDS (owner + staff)
// Business day = 6:00 AM to 2:00 AM Manila time (1:00 AM belongs to the day before)
// =====================================================================

// 'YYYY-MM-DD' of the business day a moment belongs to
export function businessDayKey(date) {
  const m = new Date(date.getTime() + MANILA_OFFSET * HOUR_MS)
  let y = m.getUTCFullYear()
  let mo = m.getUTCMonth()
  let d = m.getUTCDate()
  if (m.getUTCHours() < RULES.openHour) {
    const prev = new Date(Date.UTC(y, mo, d - 1))
    y = prev.getUTCFullYear()
    mo = prev.getUTCMonth()
    d = prev.getUTCDate()
  }
  return `${y}-${pad(mo + 1)}-${pad(d)}`
}

// Hour on the 6..26 timeline (12:30 AM -> 24.5)
export function businessHourOf(date) {
  const m = new Date(date.getTime() + MANILA_OFFSET * HOUR_MS)
  const h = m.getUTCHours() + m.getUTCMinutes() / 60
  return h < RULES.openHour ? h + 24 : h
}

const WEEKDAY_SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

// Everything the dashboards show, from real bookings + payments
//  today:   today's bookings for the timeline (cancelled ones are left out)
//  week:    Monday-Sunday of this week: number of bookings + hours booked
//  revenue: from today's paid bookings, split into court fees / extra players / equipment
export async function fetchDashboardData(now = new Date()) {
  const rows = await fetchAdminBookings()
  const todayKey = businessDayKey(now)
  const active = rows.filter((r) => r.start && r.end && r.status !== 'Cancelled')

  const today = active
    .filter((r) => businessDayKey(r.start) === todayKey)
    .map((r) => ({
      id: r.ref,
      customer: r.customer,
      startHour: businessHourOf(r.start),
      durationHours: (r.end - r.start) / HOUR_MS,
      pax: r.pax,
      status: r.status,
      row: r,
    }))
    .sort((a, b) => a.startHour - b.startHour)

  // Monday of the current (business) week
  const [ty, tm, td] = todayKey.split('-').map(Number)
  const todayUtc = Date.UTC(ty, tm - 1, td)
  const mondayUtc = todayUtc - ((new Date(todayUtc).getUTCDay() + 6) % 7) * 24 * HOUR_MS
  const week = WEEKDAY_SHORT.map((label, i) => {
    const d = new Date(mondayUtc + i * 24 * HOUR_MS)
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    const dayRows = active.filter((r) => businessDayKey(r.start) === key)
    const hours = dayRows.reduce((sum, r) => sum + (r.end - r.start) / HOUR_MS, 0)
    return {
      day: label,
      dateISO: key,
      dateStr: `${MONTHS_LONG[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`,
      bookingsCount: dayRows.length,
      totalRentalHours: Math.round(hours * 10) / 10,
      isToday: key === todayKey,
    }
  })

  // Revenue from TODAY'S bookings (the same bookings shown on today's timeline),
  // counting only paid ones, split into court fees / extra players / equipment
  const revenue = { courtFees: 0, extraPlayers: 0, equipment: 0, total: 0 }
  today.forEach(({ row }) => {
    const paid = (row.raw?.payments || []).some((p) => p.payment_status === 'Paid')
    if (!paid) return
    revenue.courtFees += Number(row.raw.court_rate_amount || 0)
    revenue.extraPlayers += Number(row.raw.extra_players_amount || 0)
    revenue.equipment += Number(row.raw.equipment_rental_amount || 0)
  })
  revenue.total = revenue.courtFees + revenue.extraPlayers + revenue.equipment

  return { today, week, revenue }
}