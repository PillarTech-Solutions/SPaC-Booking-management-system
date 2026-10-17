-- ==============================================================================
-- SPaC Booking Management System — Policy update (from the client's posted policy)
--
--  1. Nighttime rate starts at 4:00 PM (was 6:00 PM).
--       Daytime  6:00 AM – 4:00 PM  ₱200/hr (minimum 2 hours)
--       Night    4:00 PM – 2:00 AM  ₱300/hr (minimum 1 hour)
--  2. Bookings open only up to 30 days in advance (owner's request).
--
-- Pricing, the 2-hour daytime minimum and capacity (4 / 8 / 12) all read from
-- pricing_rules, so they follow the new night start automatically.
-- ==============================================================================

BEGIN;

ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS booking_window_days integer NOT NULL DEFAULT 30;
ALTER TABLE public.pricing_rules
  ALTER COLUMN night_start_time SET DEFAULT '16:00:00';

UPDATE public.pricing_rules
   SET night_start_time = '16:00:00',
       booking_window_days = 30
 WHERE id = 'DEFAULT';

-- create_booking_reservation: same as the bookings module, plus the 30-day window
CREATE OR REPLACE FUNCTION public.create_booking_reservation(
  p_court_id text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_player_count integer DEFAULT 4,
  p_paddle_count integer DEFAULT 0,
  p_ball_count integer DEFAULT 0,
  p_payment_method payment_method DEFAULT 'GCash',
  p_booking_source booking_source DEFAULT 'Online / App',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules         public.pricing_rules%ROWTYPE;
  v_quote         jsonb;
  v_ref           text;
  v_booking_id    uuid;
  v_is_staff      boolean := public.is_active_staff();
  v_local_start   timestamp;
  v_business_date date;
  v_today         date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_close         timestamptz;
  v_duration      numeric;
BEGIN
  SELECT * INTO v_rules FROM public.pricing_rules WHERE id = 'DEFAULT';

  IF NOT EXISTS (SELECT 1 FROM public.courts WHERE id = p_court_id AND is_active) THEN
    RAISE EXCEPTION 'The court is not currently available.';
  END IF;

  IF NULLIF(TRIM(p_customer_name), '') IS NULL OR NULLIF(TRIM(p_customer_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Please enter the customer name and contact number.';
  END IF;
  IF NOT v_is_staff AND NULLIF(TRIM(p_customer_email), '') IS NULL THEN
    RAISE EXCEPTION 'Please enter your email address.';
  END IF;
  IF COALESCE(p_player_count, 0) < 1 THEN
    RAISE EXCEPTION 'Please enter the number of players.';
  END IF;

  IF v_is_staff THEN
    IF p_end_time <= now() THEN
      RAISE EXCEPTION 'That time has already passed.';
    END IF;
  ELSIF p_start_time <= now() THEN
    RAISE EXCEPTION 'That time has already passed. Please pick another time.';
  END IF;

  -- Operating hours 6:00 AM - 2:00 AM (1:00 AM belongs to the previous day)
  v_local_start := p_start_time AT TIME ZONE 'Asia/Manila';
  IF v_local_start::time >= '02:00:00' AND v_local_start::time < '06:00:00' THEN
    RAISE EXCEPTION 'The court is closed between 2:00 AM and 6:00 AM.';
  END IF;
  v_business_date := CASE WHEN v_local_start::time < '06:00:00'
                          THEN v_local_start::date - 1 ELSE v_local_start::date END;
  v_close := (v_business_date::timestamp + interval '26 hours') AT TIME ZONE 'Asia/Manila';
  IF p_end_time > v_close THEN
    RAISE EXCEPTION 'That booking would end after closing time (2:00 AM).';
  END IF;

  -- Bookings open only up to N days ahead
  IF v_business_date > v_today + COALESCE(v_rules.booking_window_days, 30) THEN
    RAISE EXCEPTION 'Bookings are only open up to % days in advance.', COALESCE(v_rules.booking_window_days, 30);
  END IF;

  -- Daytime bookings need at least 2 hours
  v_duration := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600.0;
  IF v_local_start::time >= '06:00:00' AND v_local_start::time < v_rules.night_start_time AND v_duration < 2 THEN
    RAISE EXCEPTION 'Daytime bookings need at least 2 hours.';
  END IF;

  IF COALESCE(p_paddle_count, 0) > v_rules.paddle_stock THEN
    RAISE EXCEPTION 'Only % paddles are available for rent.', v_rules.paddle_stock;
  END IF;
  IF COALESCE(p_ball_count, 0) > v_rules.ball_stock THEN
    RAISE EXCEPTION 'Only % balls are available for rent.', v_rules.ball_stock;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_dates
    WHERE court_id = p_court_id
      AND tstzrange(start_time, end_time) && tstzrange(p_start_time, p_end_time)
  ) THEN
    RAISE EXCEPTION 'The selected time overlaps with a maintenance or blocked period.';
  END IF;

  v_quote := public.calculate_booking_quote(p_start_time, p_end_time, p_player_count, p_paddle_count, p_ball_count);
  v_ref   := public.next_booking_ref();

  INSERT INTO public.bookings (
    reference_number, court_id, customer_id, customer_name, customer_email, customer_phone,
    booking_source, start_time, end_time, duration_hours, player_count,
    paddle_rental_count, ball_rental_count, court_rate_amount, extra_players_amount,
    equipment_rental_amount, total_amount, status, notes, expires_at, created_by_staff_id
  ) VALUES (
    v_ref, p_court_id,
    CASE WHEN v_is_staff THEN NULL ELSE auth.uid() END,
    TRIM(p_customer_name),
    LOWER(TRIM(COALESCE(p_customer_email, ''))),
    TRIM(p_customer_phone),
    p_booking_source, p_start_time, p_end_time,
    (v_quote->>'duration_hours')::numeric,
    p_player_count, COALESCE(p_paddle_count, 0), COALESCE(p_ball_count, 0),
    (v_quote->>'court_rate_amount')::numeric,
    (v_quote->>'extra_players_amount')::numeric,
    (v_quote->>'paddle_rental_amount')::numeric + (v_quote->>'ball_rental_amount')::numeric,
    (v_quote->>'total_amount')::numeric,
    'Pending Payment',
    NULLIF(TRIM(p_notes), ''),
    now() + interval '15 minutes',
    CASE WHEN v_is_staff THEN auth.uid() ELSE NULL END
  ) RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (booking_id, reference_number, amount, payment_method, payment_status, receipt_number)
  VALUES (v_booking_id, v_ref, (v_quote->>'total_amount')::numeric, p_payment_method, 'Pending', 'REC-' || v_ref);

  RETURN jsonb_build_object(
    'booking_id', v_booking_id,
    'reference_number', v_ref,
    'total_amount', (v_quote->>'total_amount')::numeric,
    'expires_at', now() + interval '15 minutes',
    'quote', v_quote
  );
END $$;

GRANT EXECUTE ON FUNCTION public.create_booking_reservation(text, timestamptz, timestamptz, text, text, text, integer, integer, integer, payment_method, booking_source, text) TO anon, authenticated;

COMMIT;