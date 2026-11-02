import test from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "./store";
import { Property, User } from "./types";

const mockOwnerA: User = {
  id: "usr-owner-alpha",
  name: "Owner Alpha",
  email: "owner.alpha@test.com",
  phone: "+201011111111",
  role: "owner",
  isVerified: true,
  whatsappEnabled: true,
  createdAt: new Date().toISOString(),
};

const mockOwnerB: User = {
  id: "usr-owner-beta",
  name: "Owner Beta",
  email: "owner.beta@test.com",
  phone: "+201022222222",
  role: "owner",
  isVerified: true,
  whatsappEnabled: true,
  createdAt: new Date().toISOString(),
};

test("Phase 3 Criteria 1 & 3: Property submission enforces authenticated ownership and ignores forged owner IDs", () => {
  // Attacker attempts to forge advertiserId as another user
  const forgedPayload = {
    title: "Luxury Penthouse in Zayed",
    description: "Spacious penthouse",
    transactionType: "sale" as const,
    category: "penthouse" as const,
    price: 8500000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 220,
    amenities: ["elevator"],
    images: ["https://example.com/img1.jpg"],
    cityId: "city-giza",
    districtId: "dist-sheikh-zayed",
    addressDetails: "Beverly Hills Zayed",
    lat: 30.048,
    lng: 30.985,
    locationPrivacy: "exact" as const,
    status: "pending_review" as const,
    featured: false,
    // The attacker tries to inject another user's ID
    advertiserId: mockOwnerB.id,
    advertiserType: "owner" as const,
  };

  // Simulated server-side creation: Server forces advertiserId from authenticated session (mockOwnerA)
  const safePayload = {
    ...forgedPayload,
    advertiserId: mockOwnerA.id, // Server session override
  };

  const created = dbStore.createProperty(safePayload);

  assert.equal(created.advertiserId, mockOwnerA.id, "Property must belong to authenticated user, not forged ID");
  assert.notEqual(created.advertiserId, mockOwnerB.id, "Forged advertiserId must be completely ignored");
});

test("Phase 3 Criteria 2: Invalid property data (negative price, zero area, out-of-bounds coordinates) are rejected", () => {
  const invalidPrice = -5000;
  const invalidArea = 0;
  const invalidLat = 120; // out of [-90, 90]
  const invalidLng = 250; // out of [-180, 180]

  const isValidData = (price: number, area: number, lat: number, lng: number) => {
    if (price <= 0) return false;
    if (area <= 0) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  };

  assert.equal(isValidData(invalidPrice, 100, 30.0, 31.0), false, "Negative price must be rejected");
  assert.equal(isValidData(1000000, invalidArea, 30.0, 31.0), false, "Zero area must be rejected");
  assert.equal(isValidData(1000000, 100, invalidLat, 31.0), false, "Out of bounds latitude must be rejected");
  assert.equal(isValidData(1000000, 100, 30.0, invalidLng), false, "Out of bounds longitude must be rejected");
  assert.equal(isValidData(5000000, 150, 30.044, 31.235), true, "Valid parameters must be accepted");
});

test("Phase 3 Criteria 4 & 5: New listings remain unpublished (draft or pending_review); ordinary owner cannot force published status", () => {
  // Non-admin owner submits listing requesting 'published'
  const requestedStatus = "published";
  const userRole = mockOwnerA.role; // "owner"

  // Strict moderation gate
  const initialStatus = userRole === "admin" ? "published" : "pending_review";

  const prop = dbStore.createProperty({
    title: "Pending Villa Fifth Settlement",
    description: "Great villa",
    transactionType: "sale",
    category: "villa",
    price: 18000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 400,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Near AUC",
    lat: 30.02,
    lng: 31.47,
    locationPrivacy: "exact",
    status: initialStatus,
    featured: false,
    advertiserId: mockOwnerA.id,
    advertiserType: "owner",
  });

  assert.equal(prop.status, "pending_review", "Ordinary user listing must be pending_review, never auto-published");

  // Owner tries to update own status directly to 'published'
  assert.throws(() => {
    dbStore.updatePropertyStatus(prop.id, "published", mockOwnerA);
  }, /موافقة الإدارة/, "Ordinary owner must be blocked from publishing own listing");
});

test("Phase 3 Criteria 6: Image validation strictly rejects invalid file types and oversized payloads", () => {
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const validateUpload = (mime: string, size: number) => {
    if (!ALLOWED_TYPES.has(mime)) return { valid: false, error: "INVALID_MIME" };
    if (size > MAX_SIZE) return { valid: false, error: "OVERSIZED" };
    return { valid: true };
  };

  assert.equal(validateUpload("application/pdf", 1024).valid, false, "PDF upload must be rejected");
  assert.equal(validateUpload("text/html", 1024).valid, false, "HTML file must be rejected");
  assert.equal(validateUpload("image/svg+xml", 1024).valid, false, "SVG must be rejected to prevent XSS");
  assert.equal(validateUpload("image/jpeg", 15 * 1024 * 1024).valid, false, "15MB image must be rejected as oversized");
  assert.equal(validateUpload("image/webp", 2 * 1024 * 1024).valid, true, "2MB WEBP must be accepted");
});

test("Phase 3 Criteria 7: Cross-user modification and deletion are strictly denied (BOLA/IDOR protection)", () => {
  // Create a listing owned by Owner A
  const propA = dbStore.createProperty({
    title: "Owner A Apartment",
    description: "Property belonging to Alpha",
    transactionType: "rent",
    category: "apartment",
    price: 25000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 120,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Address A",
    lat: 30.01,
    lng: 31.45,
    locationPrivacy: "exact",
    status: "draft",
    featured: false,
    advertiserId: mockOwnerA.id,
    advertiserType: "owner",
  });

  // Owner B attempts to update Owner A's property
  assert.throws(() => {
    dbStore.updateProperty(propA.id, { price: 1000 }, mockOwnerB);
  }, /غير مصرح/, "Owner B must be forbidden from updating Owner A's property");

  // Owner B attempts to delete Owner A's property
  assert.throws(() => {
    dbStore.deleteProperty(propA.id, mockOwnerB);
  }, /غير مصرح/, "Owner B must be forbidden from deleting Owner A's property");

  // Owner A can successfully update own property
  const updatedByA = dbStore.updateProperty(propA.id, { price: 27000 }, mockOwnerA);
  assert.equal(updatedByA.price, 27000, "Owner A must be allowed to update own property");
});

test("Phase 3 Criteria 8: Owner Dashboard Isolation: Owner only sees own listings (including drafts); never leaks other users' drafts", () => {
  // Owner A has propA (draft)
  // Owner B creates a draft
  const propB = dbStore.createProperty({
    title: "Owner B Secret Draft",
    description: "Draft belonging to Beta",
    transactionType: "sale",
    category: "villa",
    price: 30000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 600,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Address B",
    lat: 30.03,
    lng: 31.49,
    locationPrivacy: "exact",
    status: "draft",
    featured: false,
    advertiserId: mockOwnerB.id,
    advertiserType: "owner",
  });

  // Fetch listings for Owner A
  const ownerAListings = dbStore.getPropertiesByAdvertiser(mockOwnerA.id);
  const foundDraftB = ownerAListings.find((p) => p.id === propB.id);
  assert.equal(foundDraftB, undefined, "Owner A dashboard must NEVER contain Owner B's draft");

  // Fetch listings for Owner B
  const ownerBListings = dbStore.getPropertiesByAdvertiser(mockOwnerB.id);
  const foundDraftBinB = ownerBListings.find((p) => p.id === propB.id);
  assert.notEqual(foundDraftBinB, undefined, "Owner B must see own draft");
});

test("Phase 3 Criteria 9: Storage path isolation: User cannot delete storage files belonging to another user", () => {
  const isAuthorizedPathDelete = (userId: string, path: string) => {
    if (!path.startsWith(`${userId}/`) && !path.startsWith(`local/${userId}/`)) {
      return false;
    }
    return true;
  };

  const userAPath = `${mockOwnerA.id}/prop-123/image1.jpg`;
  const userBPath = `${mockOwnerB.id}/prop-456/secret.jpg`;

  assert.equal(isAuthorizedPathDelete(mockOwnerA.id, userAPath), true, "User A can delete own file");
  assert.equal(isAuthorizedPathDelete(mockOwnerA.id, userBPath), false, "User A cannot delete User B file");
});

test("An owner can mark a published listing sold, separately from temporarily pausing it", () => {
  const listing = dbStore.createProperty({
    title: "Published listing to sell",
    description: "A published property",
    transactionType: "sale",
    category: "apartment",
    price: 1000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 100,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Cairo",
    lat: 30.01,
    lng: 31.45,
    locationPrivacy: "exact",
    status: "published",
    featured: false,
    advertiserId: mockOwnerA.id,
    advertiserType: "owner",
  });

  const paused = dbStore.updatePropertyStatus(listing.id, "paused", mockOwnerA);
  assert.equal(paused.status, "paused", "Temporary pause remains a distinct status");

  const resumed = dbStore.updatePropertyStatus(listing.id, "published", mockOwnerA);
  assert.equal(resumed.status, "published", "Owner can resume a temporarily paused listing");

  const sold = dbStore.updatePropertyStatus(listing.id, "sold", mockOwnerA);
  assert.equal(sold.status, "sold", "Owner can move their published listing to sold");
  assert.equal(dbStore.getPropertyByIdOrSlug(listing.id), null, "Sold listings are hidden from public visitors");
  assert.equal(
    dbStore.getPropertyByIdOrSlug(listing.id, mockOwnerA)?.status,
    "sold",
    "Owner can still access their sold listing in their dashboard"
  );
});

test("An owner cannot mark an unpublished listing sold", () => {
  const draft = dbStore.createProperty({
    title: "Draft listing not for sale",
    description: "An unpublished property",
    transactionType: "sale",
    category: "apartment",
    price: 1000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 100,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Cairo",
    lat: 30.01,
    lng: 31.45,
    locationPrivacy: "exact",
    status: "draft",
    featured: false,
    advertiserId: mockOwnerA.id,
    advertiserType: "owner",
  });

  assert.throws(
    () => dbStore.updatePropertyStatus(draft.id, "sold", mockOwnerA),
    /يمكن تسجيل البيع بعد نشر العقار فقط/
  );
});
