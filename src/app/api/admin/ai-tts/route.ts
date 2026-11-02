import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { isGeminiConfigured, synthesizeSpeech } from "@/lib/services/geminiTools";

export const maxDuration = 60;

/**
 * POST /api/admin/ai-tts  { text } → audio base64 (mp3)
 * تحويل نص إلى صوت — لقراءة تقارير الإشراف صوتياً
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
    const text = String(body?.text || "").trim();
    if (!text) return NextResponse.json({ error: "أدخل النص المراد قراءته" }, { status: 400 });
    if (text.length > 2500) {
      return NextResponse.json({ error: "النص طويل جداً — الحد 2500 حرف للقراءة الصوتية" }, { status: 400 });
    }
    const audio = await synthesizeSpeech(text);
    return NextResponse.json({ success: true, ...audio });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في توليد الصوت";
    console.error("[ai-tts]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
