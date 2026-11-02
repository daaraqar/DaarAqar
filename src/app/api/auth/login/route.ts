import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  checkRateLimit,
  getSafeRedirectUrl,
  isValidEmail,
  isValidPhone,
  normalizeEgyptianPhone,
  normalizeEmail,
  verifyPassword,
  hashPassword,
  isPhoneVerificationTokenValid,
  consumePhoneVerificationToken,
} from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      identifier: rawIdentifier,
      email: rawEmail,
      phone: rawPhone,
      password,
      verificationToken,
      redirect: rawRedirect,
      rememberMe,
      isAdminLogin,
    } = body;

    const identifier = (rawIdentifier || rawEmail || rawPhone || "").trim();

    // Rate limiting check
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const rateLimitKey = `login_${clientIp}_${identifier || "generic"}`;
    const rateStatus = checkRateLimit(rateLimitKey, 6, 60 * 1000);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى للمحاولات المتتالية. يرجى الانتظار ${rateStatus.retryAfterSeconds} ثانية قبل المحاولة مجدداً.`,
          retryAfterSeconds: rateStatus.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    let user = null;

    // Flow A: Passwordless Login via verified SMS OTP token
    if (verificationToken) {
      if (!isValidPhone(identifier)) {
        return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
      }
      const normalizedPhone = normalizeEgyptianPhone(identifier);
      if (!isPhoneVerificationTokenValid(normalizedPhone, verificationToken)) {
        return NextResponse.json(
          { error: "رمز تأكيد الهاتف غير صالح أو انتهت صلاحيته" },
          { status: 400 }
        );
      }
      consumePhoneVerificationToken(verificationToken);
      user = dbStore.findUserByPhone(normalizedPhone);
    }
    // Flow B: Standard Credentials Login (Phone or Email + Password)
    else {
      if (!identifier || !password) {
        return NextResponse.json(
          { error: "رقم الهاتف (أو البريد الإلكتروني) وكلمة المرور مطلوبان" },
          { status: 400 }
        );
      }

      const isEmail = identifier.includes("@");

      if (isEmail) {
        if (!isValidEmail(identifier)) {
          return NextResponse.json(
            { error: "صيغة البريد الإلكتروني غير صالحة" },
            { status: 400 }
          );
        }

        const cleanEmail = normalizeEmail(identifier);
        let passwordVerified = false;

        // 1. Fetch user from dbStore or sync from Supabase profiles
        user = dbStore.findUserByEmail(cleanEmail);
        if (!user) {
          try {
            const supabase = createSupabaseServerClient();
            const { data: supaProfile } = await supabase
              .from("profiles")
              .select("*")
              .ilike("email", cleanEmail)
              .maybeSingle();

            if (supaProfile) {
              user = dbStore.ensureUser({
                id: supaProfile.id,
                name: supaProfile.name || cleanEmail.split("@")[0],
                email: cleanEmail,
                phone: supaProfile.phone || "+201000000000",
                role: supaProfile.role || "seeker",
                isVerified: Boolean(supaProfile.is_verified),
                createdAt: supaProfile.created_at || new Date().toISOString(),
              });
            }
          } catch {
            // Non-blocking
          }
        }

        // 2. Authoritative cryptographic password check
        if (user && user.passwordHash && user.passwordSalt) {
          passwordVerified = verifyPassword(password, user.passwordHash, user.passwordSalt);
        } else {
          // If no local password hash exists yet, verify against Supabase Auth
          try {
            const supabase = createSupabaseServerClient();
            const { data: supaAuth, error: supaError } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });

            if (
              supaAuth?.user ||
              supaError?.code === "email_not_confirmed" ||
              supaError?.message?.toLowerCase().includes("email not confirmed")
            ) {
              passwordVerified = true;
              if (user) {
                const { hash, salt } = hashPassword(password);
                dbStore.updateUserPassword(user.id, hash, salt);
              }
            }
          } catch {
            // Non-blocking
          }
        }

        if (!passwordVerified) {
          user = null;
        }
      } else {
        // Phone number login
        if (!isValidPhone(identifier)) {
          return NextResponse.json(
            { error: "يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678) أو بريد إلكتروني" },
            { status: 400 }
          );
        }

        const normalizedPhone = normalizeEgyptianPhone(identifier);
        let passwordVerified = false;

        user = dbStore.findUserByPhone(normalizedPhone);
        if (!user) {
          try {
            const supabase = createSupabaseServerClient();
            const { data: supaProfiles } = await supabase
              .from("profiles")
              .select("*")
              .or(`phone.eq.${normalizedPhone},phone.eq.${identifier.trim()}`)
              .order("created_at", { ascending: false })
              .limit(1);

            const supaProfile = supaProfiles?.[0];

            if (supaProfile) {
              user = dbStore.ensureUser({
                id: supaProfile.id,
                name: supaProfile.name || normalizedPhone,
                email: supaProfile.email,
                phone: normalizedPhone,
                role: supaProfile.role || "seeker",
                isVerified: Boolean(supaProfile.is_verified),
                createdAt: supaProfile.created_at || new Date().toISOString(),
              });
            }
          } catch {
            // Non-blocking
          }
        }

        const lookupEmail = user?.email || (normalizedPhone ? `user_${normalizedPhone.replace(/\+/g, "")}@aqarpulse.com` : null);

        if (user && user.passwordHash && user.passwordSalt) {
          passwordVerified = verifyPassword(password, user.passwordHash, user.passwordSalt);
        } else if (user && lookupEmail) {
          try {
            const supabase = createSupabaseServerClient();
            const { data: supaAuth, error: supaError } = await supabase.auth.signInWithPassword({
              email: lookupEmail,
              password,
            });
            if (
              supaAuth?.user ||
              supaError?.code === "email_not_confirmed" ||
              supaError?.message?.toLowerCase().includes("email not confirmed")
            ) {
              passwordVerified = true;
              const { hash, salt } = hashPassword(password);
              dbStore.updateUserPassword(user.id, hash, salt);
            }
          } catch {
            // Ignore
          }
        }

        if (!passwordVerified) {
          user = null;
        }
      }
    }

    if (!user) {
      dbStore.recordAuditEvent(undefined, "USER_LOGIN_FAILED", "auth", "unknown", {
        identifier: identifier ? identifier.slice(0, 4) + "***" : "none",
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة، يرجى التحقق والمحاولة ثانية" },
        { status: 401 }
      );
    }

    if (user.isSuspended) {
      return NextResponse.json(
        {
          error: `تم تعليق هذا الحساب بواسطة إدارة المنصة${
            user.suspensionReason ? `: ${user.suspensionReason}` : ""
          }`,
        },
        { status: 403 }
      );
    }

    if (isAdminLogin) {
      const isMasterAdmin = (user.email || "").toLowerCase() === "mkelwayzy@gmail.com";
      const isExistingStaffOrAdmin = user.role === "admin" || (user as any).isStaff === true;

      if (!isMasterAdmin && !isExistingStaffOrAdmin) {
        return NextResponse.json(
          {
            error: "عذراً، هذا الحساب غير مصرح له بالدخول كإدارة. الدخول مخصص للمشرف العام (MKELWAYZY@gmail.com) أو موظفي الإدارة المعتمدين.",
          },
          { status: 403 }
        );
      }

      user.role = "admin";
      try {
        dbStore.updateUser(user.id, { role: "admin" });
      } catch {
        // Fallback safe
      }
    }

    const defaultRedirect = (user.role === "admin" || isAdminLogin) ? "/admin" : "/dashboard";
    const safeRedirect = getSafeRedirectUrl(rawRedirect, defaultRedirect);
    const token = createSessionToken(user);
    const response = NextResponse.json({ success: true, user, redirectTo: safeRedirect, token });

    const proto = req.headers.get("x-forwarded-proto") || "";
    const isHttps =
      proto.toLowerCase() === "https" ||
      req.headers.get("x-forwarded-ssl") === "on" ||
      req.url.startsWith("https://");
    const isSecure = isHttps;

    // Set secure session cookie with rememberMe support (30 days vs 1 day vs 7 days default)
    const maxAgeSeconds =
      rememberMe === true
        ? 30 * 24 * 60 * 60 // 30 days
        : rememberMe === false
        ? 24 * 60 * 60 // 1 day
        : 7 * 24 * 60 * 60; // 7 days

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      path: "/",
      maxAge: maxAgeSeconds,
      sameSite: "lax",
    });

    dbStore.recordAuditEvent(user.id, "USER_LOGIN", "user", user.id, {
      identifierType: identifier.includes("@") ? "email" : "phone",
      role: user.role,
      ip: clientIp,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تسجيل الدخول";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
