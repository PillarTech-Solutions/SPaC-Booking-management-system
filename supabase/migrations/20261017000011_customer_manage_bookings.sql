-- ==============================================================================
-- SPaC Booking Management System — Customers manage their own bookings
--
--  1. Records WHO cancelled a booking, WHEN and WHY (cancelled_by / cancelled_at /
--     cancellation_reason). Filled automatically.
--  2. customer_cancel_booking: a logged-in customer cancels their OWN booking,
--     only if it's at least 24 hours away (policy). Payment stays (non-refundable).
--  3. customer_reschedule_booking: a logged-in customer moves their OWN booking,
--     at least 24 hours before (policy), subject to availability. Same duration,
--     same price. Also allowed for bookings the COURT cancelled (e.g. rain), so the
--     customer can rebook for free — these show under "Needs Your Attention".
-- ==============================================================================

BEGIN;

-- 1. Cancellation details -------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.track_booking_cancellation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Cancelled' AND OLD.status IS DISTINCT FROM 'Cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    IF OLD.status = 'Pending Payment' THEN
      -- unpaid checkout that expired: nobody cancelled it
      NEW.cancelled_by := NULL;
      NEW.cancellation_reason := COALESCE(NEW.cancellation_reason, 'Payment hold expired');
    ELSE
      NEW.cancelled_by := COALESCE(NEW.cancelled_by, auth.uid());
    END IF;
  ELSIF OLD.status = 'Cancelled' AND NEW.status IS DISTINCT FROM 'Cancelled' THEN
    -- rebooked / rescheduled: clear the old cancellation
    NEW.cancelled_at := NULL;
    NEW.cancelled_by := NULL;
    NEW.cancellation_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_track_booking_cancellation ON public.bookings;
CREATE TRIGGER trg_track_booking_cancellation
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.track_booking_cancellation();

-- 2. Customer cancels their own booking ----------------------------------------
CREATE OR REPLACE FUNCTION public.customer_cancel_booking(
  p_booking_id uuid,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_b      public.bookings%ROWTYPE;
  v_cutoff integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please log in to manage your bookings.';
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  IF v_b.status NOT IN ('Reserved', 'Confirmed') THEN
    RAISE EXCEPTION 'Only reserved bookings can be cancelled.';
  END IF;

  SELECT COALESCE(cancellation_cutoff_hours, 24) INTO v_cutoff FROM public.pricing_rules WHERE id = 'DEFAULT';
  IF v_b.start_time - now() < make_interval(hours => COALESCE(v_cutoff, 24)) THEN
    RAISE EXCEPTION 'Cancellations must be made at least % hours before your schedule.', COALESCE(v_cutoff, 24);
  END IF;

  UPDATE public.bookings
     SET status = 'Cancelled',
         cancelled_by = v_uid,
         cancellation_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Cancelled by customer'),
         expires_at = NULL,
         notes = concat_ws(' | ', notes,
                   'Cancelled by customer' || COALESCE(': ' || NULLIF(TRIM(p_reason), ''), '')
                   || COALESCE(' — ' || NULLIF(TRIM(p_notes), ''), ''))
   WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'Cancelled');
END $$;

-- 3. Customer reschedules their own booking ------------------------------------
CREATE OR REPLACE FUNCTION public.customer_reschedule_booking(
  p_booking_id uuid,
  p_start_time timestamptz,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_b             public.bookings%ROWTYPE;
  v_rules         public.pricing_rules%ROWTYPE;
  v_court_cancel  boolean;
  v_length        interval;
  v_end           timestamptz;
  v_hours         numeric;
  v_local_start   timestamp;
  v_business_date date;
  v_today         date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_close         timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please log in to manage your bookings.';
  END IF;

  SELECT * INTO v_rules FROM public.pricing_rules WHERE id = 'DEFAULT';

  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  -- Cancelled by the court (e.g. rain, maintenance) -> customer may rebook for free
  v_court_cancel := v_b.status = 'Cancelled'
    AND v_b.cancelled_by IS NOT NULL
    AND v_b.cancelled_by IS DISTINCT FROM v_b.customer_id
    AND COALESCE(v_b.cancellation_reason, '') NOT IN
        ('Customer requested cancellation', 'Duplicate booking', 'Payment hold expired');

  IF v_b.status IN ('Reserved', 'Confirmed') THEN
    IF v_b.start_time - now() < make_interval(hours => COALESCE(v_rules.cancellation_cutoff_hours, 24)) THEN
      RAISE EXCEPTION 'Bookings can only be rescheduled at least % hours before the schedule.',
        COALESCE(v_rules.cancellation_cutoff_hours, 24);
    END IF;
  ELSIF NOT v_court_cancel THEN
    RAISE EXCEPTION 'This booking can no longer be rescheduled.';
  END IF;

  -- Same duration as the original booking
  v_length := v_b.end_time - v_b.start_time;
  v_end    := p_start_time + v_length;
  v_hours  := EXTRACT(EPOCH FROM v_length) / 3600.0;

  IF p_start_time <= now() THEN
    RAISE EXCEPTION 'That time has already passed. Please pick another time.';
  END IF;

  v_local_start := p_start_time AT TIME ZONE 'Asia/Manila';
  IF v_local_start::time >= '02:00:00' AND v_local_start::time < '06:00:00' THEN
    RAISE EXCEPTION 'The court is closed between 2:00 AM and 6:00 AM.';
  END IF;
  v_business_date := CASE WHEN v_local_start::time < '06:00:00'
                          THEN v_local_start::date - 1 ELSE v_local_start::date END;
  v_close := (v_business_date::timestamp + interval '26 hours') AT TIME ZONE 'Asia/Manila';
  IF v_end > v_close THEN
    RAISE EXCEPTION 'That booking would end after closing time (2:00 AM).';
  END IF;

  IF v_business_date > v_today + COALESCE(v_rules.booking_window_days, 30) THEN
    RAISE EXCEPTION 'Bookings are only open up to % days in advance.', COALESCE(v_rules.booking_window_days, 30);
  END IF;

  IF v_local_start::time >= '06:00:00' AND v_local_start::time < v_rules.night_start_time AND v_hours < 2 THEN
    RAISE EXCEPTION 'A % hour booking can only move to a nighttime start (4:00 PM onwards). Daytime needs at least 2 hours.',
      v_hours::integer;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_dates
     WHERE court_id = v_b.court_id
       AND tstzrange(start_time, end_time) && tstzrange(p_start_time, v_end)
  ) THEN
    RAISE EXCEPTION 'The selected time overlaps with a maintenance or blocked period.';
  END IF;

  -- If the new time is taken, the no-overlap rule raises error 23P01 ("slot already booked")
  UPDATE public.bookings
     SET start_time = p_start_time,
         end_time   = v_end,
         status     = 'Reserved',
         notes = concat_ws(' | ', notes,
                   'Rescheduled by customer' || COALESCE(': ' || NULLIF(TRIM(p_reason), ''), '')
                   || COALESCE(' — ' || NULLIF(TRIM(p_notes), ''), ''))
   WHERE id = p_booking_id;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'start_time', p_start_time, 'end_time', v_end);
END $$;

REVOKE ALL ON FUNCTION public.customer_cancel_booking(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_cancel_booking(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.customer_reschedule_booking(uuid, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_reschedule_booking(uuid, timestamptz, text, text) TO authenticated;

COMMIT;