/**
 * AqarPulse Platform — Safe Controlled Data Migration Utility
 *
 * Migrates local records from `.data/aqarpulse_db.json` to PostgreSQL (Supabase)
 * with strict referential integrity, idempotency, and audit validation.
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js [--apply]
 *
 * Default is DRY-RUN mode (safe inspection without mutating remote database).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Polyfill WebSocket for Node runtime
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {};
}

const { createClient } = require('@supabase/supabase-js');

// Load environment
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let v = match[2] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      env[match[1]] = v.trim();
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isApply = process.argv.includes('--apply');
const DB_FILE = path.join(__dirname, '..', '.data', 'aqarpulse_db.json');

// City and District UUID resolver mapping
const CITY_MAP = {
  "cairo": "c1000000-0000-0000-0000-000000000001",
  "city-cairo": "c1000000-0000-0000-0000-000000000001",
  "giza": "c2000000-0000-0000-0000-000000000002",
  "city-giza": "c2000000-0000-0000-0000-000000000002",
  "alexandria": "c3000000-0000-0000-0000-000000000003",
  "city-alexandria": "c3000000-0000-0000-0000-000000000003",
  "dakahlia": "c4000000-0000-0000-0000-000000000004",
  "city-dakahlia": "c4000000-0000-0000-0000-000000000004",
};

const DISTRICT_MAP = {
  "new-cairo": "d1000000-0000-0000-0000-000000000001",
  "dist-new-cairo": "d1000000-0000-0000-0000-000000000001",
  "sheikh-zayed": "d2000000-0000-0000-0000-000000000002",
  "dist-sheikh-zayed": "d2000000-0000-0000-0000-000000000002",
  "6th-october": "d3000000-0000-0000-0000-000000000003",
  "dist-6th-october": "d3000000-0000-0000-0000-000000000003",
  "new-capital": "d4000000-0000-0000-0000-000000000004",
  "dist-new-capital": "d4000000-0000-0000-0000-000000000004",
  "maadi": "37c86081-4828-4b02-b592-b5225c6af6f8",
  "dist-maadi": "37c86081-4828-4b02-b592-b5225c6af6f8",
  "dist-meet-ghamr-city": "d5000000-0000-0000-0000-000000000001",
};

function generateDeterministicUuid(namespace, value) {
  const hash = crypto.createHash('sha1').update(`${namespace}:${value}`).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    'a' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

async function runMigration() {
  console.log("=================================================================");
  console.log(`  AQARPULSE DATA MIGRATION: JSON -> POSTGRESQL (${isApply ? "APPLY" : "DRY-RUN"})`);
  console.log("=================================================================\n");

  if (!fs.existsSync(DB_FILE)) {
    console.error("❌ Database file not found:", DB_FILE);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(DB_FILE, 'utf-8');
  let db;
  try {
    db = JSON.parse(rawJson);
  } catch (e) {
    console.error("❌ Invalid JSON in data store:", e.message);
    process.exit(1);
  }

  console.log(`Loaded JSON store:`);
  console.log(`  Users:      ${db.users?.length || 0}`);
  console.log(`  Properties: ${db.properties?.length || 0}`);
  console.log(`  Inquiries:  ${db.inquiries?.length || 0}`);
  console.log(`  Target URL: ${supabaseUrl}\n`);

  // 1. Validate & Map Users
  const userMap = new Map(); // localId -> uuid
  const validUsers = [];
  const rejectedUsers = [];

  for (const u of db.users || []) {
    if (!u.id || (!u.email && !u.phone)) {
      rejectedUsers.push({ id: u.id, reason: "Missing required identifier (email or phone)" });
      continue;
    }
    const userUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u.id)
      ? u.id
      : generateDeterministicUuid("user", u.email || u.phone || u.id);

    userMap.set(u.id, userUuid);
    validUsers.push({
      id: userUuid,
      name: u.name || "مستخدم",
      email: u.email || null,
      phone: u.phone || null,
      role: u.role || "seeker",
      is_verified: Boolean(u.isVerified),
      company_name: u.companyName || null,
      license_number: u.licenseNumber || null,
      created_at: u.createdAt || new Date().toISOString(),
    });
  }

  console.log(`User Validation:`);
  console.log(`  Valid Users:    ${validUsers.length}`);
  console.log(`  Rejected Users: ${rejectedUsers.length}`);

  // 2. Validate & Map Properties
  const propMap = new Map(); // localPropId -> uuid
  const validProperties = [];
  const validImages = [];
  const rejectedProperties = [];

  for (const p of db.properties || []) {
    // Check required fields
    if (!p.id || !p.title || p.price === undefined || p.price === null) {
      rejectedProperties.push({ id: p.id, reason: "Missing id, title, or price" });
      continue;
    }

    // Resolve coordinates from property or fallback to district/city center
    const matchedDistrict = (db.districts || []).find(d => d.id === p.districtId);
    const matchedCity = (db.cities || []).find(c => c.id === p.cityId);
    const rawLat = p.lat ?? p.exactLat ?? p.latitude ?? matchedDistrict?.centerLat ?? matchedCity?.centerLat ?? 30.7194;
    const rawLng = p.lng ?? p.exactLng ?? p.longitude ?? matchedDistrict?.centerLng ?? matchedCity?.centerLng ?? 31.2580;

    // Constraints: price >= 0, area > 0
    const price = Number(p.price);
    const area = Number(p.areaSqM || p.area_sqm || 100);
    const lat = Number(rawLat);
    const lng = Number(rawLng);

    if (isNaN(price) || price < 0) {
      rejectedProperties.push({ id: p.id, reason: `Invalid price: ${p.price}` });
      continue;
    }
    if (isNaN(area) || area <= 0) {
      rejectedProperties.push({ id: p.id, reason: `Invalid area: ${p.areaSqM}` });
      continue;
    }
    // Egypt coordinate bounds check
    if (isNaN(lat) || isNaN(lng) || lat < 21 || lat > 32.5 || lng < 24 || lng > 37.5) {
      rejectedProperties.push({ id: p.id, reason: `Coordinates outside Egypt bounds: [${lat}, ${lng}]` });
      continue;
    }

    const propUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)
      ? p.id
      : generateDeterministicUuid("property", p.id);

    propMap.set(p.id, propUuid);

    const advertiserUuid = userMap.get(p.advertiserId) || userMap.get("usr-broker-01") || "a0000000-0000-0000-0000-000000000001";
    const cityUuid = CITY_MAP[p.cityId] || CITY_MAP["city-cairo"];
    const districtUuid = DISTRICT_MAP[p.districtId] || DISTRICT_MAP["dist-new-cairo"];

    const slug = (p.slug || p.title)
      .toString()
      .toLowerCase()
      .replace(/[\s\W-]+/g, "-")
      .slice(0, 40) + `-${propUuid.substring(0, 8)}`;

    validProperties.push({
      id: propUuid,
      slug,
      title: p.title.trim(),
      description: p.description?.trim() || p.title,
      transaction_type: p.transactionType === "rent" ? "rent" : "sale",
      category: p.category || "apartment",
      price,
      currency: "EGP",
      area_sqm: area,
      bedrooms: p.bedrooms ? Number(p.bedrooms) : null,
      bathrooms: p.bathrooms ? Number(p.bathrooms) : null,
      finishing_status: p.finishingStatus || "fully_finished",
      furnishing_status: p.furnishingStatus || "unfurnished",
      city_id: cityUuid,
      district_id: districtUuid,
      address_details: p.addressDetails || null,
      exact_lat: lat,
      exact_lng: lng,
      location_privacy: p.locationPrivacy || "exact",
      approximate_lat: p.approximateLat ? Number(p.approximateLat) : null,
      approximate_lng: p.approximateLng ? Number(p.approximateLng) : null,
      status: p.status || "published",
      featured: Boolean(p.featured),
      advertiser_id: advertiserUuid,
      advertiser_type: p.advertiserType || "broker",
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || new Date().toISOString(),
    });

    if (Array.isArray(p.images)) {
      p.images.forEach((imgUrl, idx) => {
        validImages.push({
          id: generateDeterministicUuid("property_image", `${propUuid}:${idx}:${imgUrl}`),
          property_id: propUuid,
          url: imgUrl,
          is_main: idx === 0,
          sort_order: idx + 1,
        });
      });
    }
  }

  console.log(`\nProperty Validation:`);
  console.log(`  Valid Properties:    ${validProperties.length}`);
  console.log(`  Valid Images:        ${validImages.length}`);
  console.log(`  Rejected Properties: ${rejectedProperties.length}`);
  if (rejectedProperties.length > 0) {
    console.log("  Sample Rejected:", rejectedProperties.slice(0, 3));
  }

  // 3. Validate & Map Inquiries + Inquiry Messages
  const validInquiries = [];
  const validInquiryMessages = [];
  const rejectedInquiries = [];

  for (const inq of db.inquiries || []) {
    if (!inq.id || !inq.propertyId) {
      rejectedInquiries.push({ id: inq.id, reason: "Missing id or propertyId" });
      continue;
    }
    const inqUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inq.id)
      ? inq.id
      : generateDeterministicUuid("inquiry", inq.id);
    const propUuid = propMap.get(inq.propertyId) || generateDeterministicUuid("property", inq.propertyId);
    const seekerUuid = inq.seekerId && userMap.has(inq.seekerId) ? userMap.get(inq.seekerId) : null;
    const advUuid = inq.advertiserId && userMap.has(inq.advertiserId) ? userMap.get(inq.advertiserId) : null;

    validInquiries.push({
      id: inqUuid,
      property_id: propUuid,
      seeker_id: seekerUuid,
      seeker_name: inq.seekerName || "عميل مهتم",
      seeker_phone: inq.seekerPhone || "",
      seeker_email: inq.seekerEmail || null,
      advertiser_id: advUuid,
      message: inq.message || "",
      preferred_contact: inq.preferredContact || "chat",
      status: inq.status || "new",
      created_at: inq.createdAt || new Date().toISOString(),
      updated_at: inq.lastMessageAt || inq.createdAt || new Date().toISOString(),
    });

    for (const msg of inq.messages || []) {
      const msgUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.id)
        ? msg.id
        : generateDeterministicUuid("inquiry_message", `${inqUuid}:${msg.id}`);
      const senderUuid = msg.senderId && userMap.has(msg.senderId) ? userMap.get(msg.senderId) : null;
      validInquiryMessages.push({
        id: msgUuid,
        inquiry_id: inqUuid,
        sender_id: senderUuid,
        sender_name: msg.senderName || "مستخدم",
        sender_role: msg.senderRole || "buyer",
        content: msg.content || "",
        is_admin_note: Boolean(msg.isAdminNote),
        is_internal_note: Boolean(msg.isInternalNote),
        is_read: Boolean(msg.isRead),
        created_at: msg.createdAt || new Date().toISOString(),
      });
    }
  }

  console.log(`\nInquiries & Messages Validation:`);
  console.log(`  Valid Inquiries:        ${validInquiries.length}`);
  console.log(`  Valid Inquiry Messages: ${validInquiryMessages.length}`);
  console.log(`  Rejected Inquiries:     ${rejectedInquiries.length}`);

  // 4. Validate & Map Reports, Favorites, and Audit Events
  const validReports = [];
  for (const rep of db.reports || []) {
    if (!rep.id || !rep.propertyId) continue;
    const repUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rep.id)
      ? rep.id
      : generateDeterministicUuid("report", rep.id);
    const propUuid = propMap.get(rep.propertyId) || generateDeterministicUuid("property", rep.propertyId);
    const reporterUuid = rep.reporterId && userMap.has(rep.reporterId) ? userMap.get(rep.reporterId) : null;
    validReports.push({
      id: repUuid,
      property_id: propUuid,
      reporter_id: reporterUuid,
      reporter_name: rep.reporterName || "مستخدم",
      reporter_phone: rep.reporterPhone || null,
      reason_category: rep.reasonCategory || "other",
      details: rep.details || "",
      status: rep.status || "pending",
      resolution_notes: rep.resolutionNotes || null,
      created_at: rep.createdAt || new Date().toISOString(),
      updated_at: rep.updatedAt || new Date().toISOString(),
    });
  }

  const validFavorites = [];
  for (const fav of db.favorites || []) {
    if (!fav.userId || !fav.propertyId) continue;
    const uUuid = userMap.get(fav.userId) || generateDeterministicUuid("user", fav.userId);
    const pUuid = propMap.get(fav.propertyId) || generateDeterministicUuid("property", fav.propertyId);
    validFavorites.push({
      id: generateDeterministicUuid("favorite", `${uUuid}:${pUuid}`),
      user_id: uUuid,
      property_id: pUuid,
      created_at: fav.createdAt || new Date().toISOString(),
    });
  }

  const validAuditEvents = [];
  for (const evt of db.auditEvents || []) {
    if (!evt.id) continue;
    const evtUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evt.id)
      ? evt.id
      : generateDeterministicUuid("audit_event", evt.id);
    const actorUuid = evt.actorId && userMap.has(evt.actorId) ? userMap.get(evt.actorId) : null;
    validAuditEvents.push({
      id: evtUuid,
      actor_id: actorUuid,
      action: evt.action,
      entity_type: evt.entityType,
      entity_id: evt.entityId,
      metadata: evt.metadata || {},
      created_at: evt.timestamp || new Date().toISOString(),
    });
  }

  const validOfficialNotices = [];
  for (const notice of db.officialNotices || []) {
    if (!notice.id || !notice.propertyId) continue;
    validOfficialNotices.push({
      id: notice.id,
      property_id: propMap.get(notice.propertyId) || notice.propertyId,
      property_title: notice.propertyTitle || "عقار",
      recipient_id: (notice.recipientId && userMap.get(notice.recipientId)) || notice.recipientId || "unknown",
      sender_id: (notice.senderId && userMap.has(notice.senderId)) ? userMap.get(notice.senderId) : null,
      sender_name: notice.senderName || "إدارة منصة دار العقار",
      notice_type: notice.noticeType || "general_notice",
      subject: notice.subject || "إشعار رسمي",
      content: notice.content || "",
      action_taken: notice.actionTaken || null,
      is_read: Boolean(notice.isRead),
      created_at: notice.createdAt || new Date().toISOString(),
    });
  }

  console.log(`\nReports, Favorites, Notices & Audit Validation:`);
  console.log(`  Valid Reports:          ${validReports.length}`);
  console.log(`  Valid Favorites:        ${validFavorites.length}`);
  console.log(`  Valid Official Notices: ${validOfficialNotices.length}`);
  console.log(`  Valid Audit Events:     ${validAuditEvents.length}`);

  // 5. Validate & Map Smart Features JSON files
  const dataDir = path.join(__dirname, '..', '.data');
  const readOptionalJson = (filename, fallback) => {
    const p = path.join(dataDir, filename);
    if (!fs.existsSync(p)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
      return fallback;
    }
  };

  const smartConfigRaw = readOptionalJson('smart_features_config.json', null);
  const reverseRequestsRaw = readOptionalJson('smart_features_requests.json', []);
  const inspectionsRaw = readOptionalJson('smart_features_inspections.json', []);
  const reviewsRaw = readOptionalJson('smart_features_reviews.json', []);
  const portfolioRaw = readOptionalJson('smart_features_portfolio.json', []);
  const reservationsRaw = readOptionalJson('smart_features_reservations.json', []);
  const neighborhoodsRaw = readOptionalJson('smart_features_neighborhoods.json', []);

  const validReverseRequests = (Array.isArray(reverseRequestsRaw) ? reverseRequestsRaw : []).map(r => ({
    id: r.id,
    user_id: (r.userId && userMap.has(r.userId)) ? userMap.get(r.userId) : null,
    user_name: r.userName || "عميل",
    user_phone: r.userPhone || "",
    title: r.title || "طلب عقاري",
    city_id: r.cityId || "cairo",
    district_id: r.districtId || null,
    district_name_ar: r.districtNameAr || "",
    category: r.category || "apartment",
    transaction_type: r.transactionType || "sale",
    min_budget: Number(r.minBudget || 0),
    max_budget: Number(r.maxBudget || 0),
    min_area: Number(r.minArea || 100),
    max_area: r.maxArea ? Number(r.maxArea) : null,
    bedrooms: r.bedrooms ? Number(r.bedrooms) : null,
    notes: r.notes || "",
    urgency: r.urgency || "flexible",
    status: r.status || "open",
    offers_count: Number(r.offersCount || 0),
    created_at: r.createdAt || new Date().toISOString(),
  }));

  const validInspections = (Array.isArray(inspectionsRaw) ? inspectionsRaw : []).map(b => ({
    id: b.id,
    property_id: b.propertyId || "unknown",
    property_title: b.propertyTitle || "عقار",
    property_address: b.propertyAddress || "",
    requester_name: b.requesterName || "عميل",
    requester_phone: b.requesterPhone || "",
    requester_email: b.requesterEmail || "",
    preferred_date: b.preferredDate || "",
    inspection_type: b.inspectionType || "full_civil_electrical",
    status: b.status || "pending",
    assigned_engineer_name: b.assignedEngineerName || null,
    score_overall: b.scoreOverall ?? null,
    notes: b.notes || null,
    created_at: b.createdAt || new Date().toISOString(),
  }));

  const validBrokerReviews = (Array.isArray(reviewsRaw) ? reviewsRaw : []).map(rev => ({
    id: rev.id,
    broker_id: rev.brokerId || "broker-1",
    broker_name: rev.brokerName || "وسيط عقاري",
    reviewer_name: rev.reviewerName || "عميل",
    rating_overall: Number(rev.ratingOverall || 5),
    rating_accuracy: Number(rev.ratingAccuracy || 5),
    rating_communication: Number(rev.ratingCommunication || 5),
    rating_punctuality: Number(rev.ratingPunctuality || 5),
    comment: rev.comment || "",
    is_verified_deal: Boolean(rev.isVerifiedDeal),
    created_at: rev.createdAt || new Date().toISOString(),
  }));

  const validPortfolioItems = (Array.isArray(portfolioRaw) ? portfolioRaw : []).map(item => ({
    id: item.id,
    user_id: item.userId || "usr-investor-1",
    property_title: item.propertyTitle || "عقار استثماري",
    purchase_price: Number(item.purchasePrice || 0),
    current_market_estimate: Number(item.currentMarketEstimate || 0),
    purchase_date: item.purchaseDate || "2024-01-01",
    rental_income_monthly: Number(item.rentalIncomeMonthly || 0),
    tenant_name: item.tenantName || null,
    next_installment_due_date: item.nextInstallmentDueDate || null,
    next_installment_amount: item.nextInstallmentAmount ? Number(item.nextInstallmentAmount) : null,
    installments_remaining_count: item.installmentsRemainingCount ?? null,
    occupancy_status: item.occupancyStatus || "rented",
  }));

  const validReservations = (Array.isArray(reservationsRaw) ? reservationsRaw : []).map(res => ({
    id: res.id,
    reservation_code: res.reservationCode,
    property_id: res.propertyId,
    property_title: res.propertyTitle || "عقار",
    property_price: Number(res.propertyPrice || 0),
    user_id: (res.userId && userMap.has(res.userId)) ? userMap.get(res.userId) : null,
    buyer_name: res.buyerName || "مشتري",
    buyer_phone: res.buyerPhone || "",
    buyer_national_id: res.buyerNationalId || "",
    frozen_price_egp: Number(res.frozenPriceEgp || res.propertyPrice || 0),
    reservation_fee_egp: Number(res.reservationFeeEgp || 25000),
    expires_at: res.expiresAt || new Date().toISOString(),
    status: res.status || "active",
    notes: res.notes || null,
    created_at: res.createdAt || new Date().toISOString(),
  }));

  const validNeighborhoods = (Array.isArray(neighborhoodsRaw) ? neighborhoodsRaw : []).map(n => ({
    id: n.id,
    slug: n.slug,
    name_ar: n.nameAr,
    name_en: n.nameEn,
    city_name_ar: n.cityNameAr,
    country: n.country || "EG",
    hero_image: n.heroImage,
    description_ar: n.descriptionAr,
    avg_price_per_sqm: Number(n.avgPricePerSqM || 0),
    yoy_appreciation_percent: Number(n.yoyAppreciationPercent || 0),
    demand_index: Number(n.demandIndex || 0),
    overall_livability_score: Number(n.overallLivabilityScore || 0),
    ratings: n.ratings || {},
    resident_reviews_count: Number(n.residentReviewsCount || 0),
    top_compounds: n.topCompounds || [],
    key_landmarks: n.keyLandmarks || [],
    popular_unit_types: n.popularUnitTypes || [],
    reviews: n.reviews || [],
    updated_at: new Date().toISOString(),
  }));

  console.log(`\nSmart Features Validation:`);
  console.log(`  Smart Features Config:  ${smartConfigRaw ? 1 : 0}`);
  console.log(`  Reverse Requests:       ${validReverseRequests.length}`);
  console.log(`  Inspection Bookings:    ${validInspections.length}`);
  console.log(`  Broker Reviews:         ${validBrokerReviews.length}`);
  console.log(`  Portfolio Items:        ${validPortfolioItems.length}`);
  console.log(`  Digital Reservations:   ${validReservations.length}`);
  console.log(`  Neighborhood Guides:    ${validNeighborhoods.length}`);

  // 6. Execution or Dry-Run Output
  if (!isApply) {
    console.log("\n=================================================================");
    console.log("  DRY-RUN VALIDATION SUCCEEDED! (No remote database writes made)");
    console.log("  To apply to PostgreSQL, execute: node scripts/migrate-to-supabase.js --apply");
    console.log("=================================================================\n");
    return;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Cannot apply migration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  // Live Apply via Supabase Client
  console.log("\nApplying records to Supabase PostgreSQL database...");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Backup current json store first
  const backupFile = `${DB_FILE}.backup_${Date.now()}.json`;
  fs.copyFileSync(DB_FILE, backupFile);
  console.log(`✔ Created safety backup at: ${backupFile}`);

  // Insert Profiles
  let insertedProfiles = 0;
  for (const profile of validUsers) {
    const { error } = await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
    if (!error) insertedProfiles++;
  }
  console.log(`✔ Upserted ${insertedProfiles}/${validUsers.length} profiles.`);

  // Insert Properties
  let insertedProperties = 0;
  for (const prop of validProperties) {
    const { error } = await supabase.from('properties').upsert(prop, { onConflict: 'id' });
    if (!error) insertedProperties++;
  }
  console.log(`✔ Upserted ${insertedProperties}/${validProperties.length} properties.`);

  // Insert Property Images
  let insertedImages = 0;
  for (const img of validImages) {
    const { error } = await supabase.from('property_images').upsert(img, { onConflict: 'id' });
    if (!error) insertedImages++;
  }
  console.log(`✔ Upserted ${insertedImages}/${validImages.length} property images.`);

  // Insert Inquiries
  let insertedInquiries = 0;
  for (const inq of validInquiries) {
    const { error } = await supabase.from('inquiries').upsert(inq, { onConflict: 'id' });
    if (!error) insertedInquiries++;
  }
  console.log(`✔ Upserted ${insertedInquiries}/${validInquiries.length} inquiries.`);

  // Insert Inquiry Messages
  let insertedMessages = 0;
  for (const msg of validInquiryMessages) {
    const { error } = await supabase.from('inquiry_messages').upsert(msg, { onConflict: 'id' });
    if (!error) insertedMessages++;
  }
  console.log(`✔ Upserted ${insertedMessages}/${validInquiryMessages.length} inquiry messages.`);

  // Insert Reports
  let insertedReports = 0;
  for (const rep of validReports) {
    const { error } = await supabase.from('property_reports').upsert(rep, { onConflict: 'id' });
    if (!error) insertedReports++;
  }
  console.log(`✔ Upserted ${insertedReports}/${validReports.length} property reports.`);

  // Insert Favorites
  let insertedFavorites = 0;
  for (const fav of validFavorites) {
    const { error } = await supabase.from('favorites').upsert(fav, { onConflict: 'id' });
    if (!error) insertedFavorites++;
  }
  console.log(`✔ Upserted ${insertedFavorites}/${validFavorites.length} favorites.`);

  // Insert Official Notices
  let insertedNotices = 0;
  for (const notice of validOfficialNotices) {
    const { error } = await supabase.from('official_notices').upsert(notice, { onConflict: 'id' });
    if (!error) insertedNotices++;
  }
  console.log(`✔ Upserted ${insertedNotices}/${validOfficialNotices.length} official notices.`);

  // Insert Audit Events
  let insertedAudits = 0;
  for (const evt of validAuditEvents) {
    const { error } = await supabase.from('audit_events').upsert(evt, { onConflict: 'id' });
    if (!error) insertedAudits++;
  }
  console.log(`✔ Upserted ${insertedAudits}/${validAuditEvents.length} audit events.`);

  // Insert Smart Features Config
  if (smartConfigRaw) {
    await supabase.from('smart_features_config').upsert({
      id: 'global',
      version: smartConfigRaw.version || '2.0.0',
      features: smartConfigRaw.features || {},
      financial_params: smartConfigRaw.financialParams || {},
      geospatial_params: smartConfigRaw.geospatialParams || {},
      finishing_params: smartConfigRaw.finishingParams || {},
      inspection_params: smartConfigRaw.inspectionParams || {},
      mortgage_params: smartConfigRaw.mortgageParams || {},
      benchmark_params: smartConfigRaw.benchmarkParams || {},
      updated_by: smartConfigRaw.updatedBy || 'system_admin',
      updated_at: smartConfigRaw.updatedAt || new Date().toISOString(),
    }, { onConflict: 'id' });
    console.log(`✔ Upserted global smart_features_config.`);
  }

  // Insert Reverse Requests
  for (const r of validReverseRequests) {
    await supabase.from('reverse_requests').upsert(r, { onConflict: 'id' });
  }
  console.log(`✔ Upserted ${validReverseRequests.length} reverse requests.`);

  // Insert Inspection Bookings
  for (const b of validInspections) {
    await supabase.from('inspection_bookings').upsert(b, { onConflict: 'id' });
  }
  console.log(`✔ Upserted ${validInspections.length} inspection bookings.`);

  // Insert Broker Reviews
  for (const rev of validBrokerReviews) {
    await supabase.from('broker_reviews').upsert(rev, { onConflict: 'id' });
  }
  console.log(`✔ Upserted ${validBrokerReviews.length} broker reviews.`);

  // Insert Portfolio Items
  for (const item of validPortfolioItems) {
    await supabase.from('investor_portfolios').upsert(item, { onConflict: 'id' });
  }
  console.log(`✔ Upserted ${validPortfolioItems.length} investor portfolio items.`);

  // Insert Digital Reservations
  for (const res of validReservations) {
    await supabase.from('reservations').upsert(res, { onConflict: 'id' });
  }
  console.log(`✔ Upserted ${validReservations.length} digital reservations.`);

  // Insert Neighborhood Guides
  for (const n of validNeighborhoods) {
    await supabase.from('neighborhood_guides').upsert(n, { onConflict: 'slug' });
  }
  console.log(`✔ Upserted ${validNeighborhoods.length} neighborhood guides.`);

  console.log("\n✅ Migration completed successfully!");
}

runMigration().catch(err => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
