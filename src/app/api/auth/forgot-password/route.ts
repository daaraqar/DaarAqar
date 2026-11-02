import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { checkRateLimit, isValidEmail, generateNumericOtp, storeOtp } from "@/lib/auth/security";
import { GmailSmtpService } from "@/lib/services/gmailSmtpService";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const rateStatus = checkRateLimit(`forgot_${clientIp}`, 5, 60 * 1000);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار ${rateStatus.retryAfterSeconds} ثانية قبل إعادة المحاولة.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "يرجى إدخال بريد إلكتروني صحيح" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = dbStore.findUserByEmail(cleanEmail);

    // Generate secure 6-digit OTP valid for 10 minutes
    const otpCode = generateNumericOtp();
    storeOtp(cleanEmail, otpCode, 10 * 60 * 1000);

    // Send branded email with code via Gmail SMTP
    const emailResult = await GmailSmtpService.sendPasswordResetOtp(
      cleanEmail,
      otpCode,
      user?.name
    );

    // Call Supabase password recovery if connected
    try {
      const supabase = createSupabaseServerClient();
      await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
      });
    } catch {
      // In offline/local mode, proceed safely
    }

    if (user) {
      dbStore.recordAuditEvent(user.id, "PASSWORD_RESET_OTP_SENT", "auth", user.id, {
        email: cleanEmail,
        ip: clientIp,
        simulated: emailResult.simulated,
      });
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: "تم إرسال كود التحقق بنجاح إلى بريدك الإلكتروني.",
      cooldownSeconds: 60,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء معالجة الطلب";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

