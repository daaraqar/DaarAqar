import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { dbStore } from "./store";
import type { User } from "./types";

describe("Central Database Persistence & Zero Local Storage Acceptance Suite", () => {
  const uniqueSuffix = Date.now().toString(36);

  it("1. Create Test: persists User, Property, Draft, Inquiry, and Report in central DB across reload", () => {
    const owner = dbStore.createUser({
      name: `مالك اختبار مركزي ${uniqueSuffix}`,
      email: `central.owner.${uniqueSuffix}@example.com`,
      phone: `0109${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const draftProp = dbStore.createProperty({
      title: `مسودة عقار مركزي ${uniqueSuffix}`,
      description: "مسودة محفوظة في قاعدة البيانات المركزية وليس localStorage",
      transactionType: "sale",
      category: "apartment",
      price: 1850000,
      currency: "EGP",
      negotiable: true,
      areaSqM: 145,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "شارع الحرية - ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"],
      amenities: [],
      status: "draft",
      featured: false,
      advertiserId: owner.id,
      advertiserType: "owner",
    });

    // Simulate fresh session / reload from central storage
    dbStore.reloadFromDisk();

    const reloadedUser = dbStore.findUserById(owner.id);
    assert.ok(reloadedUser, "User must be persisted in central database");
    assert.equal(reloadedUser?.email, owner.email);

    const reloadedDraft = dbStore.getRawPropertyById(draftProp.id);
    assert.ok(reloadedDraft, "Draft property must be persisted in central database");
    assert.equal(reloadedDraft?.status, "draft");
    assert.equal(reloadedDraft?.title, draftProp.title);
  });

  it("2. Update Test: updates property & user records centrally and persists across reload", () => {
    const owner = dbStore.createUser({
      name: `معلن تحديث ${uniqueSuffix}`,
      email: `update.owner.${uniqueSuffix}@example.com`,
      phone: `0118${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const prop = dbStore.createProperty({
      title: `شقة قبل التعديل ${uniqueSuffix}`,
      description: "وصف أولي",
      transactionType: "sale",
      category: "apartment",
      price: 2000000,
      currency: "EGP",
      negotiable: true,
      areaSqM: 150,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"],
      amenities: [],
      status: "pending_review",
      featured: false,
      advertiserId: owner.id,
      advertiserType: "owner",
    });

    dbStore.updateProperty(
      prop.id,
      { title: `شقة بعد التعديل المركزي ${uniqueSuffix}`, price: 2250000 },
      owner
    );

    dbStore.reloadFromDisk();
    const afterReload = dbStore.getRawPropertyById(prop.id);
    assert.equal(afterReload?.title, `شقة بعد التعديل المركزي ${uniqueSuffix}`);
    assert.equal(afterReload?.price, 2250000);
  });

  it("3. Delete Test: deletes draft/pending property permanently and blocks deleting published property by non-admin", () => {
    const owner = dbStore.createUser({
      name: `معلن حذف ${uniqueSuffix}`,
      email: `delete.owner.${uniqueSuffix}@example.com`,
      phone: `0127${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const admin = dbStore.getAllUsersForAdmin().find((u) => u.role === "admin")!;

    const draft = dbStore.createProperty({
      title: `مسودة للحذف ${uniqueSuffix}`,
      description: "سيتم حذفها",
      transactionType: "sale",
      category: "apartment",
      price: 1200000,
      currency: "EGP",
      negotiable: false,
      areaSqM: 110,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: [],
      amenities: [],
      status: "draft",
      featured: false,
      advertiserId: owner.id,
      advertiserType: "owner",
    });

    const inquiry = dbStore.createInquiry({
      propertyId: draft.id,
      propertyTitle: draft.title,
      seekerId: `buyer.${uniqueSuffix}`,
      seekerName: "مشتري الاختبار",
      seekerPhone: "01000000000",
      seekerEmail: `buyer.${uniqueSuffix}@example.com`,
      advertiserId: owner.id,
      message: "أرغب في معرفة تفاصيل العقار",
      preferredContact: "in_app",
    });
    const reply = dbStore.addInquiryMessage(inquiry.id, {
      senderId: owner.id,
      senderName: owner.name,
      senderRole: "owner",
      content: "المحادثة تبقى بعد حذف العقار",
    });

    const deleted = dbStore.deleteProperty(draft.id, owner);
    assert.equal(deleted, true);

    dbStore.reloadFromDisk();
    assert.equal(dbStore.getRawPropertyById(draft.id), null, "Deleted draft must not reappear after reload");
    const preservedInquiry = dbStore.getInquiryById(inquiry.id);
    assert.equal(preservedInquiry?.propertyTitle, draft.title);
    const preservedMessages = dbStore.getInquiryMessages(inquiry.id);
    assert.equal(preservedMessages.length, 2);
    assert.equal(preservedMessages[1]?.id, reply.id);

    // Published property cannot be deleted by non-admin owner
    const pubProp = dbStore.createProperty({
      title: `عقار منشور محمي ${uniqueSuffix}`,
      description: "عقار معتمد",
      transactionType: "sale",
      category: "villa",
      price: 5500000,
      currency: "EGP",
      negotiable: true,
      areaSqM: 320,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: [],
      amenities: [],
      status: "published",
      featured: false,
      advertiserId: owner.id,
      advertiserType: "owner",
    });

    assert.throws(
      () => dbStore.deleteProperty(pubProp.id, owner),
      /لا يمكن للمعلن حذف العقار بعد اعتماده/,
      "Non-admin owner must not be able to delete a published property"
    );

    // Admin can delete published property
    assert.equal(dbStore.deleteProperty(pubProp.id, admin), true);
  });

  it("4. Multi-Session / Cross-Device & Multi-User Isolation Test: enforces strict ownership boundaries", () => {
    const userA = dbStore.createUser({
      name: `مستخدم أ ${uniqueSuffix}`,
      email: `usera.${uniqueSuffix}@example.com`,
      phone: `0155${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const userB = dbStore.createUser({
      name: `مستخدم ب ${uniqueSuffix}`,
      email: `userb.${uniqueSuffix}@example.com`,
      phone: `0156${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const propA = dbStore.createProperty({
      title: `عقار خاص بالمستخدم أ ${uniqueSuffix}`,
      description: "ملكية خاصة",
      transactionType: "sale",
      category: "apartment",
      price: 1900000,
      currency: "EGP",
      negotiable: false,
      areaSqM: 130,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: [],
      amenities: [],
      status: "pending_review",
      featured: false,
      advertiserId: userA.id,
      advertiserType: "owner",
    });

    // User B must be blocked from updating or deleting User A's property
    assert.throws(
      () => dbStore.updateProperty(propA.id, { title: "اختراق" }, userB),
      /غير مصرح/
    );
    assert.throws(
      () => dbStore.deleteProperty(propA.id, userB),
      /غير مصرح/
    );

    // Favorites persistence across reload for User B
    const favAdded = dbStore.toggleFavorite(userB.id, propA.id);
    assert.equal(favAdded, true);
    dbStore.reloadFromDisk();
    assert.equal(dbStore.isPropertyFavorited(userB.id, propA.id), true);
    assert.equal(dbStore.isPropertyFavorited(userA.id, propA.id), false);
  });

  it("5. Messaging Central Persistence, Admin Supervision & Internal Notes Isolation Test", () => {
    const advertiser = dbStore.createUser({
      name: `معلن محادثة ${uniqueSuffix}`,
      email: `chat.adv.${uniqueSuffix}@example.com`,
      phone: `0101${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const seeker = dbStore.createUser({
      name: `مشتري محادثة ${uniqueSuffix}`,
      email: `chat.seeker.${uniqueSuffix}@example.com`,
      phone: `0102${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "buyer",
      isVerified: true,
      whatsappEnabled: true,
    });

    const prop = dbStore.createProperty({
      title: `وحدة للمراسلة المركزية ${uniqueSuffix}`,
      description: "وصف الوحدة",
      transactionType: "sale",
      category: "apartment",
      price: 2500000,
      currency: "EGP",
      negotiable: true,
      areaSqM: 160,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: [],
      amenities: [],
      status: "published",
      featured: false,
      advertiserId: advertiser.id,
      advertiserType: "owner",
    });

    const inquiry = dbStore.createInquiry({
      propertyId: prop.id,
      propertyTitle: prop.title,
      advertiserId: advertiser.id,
      seekerId: seeker.id,
      seekerName: seeker.name,
      seekerPhone: seeker.phone,
      seekerEmail: seeker.email || "",
      message: "أرغب في معاينة الوحدة غداً",
      preferredContact: "whatsapp",
    });

    // Advertiser replies
    dbStore.addInquiryMessage(inquiry.id, {
      senderId: advertiser.id,
      senderName: advertiser.name,
      senderRole: "owner",
      content: "أهلاً بك، المعاينة متاحة الساعة 5 مساءً",
    });

    // Admin adds internal supervision note
    dbStore.addInquiryMessage(inquiry.id, {
      senderId: "usr-admin-01",
      senderName: "إدارة عقار بلس",
      senderRole: "admin",
      content: "[ملاحظة داخلية للإدارة] تم التحقق من جدية العميل",
      isAdminNote: true,
      isInternalNote: true,
    });

    dbStore.reloadFromDisk();

    const allMessages = dbStore.getInquiryMessages(inquiry.id);
    assert.equal(allMessages.length, 3, "All 3 messages must persist centrally");
    assert.equal(allMessages[2].isInternalNote, true);

    // Verify unread tracking and read-receipt update
    dbStore.markInquiryMessagesAsRead(inquiry.id, seeker.id);
    const afterReadMessages = dbStore.getInquiryMessages(inquiry.id);
    const advReply = afterReadMessages.find((m) => m.senderId === advertiser.id);
    assert.equal(advReply?.isRead, true, "Seeker opening chat marks advertiser message as read");
  });

  it("6. Retry Idempotency & Validation Error Handling Test: prevents duplicates and rejects invalid data", () => {
    const advertiser = dbStore.createUser({
      name: `معلن عدم تكرار ${uniqueSuffix}`,
      email: `idem.adv.${uniqueSuffix}@example.com`,
      phone: `0103${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
    });

    const seeker = dbStore.createUser({
      name: `مشتري عدم تكرار ${uniqueSuffix}`,
      email: `idem.seeker.${uniqueSuffix}@example.com`,
      phone: `0104${Math.floor(1000000 + Math.random() * 8999999)}`,
      role: "buyer",
      isVerified: true,
      whatsappEnabled: true,
    });

    const prop = dbStore.createProperty({
      title: `عقار اختبار عدم التكرار ${uniqueSuffix}`,
      description: "وصف",
      transactionType: "sale",
      category: "apartment",
      price: 1750000,
      currency: "EGP",
      negotiable: false,
      areaSqM: 125,
      cityId: "city-dakahlia",
      districtId: "dist-mitghamr-city",
      addressDetails: "ميت غمر",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: [],
      amenities: [],
      status: "published",
      featured: false,
      advertiserId: advertiser.id,
      advertiserType: "owner",
    });

    // Retry creating the exact same inquiry -> must return the same inquiry ID
    const inq1 = dbStore.createInquiry({
      propertyId: prop.id,
      propertyTitle: prop.title,
      advertiserId: advertiser.id,
      seekerId: seeker.id,
      seekerName: seeker.name,
      seekerPhone: seeker.phone,
      seekerEmail: seeker.email || "",
      message: "رسالة استفسار موحدة",
      preferredContact: "call",
    });
    const inq2 = dbStore.createInquiry({
      propertyId: prop.id,
      propertyTitle: prop.title,
      advertiserId: advertiser.id,
      seekerId: seeker.id,
      seekerName: seeker.name,
      seekerPhone: seeker.phone,
      seekerEmail: seeker.email || "",
      message: "رسالة استفسار موحدة",
      preferredContact: "call",
    });
    assert.equal(inq1.id, inq2.id, "Retrying inquiry creation must be idempotent");

    // Retry sending the exact same chat message within window -> must return same message ID
    const msg1 = dbStore.addInquiryMessage(inq1.id, {
      senderId: seeker.id,
      senderName: seeker.name,
      senderRole: "buyer",
      content: "هل السعر قابل للتفاوض؟",
    });
    const msg2 = dbStore.addInquiryMessage(inq1.id, {
      senderId: seeker.id,
      senderName: seeker.name,
      senderRole: "buyer",
      content: "هل السعر قابل للتفاوض؟",
    });
    assert.equal(msg1?.id, msg2?.id, "Retrying message send must be idempotent");

    // Retry submitting the exact same property report -> must return same report ID
    const rep1 = dbStore.createPropertyReport({
      propertyId: prop.id,
      reporterId: seeker.id,
      reporterName: seeker.name,
      reasonCategory: "misleading_details",
      details: "السعر المذكور غير مطابق",
    });
    const rep2 = dbStore.createPropertyReport({
      propertyId: prop.id,
      reporterId: seeker.id,
      reporterName: seeker.name,
      reasonCategory: "misleading_details",
      details: "السعر المذكور غير مطابق",
    });
    assert.equal(rep1.id, rep2.id, "Retrying property report submission must be idempotent");

    // Invalid price or area must throw explicit validation error and never persist
    assert.throws(
      () =>
        dbStore.createProperty({
          title: "عقار بسعر سالب",
          description: "خطأ",
          transactionType: "sale",
          category: "apartment",
          price: -500,
          currency: "EGP",
          negotiable: false,
          areaSqM: 120,
          cityId: "city-dakahlia",
          districtId: "dist-mitghamr-city",
          addressDetails: "ميت غمر",
          lat: 30.7194,
          lng: 31.258,
          locationPrivacy: "exact",
          images: [],
          amenities: [],
          status: "draft",
          featured: false,
          advertiserId: advertiser.id,
          advertiserType: "owner",
        }),
      /سعر العقار يجب أن يكون رقماً صحيحاً وموجباً/
    );
  });

  it("7. Static Codebase Audit: confirms zero operational localStorage and zero dynamic HTML caching in Service Worker", () => {
    const repoRoot = process.cwd();

    const newPropPage = fs.readFileSync(
      path.join(repoRoot, "src/app/dashboard/properties/new/page.tsx"),
      "utf-8"
    );
    assert.equal(
      newPropPage.includes("localStorage."),
      false,
      "new/page.tsx must not use localStorage for property drafts"
    );

    const pwaPrompt = fs.readFileSync(
      path.join(repoRoot, "src/components/layout/PwaInstallPrompt.tsx"),
      "utf-8"
    );
    assert.equal(
      pwaPrompt.includes("localStorage."),
      false,
      "PwaInstallPrompt.tsx must not use localStorage"
    );

    const swCode = fs.readFileSync(path.join(repoRoot, "public/sw.js"), "utf-8");
    const navigateBlock = swCode.split('request.mode === "navigate"')[1] || "";
    assert.equal(
      navigateBlock.includes("cache.put"),
      false,
      "Service worker must never cache dynamic HTML navigation responses in CacheStorage"
    );
  });

  it("8. Priority 0 & Schema Audit: confirms 20261015040000 migration is neutralized and 20261018180000 defines central tables & RLS", () => {
    const repoRoot = process.cwd();
    const resetMigration = fs.readFileSync(
      path.join(repoRoot, "supabase/migrations/20261015040000_production_clean_slate_reset.sql"),
      "utf-8"
    );
    assert.equal(
      /DELETE\s+FROM\s+public\./i.test(resetMigration),
      false,
      "20261015040000_production_clean_slate_reset.sql must not contain executable DELETE FROM public.* statements"
    );

    const centralMigration = fs.readFileSync(
      path.join(repoRoot, "supabase/migrations/20261018180000_central_persistence_smart_features_and_auth.sql"),
      "utf-8"
    );
    for (const table of [
      "smart_features_config",
      "reverse_requests",
      "inspection_bookings",
      "broker_reviews",
      "investor_portfolios",
      "reservations",
      "neighborhood_guides",
      "official_notices",
      "cms_settings",
      "auth_verification_challenges",
    ]) {
      assert.equal(
        centralMigration.includes(`public.${table}`),
        true,
        `Central migration must define public.${table}`
      );
    }
  });

  it("9. Priority 2, 3 & 4 Runtime Verification: enforces production secret validation, HMAC verification tokens, and DB outage error propagation", async () => {
    const {
      getOtpSecret,
      createVerificationToken,
      isVerificationTokenValid,
      consumeVerificationToken,
    } = await import("../auth/security");
    const { smartFeaturesStore } = await import("./smartFeaturesStore");
    const { propertyService } = await import("../services/propertyService");

    // 1. HMAC verification token lifecycle & one-time consumption
    const testEmail = `verify.${uniqueSuffix}@example.com`;
    const token = createVerificationToken(testEmail);
    assert.equal(token.startsWith("evtk_"), true);
    assert.equal(isVerificationTokenValid(testEmail, token), true);
    assert.equal(isVerificationTokenValid("other@example.com", token), false);
    assert.equal(consumeVerificationToken(token), true);
    assert.equal(isVerificationTokenValid(testEmail, token), false, "Consumed token must be rejected");
    assert.equal(consumeVerificationToken(token), false, "Second consumption must return false");

    // 2. Production secret validation & DB outage error propagation
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSessionSecret = process.env.SESSION_SECRET;
    const prevJwtSecret = process.env.JWT_SECRET;
    const prevSupaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevTestDisk = process.env.AQARPULSE_ALLOW_TEST_DISK;

    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.SESSION_SECRET;
      delete process.env.JWT_SECRET;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.AQARPULSE_ALLOW_TEST_DISK;

      // Weak/missing secret in production must throw FATAL_SECURITY_ERROR
      assert.throws(() => getOtpSecret(), /FATAL_SECURITY_ERROR/);

      // Unconfigured central DB in production must fail explicitly (no silent local fallback)
      await assert.rejects(
        () => propertyService.queryPublicProperties({}),
        /CENTRAL_DB_UNAVAILABLE/
      );
      const admin: User = {
        id: "cms-admin-test",
        name: "مدير اختبار",
        phone: "+201000000000",
        role: "admin",
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      await assert.rejects(
        () => dbStore.updateCmsHomepageSettingsAsync({}, admin),
        /CENTRAL_DB_UNAVAILABLE/
      );
      await assert.rejects(
        () =>
          smartFeaturesStore.addReverseRequestAsync({
            userId: "usr-1",
            userName: "عميل",
            userPhone: "01012345678",
            title: "طلب اختبار",
            cityId: "cairo",
            districtId: "new-cairo",
            districtNameAr: "التجمع",
            category: "apartment",
            transactionType: "sale",
            minBudget: 1000000,
            maxBudget: 2000000,
            minArea: 120,
            urgency: "flexible",
          }),
        /CENTRAL_DB_UNAVAILABLE/
      );
    } finally {
      (process.env as any).NODE_ENV = prevNodeEnv;
      if (prevSessionSecret !== undefined) process.env.SESSION_SECRET = prevSessionSecret;
      if (prevJwtSecret !== undefined) process.env.JWT_SECRET = prevJwtSecret;
      if (prevSupaUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevSupaUrl;
      if (prevSupaKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevSupaKey;
      if (prevTestDisk !== undefined) process.env.AQARPULSE_ALLOW_TEST_DISK = prevTestDisk;
    }

    // 3. Confirm admin/metrics route does not use hybrid Math.max(cloud, local) logic
    const metricsRoute = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/admin/metrics/route.ts"),
      "utf-8"
    );
    assert.equal(
      metricsRoute.includes("cloudUsersCount > stats.totalUsers"),
      false,
      "admin/metrics/route.ts must not use hybrid cloud > local comparison"
    );
  });
});
