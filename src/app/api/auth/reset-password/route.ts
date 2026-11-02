import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { checkRateLimit, isStrongPassword, verifyOtpCode, hashPassword } from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown_client";
    const rateStatus = checkRateLimit(`reset_${clientIp}`, 6, 60 * 1000);

    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى للمحاولات. يرجى الانتظار ${rateStatus.retryAfterSeconds} ثانية.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { password, confirmPassword, email, code } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "البريد الإلكتروني مطلوب" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify OTP code if provided (or require it)
    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { error: "يرجى إدخال كود التحقق المرسل إلى بريدك الإلكتروني" },
        { status: 400 }
      );
    }

    const verifyResult = verifyOtpCode(cleanEmail, code);
    if (!verifyResult.valid) {
      dbStore.recordAuditEvent(undefined, "PASSWORD_RESET_OTP_FAILED", "auth", cleanEmail, {
        ip: clientIp,
        reason: verifyResult.reason,
      });
      return NextResponse.json(
        { error: verifyResult.reason || "كود التحقق غير صحيح أو انتهت صلاحيته" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json({ error: "كلمة المرور الجديدة مطلوبة" }, { status: 400 });
    }

    if (confirmPassword && password !== confirmPassword) {
      return NextResponse.json({ error: "كلمتا المرور غير متطابقتين" }, { status: 400 });
    }

    const passCheck = isStrongPassword(password);
    if (!passCheck.valid) {
      return NextResponse.json({ error: passCheck.reason }, { status: 400 });
    }

    const { hash: newPasswordHash, salt: newPasswordSalt } = hashPassword(password);

    // Sync or find user in dbStore
    let user = dbStore.findUserByEmail(cleanEmail);
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

    if (user) {
      dbStore.updateUserPassword(user.id, newPasswordHash, newPasswordSalt);
      dbStore.recordAuditEvent(user.id, "PASSWORD_RESET_COMPLETED", "auth", user.id, {
        ip: clientIp,
        email: cleanEmail,
      });
    }

    // Attempt Supabase password update if active session is present
    try {
      const supabase = createSupabaseServerClient();
      await supabase.auth.updateUser({ password });
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء إعادة تعيين كلمة المرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

