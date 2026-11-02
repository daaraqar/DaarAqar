-- ==============================================================================
-- Migration: 20261018180000_central_persistence_smart_features_and_auth.sql
-- Description:
--   Non-destructive additive schema for centralizing:
--   1. Smart Features operational records (reverse_requests, inspection_bookings,
--      broker_reviews, investor_portfolios, reservations, neighborhood_guides,
--      smart_features_config).
--   2. Administrative & CMS persistence (official_notices, cms_settings).
--   3. Shared server-side OTP & verification token state (auth_verification_challenges)
--      with expiration and attempt-limit enforcement across serverless instances.
-- ==============================================================================

-- 1. Smart Features Configuration Table
CREATE TABLE IF NOT EXISTS public.smart_features_config (
    id VARCHAR PRIMARY KEY DEFAULT 'default',
    version VARCHAR NOT NULL DEFAULT '2.0.0',
    config_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Reverse Property Requests Table
CREATE TABLE IF NOT EXISTS public.reverse_requests (
    id TEXT PRIMARY KEY,
    user_id UUID,
    seeker_name TEXT NOT NULL,
    seeker_phone TEXT NOT NULL,
    category VARCHAR NOT NULL,
    transaction_type VARCHAR NOT NULL DEFAULT 'sale',
    target_districts JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_budget NUMERIC NOT NULL CHECK (max_budget >= 0),
    min_area_sqm NUMERIC NOT NULL CHECK (min_area_sqm > 0),
    min_bedrooms INT DEFAULT 0,
    payment_method VARCHAR NOT NULL DEFAULT 'cash',
    urgency VARCHAR NOT NULL DEFAULT 'within_month',
    requirements_notes TEXT,
    offers_count INT NOT NULL DEFAULT 0,
    status VARCHAR NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Engineering Inspection Bookings Table
CREATE TABLE IF NOT EXISTS public.inspection_bookings (
    id TEXT PRIMARY KEY,
    user_id UUID,
    property_id TEXT NOT NULL,
    property_title TEXT NOT NULL,
    requester_name TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    inspection_type VARCHAR NOT NULL DEFAULT 'standard',
    total_fee_egp NUMERIC NOT NULL CHECK (total_fee_egp >= 0),
    notes TEXT,
    status VARCHAR NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Broker Reputation Reviews Table
CREATE TABLE IF NOT EXISTS public.broker_reviews (
    id TEXT PRIMARY KEY,
    broker_id TEXT NOT NULL,
    reviewer_id UUID,
    reviewer_name TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    accuracy_score INT NOT NULL DEFAULT 5 CHECK (accuracy_score BETWEEN 1 AND 5),
    response_speed_score INT NOT NULL DEFAULT 5 CHECK (response_speed_score BETWEEN 1 AND 5),
    professionalism_score INT NOT NULL DEFAULT 5 CHECK (professionalism_score BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    verified_Communication BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Investor Portfolios Table
CREATE TABLE IF NOT EXISTS public.investor_portfolios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    property_title TEXT NOT NULL,
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    current_market_estimate NUMERIC NOT NULL CHECK (current_market_estimate >= 0),
    purchase_date TEXT NOT NULL,
    rental_income_monthly NUMERIC NOT NULL DEFAULT 0,
    tenant_name TEXT,
    next_installment_due_date TEXT,
    next_installment_amount NUMERIC,
    installments_remaining_count INT,
    occupancy_status VARCHAR NOT NULL DEFAULT 'vacant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Digital Unit Reservations Table
CREATE TABLE IF NOT EXISTS public.reservations (
    id TEXT PRIMARY KEY,
    reservation_code VARCHAR UNIQUE NOT NULL,
    property_id TEXT NOT NULL,
    property_title TEXT NOT NULL,
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    commitment_amount_egp NUMERIC NOT NULL CHECK (commitment_amount_egp >= 0),
    user_id TEXT,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    national_id_masked TEXT,
    payment_method VARCHAR NOT NULL DEFAULT 'instapay',
    status VARCHAR NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Neighborhood Intelligence & Resident Reviews Table
CREATE TABLE IF NOT EXISTS public.neighborhood_guides (
    id TEXT PRIMARY KEY,
    slug VARCHAR UNIQUE NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    resident_reviews_count INT NOT NULL DEFAULT 0,
    reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Official Notices Table
CREATE TABLE IF NOT EXISTS public.official_notices (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    property_title TEXT,
    recipient_id TEXT NOT NULL,
    recipient_role VARCHAR NOT NULL DEFAULT 'owner',
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role VARCHAR NOT NULL DEFAULT 'admin',
    type VARCHAR NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'unread',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 9. CMS Settings & Pages Table
CREATE TABLE IF NOT EXISTS public.cms_settings (
    key VARCHAR PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Shared Server-Side Auth Verification Challenges (OTP & Verification Tokens)
CREATE TABLE IF NOT EXISTS public.auth_verification_challenges (
    id TEXT PRIMARY KEY,
    challenge_type VARCHAR NOT NULL CHECK (challenge_type IN ('otp', 'verification_token')),
    identifier TEXT NOT NULL,
    secret_hash TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reverse_requests_status ON public.reverse_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_bookings_property ON public.inspection_bookings(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broker_reviews_broker ON public.broker_reviews(broker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_portfolios_user ON public.investor_portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON public.reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_code ON public.reservations(reservation_code);
CREATE INDEX IF NOT EXISTS idx_official_notices_recipient ON public.official_notices(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_identifier ON public.auth_verification_challenges(identifier, challenge_type);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON public.auth_verification_challenges(expires_at);

-- Enable Row Level Security on all tables
ALTER TABLE public.smart_features_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reverse_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_verification_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies using (SELECT auth.uid()) and explicit TO clauses
DROP POLICY IF EXISTS "Public read smart_features_config" ON public.smart_features_config;
CREATE POLICY "Public read smart_features_config"
ON public.smart_features_config FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admin manage smart_features_config" ON public.smart_features_config;
CREATE POLICY "Admin manage smart_features_config"
ON public.smart_features_config FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
);

DROP POLICY IF EXISTS "Public read open reverse_requests" ON public.reverse_requests;
CREATE POLICY "Public read open reverse_requests"
ON public.reverse_requests FOR SELECT
TO anon, authenticated
USING (status = 'open' OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users read own inspection_bookings" ON public.inspection_bookings;
CREATE POLICY "Users read own inspection_bookings"
ON public.inspection_bookings FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
);

DROP POLICY IF EXISTS "Public read broker_reviews" ON public.broker_reviews;
CREATE POLICY "Public read broker_reviews"
ON public.broker_reviews FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users manage own investor_portfolios" ON public.investor_portfolios;
CREATE POLICY "Users manage own investor_portfolios"
ON public.investor_portfolios FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid())::text)
WITH CHECK (user_id = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Users read own reservations" ON public.reservations;
CREATE POLICY "Users read own reservations"
ON public.reservations FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
);

DROP POLICY IF EXISTS "Public read neighborhood_guides" ON public.neighborhood_guides;
CREATE POLICY "Public read neighborhood_guides"
ON public.neighborhood_guides FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Participants read official_notices" ON public.official_notices;
CREATE POLICY "Participants read official_notices"
ON public.official_notices FOR SELECT
TO authenticated
USING (
    recipient_id = (SELECT auth.uid())::text
    OR sender_id = (SELECT auth.uid())::text
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = (SELECT auth.uid())
          AND profiles.role::text IN ('admin', 'superadmin')
    )
);

DROP POLICY IF EXISTS "Public read cms_settings" ON public.cms_settings;
CREATE POLICY "Public read cms_settings"
ON public.cms_settings FOR SELECT
TO anon, authenticated
USING (true);
