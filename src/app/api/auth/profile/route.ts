import { NextResponse } from "next/server";
import { requireAuth, createSessionToken } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { isValidDisplayName, isValidPhone, normalizeEgyptianPhone } from "@/lib/auth/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = message === "ACCOUNT_SUSPENDED" ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { name, phone, avatarUrl, whatsappEnabled, licenseNumber, companyName, bio } = body;

    if (typeof name === "string" && !isValidDisplayName(name)) {
      return NextResponse.json(
        { error: "الاسم يجب أن يتكون من حرفين على الأقل وألا يزيد عن 80 حرفاً." },
        { status: 400 }
      );
    }

    let normalizedPhone: string | undefined = undefined;
    if (phone) {
      if (!isValidPhone(phone)) {
        return NextResponse.json(
          { error: "رقم الهاتف غير صالح، يرجى كتابة رقم موبايل صحيح (مثال: 01012345678)" },
          { status: 400 }
        );
      }
      normalizedPhone = normalizeEgyptianPhone(phone);
      const existing = dbStore.findUserByPhone(normalizedPhone);
      if (existing && existing.id !== user.id) {
        return NextResponse.json(
          { error: "رقم الهاتف المدخل مسجل بالفعل لدى مستخدم آخر في المنصة" },
          { status: 409 }
        );
      }
    }

    // 1. Supabase Cloud Sync using Admin Client to bypass any RLS restrictions
    try {
      const { createAdminClient } = await import("@/utils/supabase/server");
      const supabase = createAdminClient();
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (typeof name === "string") updatePayload.name = name.trim();
      if (normalizedPhone) updatePayload.phone = normalizedPhone;
      if (typeof avatarUrl === "string") updatePayload.avatar_url = avatarUrl.trim();
      if (typeof bio === "string") updatePayload.bio = bio.trim();
      if (typeof whatsappEnabled === "boolean") updatePayload.whatsapp_enabled = whatsappEnabled;
      if (typeof licenseNumber === "string") updatePayload.license_number = licenseNumber.trim();
      if (typeof companyName === "string") updatePayload.company_name = companyName.trim();

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      if (isUuid) {
        await supabase.from("profiles").update(updatePayload).eq("id", user.id);
      } else if (user.email) {
        await supabase.from("profiles").update(updatePayload).ilike("email", user.email);
      }
    } catch (cloudErr) {
      console.warn("[ProfilePUT] Supabase sync notice:", cloudErr);
    }

    // 2. Local Store Persistence
    const updatedUser = dbStore.updateUserProfile(user.id, {
      name: typeof name === "string" ? name.trim() : undefined,
      phone: normalizedPhone || (typeof phone === "string" ? phone.trim() : undefined),
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl.trim() : undefined,
      bio: typeof bio === "string" ? bio.trim() : undefined,
      whatsappEnabled: typeof whatsappEnabled === "boolean" ? whatsappEnabled : undefined,
      licenseNumber: typeof licenseNumber === "string" ? licenseNumber.trim() : undefined,
      companyName: typeof companyName === "string" ? companyName.trim() : undefined,
    });

    // 3. Keep Auth Session token synchronized
    const sessionToken = createSessionToken(updatedUser);
    const response = NextResponse.json({ success: true, user: updatedUser });
    response.cookies.set("auth_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ أثناء تحديث الملف الشخصي";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
