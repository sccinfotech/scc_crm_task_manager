-- Migration 030: Client GST + Billing State
-- Adds optional gst_number and billing_state_code to clients.
-- Depends on: 003_client_management

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gst_number TEXT NULL;

-- Two-letter state code (e.g. 'GJ', 'MH'). Used to derive GST type (intra vs inter-state).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_state_code TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_gst_number ON public.clients(gst_number) WHERE gst_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_billing_state_code ON public.clients(billing_state_code) WHERE billing_state_code IS NOT NULL;

