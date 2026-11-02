import { NextResponse } from "next/server";
import { isValidEmail, normalizeEmail, generateNumericOtp, storeOtp, checkRateLimit, createSignedOtpTicket } from "@/lib/auth/security";
import { sendOtpEmail } from "@/lib/services/emailService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "يرجى إدخال بريد إلكتروني صحيح (مثال: name@gmail.com)" },
        { status: 400 }
      );
    }

    const cleanEmail = normalizeEmail(email);

    // Rate limiting: max 5 requests per 10 minutes per email
    const rate = checkRateLimit(`email_otp_${cleanEmail}`, 5, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `تم إرسال عدة طلبات مؤخراً. يرجى الانتظار ${rate.retryAfterSeconds} ثانية قبل المحاولة مجدداً.` },
        { status: 429 }
      );
    }

    // Generate 6-digit numeric OTP
    const otp = generateNumericOtp();
    storeOtp(cleanEmail, otp, 10 * 60 * 1000);
    const ticket = createSignedOtpTicket(cleanEmail, otp, 10 * 60 * 1000);

    // Send via Gmail SMTP
    const mailResult = await sendOtpEmail(cleanEmail, otp);

    if (!mailResult.success && !mailResult.messageId) {
      return NextResponse.json(
        { error: "تعذر إرسال الرمز إلى البريد الإلكتروني، يرجى التأكد من صحة البريد والمحاولة لاحقاً." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح",
      email: cleanEmail,
      ticket,
    });

    response.cookies.set("aqarpulse_otp_ticket", ticket, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (err: any) {
    console.error("[EmailOtpSend] Error:", err);
    return NextResponse.json(
      { error: err?.message || "حدث خطأ غير متوقع أثناء إرسال الرمز" },
      { status: 500 }
    );
  }
}
