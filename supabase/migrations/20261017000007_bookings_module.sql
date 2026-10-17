-- ==============================================================================
-- SPaC Booking Management System — Bookings Module (for the CURRENT Supabase project)
--
-- Replaces ONLY the old booking tables with the new booking design.
-- Does NOT touch: profiles, staff_profiles, customer_profiles, site_settings,
-- gallery_images, or any auth/login data.
--
-- Safety:
--  * Runs as ONE transaction: if anything fails, NOTHING is changed.
--  * Stops immediately if the old bookings or payments tables contain data.
--
-- Moves to backup schema "backup_20261017" (not deleted): bookings, payments,
--   booking_history, notifications, courts, daily_report view
-- Creates: courts, pricing_rules, blocked_dates, bookings, payments, audit_logs,
--          booking functions, security policies, and a new daily_report view
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. SAFETY CHECK: never delete real data
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings) THEN
    RAISE EXCEPTION 'STOPPED: public.bookings has data. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments) THEN
    RAISE EXCEPTION 'STOPPED: public.payments has data. Nothing was changed.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. BACK UP OLD BOOKING OBJECTS (moved, not deleted)
-- They go into the "backup_20261017" schema with their structure, keys and rules.
-- The app can't see them there. To restore one later, e.g.:
--   ALTER TABLE backup_20261017.bookings SET SCHEMA public;
-- To delete the backup once everyone is happy:
--   DROP SCHEMA backup_20261017 CASCADE;
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS backup_20261017;
REVOKE ALL ON SCHEMA backup_20261017 FROM anon, authenticated;

ALTER VIEW  IF EXISTS public.daily_report    SET SCHEMA backup_20261017;
ALTER TABLE IF EXISTS public.notifications   SET SCHEMA backup_20261017;
ALTER TABLE IF EXISTS public.booking_history SET SCHEMA backup_20261017;
ALTER TABLE IF EXISTS public.payments        SET SCHEMA backup_20261017;
ALTER TABLE IF EXISTS public.bookings        SET SCHEMA backup_20261017;
ALTER TABLE IF EXISTS public.courts          SET SCHEMA backup_20261017;

-- ------------------------------------------------------------------------------
-- 2. EXTENSIONS & TYPES
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM
    ('Pending Payment', 'Reserved', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('GCash', 'Maya', 'QR Ph', 'Cash', 'Bank Transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_source AS ENUM ('Online / App', 'Walk-in', 'Phone', 'Social Media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_category AS ENUM ('Booking', 'Payment', 'Account', 'Settings');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 3. STAFF CHECK (reads the existing staff_profiles table)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE id = auth.uid() AND COALESCE(status, 'Active') = 'Active'
  );
$$;

-- ------------------------------------------------------------------------------
-- 4. TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE public.courts (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id                        text PRIMARY KEY DEFAULT 'DEFAULT',
  day_rate_hourly           numeric(10,2) NOT NULL DEFAULT 200.00,
  night_rate_hourly         numeric(10,2) NOT NULL DEFAULT 300.00,
  night_start_time          time NOT NULL DEFAULT '18:00:00',
  base_players              integer NOT NULL DEFAULT 4,
  extra_player_rate         numeric(10,2) NOT NULL DEFAULT 100.00,
  paddle_rental_rate        numeric(10,2) NOT NULL DEFAULT 100.00,
  paddle_stock              integer NOT NULL DEFAULT 16,
  ball_rental_rate          numeric(10,2) NOT NULL DEFAULT 50.00,
  ball_stock                integer NOT NULL DEFAULT 10,
  cancellation_cutoff_hours integer NOT NULL DEFAULT 24,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id   text NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time   timestamptz NOT NULL,
  reason     text NOT NULL DEFAULT 'Maintenance',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_blocked_time_range CHECK (end_time > start_time)
);

CREATE TABLE public.bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number        text UNIQUE NOT NULL,
  court_id                text NOT NULL REFERENCES public.courts(id) ON DELETE RESTRICT,
  customer_id             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name           text NOT NULL,
  customer_email          text NOT NULL DEFAULT '',
  customer_phone          text NOT NULL,
  booking_source          booking_source NOT NULL DEFAULT 'Online / App',
  start_time              timestamptz NOT NULL,
  end_time                timestamptz NOT NULL,
  duration_hours          numeric(4,2) NOT NULL,
  player_count            integer NOT NULL DEFAULT 4,
  paddle_rental_count     integer NOT NULL DEFAULT 0,
  ball_rental_count       integer NOT NULL DEFAULT 0,
  court_rate_amount       numeric(10,2) NOT NULL,
  extra_players_amount    numeric(10,2) NOT NULL DEFAULT 0,
  equipment_rental_amount numeric(10,2) NOT NULL DEFAULT 0,
  total_amount            numeric(10,2) NOT NULL,
  status                  booking_status NOT NULL DEFAULT 'Pending Payment',
  notes                   text,
  expires_at              timestamptz,
  created_by_staff_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_time_range CHECK (end_time > start_time),
  CONSTRAINT valid_counts CHECK (player_count >= 1 AND paddle_rental_count >= 0 AND ball_rental_count >= 0),
  -- THE KEY RULE: no two active bookings can overlap on the same court
  CONSTRAINT no_overlapping_active_bookings EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status IN ('Pending Payment', 'Reserved', 'Confirmed', 'In Progress', 'Completed'))
);

CREATE INDEX idx_bookings_time_range ON public.bookings (court_id, start_time, end_time);
CREATE INDEX idx_bookings_status     ON public.bookings (status);
CREATE INDEX idx_bookings_customer   ON public.bookings (customer_id);

CREATE TABLE public.payments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reference_number     text NOT NULL,
  amount               numeric(10,2) NOT NULL,
  payment_method       payment_method NOT NULL,
  payment_status       payment_status NOT NULL DEFAULT 'Pending',
  paymongo_payment_id  text,
  paymongo_intent_id   text,
  paid_at              timestamptz,
  verified_by_staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  receipt_number       text UNIQUE,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_booking_id ON public.payments (booking_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id            text UNIQUE NOT NULL,
  category          log_category NOT NULL,
  activity          text NOT NULL,
  action            text NOT NULL,
  entity_table      text,
  entity_id         text,
  performed_by_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text NOT NULL DEFAULT 'System',
  details           jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. SEQUENCES & HELPERS
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.seq_booking_ref START WITH 1001;
CREATE SEQUENCE IF NOT EXISTS public.seq_log_id START WITH 2001;

CREATE OR REPLACE FUNCTION public.next_booking_ref() RETURNS text
LANGUAGE sql AS $$ SELECT 'CR-' || nextval('public.seq_booking_ref')::text $$;

CREATE OR REPLACE FUNCTION public.next_log_id() RETURNS text
LANGUAGE sql AS $$ SELECT 'LOG-' || nextval('public.seq_log_id')::text $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_courts_updated_at   BEFORE UPDATE ON public.courts        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_pricing_updated_at ON public.pricing_rules;
CREATE TRIGGER trg_pricing_updated_at  BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOG (automatic history of booking + payment changes)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_booking_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category log_category;
  v_action   text;
  v_activity text;
  v_details  jsonb;
  v_user_id  uuid := auth.uid();
  v_user     text;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    v_category := 'Booking';
    IF TG_OP = 'INSERT' THEN
      v_action   := 'Created reservation ' || NEW.reference_number;
      v_activity := 'Created reservation ' || NEW.reference_number || ' for ' || NEW.customer_name;
      v_details  := jsonb_build_object('status', NEW.status, 'start_time', NEW.start_time, 'amount', NEW.total_amount);
    ELSE
      v_action := 'Updated reservation ' || NEW.reference_number;
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_activity := 'Changed reservation ' || NEW.reference_number || ' from ' || OLD.status || ' to ' || NEW.status;
      ELSIF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
        v_activity := 'Rescheduled reservation ' || NEW.reference_number;
      ELSE
        v_activity := 'Updated reservation ' || NEW.reference_number;
      END IF;
      v_details := jsonb_build_object(
        'old_status', OLD.status, 'new_status', NEW.status,
        'old_start', OLD.start_time, 'new_start', NEW.start_time
      );
    END IF;
  ELSE
    v_category := 'Payment';
    IF TG_OP = 'INSERT' THEN
      v_action   := 'Initiated payment for ' || NEW.reference_number;
      v_activity := 'Initiated ' || NEW.payment_method || ' payment of ₱' || NEW.amount;
    ELSE
      v_action   := 'Updated payment for ' || NEW.reference_number;
      v_activity := 'Payment status ' || NEW.payment_status || ' for ' || NEW.reference_number;
    END IF;
    v_details := jsonb_build_object('status', NEW.payment_status, 'method', NEW.payment_method);
  END IF;

  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_user FROM public.staff_profiles WHERE id = v_user_id;
    IF v_user IS NULL THEN
      SELECT email INTO v_user FROM auth.users WHERE id = v_user_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs
    (log_id, category, activity, action, entity_table, entity_id, performed_by_id, performed_by_name, details)
  VALUES
    (public.next_log_id(), v_category, v_activity, v_action, TG_TABLE_NAME, NEW.reference_number,
     v_user_id, COALESCE(v_user, 'System'), v_details);

  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_bookings AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_booking_audit_log();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_booking_audit_log();

-- ------------------------------------------------------------------------------
-- 7. RELEASE EXPIRED PAYMENT HOLDS (abandoned checkouts free the slot)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_holds()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  UPDATE public.payments p
     SET payment_status = 'Cancelled'
    FROM public.bookings b
   WHERE p.booking_id = b.id
     AND b.status = 'Pending Payment'
     AND b.expires_at IS NOT NULL
     AND b.expires_at < now()
     AND p.payment_status = 'Pending';

  UPDATE public.bookings
     SET status = 'Cancelled',
         notes = concat_ws(' | ', notes, 'Payment hold expired'),
         expires_at = NULL
   WHERE status = 'Pending Payment'
     AND expires_at IS NOT NULL
     AND expires_at < now();

  RETURN NULL;
END $$;

CREATE TRIGGER trg_release_expired_holds
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH STATEMENT EXECUTE FUNCTION public.release_expired_holds();

-- ------------------------------------------------------------------------------
-- 8. PRICING QUOTE (each hour priced by its band; capacity 4 / 8 / 12)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_booking_quote(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_player_count integer,
  p_paddle_count integer,
  p_ball_count integer
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules        public.pricing_rules%ROWTYPE;
  v_curr         timestamptz;
  v_next         timestamptz;
  v_local        time;
  v_day_hours    numeric := 0;
  v_night_hours  numeric := 0;
  v_duration     numeric;
  v_court_rate   numeric;
  v_capacity     integer;
  v_extra        integer;
  v_extra_cost   numeric;
  v_paddles_cost numeric;
  v_balls_cost   numeric;
BEGIN
  SELECT * INTO v_rules FROM public.pricing_rules WHERE id = 'DEFAULT';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing rules not configured.';
  END IF;

  v_duration := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) / 3600.0;
  IF v_duration <= 0 OR v_duration > 20 THEN
    RAISE EXCEPTION 'Invalid booking duration.';
  END IF;

  v_curr := p_start_time;
  WHILE v_curr < p_end_time LOOP
    v_next  := LEAST(v_curr + interval '1 hour', p_end_time);
    v_local := (v_curr AT TIME ZONE 'Asia/Manila')::time;
    IF v_local >= '06:00:00' AND v_local < v_rules.night_start_time THEN
      v_day_hours := v_day_hours + EXTRACT(EPOCH FROM (v_next - v_curr)) / 3600.0;
    ELSE
      v_night_hours := v_night_hours + EXTRACT(EPOCH FROM (v_next - v_curr)) / 3600.0;
    END IF;
    v_curr := v_next;
  END LOOP;

  v_court_rate   := v_day_hours * v_rules.day_rate_hourly + v_night_hours * v_rules.night_rate_hourly;
  v_capacity     := v_rules.base_players * LEAST(GREATEST(CEIL(v_duration)::integer, 1), 3);
  v_extra        := GREATEST(0, COALESCE(p_player_count, 1) - v_capacity);
  v_extra_cost   := v_extra * v_rules.extra_player_rate;
  v_paddles_cost := GREATEST(0, COALESCE(p_paddle_count, 0)) * v_rules.paddle_rental_rate;
  v_balls_cost   := GREATEST(0, COALESCE(p_ball_count, 0)) * v_rules.ball_rental_rate;

  RETURN jsonb_build_object(
    'duration_hours', v_duration,
    'day_hours', v_day_hours,
    'night_hours', v_night_hours,
    'court_rate_amount', v_court_rate,
    'player_capacity', v_capacity,
    'extra_players_count', v_extra,
    'extra_players_amount', v_extra_cost,
    'paddle_rental_amount', v_paddles_cost,
    'ball_rental_amount', v_balls_cost,
    'total_amount', v_court_rate + v_extra_cost + v_paddles_cost + v_balls_cost
  );
END $$;

-- ------------------------------------------------------------------------------
-- 9. CREATE BOOKING (online checkout; also used by staff bookings)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 10. STAFF WALK-IN / PHONE BOOKING (paid in person -> Reserved + Paid)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_booking(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_player_count integer,
  p_paddle_count integer,
  p_ball_count integer,
  p_payment_method payment_method,
  p_booking_source booking_source,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res jsonb;
  v_id  uuid;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Only staff can add bookings from the admin portal.';
  END IF;

  v_res := public.create_booking_reservation(
    'COURT-1', p_start_time, p_end_time, p_customer_name, p_customer_email, p_customer_phone,
    p_player_count, p_paddle_count, p_ball_count, p_payment_method, p_booking_source, p_notes
  );
  v_id := (v_res->>'booking_id')::uuid;

  UPDATE public.bookings SET status = 'Reserved', expires_at = NULL WHERE id = v_id;
  UPDATE public.payments
     SET payment_status = 'Paid', paid_at = now(), verified_by_staff_id = auth.uid()
   WHERE booking_id = v_id;

  RETURN v_res;
END $$;

-- ------------------------------------------------------------------------------
-- 11. PUBLIC AVAILABILITY (times only, no personal details)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.start_time, b.end_time
    FROM public.bookings b
   WHERE b.court_id = 'COURT-1'
     AND b.start_time < p_to
     AND b.end_time > p_from
     AND (
       b.status IN ('Reserved', 'Confirmed', 'In Progress', 'Completed')
       OR (b.status = 'Pending Payment' AND (b.expires_at IS NULL OR b.expires_at > now()))
     )
  UNION ALL
  SELECT d.start_time, d.end_time
    FROM public.blocked_dates d
   WHERE d.court_id = 'COURT-1'
     AND d.start_time < p_to
     AND d.end_time > p_from;
$$;

-- ------------------------------------------------------------------------------
-- 12. GUEST LOOKUP (reference number + email or phone, both required)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lookup_guest_booking(p_reference_number text, p_contact text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_digits  text;
BEGIN
  IF p_contact IS NULL OR TRIM(p_contact) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_booking FROM public.bookings
   WHERE UPPER(reference_number) = UPPER(TRIM(p_reference_number))
     AND status <> 'Pending Payment'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_contact, '\D', '', 'g');
  IF LOWER(v_booking.customer_email) <> LOWER(TRIM(p_contact))
     AND NOT (length(v_digits) >= 7 AND regexp_replace(v_booking.customer_phone, '\D', '', 'g') = v_digits) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_payment FROM public.payments
   WHERE booking_id = v_booking.id
   ORDER BY (payment_status = 'Paid') DESC, created_at DESC
   LIMIT 1;

  RETURN to_jsonb(v_booking) - 'customer_id' - 'created_by_staff_id'
         || jsonb_build_object(
              'payment_method', v_payment.payment_method,
              'payment_status', v_payment.payment_status,
              'paid_at', v_payment.paid_at,
              'receipt_number', v_payment.receipt_number
            );
END $$;

-- ------------------------------------------------------------------------------
-- 13. DAILY REPORT VIEW (same columns as the old one, for the Reports page)
-- ------------------------------------------------------------------------------
CREATE VIEW public.daily_report WITH (security_invoker = true) AS
SELECT (b.start_time AT TIME ZONE 'Asia/Manila')::date AS booking_date,
       count(DISTINCT b.id)                            AS total_bookings,
       COALESCE(sum(p.amount) FILTER (WHERE p.payment_status = 'Paid'), 0) AS total_revenue,
       sum(b.paddle_rental_count)                      AS total_paddles_requested
  FROM public.bookings b
  LEFT JOIN public.payments p ON p.booking_id = b.id
 WHERE b.status IN ('Reserved', 'Confirmed', 'In Progress', 'Completed')
 GROUP BY 1;

-- ------------------------------------------------------------------------------
-- 14. SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.courts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courts are public" ON public.courts FOR SELECT USING (true);
CREATE POLICY "Staff manage courts" ON public.courts FOR ALL
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "Pricing is public" ON public.pricing_rules;
DROP POLICY IF EXISTS "Staff manage pricing" ON public.pricing_rules;
CREATE POLICY "Pricing is public" ON public.pricing_rules FOR SELECT USING (true);
CREATE POLICY "Staff manage pricing" ON public.pricing_rules FOR ALL
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "Blocked dates are public" ON public.blocked_dates;
DROP POLICY IF EXISTS "Staff manage blocked dates" ON public.blocked_dates;
CREATE POLICY "Blocked dates are public" ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "Staff manage blocked dates" ON public.blocked_dates FOR ALL
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

CREATE POLICY "Staff view bookings" ON public.bookings FOR SELECT USING (public.is_active_staff());
CREATE POLICY "Customers view own bookings" ON public.bookings FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Staff update bookings" ON public.bookings FOR UPDATE
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
-- New bookings are created only through create_booking_reservation / create_staff_booking

CREATE POLICY "Staff view payments" ON public.payments FOR SELECT USING (public.is_active_staff());
CREATE POLICY "Customers view own payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
);
CREATE POLICY "Staff update payments" ON public.payments FOR UPDATE
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

DROP POLICY IF EXISTS "Staff view audit logs" ON public.audit_logs;
CREATE POLICY "Staff view audit logs" ON public.audit_logs FOR SELECT USING (public.is_active_staff());
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;

-- Function access
REVOKE ALL ON FUNCTION public.create_staff_booking(timestamptz, timestamptz, text, text, text, integer, integer, integer, payment_method, booking_source, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_booking(timestamptz, timestamptz, text, text, text, integer, integer, integer, payment_method, booking_source, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_reservation(text, timestamptz, timestamptz, text, text, text, integer, integer, integer, payment_method, booking_source, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_guest_booking(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_booking_quote(timestamptz, timestamptz, integer, integer, integer) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 15. DEFAULT DATA
-- ------------------------------------------------------------------------------
INSERT INTO public.courts (id, name, description, is_active)
VALUES ('COURT-1', 'Saranay Pickleball Court', 'Main court', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pricing_rules (id) VALUES ('DEFAULT')
ON CONFLICT (id) DO NOTHING;

COMMIT;