import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { isGeminiConfigured, generatePropertyImage } from "@/lib/services/geminiTools";

export const maxDuration = 120;

/**
 * POST /api/admin/ai-image  { prompt, sourceImageBase64? } → { dataUrl }
 * Nano Banana: توليد صورة عقارية من وصف، أو تحرير صورة موجودة.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: "الذكاء الاصطناعي غير مفعل — أضف GEMINI_API_KEY" }, { status: 503 });
    }
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    if (prompt.length < 5) {
      return NextResponse.json({ error: "اكتب وصفاً واضحاً للصورة (5 أحرف على الأقل)" }, { status: 400 });
    }
    const sourceImageBase64 = typeof body?.sourceImageBase64 === "string" ? body.sourceImageBase64 : undefined;
    const image = await generatePropertyImage(prompt.slice(0, 2000), sourceImageBase64);
    return NextResponse.json({ success: true, ...image });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في توليد الصورة";
    console.error("[ai-image]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
