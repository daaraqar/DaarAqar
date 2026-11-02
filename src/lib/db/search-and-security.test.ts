import test from "node:test";
import assert from "node:assert/strict";
import { dbStore, haversineDistanceMeters, isPointInBoundingBox } from "./store";
import { Property, User } from "./types";
import { matchesSearchQuery, normalizeSearchText } from "../search/property-search";

test("Smart property search normalizes Arabic and matches all query words across fields", () => {
  assert.equal(normalizeSearchText("إِسْكَنْدَرِيَّة"), "اسكندريه");
  assert.equal(matchesSearchQuery("اسكندريه", ["الإسكندرية"]), true);
  assert.equal(
    matchesSearchQuery("دَقَادُوس شارع بورسعيد", ["عقار للبيع", "شارع بورسعيد", "دقادوس"]),
    true
  );
  assert.equal(matchesSearchQuery("شارع غير موجود", ["شارع بورسعيد، دقادوس"]), false);
});

test("Smart property search finds listings by village and street name", () => {
  const property = dbStore.createProperty({
    title: "اختبار البحث الذكي للعنوان",
    description: "وصف اختبار للبحث",
    transactionType: "sale",
    category: "apartment",
    price: 2500000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 120,
    amenities: [],
    images: [],
    cityId: "city-dakahlia",
    districtId: "dist-daqados",
    addressDetails: "شارع بورسعيد، دقادوس",
    lat: 30.728,
    lng: 31.265,
    locationPrivacy: "exact",
    status: "published",
    featured: false,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
  });

  const result = dbStore.queryProperties({
    searchQuery: "دَقَادُوس شارع بورسعيد",
    limit: 100,
  });

  assert.ok(result.properties.some((item) => item.id === property.id));
});

test("Verification 1 & 2: Published properties appear in search; Draft and pending listings are strictly excluded from public view", () => {
  // Create one draft and one pending property
  const draftProp = dbStore.createProperty({
    title: "Draft Exclusive Apartment",
    description: "Not yet approved",
    transactionType: "sale",
    category: "apartment",
    price: 3000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 140,
    amenities: [],
    images: ["https://example.com/draft.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Draft Address",
    lat: 30.02,
    lng: 31.47,
    locationPrivacy: "exact",
    status: "draft",
    featured: false,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
  });

  const pendingProp = dbStore.createProperty({
    title: "Pending Review Villa",
    description: "Waiting for moderation",
    transactionType: "sale",
    category: "villa",
    price: 9000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 300,
    amenities: [],
    images: ["https://example.com/pending.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Pending Address",
    lat: 30.03,
    lng: 31.48,
    locationPrivacy: "exact",
    status: "pending_review",
    featured: false,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
  });

  // Public search query (no logged-in user / guest)
  const publicResult = dbStore.queryProperties({ limit: 100 }, undefined);

  // Assert draft and pending do NOT appear in public results
  const draftFound = publicResult.properties.find((p) => p.id === draftProp.id);
  const pendingFound = publicResult.properties.find((p) => p.id === pendingProp.id);

  assert.equal(draftFound, undefined, "Draft listings must never be visible to the public");
  assert.equal(pendingFound, undefined, "Pending review listings must never be visible to the public");

  // Every single returned property MUST have status 'published'
  for (const prop of publicResult.properties) {
    assert.equal(prop.status, "published", `Property ${prop.id} must be published`);
  }
});

test("Verification 3: Invalid coordinates are rejected by spatial bounds filter", () => {
  // Test invalid coordinates outside Egypt bounding box
  const invalidLat = 95.0; // out of [-90, 90]
  const invalidLng = 210.0; // out of [-180, 180]

  const bbox = {
    southWest: { lat: 29.8, lng: 30.8 },
    northEast: { lat: 30.3, lng: 31.8 },
  };

  const isInvalidInBbox = isPointInBoundingBox({ lat: invalidLat, lng: invalidLng }, bbox.southWest, bbox.northEast);
  assert.equal(isInvalidInBbox, false, "Invalid coordinates must be excluded from bounding box");
});

test("Verification 4: Approximate-location privacy guarantee (Exact coordinates never leaked)", () => {
  const secretLat = 30.019876;
  const secretLng = 31.487654;

  const testProp = dbStore.createProperty({
    title: "Privacy Sensitive Penthouse",
    description: "Owner requested privacy",
    transactionType: "sale",
    category: "apartment",
    price: 12000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 250,
    amenities: [],
    images: ["https://example.com/p1.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Private Street",
    lat: secretLat,
    lng: secretLng,
    locationPrivacy: "approximate",
    status: "published",
    featured: false,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
  });

  const dummyUsers: User[] = [];
  // Public caller (unauthenticated guest)
  const publicView = dbStore.toPublicProperty(testProp, dummyUsers, undefined);

  assert.equal(publicView.isApproximateLocation, true);
  assert.equal(publicView.privacyRadiusMeters, 50);
  assert.notEqual(publicView.lat, secretLat, "Public caller MUST NOT receive raw exact latitude");
  assert.notEqual(publicView.lng, secretLng, "Public caller MUST NOT receive raw exact longitude");

  // Public coordinates stay within the 50m approximate-location radius.
  const distance = haversineDistanceMeters(secretLat, secretLng, publicView.lat, publicView.lng);
  assert.ok(distance > 0 && distance <= 50, `Blurred distance ${distance}m must be within the 50m privacy radius`);
  assert.ok(distance < 1000, `Blurred distance ${distance}m must remain in local vicinity`);
});

test("Verification 5: Spatial search accurately returns properties within bounding box and radius", () => {
  // New Cairo centroid ~ 30.02, 31.47
  const newCairoBbox = {
    southWest: { lat: 29.95, lng: 31.40 },
    northEast: { lat: 30.10, lng: 31.60 },
  };

  const results = dbStore.queryProperties({
    bounds: newCairoBbox,
    limit: 50,
  });

  assert.ok(results.properties.length > 0, "Should find published properties in New Cairo bounds");
  for (const p of results.properties) {
    assert.ok(
      p.lat >= newCairoBbox.southWest.lat && p.lat <= newCairoBbox.northEast.lat,
      `Property lat ${p.lat} should be inside bounding box`
    );
    assert.ok(
      p.lng >= newCairoBbox.southWest.lng && p.lng <= newCairoBbox.northEast.lng,
      `Property lng ${p.lng} should be inside bounding box`
    );
  }

  // Radius test from Cairo center (15km radius)
  const radiusResults = dbStore.queryProperties({
    radius: { center: { lat: 30.0444, lng: 31.2357 }, radiusKm: 15 },
  });
  for (const p of radiusResults.properties) {
    const dist = haversineDistanceMeters(30.0444, 31.2357, p.lat, p.lng);
    assert.ok(dist <= 15000, `Distance ${dist}m must be within 15km`);
  }
});

test("Verification 6: Missing or invalid property identifiers safely return null", () => {
  const notFound1 = dbStore.getPropertyByIdOrSlug("non-existent-slug-xyz-999");
  assert.equal(notFound1, null, "Unknown slug should return null");

  const notFound2 = dbStore.getPropertyByIdOrSlug("prop-0000000000000");
  assert.equal(notFound2, null, "Unknown ID should return null");
});

test("Verification 7: Unauthorized access to unpublished listing details is forbidden", () => {
  // Create an unpublished draft listing
  const draft = dbStore.createProperty({
    title: "Secret Unapproved Property",
    description: "Should not be readable by public",
    transactionType: "sale",
    category: "apartment",
    price: 4500000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 160,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Secret Address",
    lat: 30.01,
    lng: 31.45,
    locationPrivacy: "exact",
    status: "draft",
    featured: false,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
  });

  // Guest attempts to fetch via getPropertyByIdOrSlug
  const guestFetch = dbStore.getPropertyByIdOrSlug(draft.slug, undefined);
  assert.equal(guestFetch, null, "Unauthenticated guest must NOT be able to view draft property details");

  // Owner attempts to fetch own draft
  const ownerUser: User = {
    id: "usr-owner-01",
    name: "Owner",
    email: "owner@test.com",
    phone: "010",
    role: "owner",
    isVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };
  const ownerFetch = dbStore.getPropertyByIdOrSlug(draft.slug, ownerUser);
  assert.notEqual(ownerFetch, null, "Owner should be allowed to preview their own draft listing");
});
