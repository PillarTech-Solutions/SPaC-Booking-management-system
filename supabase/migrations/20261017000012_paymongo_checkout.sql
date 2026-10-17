-- ==============================================================================
-- SPaC Booking Management System — PayMongo checkout
-- Stores the PayMongo checkout session ID on the payment, so the "paymongo"
-- Edge Function can check whether it was paid when the customer returns.
-- ==============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id text;