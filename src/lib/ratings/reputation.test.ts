import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  DEFAULT_RATINGS_CONFIG,
  fetchAllRows,
  getRatingGroupKey,
  mapRatingsConfig,
} from "./reputation";

test("ratings config maps persisted values and preserves the scoped ranking mode", () => {
  assert.deepEqual(mapRatingsConfig(null), DEFAULT_RATINGS_CONFIG);
  assert.deepEqual(
    mapRatingsConfig({
      seller_ratings_enabled: true,
      seller_badge_enabled: false,
      project_badge_enabled: true,
      seller_min_rating: "4.6",
      seller_min_reviews: 7,
      project_min_favorites: 12,
      project_window_days: 14,
      ranking_scope: "city_category",
    }),
    {
      sellerRatingsEnabled: true,
      sellerBadgeEnabled: false,
      projectBadgeEnabled: true,
      sellerMinRating: 4.6,
      sellerMinReviews: 7,
      projectMinFavorites: 12,
      projectWindowDays: 14,
      rankingScope: "city_category",
    }
  );
});

test("ratings config falls back to safe values when database settings are invalid", () => {
  assert.deepEqual(
    mapRatingsConfig({
      seller_ratings_enabled: true,
      seller_badge_enabled: true,
      project_badge_enabled: true,
      seller_min_rating: "invalid",
      seller_min_reviews: 0,
      project_min_favorites: 1.5,
      project_window_days: null,
    }),
    DEFAULT_RATINGS_CONFIG
  );
});

test("seller ranking keys keep local competition separated by the configured scope", () => {
  assert.equal(
    getRatingGroupKey("seller", "city-a", "district-a", "apartment", "district_category"),
    "seller:district-a:apartment"
  );
  assert.equal(
    getRatingGroupKey("seller", "city-a", "district-a", "apartment", "city_category"),
    "seller:city-a:apartment"
  );
  assert.equal(
    getRatingGroupKey("seller", "city-a", "district-a", "apartment", "platform_wide"),
    "seller"
  );
});

test("pagination helper reads every page and surfaces database errors", async () => {
  const allRows = Array.from({ length: 1001 }, (_, index) => index);
  const rows = await fetchAllRows(async (start, end) => ({
    data: allRows.slice(start, end + 1),
    error: null,
  }));
  assert.equal(rows.length, allRows.length);
  assert.equal(rows.at(-1), 1000);

  await assert.rejects(
    () => fetchAllRows(async () => ({ data: null, error: { message: "database unavailable" } })),
    /database unavailable/
  );
});

test("ratings migration establishes server-only access and explicit defaults", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261020231930_ratings_reputation.sql"),
    "utf-8"
  );
  assert.match(migration, /seller_reviews_one_per_inquiry/);
  assert.match(migration, /seller_reviews_one_per_buyer_seller/);
  assert.match(migration, /seller_min_rating NUMERIC\(2, 1\) NOT NULL DEFAULT 4\.5/);
  assert.match(migration, /project_min_favorites INTEGER NOT NULL DEFAULT 10/);
  assert.match(migration, /project_window_days INTEGER NOT NULL DEFAULT 30/);
  assert.match(migration, /ALTER TABLE public\.seller_reviews ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.seller_reviews/);
  assert.match(migration, /TO service_role/);
});
