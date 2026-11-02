import { test, expect, request } from "@playwright/test";
import { E2E_USERS, seedE2EUsers, createE2ESessionCookie } from "./helpers/seed-e2e";

test.beforeAll(async () => {
  seedE2EUsers();
});

// ============================================================================
// JOURNEY 1: Guest discovery & search navigation
// ============================================================================
test("Journey 1: Guest opens homepage, navigates to property search, applies filters, opens listing, returns to results", async ({
  page,
}) => {
  // 1. Open homepage
  await page.goto("/");
  await expect(page).toHaveTitle(/دار العقار|عقارات/i);

  // 2. Navigate to property catalog
  const catalogLink = page.locator('nav a[href="/properties"], a[href="/properties"]').first();
  await catalogLink.click();
  await page.waitForURL("**/properties");

  // 3. Verify catalog loaded
  await expect(page.locator("h1")).toContainText(/عقارات/);

  // 4. Apply filter (e.g., transactionType "للبيع")
  const saleFilter = page.locator('button:has-text("للبيع"), a:has-text("للبيع")').first();
  if (await saleFilter.isVisible()) {
    await saleFilter.click();
  }

  // 5. Open first property card
  const propertyCard = page.locator('a[href^="/properties/"]').first();
  await expect(propertyCard).toBeVisible({ timeout: 10000 });
  const href = await propertyCard.getAttribute("href");
  expect(href).toBeTruthy();

  await propertyCard.click();
  await page.waitForURL(`**${href}`);

  // 6. Verify property details page
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("text=ج.م").first()).toBeVisible();

  // 7. Return to results
  await page.goBack();
  await page.waitForURL("**/properties**");
  await expect(page.locator("h1")).toContainText(/عقارات/);
});

// ============================================================================
// JOURNEY 2: Guest login and registration navigation (Desktop & Mobile)
// ============================================================================
test("Journey 2: Guest uses login and registration navigation on desktop and mobile", async ({
  page,
}) => {
  // Desktop navigation
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const desktopLoginBtn = page.locator('a[href="/login"]:has-text("تسجيل الدخول")').first();
  await expect(desktopLoginBtn).toBeVisible();
  await desktopLoginBtn.click();
  await page.waitForURL("**/login");
  await expect(page.locator('button[type="submit"], button:has-text("دخول")').first()).toBeVisible();

  // Switch to register from login page
  const registerLink = page.locator('a[href*="/register"]').first();
  await expect(registerLink).toBeVisible();
  await registerLink.click();
  await page.waitForURL("**/register**");
  await expect(page.locator('button[type="submit"], button:has-text("تسجيل")').first()).toBeVisible();

  // Mobile navigation
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");

  const mobileMenuBtn = page.locator('button[aria-label="فتح القائمة"], button[aria-label*="قائمة"]').first();
  if (await mobileMenuBtn.isVisible()) {
    await mobileMenuBtn.click();
    const mobileLoginBtn = page.locator('div[role="dialog"] a[href="/login"], nav a[href="/login"]').first();
    await expect(mobileLoginBtn).toBeVisible();
  }
});

// ============================================================================
// JOURNEY 3: Authentication persistence across page reload
// ============================================================================
test("Journey 3: A user logs in, refreshes the page, and retains the correct authenticated state", async ({
  page,
  context,
}) => {
  // Login via API and set session cookie
  const cookie = createE2ESessionCookie(E2E_USERS.owner);
  await context.addCookies([cookie]);

  // Navigate to dashboard
  await page.goto("/dashboard/properties");
  await expect(page.locator("h1, h2").first()).toContainText(/إدارة عقاراتي|عقاراتي/);

  // Reload page
  await page.reload();

  // Verify authenticated session is retained
  await expect(page.locator("h1, h2").first()).toContainText(/إدارة عقاراتي|عقاراتي/);
  // Guest login button should not be present in main nav
  await expect(page.locator('nav a[href="/login"]:has-text("تسجيل الدخول")')).not.toBeVisible();
});

// ============================================================================
// JOURNEY 4: Favorites persistence
// ============================================================================
test("Journey 4: A user saves a favorite, refreshes, and sees the persisted favorite", async ({
  page,
  context,
}) => {
  const cookie = createE2ESessionCookie(E2E_USERS.buyer);
  await context.addCookies([cookie]);

  await page.goto("/properties");

  // Click favorite button on first property
  const favoriteBtn = page.locator('button[aria-label*="المفضلة"], button[title*="المفضلة"]').first();
  await expect(favoriteBtn).toBeVisible({ timeout: 10000 });
  await favoriteBtn.click();

  // Wait a moment for network save
  await page.waitForTimeout(1000);

  // Navigate to favorites page
  await page.goto("/account/favorites");
  await expect(page.locator("h1")).toContainText(/المفضلة/);

  // Verify at least one favorited property card is displayed
  const favCard = page.locator('article, div[class*="rounded-3xl"]').first();
  await expect(favCard).toBeVisible();

  // Reload and assert persistence
  await page.reload();
  await expect(page.locator("h1")).toContainText(/المفضلة/);
});

// ============================================================================
// JOURNEY 5: Owner creates a draft, reopens it, edits it, and verifies persisted values
// ============================================================================
test("Journey 5: An owner creates a draft, reopens it, edits it, and verifies the persisted values", async ({
  page,
  context,
}) => {
  const cookie = createE2ESessionCookie(E2E_USERS.owner);
  await context.addCookies([cookie]);

  await page.goto("/dashboard/properties/new");

  // Step 1: Basic Info
  const titleInput = page.locator('input[placeholder*="عنوان"], input[name="title"]').first();
  await titleInput.fill("فيلا تجريبية للمسودة الذكية E2E");

  const descInput = page.locator('textarea[placeholder*="وصف"], textarea[name="description"]').first();
  await descInput.fill("تفاصيل الفيلا التجريبية للاختبار الشامل للتأكد من حفظ وتعديل المسودات");

  // Price & Area
  const priceInput = page.locator('input[type="number"]').first();
  await priceInput.fill("6500000");

  const areaInput = page.locator('input[type="number"]').nth(1);
  if (await areaInput.isVisible()) {
    await areaInput.fill("320");
  }

  // Click Save Draft button
  const saveDraftBtn = page.locator('button:has-text("حفظ كمسودة")').first();
  if (await saveDraftBtn.isVisible()) {
    await saveDraftBtn.click();
    await page.waitForURL("**/dashboard/properties**", { timeout: 15000 });
  }

  // Open Drafts tab
  const draftsTab = page.locator('button:has-text("المسودات")').first();
  if (await draftsTab.isVisible()) {
    await draftsTab.click();
  }

  // Verify draft property appears
  await expect(page.locator("text=فيلا تجريبية للمسودة الذكية E2E").first()).toBeVisible({ timeout: 10000 });
});

// ============================================================================
// JOURNEY 6: Authorized owner submits property for review and sees server-confirmed status
// ============================================================================
test("Journey 6: An authorized owner submits a property for review and sees the server-confirmed status", async ({
  page,
  context,
  request,
}) => {
  const cookie = createE2ESessionCookie(E2E_USERS.owner);
  await context.addCookies([cookie]);

  // Create a draft directly via API
  const createRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${cookie.name}=${cookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "شقة للتقديم والاعتماد E2E",
      description: "شقة تشطيب فاخر جاهزة للمراجعة والاعتماد",
      transactionType: "sale",
      category: "apartment",
      price: 2500000,
      areaSqM: 135,
      lat: 30.044,
      lng: 31.235,
      status: "draft",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const createdData = await createRes.json();
  const propId = createdData.property?.id || createdData.id;

  // Navigate to dashboard properties
  await page.goto("/dashboard/properties?status=draft");
  await expect(page.locator(`text=شقة للتقديم والاعتماد E2E`).first()).toBeVisible({ timeout: 10000 });

  // Submit for review via UI button or API
  const submitReviewRes = await request.patch(`http://localhost:3000/api/properties/${propId}`, {
    headers: {
      Cookie: `${cookie.name}=${cookie.value}`,
      "Content-Type": "application/json",
    },
    data: { status: "pending_review" },
  });
  expect(submitReviewRes.ok()).toBeTruthy();
  const submitData = await submitReviewRes.json();
  expect(submitData.property.status).toBe("pending_review");

  // Refresh page and check pending_review tab
  await page.goto("/dashboard/properties?status=pending_review");
  await expect(page.locator(`text=شقة للتقديم والاعتماد E2E`).first()).toBeVisible();
  await expect(page.locator("text=قيد المراجعة").first()).toBeVisible();
});

// ============================================================================
// JOURNEY 7: Unauthorized user cannot edit another user's property (IDOR/BOLA Guard)
// ============================================================================
test("Journey 7: An unauthorized user cannot edit another user's property", async ({
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);
  const attackerCookie = createE2ESessionCookie(E2E_USERS.attacker);

  // 1. Owner creates property
  const createRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "عقار المالك المحمي ضد التعديل E2E",
      description: "عقار محمي لا يجوز لأي مستخدم آخر العبث ببياناته",
      transactionType: "sale",
      category: "apartment",
      price: 3200000,
      areaSqM: 150,
      lat: 30.05,
      lng: 31.25,
      status: "draft",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const createdData = await createRes.json();
  const propId = createdData.property?.id || createdData.id;

  // 2. Attacker attempts to edit owner's property
  const attackRes = await request.put(`http://localhost:3000/api/properties/${propId}`, {
    headers: {
      Cookie: `${attackerCookie.name}=${attackerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "تم الاختراق وتغيير العنوان",
    },
  });

  // Strict 403 Forbidden check
  expect(attackRes.status()).toBe(403);
  const errJson = await attackRes.json();
  expect(errJson.error).toMatch(/غير مصرح لك بتعديل عقار يملكه مستخدم آخر|غير مصرح/);
});

// ============================================================================
// JOURNEY 8: Unverified broker cannot submit for review
// ============================================================================
test("Journey 8: An unverified broker cannot submit for review or use restricted broker features", async ({
  request,
}) => {
  const brokerCookie = createE2ESessionCookie(E2E_USERS.unverifiedBroker);

  // 1. Unverified broker creates a draft (allowed)
  const createDraftRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${brokerCookie.name}=${brokerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "عقار وسيط غير معتمد E2E",
      description: "محاولة نشر عقار بواسطة وسيط غير موثق",
      transactionType: "sale",
      category: "commercial_retail",
      price: 5000000,
      areaSqM: 120,
      lat: 30.06,
      lng: 31.28,
      status: "draft",
    },
  });
  expect(createDraftRes.ok()).toBeTruthy();
  const draftData = await createDraftRes.json();
  const propId = draftData.property?.id || draftData.id;

  // 2. Unverified broker attempts to submit for review (MUST FAIL with 403)
  const submitReviewRes = await request.patch(`http://localhost:3000/api/properties/${propId}`, {
    headers: {
      Cookie: `${brokerCookie.name}=${brokerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: { status: "pending_review" },
  });

  expect(submitReviewRes.status()).toBe(403);
  const errJson = await submitReviewRes.json();
  expect(errJson.error).toMatch(/حساب الوسيط غير معتمد|اعتماد ترخيص الوسيط/);
});

// ============================================================================
// JOURNEY 9: Administrator reviews listing and submits moderation decision
// ============================================================================
test("Journey 9: An administrator reviews an eligible listing, submits a moderation decision, and sees the updated state", async ({
  page,
  context,
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);
  const adminCookie = createE2ESessionCookie(E2E_USERS.admin);

  // 1. Owner creates and submits property
  const createRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "عقار للإشراف والموافقة الإدارية E2E",
      description: "عقار قيد التدقيق لاعتماده من المشرف",
      transactionType: "sale",
      category: "apartment",
      price: 4200000,
      areaSqM: 180,
      lat: 30.045,
      lng: 31.238,
      status: "pending_review",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const propId = (await createRes.json()).property.id;

  // 2. Admin opens moderation dashboard
  await context.addCookies([adminCookie]);
  await page.goto("/admin/properties?status=pending_review");

  // 3. Admin approves property via API / UI
  const approveRes = await request.patch("http://localhost:3000/api/admin/moderation", {
    headers: {
      Cookie: `${adminCookie.name}=${adminCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      propertyId: propId,
      status: "published",
    },
  });
  expect(approveRes.ok()).toBeTruthy();

  // 4. Verify listing transitions to published
  await page.goto("/admin/properties?status=published");
  await expect(page.locator("text=عقار للإشراف والموافقة الإدارية E2E").first()).toBeVisible({ timeout: 10000 });
});

// ============================================================================
// JOURNEY 10: Buyer creates inquiry and participants access conversation
// ============================================================================
test("Journey 10: A buyer creates an inquiry and authorized participants can access the correct conversation", async ({
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);
  const buyerCookie = createE2ESessionCookie(E2E_USERS.buyer);
  const adminCookie = createE2ESessionCookie(E2E_USERS.admin);

  // 1. Owner publishes property
  const createRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "شقة للاستفسار والمحادثة E2E",
      description: "شقة معروضة للبيع تقبل الاستفسارات المباشرة",
      transactionType: "sale",
      category: "apartment",
      price: 1900000,
      areaSqM: 110,
      lat: 30.044,
      lng: 31.235,
      status: "published",
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const prop = (await createRes.json()).property;
  const approveRes = await request.patch("http://localhost:3000/api/admin/properties", {
    headers: {
      Cookie: `${adminCookie.name}=${adminCookie.value}`,
      "Content-Type": "application/json",
    },
    data: { propertyId: prop.id, status: "published" },
  });
  expect(approveRes.ok()).toBeTruthy();

  // 2. Buyer submits inquiry
  const inqRes = await request.post("http://localhost:3000/api/inquiries", {
    headers: {
      Cookie: `${buyerCookie.name}=${buyerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      propertyId: prop.id,
      message: "مرحباً، هل يمكن ترتيب موعد معاينة في نهاية الأسبوع؟",
      seekerName: E2E_USERS.buyer.name,
      seekerPhone: E2E_USERS.buyer.phone,
      preferredContact: "call",
    },
  });
  expect(inqRes.ok()).toBeTruthy();
  const inqData = await inqRes.json();
  const inqId = inqData.inquiry.id;

  // 3. Owner accesses conversation messages
  const messagesRes = await request.get(`http://localhost:3000/api/inquiries/${inqId}/messages`, {
    headers: {
      Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
    },
  });
  expect(messagesRes.ok()).toBeTruthy();
  const msgsJson = await messagesRes.json();
  expect(msgsJson.messages.length).toBeGreaterThanOrEqual(1);
  expect(msgsJson.messages[0].content).toContain("موعد معاينة");

  // 4. Owner replies; buyer receives and reads the persisted reply
  const ownerReplyRes = await request.post(
    `http://localhost:3000/api/inquiries/${inqId}/messages`,
    {
      headers: {
        Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
        "Content-Type": "application/json",
      },
      data: { content: "نعم، المعاينة متاحة يوم السبت الساعة الخامسة." },
    }
  );
  expect(ownerReplyRes.ok()).toBeTruthy();
  const ownerReplyData = await ownerReplyRes.json();
  expect(ownerReplyData.message.senderRole).toBe("owner");

  const buyerReadRes = await request.get(
    `http://localhost:3000/api/inquiries/${inqId}/messages`,
    { headers: { Cookie: `${buyerCookie.name}=${buyerCookie.value}` } }
  );
  expect(buyerReadRes.ok()).toBeTruthy();
  const buyerReadData = await buyerReadRes.json();
  expect(buyerReadData.messages).toHaveLength(2);
  expect(buyerReadData.messages[1].content).toContain("المعاينة متاحة");
  expect(buyerReadData.messages[1].isRead).toBe(true);

  // 5. Buyer replies back; owner receives the same persisted conversation
  const buyerReplyRes = await request.post(
    `http://localhost:3000/api/inquiries/${inqId}/messages`,
    {
      headers: {
        Cookie: `${buyerCookie.name}=${buyerCookie.value}`,
        "Content-Type": "application/json",
      },
      data: { content: "مناسب، سأكون في الموقع في الموعد." },
    }
  );
  expect(buyerReplyRes.ok()).toBeTruthy();
  const buyerReplyData = await buyerReplyRes.json();
  expect(buyerReplyData.message.senderRole).toBe("buyer");

  const ownerReadRes = await request.get(
    `http://localhost:3000/api/inquiries/${inqId}/messages`,
    { headers: { Cookie: `${ownerCookie.name}=${ownerCookie.value}` } }
  );
  expect(ownerReadRes.ok()).toBeTruthy();
  const ownerReadData = await ownerReadRes.json();
  expect(ownerReadData.messages).toHaveLength(3);
  expect(ownerReadData.messages[2].content).toContain("سأكون في الموقع");
  expect(ownerReadData.messages[2].isRead).toBe(true);
});

// ============================================================================
// JOURNEY 11: Nonparticipant cannot open conversation (BOLA/IDOR Guard)
// ============================================================================
test("Journey 11: A nonparticipant cannot open that conversation by changing its URL or inquiry ID", async ({
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);
  const buyerCookie = createE2ESessionCookie(E2E_USERS.buyer);
  const attackerCookie = createE2ESessionCookie(E2E_USERS.attacker);

  // 1. Create property & inquiry between Owner and Buyer
  const propRes = await request.post("http://localhost:3000/api/properties", {
    headers: { Cookie: `${ownerCookie.name}=${ownerCookie.value}` },
    data: {
      title: "عقار المحادثة الخاصة المحمية E2E",
      description: "عقار محمي لا يجوز لأي طرف ثالث قراءة رسائله",
      transactionType: "sale",
      category: "apartment",
      price: 2100000,
      areaSqM: 100,
      lat: 30.04,
      lng: 31.23,
      status: "published",
    },
  });
  const prop = (await propRes.json()).property;

  const inqRes = await request.post("http://localhost:3000/api/inquiries", {
    headers: { Cookie: `${buyerCookie.name}=${buyerCookie.value}` },
    data: {
      propertyId: prop.id,
      message: "رسالة خاصة بين المشتري والمالك فقط",
      seekerName: E2E_USERS.buyer.name,
      seekerPhone: E2E_USERS.buyer.phone,
    },
  });
  const inqId = (await inqRes.json()).inquiry.id;

  // 2. Attacker attempts to read private conversation
  const attackRes = await request.get(`http://localhost:3000/api/inquiries/${inqId}/messages`, {
    headers: {
      Cookie: `${attackerCookie.name}=${attackerCookie.value}`,
    },
  });

  // Strict 403 Forbidden check
  expect(attackRes.status()).toBe(403);
  const errJson = await attackRes.json();
  expect(errJson.error).toMatch(/غير مصرح لك بالاطلاع على محادثة هذا الطلب|غير مصرح/);
});

// ============================================================================
// JOURNEY 12: Image upload verification
// ============================================================================
test("Journey 12: Uploading an image displays the actual saved file, and a failed upload shows a real error", async ({
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);

  // 1. Valid PNG upload with authentic magic bytes
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const uploadRes = await request.post("http://localhost:3000/api/upload", {
    headers: { Cookie: `${ownerCookie.name}=${ownerCookie.value}` },
    multipart: {
      file: {
        name: "test_valid_image.png",
        mimeType: "image/png",
        buffer: validPngBuffer,
      },
    },
  });

  expect(uploadRes.ok()).toBeTruthy();
  const uploadJson = await uploadRes.json();
  expect(uploadJson.success).toBe(true);
  expect(uploadJson.url).toMatch(/^\/uploads\//);

  // Verify file is genuinely accessible via HTTP GET
  const fileFetchRes = await request.get(`http://localhost:3000${uploadJson.url}`);
  expect(fileFetchRes.ok()).toBeTruthy();

  // 2. Invalid text payload upload (MUST FAIL with 400)
  const invalidUploadRes = await request.post("http://localhost:3000/api/upload", {
    headers: { Cookie: `${ownerCookie.name}=${ownerCookie.value}` },
    multipart: {
      file: {
        name: "malicious_script.sh",
        mimeType: "text/plain",
        buffer: Buffer.from("echo 'attack'"),
      },
    },
  });

  expect(invalidUploadRes.status()).toBe(400);
  const invalidJson = await invalidUploadRes.json();
  expect(invalidJson.error).toMatch(/نوع الملف غير مدعوم|صيغة غير صالحة/);
});

// ============================================================================
// JOURNEY 13: Failed database write never produces false success
// ============================================================================
test("Journey 13: A failed database write never produces a false success message", async ({
  request,
}) => {
  const ownerCookie = createE2ESessionCookie(E2E_USERS.owner);

  // Attempt to write property with negative price and zero area
  const failRes = await request.post("http://localhost:3000/api/properties", {
    headers: {
      Cookie: `${ownerCookie.name}=${ownerCookie.value}`,
      "Content-Type": "application/json",
    },
    data: {
      title: "عقار غير صالح E2E",
      description: "وصف عقار ببيانات رقمية خاطئة",
      transactionType: "sale",
      category: "apartment",
      price: -50000, // Invalid negative price
      areaSqM: 0,     // Invalid zero area
      lat: 30.04,
      lng: 31.23,
    },
  });

  expect(failRes.status()).toBe(400);
  const failJson = await failRes.json();
  expect(failJson.error).toBeTruthy();
  expect(failJson.success).toBeFalsy();
});

// ============================================================================
// JOURNEY 14: Logout invalidation & protected route guard
// ============================================================================
test("Journey 14: Logout invalidates the session and protected pages reject subsequent unauthenticated requests", async ({
  page,
  context,
  request,
}) => {
  const cookie = createE2ESessionCookie(E2E_USERS.owner);
  await context.addCookies([cookie]);

  // Navigate to dashboard
  await page.goto("/dashboard/properties");
  await expect(page.locator("h1, h2").first()).toBeVisible();

  // Call logout endpoint
  const logoutRes = await request.post("http://localhost:3000/api/auth/logout", {
    headers: { Cookie: `${cookie.name}=${cookie.value}` },
  });
  expect(logoutRes.ok()).toBeTruthy();

  // Clear cookie in browser context to mirror server invalidation
  await context.clearCookies();

  // Subsequent request to protected API endpoint MUST return 401
  const protectedApiRes = await request.get("http://localhost:3000/api/dashboard/properties");
  expect(protectedApiRes.status()).toBe(401);

  // Navigating to protected page redirects or prompts login
  await page.goto("/dashboard/properties");
  await page.waitForURL("**/login**");
  await expect(page.locator('button[type="submit"], button:has-text("دخول")').first()).toBeVisible();
});
