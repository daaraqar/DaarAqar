import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hashPassword, verifyPassword } from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول أولاً" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف" },
        { status: 400 }
      );
    }

    // If current password provided, verify it first
    if (currentPassword) {
      let isCurrentValid = false;

      if (user.passwordHash && user.passwordSalt) {
        isCurrentValid = verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
      } else if (user.email) {
        try {
          const supabase = createSupabaseServerClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
          });
          if (data?.user && !error) {
            isCurrentValid = true;
          }
        } catch {
          // Ignore
        }
      }

      if (!isCurrentValid) {
        return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 });
      }
    }

    // 1. Update password in Supabase PostgreSQL auth.users
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Update password via auth admin API if service key exists, or update profile
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          await supabase.auth.admin.updateUserById(user.id, {
            password: newPassword,
          });
        } else {
          // Update via RPC or direct update if available
          await supabase.rpc("update_user_password_direct", {
            target_user_id: user.id,
            new_password_text: newPassword,
          });
        }
      } catch (err) {
        console.error("Supabase password update error", err);
      }
    }

    // 2. Update local dbStore hash and salt
    const { hash, salt } = hashPassword(newPassword);
    dbStore.updateUserPassword(user.id, hash, salt);

    // 3. Record Audit Event
    dbStore.recordAuditEvent(user.id, "ADMIN_PASSWORD_CHANGED", "admin", user.id, {
      adminEmail: user.email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تغيير كلمة المرور";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
