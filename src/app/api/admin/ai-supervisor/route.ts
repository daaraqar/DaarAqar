import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { chatWithGemini, isGeminiConfigured, type ChatTurn } from "@/lib/services/geminiDashboardChat";
import {
  buildSupervisorReport,
  buildSupervisorContext,
} from "@/lib/services/projectSupervisor";
import {
  askWithGoogleSearch,
  createSupervisorCache,
  generateWithCache,
} from "@/lib/services/geminiTools";

export const maxDuration = 60;

const SUPERVISOR_PROMPT = `أنت "المرشد الذكي لمشروع دار العقار" — مشرف أعمال استشاري يعيش داخل لوحة تحكم منصة عقارية في مركز ميت غمر وقراه (الدقهلية، مصر).
مهمتك: أن تكون عيناً الإشرافية على المشروع — تقرأ كل البيانات الحية وتحللها وتعطي الإدارة تحليلات وإجراءات عملية حقيقية، وليس كلاماً عاماً.

قواعد صارمة:
1. اعتمد حصراً على "حقائق التقرير المحسوب" المرفق — كل رقم فيه محسوب فعلياً من قاعدة البيانات. لا تخترع رقماً واحداً أبداً. إن لم يكن في البيانات قل "غير متوفر في البيانات حالياً".
2. ردك يجب أن يكون ملموساً: رقم + تفسير + إجراء واحد واضح على الأقل (أو افعل هذا الآن).
3. عند السؤال عن التسعير استخدم "نطاق الأسعار لكل تصنيف" المحسوب — قارن السعر السائل بالمتوسط الحقيقي.
4. عند السؤال عن توسع/فرص استخدم "توازن العرض والطلب" — اطلب من المناطق التي فيها طلب يفوق العرض.
5. رتّب أولوياتك: أول اشياء تحرق المال (استفسارات لم يُرد عليها، عقارات معلقة طويلاً، معلنون موقوفون) قبل تحسينات النموذج.
6. أجب بالعربية المصرية الواضحة والمنظمة — عناوين فرعية، نقاط، أرقام. مختصر لا إنشائي.
7. أنت لا تنفذ أي تعديل — تنصح فقط وتقول للإدارة أين تفعله من اللوحة.
8. أحياناً الإدارة تريد "جلسة إشراف كاملة" — في هذه الحالة قدّم: (أ) صحة المنصة اليوم، (ب) أطوار الخطر، (ج) الفرص، (د) خطة الأسبوع القادم بخطوات محددة.`;

/** POST { message, history?, webSearch? } → { reply, sources?, report } — المرشد الذكي */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح — المرشد الذكي مخصص للإدارة" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "المرشد الذكي غير مفعل — أضف GEMINI_API_KEY إلى ملف البيئة" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body?.message || "").trim();
    const history: ChatTurn[] = Array.isArray(body?.history)
      ? body.history
        .filter((t: any) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
        .slice(-20)
        .map((t: any) => ({ role: t.role, text: String(t.text).slice(0, 4000) }))
      : [];

    if (message.length < 1) {
      return NextResponse.json({ error: "اكتب سؤالك أولاً" }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "الرسالة طويلة جداً" }, { status: 400 });
    }

    // التقرير الإشرافي — يُحسب من قاعدة البيانات في كل استدعاء (بيانات حية دائماً)
    const report = buildSupervisorReport();
    const context = buildSupervisorContext(report);

    // وضع "بحث ويب" — سؤال يحتاج معلومات من خارج المنصة (أسعار السوق الفعلية مثلاً)
    const useWebSearch = body?.webSearch === true;

    if (useWebSearch) {
      // Grounding with Google Search — يجمع بيانات المنصة المحلية + بحث جوجل الحي
      const grounded = await askWithGoogleSearch(message, context);
      return NextResponse.json({
        success: true,
        reply: grounded.text,
        sources: grounded.sources,
        report,
        webSearchUsed: true,
      });
    }

    // وضع عادي — نحاول الكاش إن كان متاحاً (يوفّر حصة النموذج)، وإلا الرد المباشر
    let reply: string | null = null;
    try {
      const cache = await createSupervisorCache(SUPERVISOR_PROMPT, context);
      if (cache) {
        const cached = await generateWithCache(cache.name, message, history);
        reply = cached.text;
      }
    } catch {
      // الكاش اختياري — لا يفشل الرد إذا لم يُتاح
    }

    if (!reply) {
      const direct = await chatWithGemini(SUPERVISOR_PROMPT, context, history, message);
      reply = direct;
    }

    return NextResponse.json({ success: true, reply, report, webSearchUsed: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في المرشد الذكي";
    console.error("[ai-supervisor]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET → التقرير الإشرافي فقط بدون استدعاء AI (سريع — للوحة الملاحة) */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح — التقرير مخصص للإدارة" }, { status: 403 });
    }
    const report = buildSupervisorReport();
    return NextResponse.json({ success: true, report, aiEnabled: isGeminiConfigured(), webSearchFree: 1500 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في بناء تقرير الإشراف";
    console.error("[ai-supervisor GET]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
