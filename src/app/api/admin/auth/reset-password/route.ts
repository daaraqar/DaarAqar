import { NextResponse } from "next/server";
import { GmailSmtpService } from "@/lib/services/gmailSmtpService";
import { dbStore } from "@/lib/db/store";
import { hashPassword, normalizeEmail } from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

// In-memory recovery PIN store (10 minute expiry)
const recoveryStore = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, email: rawEmail, code, newPassword } = body;

    const email = normalizeEmail(rawEmail || "mkelwayzy@gmail.com");

    const supabase = createSupabaseServerClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, name, role")
      .ilike("email", email)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json(
        { error: "هذا البريد غير مسجل كمسؤول للنظام" },
        { status: 403 }
      );
    }

    // Step 1: Send recovery PIN
    if (action === "send_code") {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      recoveryStore.set(email, {
        code: pin,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      try {
        await GmailSmtpService.sendPasswordResetOtp(email, pin, profile.name || "مدير النظام");
      } catch (err: any) {
        console.error("Failed to send admin recovery email:", err);
      }

      return NextResponse.json({
        success: true,
        message: `تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك (${email})`,
      });
    }

    // Step 2: Verify and Reset
    if (action === "verify_and_reset") {
      if (!code || !newPassword) {
        return NextResponse.json(
          { error: "رمز التحقق وكلمة المرور الجديدة مطلوبان" },
          { status: 400 }
        );
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف" },
          { status: 400 }
        );
      }

      const record = recoveryStore.get(email);
      if (!record || record.expiresAt < Date.now()) {
        return NextResponse.json(
          { error: "انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد" },
          { status: 400 }
        );
      }

      if (record.code !== code.trim()) {
        return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
      }

      // Valid PIN -> Update password in Supabase via RPC
      await supabase.rpc("update_user_password_direct", {
        target_user_id: profile.id,
        new_password_text: newPassword,
      });

      // Update in dbStore
      const { hash, salt } = hashPassword(newPassword);
      dbStore.updateUserPassword(profile.id, hash, salt);

      // Clean up recovery record
      recoveryStore.delete(email);

      dbStore.recordAuditEvent(profile.id, "ADMIN_PASSWORD_RESET_RECOVERY", "admin", profile.id, {
        email,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        message: "تم تعيين كلمة مرور المسؤول الجديدة بنجاح! يمكنك الآن تسجيل الدخول.",
      });
    }

    return NextResponse.json({ error: "إجراء غير مدعوم" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء استعادة كلمة المرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
