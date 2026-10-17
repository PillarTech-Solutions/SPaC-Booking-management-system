-- ==============================================================================
-- SPaC Booking Management System — Guest lookup by reference number (temporary)
--
-- Until OTP verification is added, guests can look up a booking with only the
-- reference number. Because reference numbers are sequential (CR-1001, CR-1002...),
-- this returns NO contact details and only a shortened name (e.g. "Juan D.").
-- Replace with an OTP-verified lookup later.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.lookup_booking_by_reference(p_reference_number text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_name    text;
  v_masked  text;
BEGIN
  IF p_reference_number IS NULL OR TRIM(p_reference_number) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking FROM public.bookings
   WHERE UPPER(reference_number) = UPPER(TRIM(p_reference_number))
     AND status <> 'Pending Payment'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE booking_id = v_booking.id
   ORDER BY (payment_status = 'Paid') DESC, created_at DESC
   LIMIT 1;

  -- "Juan Dela Cruz" -> "Juan C."
  v_name := TRIM(v_booking.customer_name);
  v_masked := split_part(v_name, ' ', 1)
              || CASE WHEN position(' ' IN v_name) > 0
                      THEN ' ' || upper(left(regexp_replace(v_name, '^.*\s', ''), 1)) || '.'
                      ELSE '' END;

  RETURN jsonb_build_object(
    'reference_number', v_booking.reference_number,
    'customer_name', v_masked,
    'booking_source', v_booking.booking_source,
    'start_time', v_booking.start_time,
    'end_time', v_booking.end_time,
    'duration_hours', v_booking.duration_hours,
    'player_count', v_booking.player_count,
    'paddle_rental_count', v_booking.paddle_rental_count,
    'ball_rental_count', v_booking.ball_rental_count,
    'court_rate_amount', v_booking.court_rate_amount,
    'extra_players_amount', v_booking.extra_players_amount,
    'equipment_rental_amount', v_booking.equipment_rental_amount,
    'total_amount', v_booking.total_amount,
    'status', v_booking.status,
    'created_at', v_booking.created_at,
    'updated_at', v_booking.updated_at,
    'payment_method', v_payment.payment_method,
    'payment_status', v_payment.payment_status,
    'paid_at', v_payment.paid_at
  );
END $$;

REVOKE ALL ON FUNCTION public.lookup_booking_by_reference(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_by_reference(text) TO anon, authenticated;