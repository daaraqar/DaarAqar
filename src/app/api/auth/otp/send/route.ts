import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import {
  checkRateLimit,
  isValidEmail,
  isDisposableEmail,
  isValidPhone,
  normalizeEgyptianPhone,
  normalizeEmail,
  evaluateSubmissionSecurity,
  generateNumericOtp,
  storeOtp,
} from "@/lib/auth/security";
import { GmailSmtpService } from "@/lib/services/gmailSmtpService";
import { WhatsAppService } from "@/lib/services/whatsappService";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const body = await req.json();
    const { email, phone, name, purpose = "register", hp_field, formLoadedAt } = body;

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
        { error: secResult.reason || "تعذر معالجة الطلب، تم رصد نشاط غير مصرح" },
        { status: 400 }
      );
    }

    // =========================================================================
    // CHANNEL A: Official Verification via Gmail SMTP (Priority)
    // =========================================================================
    if (email && typeof email === "string" && email.trim().length > 0) {
      const cleanEmail = email.trim().toLowerCase();

      // Validate email format
      if (!isValidEmail(cleanEmail)) {
        return NextResponse.json(
          { error: "يرجى إدخال بريد إلكتروني صحيح (مثال: name@gmail.com)" },
          { status: 400 }
        );
      }

      // Block temporary/disposable email domains
      if (isDisposableEmail(cleanEmail)) {
        return NextResponse.json(
          { error: "لا يمكن استخدام بريد إلكتروني مؤقت أو وهمي. يرجى استخدام بريد حقيقي لاستلام رمز التأكيد." },
          { status: 400 }
        );
      }

      // Rate Limiting: IP & Email limits
      const ipRate = checkRateLimit(`otp_ip_${clientIp}`, 8, 10 * 60 * 1000);
      if (!ipRate.allowed) {
        return NextResponse.json(
          {
            error: `تم تجاوز الحد الأقصى لطلب رموز التحقق. يرجى الانتظار ${ipRate.retryAfterSeconds} ثانية.`,
          },
          { status: 429 }
        );
      }

      const emailRate = checkRateLimit(`otp_email_${cleanEmail}`, 5, 10 * 60 * 1000);
      if (!emailRate.allowed) {
        return NextResponse.json(
          {
            error: `تم إرسال الحد الأقصى من رموز التحقق لهذا البريد. يرجى الانتظار ${emailRate.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
          },
          { status: 429 }
        );
      }

      // Duplicate registration check
      if (purpose === "register") {
        const existingEmailUser = dbStore.findUserByEmail(cleanEmail);
        if (existingEmailUser) {
          return NextResponse.json(
            {
              error: "البريد الإلكتروني مسجل بالفعل مسبقاً في المنصة. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.",
              alreadyExists: true,
              field: "email",
            },
            { status: 409 }
          );
        }

        if (phone && isValidPhone(phone)) {
          const normalizedPhone = normalizeEgyptianPhone(phone);
          const existingPhoneUser = dbStore.findUserByPhone(normalizedPhone);
          if (existingPhoneUser) {
            return NextResponse.json(
              {
                error: "رقم الهاتف المدخل مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول.",
                alreadyExists: true,
                field: "phone",
              },
              { status: 409 }
            );
          }
        }

        // Supabase duplicate check
        try {
          const supabase = createSupabaseServerClient();
          const { data: supaEmail } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", cleanEmail)
            .maybeSingle();

          if (supaEmail) {
            return NextResponse.json(
              {
                error: "البريد الإلكتروني مسجل بالفعل مسبقاً في المنصة. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.",
                alreadyExists: true,
                field: "email",
              },
              { status: 409 }
            );
          }

          if (phone && isValidPhone(phone)) {
            const normalizedPhone = normalizeEgyptianPhone(phone);
            const { data: supaPhone } = await supabase
              .from("profiles")
              .select("id")
              .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()}`)
              .maybeSingle();

            if (supaPhone) {
              return NextResponse.json(
                {
                  error: "رقم الهاتف المدخل مسجل بالفعل في حساب آخر. يرجى تسجيل الدخول.",
                  alreadyExists: true,
                  field: "phone",
                },
                { status: 409 }
              );
            }
          }
        } catch {
          // Non-blocking if offline
        }
      }

      // Generate & Store OTP (Valid for 5 minutes)
      const otpCode = generateNumericOtp();
      storeOtp(cleanEmail, otpCode, 5 * 60 * 1000);

      // If phone is also provided, store for normalized phone as well
      if (phone && isValidPhone(phone)) {
        storeOtp(normalizeEgyptianPhone(phone), otpCode, 5 * 60 * 1000);
      }

      // Dispatch via Gmail SMTP
      const emailResult = await GmailSmtpService.sendOtp(cleanEmail, otpCode, name);

      // Audit trail logging
      dbStore.recordAuditEvent(undefined, "AUTH_OTP_GMAIL_SENT", "auth", cleanEmail, {
        purpose,
        channel: "gmail",
        ip: clientIp,
        simulated: emailResult.simulated,
      });

      return NextResponse.json({
        success: true,
        channel: "email",
        email: cleanEmail,
        message: emailResult.message || "تم إرسال كود التحقق بنجاح إلى بريدك الإلكتروني (Gmail) ✉️",
        cooldownSeconds: 60,
      });
    }

    // =========================================================================
    // CHANNEL B: Fallback Verification via WhatsApp (if email was omitted)
    // =========================================================================
    if (!phone || typeof phone !== "string" || !isValidPhone(phone)) {
      return NextResponse.json(
        { error: "يرجى إدخال البريد الإلكتروني لاستلام رمز التأكيد عبر Gmail، أو رقم هاتف صحيح" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizeEgyptianPhone(phone);

    const ipRate = checkRateLimit(`otp_ip_${clientIp}`, 6, 10 * 60 * 1000);
    if (!ipRate.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى لطلب رموز التحقق. يرجى الانتظار ${ipRate.retryAfterSeconds} ثانية.`,
        },
        { status: 429 }
      );
    }

    const phoneRate = checkRateLimit(`otp_phone_${normalizedPhone}`, 4, 10 * 60 * 1000);
    if (!phoneRate.allowed) {
      return NextResponse.json(
        {
          error: `تم إرسال الحد الأقصى من رموز التحقق لهذا الرقم. يرجى الانتظار ${phoneRate.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
        },
        { status: 429 }
      );
    }

    if (purpose === "register") {
      const existingUser = dbStore.findUserByPhone(normalizedPhone);
      if (existingUser) {
        return NextResponse.json(
          {
            error: "رقم الهاتف مسجل بالفعل مسبقاً في المنصة. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.",
            alreadyExists: true,
            field: "phone",
          },
          { status: 409 }
        );
      }

      try {
        const supabase = createSupabaseServerClient();
        const { data: supaPhone } = await supabase
          .from("profiles")
          .select("id")
          .or(`phone.eq.${normalizedPhone},phone.eq.${phone.trim()}`)
          .maybeSingle();

        if (supaPhone) {
          return NextResponse.json(
            {
              error: "رقم الهاتف مسجل بالفعل مسبقاً في المنصة. يرجى تسجيل الدخول بدلاً من إنشاء حساب جديد.",
              alreadyExists: true,
              field: "phone",
            },
            { status: 409 }
          );
        }
      } catch {
        // Non-blocking if offline
      }
    }

    const otpCode = generateNumericOtp();
    storeOtp(normalizedPhone, otpCode, 5 * 60 * 1000);

    const waResult = await WhatsAppService.sendOtp(normalizedPhone, otpCode);

    dbStore.recordAuditEvent(undefined, "AUTH_OTP_WHATSAPP_SENT", "auth", normalizedPhone, {
      purpose,
      channel: "whatsapp",
      ip: clientIp,
      simulated: waResult.simulated,
    });

    return NextResponse.json({
      success: true,
      channel: "whatsapp",
      message: "تم إرسال كود التحقق بنجاح إلى حسابك على واتساب 🟢",
      phone: normalizedPhone,
      cooldownSeconds: 60,
      waLink: waResult.waLink,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء إرسال كود التحقق";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
