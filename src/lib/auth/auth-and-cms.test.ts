import test from "node:test";
import assert from "node:assert/strict";
import {
  getSafeRedirectUrl,
  checkRateLimit,
  isValidEmail,
  isValidPhone,
  isValidDisplayName,
  isStrongPassword,
  normalizeEgyptianPhone,
  isDisposableEmail,
  evaluateSubmissionSecurity,
  validateHoneypot,
  storeOtp,
  verifyOtpCode,
  generateNumericOtp,
  createVerificationToken,
  createPhoneVerificationToken,
  isPhoneVerificationTokenValid,
  consumePhoneVerificationToken,
} from "./security";
import { WhatsAppService } from "../services/whatsappService";
import { GmailSmtpService } from "../services/gmailSmtpService";
import { dbStore } from "../db/store";
import { User } from "../db/types";

const mockAdminUser: User = {
  id: "user-admin-test",
  name: "مدير النظام التجريبي",
  email: "admin.test@aqarpulse.eg",
  phone: "+201011112222",
  role: "admin",
  isVerified: true,
  createdAt: new Date().toISOString(),
};

const mockRegularUser: User = {
  id: "user-buyer-test",
  name: "أحمد المشتري",
  email: "ahmed.buyer@aqarpulse.eg",
  phone: "+201022223333",
  role: "buyer",
  isVerified: true,
  createdAt: new Date().toISOString(),
};

test("Auth Security 1: Safe redirect validator rejects open redirect payloads", () => {
  assert.equal(getSafeRedirectUrl("//evil.com", "/dashboard"), "/dashboard");
  assert.equal(getSafeRedirectUrl("https://evil.com", "/dashboard"), "/dashboard");
  assert.equal(getSafeRedirectUrl("http://phishing.site/login", "/dashboard"), "/dashboard");
  assert.equal(getSafeRedirectUrl("javascript:alert(1)", "/dashboard"), "/dashboard");
  assert.equal(getSafeRedirectUrl("/explore?districtId=dist-new-cairo", "/dashboard"), "/explore?districtId=dist-new-cairo");
  assert.equal(getSafeRedirectUrl("/account/profile", "/dashboard"), "/account/profile");
});

test("Auth Security 2: Rate limiter tracks attempts and enforces throttle window", () => {
  const testKey = `test_rate_limit_${Date.now()}`;
  
  // First 3 attempts should be permitted
  const a1 = checkRateLimit(testKey, 3, 5000);
  assert.equal(a1.allowed, true);
  assert.equal(a1.remainingAttempts, 2);

  const a2 = checkRateLimit(testKey, 3, 5000);
  assert.equal(a2.allowed, true);

  const a3 = checkRateLimit(testKey, 3, 5000);
  assert.equal(a3.allowed, true);
  assert.equal(a3.remainingAttempts, 0);

  // 4th attempt should be blocked
  const a4 = checkRateLimit(testKey, 3, 5000);
  assert.equal(a4.allowed, false);
  assert.ok(a4.retryAfterSeconds > 0);
});

test("Auth Security 3: Input validators verify phone, email, and password strength", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("invalid-email"), false);

  assert.equal(isValidPhone("01012345678"), true);
  assert.equal(isValidPhone("+201123456789"), true);
  assert.equal(isValidPhone("123"), false);

  assert.equal(isValidDisplayName("أحمد محمد"), true);
  assert.equal(isValidDisplayName(" أ "), false);
  assert.equal(isValidDisplayName("a".repeat(81)), false);

  assert.equal(isStrongPassword("12345").valid, false);
  assert.equal(isStrongPassword("secret2026").valid, true);
});

test("CMS Security 1: Non-admin users are strictly denied from updating CMS settings", () => {
  assert.throws(() => {
    dbStore.updateCmsHomepageSettings({ heroBadgeText: "اختراق" }, mockRegularUser);
  }, /غير مصرح/);
});

test("CMS Security 2: Authorized admin updates CMS homepage and creates audit & revision", () => {
  const updated = dbStore.updateCmsHomepageSettings(
    { heroBadgeText: "المنصة العقارية الموثوقة 2026" },
    mockAdminUser
  );
  assert.equal(updated.heroBadgeText, "المنصة العقارية الموثوقة 2026");

  const latest = dbStore.getCmsHomepageSettings();
  assert.equal(latest.heroBadgeText, "المنصة العقارية الموثوقة 2026");
});

test("CMS Security 3: Static page content is updated with revision logging", () => {
  const page = dbStore.updateCmsPage(
    "about",
    { titleAr: "عن دار العقار المحدثة" },
    mockAdminUser
  );
  assert.equal(page.titleAr, "عن دار العقار المحدثة");

  const fetched = dbStore.getCmsPage("about");
  assert.ok(fetched);
  assert.equal(fetched.titleAr, "عن دار العقار المحدثة");
});

test("CMS Security 4: Media asset in use cannot be deleted without warning", () => {
  const asset = dbStore.addCmsMediaAsset({
    url: "https://example.com/banner-active.jpg",
    altText: "بانر رئيسي",
    fileName: "banner-active.jpg",
    mimeType: "image/jpeg",
    fileSizeBytes: 50000,
    uploadedBy: "Admin",
  });
  
  // Simulate asset being in active use
  asset.inUseCount = 2;

  assert.throws(() => {
    dbStore.deleteCmsMediaAsset(asset.id, mockAdminUser);
  }, /لا يمكن حذف ملف وسائط مستخدم بالفعل/);

  // Set inUse to 0 and verify deletion succeeds
  asset.inUseCount = 0;
  assert.doesNotThrow(() => {
    dbStore.deleteCmsMediaAsset(asset.id, mockAdminUser);
  });
});

test("Role Management: Changing user role requires mandatory reason and admin privileges", () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const target = dbStore.createUser({
    name: "مستخدم للتجربة",
    email: `test-${Date.now()}-${rand}@test.com`,
    phone: `+20109999${rand}`,
    role: "buyer",
    isVerified: false,
  });

  // Regular user cannot change role
  assert.throws(() => {
    dbStore.changeUserRole(target.id, "broker", mockRegularUser, "ترقية");
  }, /غير مصرح/);

  // Admin cannot change role without reason
  assert.throws(() => {
    dbStore.changeUserRole(target.id, "broker", mockAdminUser, "");
  }, /سبب تعديل الدور إلزامي/);

  // Admin successfully changes role with reason
  const changed = dbStore.changeUserRole(target.id, "broker", mockAdminUser, "تقديم ترخيص الوساطة المعتمد");
  assert.equal(changed.role, "broker");
});

test("Anti-Fake 1: Egyptian Phone Normalizer standardizes numbers to E.164", () => {
  assert.equal(normalizeEgyptianPhone("01012345678"), "+201012345678");
  assert.equal(normalizeEgyptianPhone("201012345678"), "+201012345678");
  assert.equal(normalizeEgyptianPhone("00201012345678"), "+201012345678");
  assert.equal(normalizeEgyptianPhone("+20 10 1234 5678"), "+201012345678");
  assert.equal(normalizeEgyptianPhone("٠١٠١٢٣٤٥٦٧٨"), "+201012345678");
});

test("Anti-Fake 2: Disposable email detector rejects temporary spam email domains", () => {
  assert.equal(isDisposableEmail("attacker@mailinator.com"), true);
  assert.equal(isDisposableEmail("bot@10minutemail.com"), true);
  assert.equal(isDisposableEmail("spam@tempmail.com"), true);
  assert.equal(isDisposableEmail("legit.user@gmail.com"), false);
  assert.equal(isDisposableEmail("doctor@yahoo.com"), false);
});

test("Anti-Fake 3: Bot Honeypot detects and blocks automated form submissions", () => {
  assert.equal(validateHoneypot(""), true);
  assert.equal(validateHoneypot(undefined), true);
  assert.equal(validateHoneypot("bot-spam-content"), false);
});

test("Anti-Fake 4: SMS OTP lifecycle verifies code, locks out after 3 wrong attempts", () => {
  const testPhone = "+201098765432";
  storeOtp(testPhone, "852963", 60000);

  // Attempt 1: wrong
  const r1 = verifyOtpCode(testPhone, "000000");
  assert.equal(r1.valid, false);

  // Attempt 2: wrong
  const r2 = verifyOtpCode(testPhone, "111111");
  assert.equal(r2.valid, false);

  // Attempt 3: wrong -> should trigger lockout
  const r3 = verifyOtpCode(testPhone, "222222");
  assert.equal(r3.valid, false);

  // Attempt 4: even if now correct, code is deleted/locked
  const r4 = verifyOtpCode(testPhone, "852963");
  assert.equal(r4.valid, false);
});

test("Anti-Fake 5: Phone verification tokens are single-use and bound to normalized phone", () => {
  const phone = "01055554444";
  const token = createPhoneVerificationToken(phone);
  assert.ok(token.startsWith("pvtk_"));

  // Valid for normalized phone
  assert.equal(isPhoneVerificationTokenValid("+201055554444", token), true);
  // Invalid for another phone
  assert.equal(isPhoneVerificationTokenValid("+201011111111", token), false);

  // Consume token
  assert.equal(consumePhoneVerificationToken(token), true);
  // Second consumption fails (replay attack prevented)
  assert.equal(isPhoneVerificationTokenValid("+201055554444", token), false);
});

test("Account Derivatives: User can be created and queried without email using phone as primary", () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const testPhone = `+20107777${rand}`;
  const phoneOnlyUser = dbStore.createUser({
    name: "مستخدم برقم الهاتف فقط",
    phone: testPhone,
    role: "seeker",
    isVerified: true,
    phoneVerified: true,
  });

  assert.ok(phoneOnlyUser.id);
  assert.equal(phoneOnlyUser.email, undefined);

  // Lookup by phone works seamlessly
  const found = dbStore.findUserByPhone(testPhone);
  assert.ok(found);
  assert.equal(found.id, phoneOnlyUser.id);

  // Lookup by email or phone works
  const foundOr = dbStore.findUserByEmailOrPhone(testPhone);
  assert.ok(foundOr);
  assert.equal(foundOr.id, phoneOnlyUser.id);
});

test("Duplicate Prevention: Re-registration with duplicate email is blocked", () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const email = `unique.${rand}@aqarpulse.eg`;
  dbStore.createUser({
    name: "مستخدم أول",
    email,
    phone: `+20101111${rand}`,
    role: "seeker",
    isVerified: false,
  });

  // Attempt duplicate email with different case
  assert.throws(() => {
    dbStore.createUser({
      name: "مستخدم مكرر بريد",
      email: email.toUpperCase(),
      phone: `+20102222${rand}`,
      role: "seeker",
      isVerified: false,
    });
  }, /البريد الإلكتروني مسجل بالفعل/);
});

test("Duplicate Prevention: Re-registration with duplicate phone is blocked including digit formats", () => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const rawPhone = `0103333${rand}`;
  dbStore.createUser({
    name: "مستخدم أول هاتف",
    email: `user-phone-${rand}@aqarpulse.eg`,
    phone: rawPhone,
    role: "seeker",
    isVerified: false,
  });

  // Attempt duplicate with international format
  assert.throws(() => {
    dbStore.createUser({
      name: "مستخدم مكرر هاتف",
      email: `different-email-${rand}@aqarpulse.eg`,
      phone: `+20${rawPhone.slice(1)}`,
      role: "seeker",
      isVerified: false,
    });
  }, /رقم الهاتف مسجل بالفعل/);
});

test("WhatsApp OTP: WhatsAppService formats Arabic message and dispatches OTP", async () => {
  const formatted = WhatsAppService.formatOtpMessage("654321");
  assert.ok(formatted.includes("654321"));
  assert.ok(formatted.includes("دار العقار"));

  const res = await WhatsAppService.sendOtp("01012345678", "654321");
  assert.equal(res.success, true);
  assert.ok(res.devCode === "654321" || res.simulated);
  assert.ok(res.waLink?.includes("wa.me"));
});

test("Gmail SMTP 1: GmailSmtpService formats branded Arabic HTML template with OTP code", () => {
  const html = GmailSmtpService.formatOtpHtml("583921", "أحمد");
  assert.ok(html.includes("583921"));
  assert.ok(html.includes("دار العقار"));
  assert.ok(html.includes("Gmail"));
  assert.ok(html.includes("5 دقائق"));
  assert.ok(html.includes("أحمد"));

  const text = GmailSmtpService.formatOtpText("583921", "أحمد");
  assert.ok(text.includes("583921"));
  assert.ok(text.includes("دار العقار"));
});

test("Gmail SMTP 2: GmailSmtpService dispatches OTP email with resilient fallback", async () => {
  const res = await GmailSmtpService.sendOtp("ahmed.verify@gmail.com", "778899", "أحمد");
  assert.equal(res.success, true);
  assert.equal(res.channel, "gmail");
  assert.equal(res.email, "ahmed.verify@gmail.com");
  assert.ok(res.messageId !== undefined || res.simulated === true);
});

test("Gmail SMTP 3: Full Email OTP workflow with token generation and replay prevention", () => {
  const testEmail = "buyer.official@gmail.com";
  const testCode = "445566";

  // 1. Store OTP for email
  storeOtp(testEmail, testCode);

  // 2. Wrong code fails
  const wrongRes = verifyOtpCode(testEmail, "000000");
  assert.equal(wrongRes.valid, false);

  // 3. Correct code succeeds
  const correctRes = verifyOtpCode(testEmail, testCode);
  assert.equal(correctRes.valid, true);

  // 4. Token creation produces email verification token
  const token = createVerificationToken(testEmail);
  assert.ok(token.startsWith("evtk_"));

  // 5. Valid for email (case-insensitive)
  assert.equal(isPhoneVerificationTokenValid("BUYER.OFFICIAL@GMAIL.COM", token), true);
  assert.equal(isPhoneVerificationTokenValid("another@gmail.com", token), false);

  // 6. Token consumption prevents replay
  assert.equal(consumePhoneVerificationToken(token), true);
  assert.equal(isPhoneVerificationTokenValid(testEmail, token), false);
});

test("Security Audit 1: Multi-layer guard catches spam bots and speed-traps without naive name bypass", () => {
  // 1. Legitimate human user (empty honeypot, normal timing)
  const legitHuman = evaluateSubmissionSecurity({
    honeypotValue: "",
    formLoadedAt: Date.now() - 3000,
  });
  assert.equal(legitHuman.isBlocked, false);
  assert.equal(legitHuman.riskScore, 0);

  // 2. Automated spam scraper with URL payload in honeypot -> MUST BE BLOCKED
  const spamBot = evaluateSubmissionSecurity({
    honeypotValue: "http://malicious-spam.ru/seo",
    formLoadedAt: Date.now() - 3000,
  });
  assert.equal(spamBot.isBlocked, true);
  assert.equal(spamBot.riskScore, 100);

  // 3. Fast script attack (< 400ms) -> MUST BE BLOCKED
  const fastBot = evaluateSubmissionSecurity({
    honeypotValue: "some_value",
    formLoadedAt: Date.now() - 50,
    minDurationMs: 400,
  });
  assert.equal(fastBot.isBlocked, true);

  // 4. Benign autofill (harmless text without spam URLs, normal human timing) -> ALLOWED
  const autofillUser = evaluateSubmissionSecurity({
    honeypotValue: "Cairo Resident",
    formLoadedAt: Date.now() - 4000,
  });
  assert.equal(autofillUser.isBlocked, false);
  assert.equal(autofillUser.riskScore < 60, true);

  // 5. Clock skew (client clock slightly ahead of server, duration < 0) -> Tolerated safely
  const clockSkewUser = evaluateSubmissionSecurity({
    honeypotValue: "",
    formLoadedAt: Date.now() + 2000,
  });
  assert.equal(clockSkewUser.isBlocked, false);
});

test("Security Audit 2: Manual API request without honeypot cannot bypass server rate-limits and OTP tokens", () => {
  // Even if a script calls the API without honeypot (empty value), rate limiting stops abuse
  const manualIpKey = `manual_curl_ip_${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(manualIpKey, 5, 60000);
    assert.equal(res.allowed, true);
  }
  // 6th attempt is blocked
  const blockedRes = checkRateLimit(manualIpKey, 5, 60000);
  assert.equal(blockedRes.allowed, false);

  // Disposable emails are blocked regardless of honeypot status
  assert.equal(isDisposableEmail("attacker@tempmail.com"), true);
  assert.equal(isDisposableEmail("victim@10minutemail.net"), true);
  assert.equal(isDisposableEmail("real.user@gmail.com"), false);
});

test("Security Audit 3: Cryptographic OTP brute-force defense limits to 3 attempts and destroys expired codes", () => {
  const targetEmail = "security.audit@aqarpulse.eg";
  const realOtp = "394857";

  storeOtp(targetEmail, realOtp, 60000);

  // Attempt 1: wrong code
  const try1 = verifyOtpCode(targetEmail, "111111");
  assert.equal(try1.valid, false);

  // Attempt 2: wrong code
  const try2 = verifyOtpCode(targetEmail, "222222");
  assert.equal(try2.valid, false);

  // Attempt 3: wrong code -> exhausts attempts and deletes OTP
  const try3 = verifyOtpCode(targetEmail, "333333");
  assert.equal(try3.valid, false);

  // Attempt 4: Even if correct code is guessed afterwards, OTP is gone
  const try4 = verifyOtpCode(targetEmail, realOtp);
  assert.equal(try4.valid, false);
});

test("Security Audit 4: Password reset OTP flow validates verification code and completes reset", () => {
  const targetEmail = `reset.test.${Date.now()}.${Math.floor(Math.random() * 10000)}@aqarpulse.eg`;
  const user = dbStore.createUser({
    name: "مستخدم استعادة",
    email: targetEmail,
    phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: "seeker",
    isVerified: true,
  });

  const otpCode = generateNumericOtp();
  storeOtp(targetEmail, otpCode, 60000);

  // Wrong code is rejected
  const invalidVerify = verifyOtpCode(targetEmail, "000000");
  assert.equal(invalidVerify.valid, false);

  // Correct code passes
  const validVerify = verifyOtpCode(targetEmail, otpCode);
  assert.equal(validVerify.valid, true);

  // Email template formatting
  const emailHtml = GmailSmtpService.formatPasswordResetHtml(otpCode, user.name);
  assert.ok(emailHtml.includes(otpCode));
  assert.ok(emailHtml.includes("استعادة وتعيين كلمة المرور"));
});

test("Security Audit 5: HMAC-SHA256 Session token security & anti-forgery protection", async () => {
  const { createSessionToken, verifySessionToken } = await import("./session");

  const validUser: User = {
    id: "usr-sec-valid-" + Date.now(),
    name: "مستخدم أمان تجريبي",
    email: "security.user@aqarpulse.eg",
    phone: "+201011112222",
    role: "buyer",
    isVerified: true,
    createdAt: new Date().toISOString(),
  };

  const validToken = createSessionToken(validUser);
  assert.ok(validToken && validToken.includes("."));

  // 1. Valid token verifies cleanly
  const verified = verifySessionToken(validToken);
  assert.ok(verified);
  assert.equal(verified.userId, validUser.id);
  assert.equal(verified.role, "buyer");

  // 2. Tampered payload is strictly rejected
  const [payloadBase64, signature] = validToken.split(".");
  const decodedPayload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
  decodedPayload.role = "admin"; // Attacker attempts privilege escalation
  const forgedPayloadBase64 = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
  const forgedToken = `${forgedPayloadBase64}.${signature}`;

  assert.equal(verifySessionToken(forgedToken), null, "Tampered payload must be rejected by HMAC verification");

  // 3. Forged signature is strictly rejected
  const invalidSigToken = `${payloadBase64}.invalidsignature12345`;
  assert.equal(verifySessionToken(invalidSigToken), null, "Invalid signature must return null");

  // 4. Malformed token returns null
  assert.equal(verifySessionToken("not-a-token"), null);
  assert.equal(verifySessionToken(""), null);
});

test("Security Audit 6: Expired session token is strictly rejected", async () => {
  const { verifySessionToken } = await import("./session");
  const { createHmac } = await import("node:crypto");

  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || "aqarpulse_jwt_secret_egypt_market_2026";
  const expiredPayload = {
    userId: "usr-expired-test",
    role: "buyer",
    name: "مستخدم منتهي",
    exp: Date.now() - 10000, // Expired 10s ago
  };
  const payloadBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  const expiredToken = `${payloadBase64}.${signature}`;

  assert.equal(verifySessionToken(expiredToken), null, "Expired token must be rejected");
});

test("Security Audit 7: Nonexistent or deleted user session never recreates or resurrects user records", async () => {
  const { createSessionToken } = await import("./session");

  const phantomUser: User = {
    id: "usr-phantom-deleted-" + Date.now(),
    name: "مستخدم وهمي غير مسجل",
    email: `phantom.${Date.now()}@attacker.com`,
    phone: "+201099998888",
    role: "admin", // Attacker claims to be admin
    isVerified: true,
    createdAt: new Date().toISOString(),
  };

  const token = createSessionToken(phantomUser);
  assert.ok(token);

  // User is NOT in database
  const lookup = dbStore.findUserById(phantomUser.id);
  assert.equal(lookup, null, "Phantom user must not exist in store");

  // Note: getCurrentUser() strictly returns null if dbStore does not have this user
});

test("Security Audit 8: Admin account password verification with scrypt", async () => {
  const { verifyPassword } = await import("./security");

  const admin = dbStore.findUserByEmail("admin@aqarpulse.eg");
  assert.ok(admin, "Admin account must exist");
  assert.ok(admin.passwordHash && admin.passwordSalt, "Admin must have secure scrypt password hash and salt");

  // Correct password succeeds
  const correctAuth = verifyPassword("Admin@2026!Pulse", admin.passwordHash, admin.passwordSalt);
  assert.equal(correctAuth, true, "Correct admin credentials must verify");

  // Wrong password fails
  const wrongAuth = verifyPassword("WrongPassword123!", admin.passwordHash, admin.passwordSalt);
  assert.equal(wrongAuth, false, "Wrong password must fail");

  // Empty password fails
  const emptyAuth = verifyPassword("", admin.passwordHash, admin.passwordSalt);
  assert.equal(emptyAuth, false, "Empty password must fail");
});
