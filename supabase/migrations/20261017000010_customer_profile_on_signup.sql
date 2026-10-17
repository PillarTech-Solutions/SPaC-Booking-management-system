-- ==============================================================================
-- SPaC Booking Management System — Create customer profile on sign-up
--
-- When email verification is ON, the app can't save the customer's profile
-- (no session yet). This trigger saves it from the sign-up form details instead.
-- Only for customer sign-ups (account_type = 'customer'); staff accounts made by
-- the create-staff-account function are not affected.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_customer_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'account_type', '') = 'customer' THEN
    INSERT INTO public.customer_profiles (id, full_name, contact_number, email)
    VALUES (
      NEW.id,
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'contact_number'), ''),
      LOWER(NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_customer_profile ON auth.users;
CREATE TRIGGER trg_create_customer_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer_signup();

-- Fix accounts that already signed up before this trigger existed
-- (customer sign-ups have contact_number in their sign-up details; staff don't)
INSERT INTO public.customer_profiles (id, full_name, contact_number, email)
SELECT u.id,
       NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
       NULLIF(TRIM(u.raw_user_meta_data->>'contact_number'), ''),
       LOWER(u.email)
  FROM auth.users u
 WHERE u.raw_user_meta_data ? 'contact_number'
   AND NOT EXISTS (SELECT 1 FROM public.staff_profiles s WHERE s.id = u.id)
   AND NOT EXISTS (SELECT 1 FROM public.customer_profiles c WHERE c.id = u.id);