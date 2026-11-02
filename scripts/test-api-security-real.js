/**
 * Dar Al Aqar — Real API Route Security Integration Tests
 * 
 * Invokes live HTTP API route handlers against http://localhost:3000 with real HTTP requests,
 * authentic session cookies, and asserts actual HTTP response statuses and error bodies.
 * 
 * Covers the 8 mandatory security verification scenarios from Phase 0.1:
 *  1. An unverified broker attempting every privileged broker action (and verified broker succeeding).
 *  2. A user attempting to impersonate another user in an inquiry INSERT.
 *  3. Nonexistent / invalid property inquiry write does not return false success.
 *  4. A failed role update does not return success or issue an inconsistent session.
 *  5. A nonparticipant attempting to read another user's inquiry and messages.
 *  6. An ordinary user attempting to set an admin role through all available role/profile mutation paths.
 *  7. Unauthorized property updates and publication attempts through the actual API.
 *  8. Upload failures (nonexistent property, IDOR/BOLA cross-user upload, missing file).
 */

const assert = require("assert");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3000";
const SESSION_COOKIE_NAME = "aqarpulse_session";

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const envLocal = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
    const mSession = envLocal.match(/SESSION_SECRET=([^\r\n]+)/);
    if (mSession) return mSession[1].trim();
    const mJwt = envLocal.match(/JWT_SECRET=([^\r\n]+)/);
    if (mJwt) return mJwt[1].trim();
  } catch {}
  return "aqarpulse_super_secret_jwt_key_egypt_2026";
}

const ACTIVE_SECRET = getSessionSecret();

function makeSessionCookie(user) {
  const payload = {
    userId: user.id,
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    name: user.name,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString("base64url");
  const signature = crypto.createHmac("sha256", ACTIVE_SECRET).update(payloadBase64).digest("base64url");
  return `${SESSION_COOKIE_NAME}=${payloadBase64}.${signature}`;
}

async function runRealApiSecurityTests() {
  console.log("================================================================================");
  console.log("       AqarPulse Phase 0.1: Real API Route Security Integration Tests           ");
  console.log("================================================================================\n");

  // Load dbStore to seed persistent test accounts
  const dbPath = path.join(process.cwd(), ".data", "aqarpulse_db.json");
  const dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

  const timestamp = Date.now();
  
  // Use valid UUIDs for all test users
  const unverifiedBroker = {
    id: crypto.randomUUID(),
    name: "وسيط عقاري غير معتمد",
    email: `broker.unverified.${timestamp}@aqarpulse.eg`,
    phone: `+20101111${Math.floor(1000 + Math.random() * 9000)}`,
    role: "broker",
    isVerified: false,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const verifiedBroker = {
    id: crypto.randomUUID(),
    name: "وسيط عقاري معتمد رسمياً",
    email: `broker.verified.${timestamp}@aqarpulse.eg`,
    phone: `+20102222${Math.floor(1000 + Math.random() * 9000)}`,
    role: "broker",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const ownerA = {
    id: crypto.randomUUID(),
    name: "مالك عقار أ",
    email: `owner.a.${timestamp}@aqarpulse.eg`,
    phone: `+20103333${Math.floor(1000 + Math.random() * 9000)}`,
    role: "owner",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const ownerB = {
    id: crypto.randomUUID(),
    name: "مالك عقار ب (مهاجم محتمل)",
    email: `owner.b.${timestamp}@aqarpulse.eg`,
    phone: `+20104444${Math.floor(1000 + Math.random() * 9000)}`,
    role: "owner",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const seekerAlice = {
    id: crypto.randomUUID(),
    name: "باحثة عقار أليس",
    email: `alice.${timestamp}@aqarpulse.eg`,
    phone: `+20105555${Math.floor(1000 + Math.random() * 9000)}`,
    role: "seeker",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const seekerBob = {
    id: crypto.randomUUID(),
    name: "باحث عقار بوب (طرف ثالث)",
    email: `bob.${timestamp}@aqarpulse.eg`,
    phone: `+20106666${Math.floor(1000 + Math.random() * 9000)}`,
    role: "seeker",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const adminUser = {
    id: crypto.randomUUID(),
    name: "مدير النظام الرئيسي",
    email: `admin.${timestamp}@aqarpulse.eg`,
    phone: `+20107777${Math.floor(1000 + Math.random() * 9000)}`,
    role: "admin",
    isVerified: true,
    phoneVerified: true,
    emailVerified: true,
    whatsappEnabled: true,
    createdAt: new Date().toISOString(),
  };

  // Seed into database
  dbData.users.push(unverifiedBroker, verifiedBroker, ownerA, ownerB, seekerAlice, seekerBob, adminUser);
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2));

  const unverifiedBrokerCookie = makeSessionCookie(unverifiedBroker);
  const verifiedBrokerCookie = makeSessionCookie(verifiedBroker);
  const ownerACookie = makeSessionCookie(ownerA);
  const ownerBCookie = makeSessionCookie(ownerB);
  const seekerAliceCookie = makeSessionCookie(seekerAlice);
  const seekerBobCookie = makeSessionCookie(seekerBob);
  const adminCookie = makeSessionCookie(adminUser);

  let passedTests = 0;
  let totalTests = 0;

  async function testCase(name, fn) {
    totalTests++;
    process.stdout.write(`▶ Test ${totalTests}: ${name} ... `);
    try {
      await fn();
      passedTests++;
      console.log("✔ PASSED");
    } catch (err) {
      console.log("❌ FAILED");
      console.error("   Error:", err.message);
      throw err;
    }
  }

  // ============================================================================
  // Scenario 1: Unverified broker attempting privileged actions vs verified broker
  // ============================================================================
  let draftPropId = null;

  await testCase("1a. Unverified broker cannot create a property with status 'pending_review' (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: unverifiedBrokerCookie,
      },
      body: JSON.stringify({
        title: "عقار تجريبي لوسيط غير معتمد",
        description: "وصف تفصيلي كامل للعقار التجريبي",
        price: 2500000,
        areaSqM: 140,
        lat: 30.0444,
        lng: 31.2357,
        status: "pending_review",
      }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير معتمد/);
  });

  await testCase("1b. Unverified broker CAN save property as draft (200)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: unverifiedBrokerCookie,
      },
      body: JSON.stringify({
        title: "مسودة عقار وسيط قيد الاعتماد",
        description: "مسودة عقار تجريبي تم حفظها كمسودة فقط لحين المراجعة",
        price: 1800000,
        areaSqM: 120,
        lat: 30.0444,
        lng: 31.2357,
        status: "draft",
      }),
    });
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.property.status, "draft");
    draftPropId = data.property.id;
  });

  await testCase("1c. Unverified broker cannot submit saved draft for review via PATCH /api/properties/[id] (403)", async () => {
    assert.ok(draftPropId, "Draft property ID must exist");
    const res = await fetch(`${BASE_URL}/api/properties/${draftPropId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: unverifiedBrokerCookie,
      },
      body: JSON.stringify({ status: "pending_review" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير معتمد/);
  });

  await testCase("1d. Unverified broker cannot submit saved draft for review via PUT /api/properties/[id] (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties/${draftPropId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: unverifiedBrokerCookie,
      },
      body: JSON.stringify({ status: "pending_review", title: "تحديث المسودة" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير معتمد/);
  });

  // Verify broker via Admin API
  await testCase("1e. Admin verifies broker account via PATCH /api/admin/users/[id] (200)", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users/${unverifiedBroker.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ isVerified: true, verificationReason: "تم التحقق من السجل التجاري والبطاقة الضريبية" }),
    });
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.user.isVerified, true);
  });

  await testCase("1f. Newly verified broker CAN now submit draft for review (200)", async () => {
    // Unverified broker is now verified in database
    const res = await fetch(`${BASE_URL}/api/properties/${draftPropId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: unverifiedBrokerCookie,
      },
      body: JSON.stringify({ status: "pending_review" }),
    });
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.property.status, "pending_review");
  });

  // ============================================================================
  // Scenario 2: Seeker impersonation & advertiser tampering in inquiry INSERT
  // ============================================================================
  let publishedPropId = null;

  await testCase("2-prep. Owner A creates property and Admin publishes it via API (200)", async () => {
    // Owner A creates property
    const createRes = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerACookie,
      },
      body: JSON.stringify({
        title: "شقة للبيع في المعادي دجلة",
        description: "شقة راقية كاملة التشطيب في دجلة المعادي قريبة من المترو",
        price: 3500000,
        areaSqM: 165,
        lat: 29.9602,
        lng: 31.2569,
        status: "pending_review",
      }),
    });
    assert.equal(createRes.status, 200, `Expected 200 OK from create, got ${createRes.status}`);
    const createData = await createRes.json();
    publishedPropId = createData.property.id;

    // Admin approves & publishes property
    const pubRes = await fetch(`${BASE_URL}/api/properties/${publishedPropId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "published" }),
    });
    assert.equal(pubRes.status, 200, `Expected 200 OK from admin publish, got ${pubRes.status}`);
    const pubData = await pubRes.json();
    assert.equal(pubData.property.status, "published");
  });

  await testCase("2a. Authenticated user attempting to impersonate another seeker is rejected (400)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({
        propertyId: publishedPropId,
        seekerId: seekerBob.id, // Forged seeker identity
        seekerName: "أليس متنكرة باسم بوب",
        seekerPhone: "+201099998888",
        message: "أرغب في المعاينة الفورية",
      }),
    });
    assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /انتحال هوية باحث آخر/);
  });

  await testCase("2b. Client attempting to inject forged advertiserId is rejected (400)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({
        propertyId: publishedPropId,
        advertiserId: crypto.randomUUID(), // Forged advertiser ID
        seekerName: seekerAlice.name,
        seekerPhone: seekerAlice.phone,
        message: "استفسار عادي",
      }),
    });
    assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /معرف المعلن غير مطابق/);
  });

  // Legitimate inquiry from Alice to Owner A
  let aliceInquiryId = null;
  await testCase("2c. Legitimate inquiry from Alice succeeds (200)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({
        propertyId: publishedPropId,
        seekerName: seekerAlice.name,
        seekerPhone: seekerAlice.phone,
        message: "هل العقار متاح للمعاينة يوم السبت؟",
      }),
    });
    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inquiry.seekerId, seekerAlice.id);
    assert.equal(data.inquiry.advertiserId, ownerA.id);
    aliceInquiryId = data.inquiry.id;
  });

  // ============================================================================
  // Scenario 3: Nonexistent property inquiry write returns error, never false success
  // ============================================================================
  await testCase("3. Inquiry for nonexistent property returns 404, never false success (404)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({
        propertyId: crypto.randomUUID(), // Valid UUID format but nonexistent
        seekerName: "أليس",
        seekerPhone: "+201055554444",
        message: "رسالة لعقار غير موجود",
      }),
    });
    assert.equal(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير موجود/);
  });

  // ============================================================================
  // Scenario 4: Failed role update does not return success or issue session
  // ============================================================================
  await testCase("4a. User attempting self-upgrade to 'admin' role is rejected (400)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/upgrade-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({ targetRole: "admin" }),
    });
    assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
    const setCookie = res.headers.get("set-cookie");
    assert.ok(!setCookie, "Must NOT issue upgraded session cookie on failed role upgrade");
  });

  await testCase("4b. Admin user cannot downgrade/convert via upgrade-role self-service (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/upgrade-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ targetRole: "broker" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  // ============================================================================
  // Scenario 5: Nonparticipant attempting to read inquiry or messages (403)
  // ============================================================================
  await testCase("5a. Nonparticipant Seeker Bob cannot read Alice's inquiry details (403)", async () => {
    assert.ok(aliceInquiryId, "Inquiry ID must exist");
    const res = await fetch(`${BASE_URL}/api/inquiries/${aliceInquiryId}`, {
      method: "GET",
      headers: {
        Cookie: seekerBobCookie,
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير مصرح/);
  });

  await testCase("5b. Nonparticipant Seeker Bob cannot read Alice's inquiry messages (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries/${aliceInquiryId}/messages`, {
      method: "GET",
      headers: {
        Cookie: seekerBobCookie,
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await testCase("5c. Nonparticipant Seeker Bob cannot post message to Alice's inquiry (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/inquiries/${aliceInquiryId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerBobCookie,
      },
      body: JSON.stringify({ content: "رسالة تطفلية من مستخدم غير مشارك" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await testCase("5d. Legitimate participants (Alice, Owner A) CAN read messages (200)", async () => {
    const resAlice = await fetch(`${BASE_URL}/api/inquiries/${aliceInquiryId}/messages`, {
      headers: { Cookie: seekerAliceCookie },
    });
    assert.equal(resAlice.status, 200);

    const resOwnerA = await fetch(`${BASE_URL}/api/inquiries/${aliceInquiryId}/messages`, {
      headers: { Cookie: ownerACookie },
    });
    assert.equal(resOwnerA.status, 200);
  });

  // ============================================================================
  // Scenario 6: Ordinary user attempting admin role mutation across all routes
  // ============================================================================
  await testCase("6a. Profile mutation PUT /api/auth/profile ignores attempted role='admin'", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({ role: "admin", name: "أليس محدثة" }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.role, "seeker", "Role must remain seeker");
  });

  await testCase("6b. Registration POST /api/auth/register strictly rejects role='admin' (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "مسؤول مزيف",
        phone: "+2010" + Math.floor(10000000 + Math.random() * 89999999),
        role: "admin",
      }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /مسؤول نظام/);
  });

  await testCase("6c. Non-admin caller calling PATCH /api/admin/users/[id] is rejected (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/users/${seekerAlice.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: seekerAliceCookie,
      },
      body: JSON.stringify({ role: "admin", roleReason: "محاولة اختراق" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  // ============================================================================
  // Scenario 7: Unauthorized property updates & direct publication attempts
  // ============================================================================
  await testCase("7a. Cross-user property update PUT /api/properties/[id] is rejected (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties/${publishedPropId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerBCookie,
      },
      body: JSON.stringify({ title: "عنوان مخترق" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير مصرح/);
  });

  await testCase("7b. Cross-user property status change PATCH /api/properties/[id] is rejected (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties/${publishedPropId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerBCookie,
      },
      body: JSON.stringify({ status: "paused" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await testCase("7c. Cross-user property deletion DELETE /api/properties/[id] is rejected (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/properties/${publishedPropId}`, {
      method: "DELETE",
      headers: {
        Cookie: ownerBCookie,
      },
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  await testCase("7d. Legitimate Owner A cannot force status='published' directly (403)", async () => {
    // Owner A creates a draft
    const createRes = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerACookie,
      },
      body: JSON.stringify({
        title: "عقار جديد للمالك أ بانتظار الموافقة",
        description: "تفاصيل العقار للمالك أ",
        price: 2100000,
        areaSqM: 130,
        lat: 30.0444,
        lng: 31.2357,
        status: "draft",
      }),
    });
    const createData = await createRes.json();
    const ownerADraftId = createData.property.id;

    // Owner A attempts to force status: 'published' directly without admin moderation
    const res = await fetch(`${BASE_URL}/api/properties/${ownerADraftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerACookie,
      },
      body: JSON.stringify({ status: "published" }),
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /يتطلب نشر العقار موافقة الإدارة/);
  });

  // ============================================================================
  // Scenario 8: Upload validation failures and IDOR checks
  // ============================================================================
  await testCase("8a. Upload to nonexistent propertyId is rejected (404)", async () => {
    const formData = new FormData();
    formData.append("propertyId", crypto.randomUUID());
    formData.append("file", new Blob(["fake-image-bytes"], { type: "image/jpeg" }), "photo.jpg");

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        Cookie: ownerACookie,
      },
      body: formData,
    });
    assert.equal(res.status, 404, `Expected 404 Not Found, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير موجود/);
  });

  await testCase("8b. Upload to another user's property is rejected (403)", async () => {
    const formData = new FormData();
    formData.append("propertyId", publishedPropId);
    formData.append("file", new Blob(["fake-image-bytes"], { type: "image/jpeg" }), "photo.jpg");

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        Cookie: ownerBCookie, // Owner B does not own publishedPropId
      },
      body: formData,
    });
    assert.equal(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert.match(data.error, /غير مصرح لك بإرفاق صور لعقار لا تملكه/);
  });

  await testCase("8c. Upload without file payload is rejected (400)", async () => {
    const formData = new FormData();
    formData.append("propertyId", "draft");

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      headers: {
        Cookie: ownerACookie,
      },
      body: formData,
    });
    assert.equal(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
  });

  console.log("\n================================================================================");
  console.log(`  ALL ${passedTests}/${totalTests} REAL API INTEGRATION TESTS PASSED WITH ZERO FAILURES!  `);
  console.log("================================================================================\n");
}

runRealApiSecurityTests().catch((err) => {
  console.error("\n❌ Test Suite Aborted with Error:", err);
  process.exit(1);
});
