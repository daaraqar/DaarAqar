import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import {
  normalizeIdentifier,
  verifyOtpCode,
  createVerificationToken,
} from "@/lib/auth/security";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const body = await req.json();
    const { email, phone, code } = body;

    const identifier = (email && typeof email === "string" && email.trim()) || (phone && typeof phone === "string" && phone.trim());

    if (!identifier || !code) {
      return NextResponse.json(
        { error: "البريد الإلكتروني (أو رقم الهاتف) وكود التحقق مطلوبان" },
        { status: 400 }
      );
    }

    const normalizedIdentifier = normalizeIdentifier(identifier);
    const verifyResult = verifyOtpCode(normalizedIdentifier, code);

    if (!verifyResult.valid) {
      dbStore.recordAuditEvent(undefined, "AUTH_OTP_FAILED", "auth", normalizedIdentifier, {
        ip: clientIp,
        reason: verifyResult.reason,
      });
      return NextResponse.json({ error: verifyResult.reason }, { status: 400 });
    }

    // Generate secure one-time verification token (valid for 15 minutes)
    const verificationToken = createVerificationToken(normalizedIdentifier);

    // If phone is also provided alongside email, also generate phone token so register API can validate either
    if (phone && phone !== identifier) {
      const normalizedPhone = normalizeIdentifier(phone);
      createVerificationToken(normalizedPhone);
    }

    dbStore.recordAuditEvent(undefined, "AUTH_OTP_VERIFIED", "auth", normalizedIdentifier, {
      ip: clientIp,
      channel: normalizedIdentifier.includes("@") ? "gmail" : "phone",
    });

    return NextResponse.json({
      success: true,
      message: normalizedIdentifier.includes("@")
        ? "تم تأكيد البريد الإلكتروني بنجاح عبر Gmail"
        : "تم التحقق من رقم الهاتف بنجاح",
      identifier: normalizedIdentifier,
      email: normalizedIdentifier.includes("@") ? normalizedIdentifier : undefined,
      phone: !normalizedIdentifier.includes("@") ? normalizedIdentifier : undefined,
      verificationToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء التحقق من الرمز";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizedPhone(val: string): string {
  return normalizeIdentifier(val);
}
