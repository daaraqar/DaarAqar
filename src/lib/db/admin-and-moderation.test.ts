import test from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "./store";
import { User, Property, PropertyStatus } from "./types";

const mockAdminUser: User = {
  id: "usr-admin-secops",
  name: "Platform SuperAdmin",
  email: "admin.secops@aqarpulse.eg",
  phone: "+201000000001",
  role: "admin",
  isVerified: true,
  whatsappEnabled: false,
  createdAt: new Date().toISOString(),
};

const mockAdvertiserOwner: User = {
  id: "usr-adv-owner-99",
  name: "Tarek Mansour",
  email: "tarek.owner99@test.com",
  phone: "+201099999999",
  role: "owner",
  isVerified: true,
  whatsappEnabled: true,
  createdAt: new Date().toISOString(),
};

const mockBuyerUser: User = {
  id: "usr-buyer-ordinary",
  name: "Ordinary Seeker",
  email: "seeker@test.com",
  phone: "+201000000002",
  role: "seeker",
  isVerified: false,
  whatsappEnabled: false,
  createdAt: new Date().toISOString(),
};

test("Phase 4 Security 1: Ordinary authenticated users are denied admin moderation actions", () => {
  // Create a pending property submitted by advertiser
  const prop = dbStore.createProperty({
    title: "Pending Villa in New Cairo",
    description: "Spacious standalone villa",
    transactionType: "sale",
    category: "villa",
    price: 15000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 450,
    amenities: [],
    images: ["https://example.com/v1.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Choueifat, New Cairo",
    lat: 30.0123,
    lng: 31.4321,
    locationPrivacy: "exact",
    status: "pending_review",
    featured: false,
    advertiserId: mockAdvertiserOwner.id,
    advertiserType: "owner",
  });

  // Ordinary buyer user attempts to approve or reject the listing
  assert.throws(
    () => {
      dbStore.updatePropertyStatus(prop.id, "published", mockBuyerUser);
    },
    /يتطلب نشر العقار موافقة الإدارة|غير مصرح/,
    "Ordinary buyer must not be able to publish/approve listings"
  );

  assert.throws(
    () => {
      dbStore.updatePropertyStatus(prop.id, "rejected", mockBuyerUser, "Fraudulent");
    },
    /صلاحية رفض الإعلان مقتصرة على مشرفي المنصة|غير مصرح/,
    "Ordinary buyer must not be able to reject listings"
  );
});

test("Phase 4 Security 2: Listing rejection strictly requires a mandatory reason", () => {
  const prop = dbStore.createProperty({
    title: "Apartment with Missing Details",
    description: "Apartment description",
    transactionType: "rent",
    category: "apartment",
    price: 18000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 140,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-maadi",
    addressDetails: "Degla, Maadi",
    lat: 29.96,
    lng: 31.28,
    locationPrivacy: "approximate",
    status: "pending_review",
    featured: false,
    advertiserId: mockAdvertiserOwner.id,
    advertiserType: "owner",
  });

  // Admin attempts to reject without a reason or with empty whitespace
  assert.throws(
    () => {
      dbStore.updatePropertyStatus(prop.id, "rejected", mockAdminUser, "");
    },
    /سبب الرفض إلزامي/,
    "Rejecting without reason must be rejected with 400 validation error"
  );

  assert.throws(
    () => {
      dbStore.updatePropertyStatus(prop.id, "rejected", mockAdminUser, "   ");
    },
    /سبب الرفض إلزامي/,
    "Rejecting with whitespace-only reason must be rejected"
  );

  // Rejection with legitimate reason succeeds
  const rejected = dbStore.updatePropertyStatus(
    prop.id,
    "rejected",
    mockAdminUser,
    "الصور المرفقة غير كافية ويجب إرفاق صور واقعية للوحدة"
  );
  assert.equal(rejected.status, "rejected");
});

test("Phase 4 Security 3: Authorized administrators successfully approve eligible listings", () => {
  const prop = dbStore.createProperty({
    title: "Eligible Duplex in Zayed",
    description: "Fully finished duplex",
    transactionType: "sale",
    category: "duplex",
    price: 7200000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 260,
    amenities: [],
    images: ["https://example.com/d1.jpg"],
    cityId: "city-giza",
    districtId: "dist-sheikh-zayed",
    addressDetails: "District 9, Zayed",
    lat: 30.045,
    lng: 30.982,
    locationPrivacy: "approximate",
    status: "pending_review",
    featured: false,
    advertiserId: mockAdvertiserOwner.id,
    advertiserType: "owner",
  });

  const approved = dbStore.updatePropertyStatus(prop.id, "published", mockAdminUser);
  assert.equal(approved.status, "published", "Property status should transition to published");
  assert.ok(approved.publishedAt, "publishedAt timestamp must be populated on approval");

  // Attempting to approve an already published property must be rejected (no repeat transitions)
  assert.throws(
    () => {
      dbStore.updatePropertyStatus(prop.id, "published", mockAdminUser);
    },
    /العقار في هذه الحالة بالفعل/,
    "Cannot transition to the exact same status"
  );
});

test("Phase 4 Security 4: Location privacy remains strictly enforced on public queries even after approval", () => {
  const prop = dbStore.createProperty({
    title: "Private Penthouse in Katameya",
    description: "Top floor penthouse",
    transactionType: "sale",
    category: "penthouse",
    price: 19000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 320,
    amenities: [],
    images: ["https://example.com/p1.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Katameya Heights",
    lat: 30.001234,
    lng: 31.401234,
    locationPrivacy: "approximate", // Strict privacy configured
    status: "pending_review",
    featured: false,
    advertiserId: mockAdvertiserOwner.id,
    advertiserType: "owner",
  });

  // Admin approves the listing
  dbStore.updatePropertyStatus(prop.id, "published", mockAdminUser);

  // Anonymous or ordinary buyer queries the published property
  const publicProp = dbStore.getPropertyByIdOrSlug(prop.id, undefined);
  assert.ok(publicProp, "Published property must be publicly readable");
  assert.equal(publicProp.isApproximateLocation, true);
  assert.notEqual(
    publicProp.lat,
    30.001234,
    "Exact latitude must never leak to public viewers when approximate privacy is chosen"
  );
  assert.notEqual(
    publicProp.lng,
    31.401234,
    "Exact longitude must never leak to public viewers when approximate privacy is chosen"
  );

  // But admin viewer retains access to raw audit data for verification
  const rawAdminProp = dbStore.getRawPropertyById(prop.id);
  assert.equal(rawAdminProp?.lat, 30.001234, "Admin can inspect exact location for verification");
});

test("Phase 4 Security 5: Advertiser account suspension safety controls", () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const advertiser = dbStore.createUser({
    name: "Suspicious Broker",
    email: `fake.broker-${Date.now()}-${rand}@test.eg`,
    phone: `+20109876${rand}`,
    role: "broker",
    isVerified: false,
    whatsappEnabled: false,
  });

  // 1. Non-admin cannot suspend user
  assert.throws(
    () => {
      dbStore.suspendUser(advertiser.id, true, mockBuyerUser, "Spam");
    },
    /غير مصرح/,
    "Ordinary users cannot suspend accounts"
  );

  // 2. Admin cannot suspend themselves
  assert.throws(
    () => {
      dbStore.suspendUser(mockAdminUser.id, true, mockAdminUser, "Self-suspension");
    },
    /لا يمكن للمشرف تعليق حسابه الشخصي/,
    "Administrator cannot suspend their own account"
  );

  // 3. Suspending requires a mandatory reason
  assert.throws(
    () => {
      dbStore.suspendUser(advertiser.id, true, mockAdminUser, "");
    },
    /سبب تعليق الحساب إلزامي/,
    "Suspension without reason must fail"
  );

  // 4. Valid suspension succeeds
  const suspended = dbStore.suspendUser(
    advertiser.id,
    true,
    mockAdminUser,
    "تكرار نشر إعلانات مكررة بروابط وهمية"
  );
  assert.equal(suspended.isSuspended, true);
  assert.equal(suspended.suspensionReason, "تكرار نشر إعلانات مكررة بروابط وهمية");

  // 5. Reactivation succeeds
  const reactivated = dbStore.suspendUser(advertiser.id, false, mockAdminUser);
  assert.equal(reactivated.isSuspended, false);
});

test("Phase 4 Security 6: Property reports workflow with append-only audit logging", () => {
  const prop = dbStore.createProperty({
    title: "Reported Property Listing",
    description: "Property under complaint",
    transactionType: "sale",
    category: "apartment",
    price: 3500000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 160,
    amenities: [],
    images: [],
    cityId: "city-cairo",
    districtId: "dist-nasr-city",
    addressDetails: "Abbas El Akkad, Nasr City",
    lat: 30.06,
    lng: 31.34,
    locationPrivacy: "exact",
    status: "published",
    featured: false,
    advertiserId: mockAdvertiserOwner.id,
    advertiserType: "owner",
  });

  // User submits a complaint
  const report = dbStore.createPropertyReport({
    propertyId: prop.id,
    reporterId: mockBuyerUser.id,
    reporterName: mockBuyerUser.name,
    reporterPhone: "+201234567890",
    reasonCategory: "misleading_details",
    details: "السعر المعلن مختلف عن السعر المطلوب عند التواصل هاتفياً بمقدار نصف مليون جنيه",
  });

  assert.ok(report.id.startsWith("rep-"));
  assert.equal(report.status, "pending");

  // Admin reviews and resolves the report
  const resolved = dbStore.resolvePropertyReport(
    report.id,
    "resolved",
    mockAdminUser,
    "تم التواصل مع المعلن وتعديل السعر ليتوافق مع السعر الحقيقي"
  );

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedBy, mockAdminUser.id);
  assert.ok(resolved.resolvedAt);

  // Verify Audit Log has recorded the action
  const auditLogs = dbStore.getAuditEvents();
  const resolveLog = auditLogs.find((l) => l.action === "RESOLVE_REPORT" && l.entityId === report.id);
  assert.ok(resolveLog, "Audit log must contain RESOLVE_REPORT event");
  assert.equal(resolveLog.userId, mockAdminUser.id);
});
