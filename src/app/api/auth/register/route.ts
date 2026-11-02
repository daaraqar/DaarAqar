import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  checkRateLimit,
  getSafeRedirectUrl,
  isValidEmail,
  isValidPhone,
  isValidDisplayName,
  normalizeEgyptianPhone,
  normalizeEmail,
  isDisposableEmail,
  isStrongPassword,
  evaluateSubmissionSecurity,
  validateHoneypot,
  validateSubmissionTiming,
  isPhoneVerificationTokenValid,
  consumePhoneVerificationToken,
  hashPassword,
} from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const rateStatus = checkRateLimit(`register_${clientIp}`, 8, 60 * 1000);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى لمحاولات التسجيل. يرجى الانتظار ${rateStatus.retryAfterSeconds} ثانية.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      password,
      role,
      avatarUrl,
      licenseNumber,
      companyName,
      nationalId,
      verificationToken,
      hp_field,
      formLoadedAt,
      redirect: rawRedirect,
    } = body;

    // 1. Multi-Layer Anti-Bot & Speed Trap Guard (No fragile user-data matching)
    const secResult = evaluateSubmissionSecurity({
      honeypotValue: hp_field,
      formLoadedAt,
      minDurationMs: 400,
    });

    if (secResult.isBlocked) {
      dbStore.recordAuditEvent(undefined, "SECURITY_BOT_BLOCKED", "auth", "bot_guard", {
        ip: clientIp,
        riskScore: secResult.riskScore,
        reason: secResult.reason,
      });
      return NextResponse.json(
        { error: secResult.reason || "تعذر إتمام التسجيل، تم رصد نشاط غير مصرح" },
        { status: 400 }
      );
    }

    // 3. Basic mandatory fields
    if (!isValidDisplayName(name) || !phone?.trim() || !role) {
      return NextResponse.json(
        { error: "اكتب اسماً كاملاً لا يقل عن حرفين ولا يزيد عن 80 حرفاً، مع رقم الهاتف ونوع الحساب." },
        { status: 400 }
      );
    }

    // Role validation & escalation prevention
    if (role === "admin") {
      dbStore.recordAuditEvent(undefined, "SECURITY_PRIVILEGE_ESCALATION_BLOCKED", "auth", "unknown", {
        attemptedRole: "admin",
        ip: clientIp,
      });
      return NextResponse.json(
        { error: "لا يمكن إنشاء حساب مسؤول نظام عبر التسجيل العام نهائياً" },
        { status: 403 }
      );
    }

    // Unified account model: All accounts are unified into standard user account
    const allowedRoles = ["user", "seeker", "buyer", "owner", "broker"];
    const effectiveRole = (role && allowedRoles.includes(role)) ? "user" : "user";

    // 4. Phone validation & normalization
    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "صيغة رقم الهاتف غير صالحة. يرجى إدخال رقم مصري صحيح (مثال: 01012345678)" },
        { status: 400 }
      );
    }
    const normalizedPhone = normalizeEgyptianPhone(phone);

    // Check duplicate phone in local store
    const existingPhoneUser = dbStore.findUserByPhone(normalizedPhone);
    if (existingPhoneUser) {
      return NextResponse.json(
        { error: "رقم الهاتف مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول بدلاً من التسجيل." },
        { status: 409 }
      );
    }

    // Check duplicate phone in Supabase profiles (if configured)
    try {
      const supabase = createSupabaseServerClient();
      const { data: supaPhoneUser } = await supabase
        .from("profiles")
        .select("id")
        .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()}`)
        .maybeSingle();

      if (supaPhoneUser) {
        return NextResponse.json(
          { error: "رقم الهاتف مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول بدلاً من التسجيل." },
          { status: 409 }
        );
      }
    } catch {
      // Non-blocking if offline
    }

    // 5. Email validation & disposable email defense
    let cleanEmail: string | undefined = undefined;
    if (email && email.trim().length > 0) {
      const trimmedEmail = email.trim().toLowerCase();
      if (!isValidEmail(trimmedEmail)) {
        return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, { status: 400 });
      }

      // Block temporary/fake disposable emails
      if (isDisposableEmail(trimmedEmail)) {
        return NextResponse.json(
          { error: "لا يمكن استخدام بريد إلكتروني مؤقت أو وهمي. يرجى إدخال بريدك الحقيقي أو تركه فارغاً." },
          { status: 400 }
        );
      }

      const canonicalEmail = normalizeEmail(trimmedEmail);
      const existingEmailUser = dbStore.findUserByEmail(canonicalEmail);
      if (existingEmailUser) {
        return NextResponse.json(
          { error: "البريد الإلكتروني مسجل بالفعل مسبقاً، يمكنك تسجيل الدخول به" },
          { status: 409 }
        );
      }

      // Check duplicate email in Supabase profiles (if configured)
      try {
        const supabase = createSupabaseServerClient();
        const { data: supaEmailUser } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", canonicalEmail)
          .maybeSingle();

        if (supaEmailUser) {
          return NextResponse.json(
            { error: "البريد الإلكتروني مسجل بالفعل مسبقاً في المنصة، يمكنك تسجيل الدخول به" },
            { status: 409 }
          );
        }
      } catch {
        // Non-blocking if offline
      }

      cleanEmail = canonicalEmail;
    }

    // 6. Anti-Fake Protection: Verify Token (Gmail SMTP or Phone)
    const emailTokenValid = Boolean(
      cleanEmail && isPhoneVerificationTokenValid(cleanEmail, verificationToken)
    );
    const phoneTokenValid = Boolean(
      normalizedPhone && isPhoneVerificationTokenValid(normalizedPhone, verificationToken)
    );
    const isTokenValid = emailTokenValid || phoneTokenValid;

    if (!verificationToken || !isTokenValid) {
      return NextResponse.json(
        {
          error: "يجب تأكيد الحساب عبر رمز التحقق (Gmail) قبل إتمام التسجيل لضمان أمان وموثوقية الحساب",
          requiresOtp: true,
        },
        { status: 400 }
      );
    }

    // 7. Password check
    if (password) {
      const passCheck = isStrongPassword(password);
      if (!passCheck.valid) {
        return NextResponse.json({ error: passCheck.reason }, { status: 400 });
      }
    }

    // Unified account: Profile details can be optionally supplied by any user

    // 9. Consume the verification token (prevent replay attacks)
    consumePhoneVerificationToken(verificationToken);

    // 10. Provision User in Supabase Cloud Auth & Profiles
    let supabaseUserId: string | undefined = undefined;
    try {
      const supabase = createSupabaseServerClient();
      const signupEmail = cleanEmail || `user_${normalizedPhone.replace(/\+/g, "")}@aqarpulse.com`;
      const signupPassword = password || "AqarPulse2026AutoPass!";

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          data: {
            name: name.trim(),
            phone: normalizedPhone,
            role: effectiveRole,
            avatar_url: avatarUrl || undefined,
          },
        },
      });

      if (authError) {
        console.warn("[Register] Supabase Auth response note:", authError.message);
        if (authError.message.toLowerCase().includes("already registered") || authError.status === 422) {
          // If already in Supabase, fetch their UUID
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .or(`email.eq.${signupEmail},phone.eq.${normalizedPhone}`)
            .maybeSingle();
          if (existingProfile?.id) {
            supabaseUserId = existingProfile.id;
          }
        }
      } else if (authData?.user?.id) {
        supabaseUserId = authData.user.id;
      }
    } catch (authErr: unknown) {
      console.warn("[Register] Supabase Auth provisioning warning:", authErr);
    }

    // 11. Create Persistent User with Cryptographic Hash (Unified Account)
    const { hash: passwordHash, salt: passwordSalt } = password
      ? hashPassword(password)
      : { hash: undefined, salt: undefined };

    const newUser = dbStore.createUser({
      id: supabaseUserId,
      name: name.trim(),
      email: cleanEmail,
      phone: normalizedPhone,
      role: effectiveRole,
      avatarUrl: typeof avatarUrl === "string" && avatarUrl.trim() ? avatarUrl.trim() : undefined,
      licenseNumber: licenseNumber ? licenseNumber.trim() : undefined,
      companyName: companyName ? companyName.trim() : undefined,
      nationalId: nationalId ? nationalId.trim() : undefined,
      isVerified: false,
      phoneVerified: phoneTokenValid,
      emailVerified: emailTokenValid,
      whatsappEnabled: true,
      passwordHash,
      passwordSalt,
    });

    const safeRedirect = getSafeRedirectUrl(rawRedirect, "/dashboard");
    const token = createSessionToken(newUser);
    const response = NextResponse.json({
      success: true,
      user: newUser,
      redirectTo: safeRedirect,
      token,
      message: "تم إنشاء حسابك بنجاح.",
    });

    const proto = req.headers.get("x-forwarded-proto") || "";
    const isHttps =
      proto.toLowerCase() === "https" ||
      req.headers.get("x-forwarded-ssl") === "on" ||
      req.url.startsWith("https://");
    const isSecure = isHttps;

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
    });

    dbStore.recordAuditEvent(newUser.id, "USER_REGISTERED", "user", newUser.id, {
      role: newUser.role,
      phone: normalizedPhone,
      hasEmail: Boolean(cleanEmail),
      channel: cleanEmail ? "gmail" : "whatsapp",
      ip: clientIp,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء إتمام التسجيل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
