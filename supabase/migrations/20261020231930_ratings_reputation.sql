-- Verified seller reputation, public ranking thresholds, and audited moderation.
CREATE TABLE IF NOT EXISTS public.seller_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_name TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL CHECK (char_length(comment) BETWEEN 3 AND 1200),
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
    verified_communication BOOLEAN NOT NULL DEFAULT true CHECK (verified_communication),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT seller_reviews_one_per_inquiry UNIQUE (inquiry_id),
    CONSTRAINT seller_reviews_one_per_buyer_seller UNIQUE (reviewer_id, seller_id),
    CONSTRAINT seller_reviews_no_self_rating CHECK (reviewer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS seller_reviews_published_seller_created_idx
    ON public.seller_reviews (seller_id, created_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS seller_reviews_property_published_created_idx
    ON public.seller_reviews (property_id, created_at DESC)
    WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.rating_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.seller_reviews(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT rating_reports_one_per_user UNIQUE (review_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS rating_reports_status_created_idx
    ON public.rating_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ratings_config (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    seller_ratings_enabled BOOLEAN NOT NULL DEFAULT true,
    seller_badge_enabled BOOLEAN NOT NULL DEFAULT true,
    project_badge_enabled BOOLEAN NOT NULL DEFAULT true,
    seller_min_rating NUMERIC(2, 1) NOT NULL DEFAULT 4.5 CHECK (seller_min_rating BETWEEN 1 AND 5),
    seller_min_reviews INTEGER NOT NULL DEFAULT 5 CHECK (seller_min_reviews BETWEEN 1 AND 1000),
    project_min_favorites INTEGER NOT NULL DEFAULT 10 CHECK (project_min_favorites BETWEEN 1 AND 100000),
    project_window_days INTEGER NOT NULL DEFAULT 30 CHECK (project_window_days BETWEEN 1 AND 365),
    ranking_scope TEXT NOT NULL DEFAULT 'district_category'
        CHECK (ranking_scope IN ('district_category', 'city_category', 'platform_wide')),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ratings_config (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rating_badge_overrides (
    subject_type TEXT NOT NULL CHECK (subject_type IN ('seller', 'project')),
    subject_id UUID NOT NULL,
    badge_type TEXT NOT NULL CHECK (badge_type IN ('seller_highly_rated', 'project_trending')),
    enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_type, subject_id, badge_type),
    CHECK (
        (subject_type = 'seller' AND badge_type = 'seller_highly_rated')
        OR (subject_type = 'project' AND badge_type = 'project_trending')
    )
);

ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_badge_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.seller_reviews, public.rating_reports, public.ratings_config, public.rating_badge_overrides
    FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_reviews, public.rating_reports, public.ratings_config, public.rating_badge_overrides
    TO service_role;