/**
 * AqarPulse Platform — Auth Security Utilities
 *
 * Implements:
 * 1. Safe redirect URL validation (protecting against Open Redirect vulnerabilities).
 * 2. In-memory sliding rate limiter for authentication endpoints (preventing brute-force/credential-stuffing).
 * 3. Input sanitation and password/email strength validation.
 */

import { randomInt, randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Safe redirect validator: strictly permits relative paths starting with single '/'
export function getSafeRedirectUrl(url: string | null | undefined, fallback = "/dashboard"): string {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  // Reject protocol-relative URLs (e.g., "//evil.com") or javascript: URIs
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    // Avoid double slashes or encoded backslashes
    return trimmed;
  }
  return fallback;
}

// In-memory rate limiter for login and registration attempts
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Checks if a key (e.g. IP or email) has exceeded max attempts within the given window.
 * Default: 5 attempts per 60 seconds.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 60 * 1000
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const now = Date.now();

  // Periodic eviction of expired records to protect against memory exhaustion under flood
  if (rateLimitMap.size > 500) {
    rateLimitMap.forEach((v, k) => {
      if (now > v.resetAt) {
        rateLimitMap.delete(k);
      }
    });
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remainingAttempts: maxAttempts - 1, retryAfterSeconds: 0 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  record.count += 1;
  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Converts Arabic-Indic and Eastern Arabic digits to standard ASCII digits.
 * E.g., "٠١٠١٢٣٤٥٦٧٨" -> "01012345678"
 */
export function toAsciiDigits(str: string): string {
  if (!str) return "";
  return str
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48))
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48));
}

/**
 * Normalizes an email address to a canonical form for strict duplicate detection.
 * - Trims whitespace and converts to lowercase.
 * - For Gmail/Googlemail: strips dots and ignores "+" aliases (e.g. user+1@gmail.com -> user@gmail.com).
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return trimmed;
  let local = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    domain = "gmail.com";
    local = local.replace(/\./g, ""); // Gmail ignores dots
    const plusIdx = local.indexOf("+");
    if (plusIdx !== -1) {
      local = local.slice(0, plusIdx); // Gmail ignores + tags
    }
  }

  return `${local}@${domain}`;
}

/**
 * Normalizes Egyptian and international phone numbers into canonical E.164 format.
 * Examples:
 *   "01012345678" -> "+201012345678"
 *   "٠١٠١٢٣٤٥٦٧٨" -> "+201012345678"
 *   "201012345678" -> "+201012345678"
 *   "00201012345678" -> "+201012345678"
 *   "+20 10 1234 5678" -> "+201012345678"
 */
export function normalizeEgyptianPhone(phone: string): string {
  if (!phone) return "";
  let cleaned = toAsciiDigits(phone).replace(/[\s\-\(\)\.]/g, "").trim();

  // Handle leading 00
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Egyptian mobile with leading 0 (e.g. 010..., 011..., 012..., 015...)
  if (/^01[0125]\d{8}$/.test(cleaned)) {
    return "+20" + cleaned.slice(1);
  }

  // Egyptian mobile with 20 without + (e.g. 2010...)
  if (/^201[0125]\d{8}$/.test(cleaned)) {
    return "+" + cleaned;
  }

  // Already prefixed with +20
  if (/^\+201[0125]\d{8}$/.test(cleaned)) {
    return cleaned;
  }

  // Generic international with +
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Generic fallback: prepend +
  return cleaned ? `+${cleaned}` : "";
}

/**
 * Validates Egyptian or international phone numbers.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const clean = toAsciiDigits(phone).replace(/[\s\-\(\)\.]/g, "").trim();
  // Accepts Egyptian mobiles (010, 011, 012, 015) or standard E.164
  return /^(\+?20|0)?1[0125]\d{8}$/.test(clean) || /^\+?[1-9]\d{7,14}$/.test(clean);
}

/**
 * Common disposable / throwaway email provider domains used by spam bots and fake accounts.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "getairmail.com",
  "dispostable.com",
  "trashmail.com",
  "inboxbear.com",
  "mohmal.com",
  "mytemp.email",
  "dropmail.me",
  "crazymailing.com",
  "burnermail.io",
]);

/**
 * Checks whether an email belongs to a known temporary/disposable domain.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.trim().toLowerCase().split("@")[1];
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/**
 * Validates email format strictly.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidDisplayName(name: string): boolean {
  if (typeof name !== "string") return false;
  const normalized = name.trim();
  return normalized.length >= 2 && normalized.length <= 80 && !/[\u0000-\u001f\u007f]/.test(normalized);
}

/**
 * Validates password strength (minimum 6 characters for user convenience).
 */
export function isStrongPassword(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 6) {
    return { valid: false, reason: "كلمة المرور يجب ألا تقل عن 6 أحرف" };
  }
  return { valid: true };
}

export interface BotSecurityResult {
  isBlocked: boolean;
  reason?: string;
  riskScore: number;
}

/**
 * Anti-Bot & Spam Submission Guard:
 * Multi-layer evaluation without naive user-data matching.
 * 
 * 1. Explicit Spam Signatures:
 *    Detects automated scrapers/bots that inject URLs (http/https/www), HTML/script tags,
 *    bbcode, spam advertising tokens, or excessive payload lengths (> 100 chars).
 * 
 * 2. Inhuman Speed Trap:
 *    Catches sub-second programmatic submissions while tolerating client clock skews.
 * 
 * 3. Autofill Tolerance:
 *    Benign text accidentally placed in a hidden field by a browser extension
 *    does NOT unilaterally block legitimate humans, while spam payloads are rejected.
 * 
 * 4. Resilient Server Defense:
 *    Even if a bot leaves the honeypot empty, IP/email rate limits, OTP verification,
 *    and cryptographic tokens protect the endpoints.
 */
export function evaluateSubmissionSecurity(options: {
  honeypotValue?: string | null;
  formLoadedAt?: number | null;
  minDurationMs?: number;
}): BotSecurityResult {
  const { honeypotValue, formLoadedAt, minDurationMs = 400 } = options;
  let riskScore = 0;

  // Layer 1: Honeypot analysis
  if (honeypotValue && typeof honeypotValue === "string" && honeypotValue.trim().length > 0) {
    const raw = honeypotValue.trim();
    const hasSpamSignature =
      /https?:\/\/|www\.|\.ru\/|\.xyz\/|<script|<\/script|<a\s|\[url=|\b(casino|crypto|viagra|porn|seo-traffic)\b/i.test(raw) ||
      raw.length > 100;

    if (hasSpamSignature) {
      return {
        isBlocked: true,
        reason: "تعذر معالجة الطلب، تم رصد نشاط غير مصرح",
        riskScore: 100,
      };
    }

    // Harmless text without spam URLs: suspicious (+25) but not alone a block
    riskScore += 25;
  }

  // Layer 2: Speed trap (sub-human submission time)
  if (formLoadedAt && typeof formLoadedAt === "number" && !isNaN(formLoadedAt)) {
    const duration = Date.now() - formLoadedAt;
    if (duration > 0 && duration < minDurationMs) {
      riskScore += 40;
    }
  }

  if (riskScore >= 60) {
    return {
      isBlocked: true,
      reason: "يرجى الانتظار بضع ثوانٍ قبل إرسال النموذج",
      riskScore,
    };
  }

  return { isBlocked: false, riskScore };
}

/**
 * Standalone Honeypot Validator:
 * Validates that the hidden trap field remains empty and untouched.
 */
export function validateHoneypot(honeypotValue?: string | null): boolean {
  return !honeypotValue || typeof honeypotValue !== "string" || honeypotValue.trim().length === 0;
}

/**
 * Form Speed Trap:
 * Verifies submission timing while tolerating negative clock skews safely.
 */
export function validateSubmissionTiming(formLoadedAt: number | undefined | null, minMs = 400): boolean {
  if (!formLoadedAt || typeof formLoadedAt !== "number" || isNaN(formLoadedAt)) return true;
  const duration = Date.now() - formLoadedAt;
  if (duration < 0) return true; // Clock skew tolerated
  return duration >= minMs;
}

// ============================================================================
// Cryptographic Password Hashing & Verification (Local Fallback & Primary Store)
// ============================================================================

/**
 * Hashes a password with a unique cryptographic salt using Node.js scryptSync.
 */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Verifies a password against a stored scrypt hash and salt.
 * Timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, hash?: string, salt?: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const derivedKey = scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(hash, "hex");
    if (derivedKey.length !== storedBuffer.length) return false;
    return timingSafeEqual(derivedKey, storedBuffer);
  } catch {
    return false;
  }
}

// ============================================================================
// OTP & Verification Token State Management (Cross-Chunk & Disk-Backed)
// ============================================================================

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

interface VerificationTokenRecord {
  identifier: string;
  expiresAt: number;
}

const TOKENS_FILE = path.join(process.cwd(), ".data", "auth_tokens.json");
const TMP_TOKENS_FILE = path.join(os.tmpdir(), "aqarpulse_auth_tokens.json");
const DEV_OTP_FALLBACK_SECRET = "aqarpulse_otp_signing_secret_egypt_2026_secure";

// Ensure globalThis reference survives across hot-reloads and chunk evaluations
const globalRef = globalThis as unknown as {
  __aqarpulse_otp_store?: Map<string, OtpRecord>;
  __aqarpulse_verified_tokens?: Map<string, VerificationTokenRecord>;
  __aqarpulse_consumed_tokens?: Set<string>;
};

if (!globalRef.__aqarpulse_otp_store) {
  globalRef.__aqarpulse_otp_store = new Map<string, OtpRecord>();
}
if (!globalRef.__aqarpulse_verified_tokens) {
  globalRef.__aqarpulse_verified_tokens = new Map<string, VerificationTokenRecord>();
}
if (!globalRef.__aqarpulse_consumed_tokens) {
  globalRef.__aqarpulse_consumed_tokens = new Set<string>();
}

const otpStore = globalRef.__aqarpulse_otp_store;
const verifiedTokens = globalRef.__aqarpulse_verified_tokens;
const consumedTokens = globalRef.__aqarpulse_consumed_tokens;

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function syncChallengeToSupabaseAsync(params: {
  identifier: string;
  challengeType: "otp" | "verification_token";
  codeHash: string;
  expiresAt: number;
  attempts?: number;
  consumedAt?: string | null;
}): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  void (async () => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await adminClient.from("auth_verification_challenges").upsert(
        {
          id: `chal_${createHmac("sha256", serviceKey)
            .update(`${params.challengeType}:${params.identifier}`)
            .digest("hex")
            .slice(0, 32)}`,
          identifier: params.identifier,
          challenge_type: params.challengeType,
          code_hash: params.codeHash,
          attempts: params.attempts ?? 0,
          max_attempts: 3,
          expires_at: new Date(params.expiresAt).toISOString(),
          consumed_at: params.consumedAt ?? null,
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-blocking central challenge audit sync
    }
  })();
}

function safeWriteTokensFile(filePath: string, data: any, maxRetries = 4): void {
  if (isProductionEnv()) return;
  const content = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}_${Math.random().toString(36).substring(2, 6)}.tmp`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(tmpPath, content, "utf-8");
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch {}
      }
      return;
    } catch (err: any) {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
      if ((err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES") && attempt < maxRetries) {
        const end = Date.now() + 20 * attempt;
        while (Date.now() < end) {}
        continue;
      }
      throw err;
    }
  }
}

function syncTokensToDisk(): void {
  // Priority 3: Never write OTP or verification tokens to local filesystem or os.tmpdir() in production
  if (isProductionEnv()) return;
  const data = {
    otps: Object.fromEntries(otpStore.entries()),
    tokens: Object.fromEntries(verifiedTokens.entries()),
  };
  try {
    safeWriteTokensFile(TOKENS_FILE, data);
  } catch {
    try {
      safeWriteTokensFile(TMP_TOKENS_FILE, data);
    } catch {}
  }
}

function loadTokensFromDisk(): void {
  // Priority 3: Never load OTP or verification tokens from local filesystem or os.tmpdir() in production
  if (isProductionEnv()) return;
  const targetFiles = [TOKENS_FILE, TMP_TOKENS_FILE];
  const now = Date.now();

  for (const file of targetFiles) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = fs.readFileSync(file, "utf-8");
      if (!raw || !raw.trim()) continue;
      const parsed = JSON.parse(raw);

      if (parsed.otps) {
        for (const [k, v] of Object.entries(parsed.otps as Record<string, OtpRecord>)) {
          if (v && v.expiresAt > now) {
            const existing = otpStore.get(k);
            if (!existing || (v.createdAt || 0) >= (existing.createdAt || 0)) {
              otpStore.set(k, v);
            }
          }
        }
      }
      if (parsed.tokens) {
        for (const [k, v] of Object.entries(parsed.tokens as Record<string, VerificationTokenRecord>)) {
          if (v && v.expiresAt > now && !consumedTokens.has(k)) {
            const existing = verifiedTokens.get(k);
            if (!existing || v.expiresAt >= existing.expiresAt) {
              verifiedTokens.set(k, v);
            }
          }
        }
      }
    } catch {
      // Safe fallback in dev/test
    }
  }
}

// Initial load (only in non-production environments)
loadTokensFromDisk();

export function getOtpSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (isProductionEnv()) {
    if (
      !secret ||
      secret.length < 32 ||
      secret === "aqarpulse_jwt_secret_egypt_market_2026" ||
      secret === DEV_OTP_FALLBACK_SECRET ||
      secret === "dev_insecure_aqarpulse_session_signing_secret_do_not_use_in_production_32chars"
    ) {
      throw new Error(
        "FATAL_SECURITY_ERROR: Missing or insufficiently strong SESSION_SECRET/JWT_SECRET in production environment for OTP signing. A minimum of 32 characters is required."
      );
    }
    return secret;
  }

  return secret || DEV_OTP_FALLBACK_SECRET;
}

/**
 * Creates a cryptographically signed, stateless OTP verification ticket.
 * Allows instant verification across serverless instances without shared filesystem or memory.
 */
export function createSignedOtpTicket(identifier: string, code: string, ttlMs = 10 * 60 * 1000): string {
  const normalized = normalizeIdentifier(identifier);
  const secret = getOtpSecret();
  const expiresAt = Date.now() + ttlMs;
  const cleanCode = code.trim().replace(/\D/g, "");
  const codeHash = createHmac("sha256", secret).update(`otp:${normalized}:${cleanCode}`).digest("hex");
  const payload = {
    id: normalized,
    hash: codeHash,
    exp: expiresAt,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${sig}`;
}

/**
 * Verifies a cryptographically signed OTP ticket.
 */
export function verifySignedOtpTicket(
  identifier: string,
  inputCode: string,
  ticket: string
): { valid: boolean; reason?: string } {
  if (!ticket || typeof ticket !== "string") {
    return { valid: false, reason: "لم يتم العثور على رمز تحقق صالح. يرجى طلب رمز جديد." };
  }

  const parts = ticket.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "رمز التحقق غير صالح. يرجى طلب رمز جديد." };
  }

  const [payloadBase64, providedSig] = parts;
  let secret: string;
  try {
    secret = getOtpSecret();
  } catch {
    return { valid: false, reason: "خطأ في إعدادات أمان الخادم." };
  }
  const expectedSig = createHmac("sha256", secret).update(payloadBase64).digest("base64url");

  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: "رمز التحقق غير صالح أو تم التلاعب به." };
  }

  let payload: { id: string; hash: string; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
  } catch {
    return { valid: false, reason: "رمز التحقق غير صالح." };
  }

  const normalized = normalizeIdentifier(identifier);
  const canonical = normalized.includes("@") ? normalizeEmail(normalized) : normalized;
  const ticketId = payload.id;
  const ticketCanonical = ticketId.includes("@") ? normalizeEmail(ticketId) : ticketId;

  if (ticketId !== normalized && ticketCanonical !== canonical) {
    return { valid: false, reason: "الرمز المطلوب غير متطابق مع هذا البريد الإلكتروني." };
  }

  if (Date.now() > payload.exp) {
    return { valid: false, reason: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد." };
  }

  const cleanInput = inputCode.trim().replace(/\D/g, "");
  const expectedHash = createHmac("sha256", secret).update(`otp:${normalized}:${cleanInput}`).digest("hex");
  const altHash = createHmac("sha256", secret).update(`otp:${canonical}:${cleanInput}`).digest("hex");

  if (payload.hash !== expectedHash && payload.hash !== altHash) {
    return { valid: false, reason: "رمز التحقق غير صحيح. يرجى التأكد من الرمز المدخل والمحاولة مجدداً." };
  }

  return { valid: true };
}

/**
 * Normalizes an identifier (either email or phone number).
 */
export function normalizeIdentifier(identifier: string): string {
  if (!identifier || typeof identifier !== "string") return "";
  if (identifier.includes("@")) {
    return identifier.trim().toLowerCase();
  }
  return normalizeEgyptianPhone(identifier);
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP code.
 */
export function generateNumericOtp(): string {
  try {
    return randomInt(100000, 1000000).toString();
  } catch {
    const buf = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      return (100000 + (buf[0] % 900000)).toString();
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

/**
 * Stores an OTP code for a normalized phone or email with an expiration window.
 * Default validity: 10 minutes (600,000 ms).
 */
export function storeOtp(identifier: string, code: string, ttlMs = 10 * 60 * 1000): void {
  loadTokensFromDisk();
  const normalized = normalizeIdentifier(identifier);
  const expiresAt = Date.now() + ttlMs;
  const record: OtpRecord = {
    code: code.trim(),
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
  };

  otpStore.set(normalized, record);
  if (normalized.includes("@")) {
    const canonical = normalizeEmail(normalized);
    if (canonical !== normalized) {
      otpStore.set(canonical, record);
    }
  }

  syncTokensToDisk();

  try {
    const secret = getOtpSecret();
    const codeHash = createHmac("sha256", secret).update(`otp:${normalized}:${code.trim()}`).digest("hex");
    syncChallengeToSupabaseAsync({
      identifier: normalized,
      challengeType: "otp",
      codeHash,
      expiresAt,
      attempts: 0,
      consumedAt: null,
    });
  } catch {
    // Ignore if secret validation fails in unconfigured test env
  }
}

/**
 * Verifies the OTP code entered by the user.
 * Blocks after 3 failed attempts to prevent brute-force attacks.
 */
export function verifyOtpCode(
  identifier: string,
  inputCode: string
): { valid: boolean; reason?: string } {
  loadTokensFromDisk();
  const normalized = normalizeIdentifier(identifier);
  let record = otpStore.get(normalized);
  let keyUsed = normalized;

  if (!record && normalized.includes("@")) {
    const canonical = normalizeEmail(normalized);
    record = otpStore.get(canonical);
    if (record) keyUsed = canonical;
  }

  if (!record) {
    return { valid: false, reason: "لم يتم طلب رمز تحقق لهذا البريد/الرقم أو انتهت صلاحيته. يرجى طلب رمز جديد." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(keyUsed);
    syncTokensToDisk();
    return { valid: false, reason: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد." };
  }

  if (record.attempts >= 3) {
    otpStore.delete(keyUsed);
    syncTokensToDisk();
    return { valid: false, reason: "تم تجاوز الحد الأقصى للمحاولات الخاطئة (3 محاولات). يرجى طلب رمز جديد." };
  }

  const cleanInput = inputCode.trim().replace(/\D/g, "");
  if (record.code !== cleanInput) {
    record.attempts += 1;
    syncTokensToDisk();
    const remaining = 3 - record.attempts;
    return {
      valid: false,
      reason: `رمز التحقق غير صحيح. متبقي ${remaining} محاولة.`,
    };
  }

  // Successful verification: delete OTP and sync
  otpStore.delete(keyUsed);
  if (normalized.includes("@")) {
    otpStore.delete(normalizeEmail(normalized));
  }
  syncTokensToDisk();
  return { valid: true };
}

function parseSignedVerificationToken(token: string): VerificationTokenRecord | null {
  if (!token || typeof token !== "string") return null;
  const prefix = token.startsWith("evtk_") ? "evtk_" : token.startsWith("pvtk_") ? "pvtk_" : "";
  if (!prefix) return null;
  const body = token.slice(prefix.length);
  const parts = body.split(".");
  if (parts.length !== 2) return null;

  const [payloadBase64, providedSig] = parts;
  let secret: string;
  try {
    secret = getOtpSecret();
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf-8"));
    if (!payload || typeof payload.id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return {
      identifier: payload.id,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Creates a cryptographically random, HMAC-signed verification token granting permission
 * to register with this email or phone. Valid for 15 minutes.
 */
export function createVerificationToken(identifier: string): string {
  loadTokensFromDisk();
  const normalized = identifier.includes("@") ? normalizeEmail(identifier) : normalizeIdentifier(identifier);
  const prefix = normalized.includes("@") ? "evtk_" : "pvtk_";
  const expiresAt = Date.now() + 15 * 60 * 1000;
  const nonce = randomBytes(16).toString("hex");
  const secret = getOtpSecret();

  const payloadBase64 = Buffer.from(
    JSON.stringify({ id: normalized, exp: expiresAt, nonce })
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  const token = `${prefix}${payloadBase64}.${sig}`;

  const record: VerificationTokenRecord = {
    identifier: normalized,
    expiresAt,
  };

  verifiedTokens.set(token, record);
  syncTokensToDisk();

  syncChallengeToSupabaseAsync({
    identifier: normalized,
    challengeType: "verification_token",
    codeHash: sig,
    expiresAt,
    attempts: 0,
    consumedAt: null,
  });

  return token;
}

/**
 * Validates that the provided verification token matches the identifier (email or phone).
 */
export function isVerificationTokenValid(identifier: string, token: string): boolean {
  if (!token || consumedTokens.has(token)) return false;
  loadTokensFromDisk();

  let record = verifiedTokens.get(token);
  if (!record) {
    const signedRecord = parseSignedVerificationToken(token);
    if (signedRecord) {
      record = signedRecord;
    }
  }
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    verifiedTokens.delete(token);
    syncTokensToDisk();
    return false;
  }

  const normalized = normalizeIdentifier(identifier);
  if (record.identifier === normalized) return true;
  if (normalized.includes("@") || record.identifier.includes("@")) {
    return normalizeEmail(record.identifier) === normalizeEmail(normalized);
  }
  return false;
}

/**
 * Consumes the verification token after successful user registration (one-time use).
 */
export function consumeVerificationToken(token: string): boolean {
  if (!token || consumedTokens.has(token)) return false;
  loadTokensFromDisk();

  const inMemoryRecord = verifiedTokens.get(token);
  const signedRecord = inMemoryRecord || parseSignedVerificationToken(token);
  const deleted = verifiedTokens.delete(token);

  if (signedRecord && Date.now() <= signedRecord.expiresAt) {
    consumedTokens.add(token);
    syncTokensToDisk();
    syncChallengeToSupabaseAsync({
      identifier: signedRecord.identifier,
      challengeType: "verification_token",
      codeHash: "consumed",
      expiresAt: signedRecord.expiresAt,
      attempts: 1,
      consumedAt: new Date().toISOString(),
    });
    return true;
  }

  syncTokensToDisk();
  return deleted;
}

// Backwards-compatible aliases for legacy phone-specific calls
export const createPhoneVerificationToken = createVerificationToken;
export const isPhoneVerificationTokenValid = isVerificationTokenValid;
export const consumePhoneVerificationToken = consumeVerificationToken;

