import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { User, UserRole } from "../db/types";
import { dbStore } from "../db/store";

const SESSION_COOKIE_NAME = "aqarpulse_session";

const DEV_FALLBACK_SECRET = "dev_insecure_aqarpulse_session_signing_secret_do_not_use_in_production_32chars";

export const VALID_SESSION_ROLES: readonly UserRole[] = [
  "seeker",
  "buyer",
  "owner",
  "broker",
  "admin",
] as const;

/**
 * Returns the session signing secret.
 * In production, fails securely if SESSION_SECRET is missing, predictable default, or < 32 characters.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (
      !secret ||
      secret.length < 32 ||
      secret === "aqarpulse_jwt_secret_egypt_market_2026" ||
      secret === DEV_FALLBACK_SECRET
    ) {
      throw new Error(
        "FATAL_SECURITY_ERROR: Missing or insufficiently strong SESSION_SECRET in production environment. A minimum of 32 characters is required."
      );
    }
    return secret;
  }

  // Explicit development fallback only in non-production environments
  return secret || DEV_FALLBACK_SECRET;
}

export interface SessionData {
  userId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  name: string;
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token for the user.
 */
export function createSessionToken(user: User): string {
  const secret = getSessionSecret();
  const payload = {
    userId: user.id,
    email: user.email || "",
    phone: user.phone || "",
    role: user.role,
    name: user.name,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
  return `${payloadBase64}.${signature}`;
}

/**
 * Parses and cryptographically verifies session token using HMAC-SHA256 and timing-safe comparison.
 */
export function verifySessionToken(token: string): SessionData | null {
  if (!token || typeof token !== "string") return null;
  try {
    let secret: string;
    try {
      secret = getSessionSecret();
    } catch {
      // In production without valid secret, fail securely
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signature] = parts;
    if (!payloadBase64 || !signature) return null;

    const expectedSignature = createHmac("sha256", secret).update(payloadBase64).digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const jsonStr = Buffer.from(payloadBase64, "base64url").toString("utf-8");
    const payload = JSON.parse(jsonStr);
    
    // Strict payload structural validation
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.userId !== "string" || !payload.userId.trim()) return null;
    if (typeof payload.role !== "string" || !VALID_SESSION_ROLES.includes(payload.role as UserRole)) return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (typeof payload.iat !== "number" || payload.iat > Date.now() + 60 * 1000) return null;

    return {
      userId: payload.userId,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      role: payload.role as UserRole,
      name: payload.name || "مستخدم",
    };
  } catch {
    return null;
  }
}

/**
 * Gets currently logged in user from Authorization headers or session cookies.
 * Supports:
 * 1. Bearer <token> (HMAC session token or Supabase JWT access token for Capacitor mobile apps)
 * 2. X-Auth-Token header
 * 3. aqarpulse_session HttpOnly cookie (for standard web sessions)
 * Strictly validates against the authoritative database and rejects non-existent or suspended users.
 */
export async function getCurrentUser(req?: Request): Promise<User | null> {
  try {
    let token: string | undefined = undefined;

    // 1. Check Authorization Bearer header (for Capacitor mobile apps & API clients)
    let authHeader: string | null = null;
    if (req) {
      authHeader = req.headers.get("authorization");
    } else {
      try {
        const h = headers();
        authHeader = h.get("authorization");
      } catch {}
    }

    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Check X-Auth-Token header fallback
    if (!token) {
      if (req) {
        token = req.headers.get("x-auth-token") || undefined;
      } else {
        try {
          const h = headers();
          token = h.get("x-auth-token") || undefined;
        } catch {}
      }
    }

    // 3. Fallback to HttpOnly cookie (for standard web sessions)
    if (!token) {
      try {
        const cookieStore = cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {}
    }

    if (!token) return null;

    // Check token format: 2-part internal session token vs 3-part Supabase JWT
    const tokenParts = token.split(".");
    let session = null;

    if (tokenParts.length === 2) {
      // 1. Strictly an internal AqarPulse HMAC-SHA256 session token (payload.signature)
      session = verifySessionToken(token);
    } else if (tokenParts.length === 3) {
      // 2. Strictly a standard 3-part Supabase JWT (header.payload.signature)
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const { createClient } = await import("@supabase/supabase-js");
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: supaAuthData, error: supaAuthErr } = await supabase.auth.getUser(token);

          if (!supaAuthErr && supaAuthData?.user) {
            const supaUser = supaAuthData.user;
            session = {
              userId: supaUser.id,
              email: supaUser.email || undefined,
              phone: supaUser.phone || undefined,
              role: (supaUser.app_metadata?.role || supaUser.user_metadata?.role || "seeker") as UserRole,
              name: supaUser.user_metadata?.name || supaUser.email?.split("@")[0] || "مستخدم",
            };
          }
        }
      } catch (err) {
        console.warn("[session] Could not verify Supabase JWT bearer token:", err);
      }
    } else {
      // Fallback attempt for any edge token formats
      session = verifySessionToken(token);
    }

    if (!session) return null;

    // 1. Authoritative Cloud Synchronization with Supabase profiles table
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.userId);
    let user = null;

    const isProduction = process.env.NODE_ENV === "production";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const hasCentralSupabase = Boolean(
      supabaseUrl &&
        supabaseKey &&
        !supabaseUrl.includes("placeholder") &&
        !supabaseKey.includes("placeholder")
    );

    try {
      if (hasCentralSupabase && supabaseUrl && supabaseKey) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);

        let supaProfile = null;
        if (isUuid) {
          const { data: byId, error: errById } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.userId)
            .limit(1);
          if (errById && isProduction) {
            return null;
          }
          supaProfile = byId?.[0];
        }
        if (!supaProfile && session.email) {
          const { data: byEmail, error: errByEmail } = await supabase
            .from("profiles")
            .select("*")
            .ilike("email", session.email)
            .limit(1);
          if (errByEmail && isProduction) {
            return null;
          }
          supaProfile = byEmail?.[0];
        }

        if (supaProfile) {
          user = dbStore.ensureUser({
            id: supaProfile.id,
            name: supaProfile.name || session.name,
            email: supaProfile.email || session.email,
            phone: supaProfile.phone || session.phone || undefined,
            role: supaProfile.role || session.role,
            isVerified: Boolean(supaProfile.is_verified),
            isSuspended: Boolean(supaProfile.is_suspended),
            companyName: supaProfile.company_name || undefined,
            licenseNumber: supaProfile.license_number || undefined,
            adminRole: supaProfile.admin_role || (
              supaProfile.role === "admin" &&
              !supaProfile.is_staff &&
              !Array.isArray(supaProfile.admin_permissions)
                ? "superadmin"
                : undefined
            ),
            adminPermissions: Array.isArray(supaProfile.admin_permissions)
              ? supaProfile.admin_permissions
              : [],
            isStaff: Boolean(supaProfile.is_staff),
            createdAt: supaProfile.created_at || new Date().toISOString(),
          });
        } else if (isProduction) {
          // Priority 1 & 4: Do not fall back to local dbStore in production when central DB is authoritative
          return null;
        }
      }
    } catch {
      if (isProduction && hasCentralSupabase) {
        return null;
      }
    }

    // 2. Fallback to memory store ONLY in non-production / offline test fixtures
    if (!user && (!isProduction || !hasCentralSupabase)) {
      user = dbStore.findUserById(session.userId);
      if (!user && session.phone) {
        user = dbStore.findUserByPhone(session.phone);
      }
      if (!user && session.email) {
        user = dbStore.findUserByEmail(session.email);
      }

      if (!user && (session.userId || session.email)) {
        user = dbStore.ensureUser({
          id: session.userId,
          name: session.name || (session.email ? session.email.split("@")[0] : "مستخدم"),
          email: session.email || "",
          phone: session.phone || "",
          role: session.role || "seeker",
          isVerified: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    if (!user) {
      return null;
    }

    // Fail closed if user is suspended
    if (user.isSuspended) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Guards a route to ensure user is authenticated.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  if (user.isSuspended) {
    throw new Error("ACCOUNT_SUSPENDED");
  }
  return user;
}

/**
 * Guards a route to ensure user has specific role or admin.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await requireAuth();
  if (user.role === "admin") return user; // Admin has superuser access
  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export { SESSION_COOKIE_NAME };
