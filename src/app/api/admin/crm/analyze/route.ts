import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import {
  analyzeSocialPostWithGemini,
  isGeminiConfigured,
} from "@/lib/services/geminiSocialAnalyzer";
import { fetchSocialPost } from "@/lib/services/socialPostFetcher";

export const maxDuration = 60;

/**
 * POST /api/admin/crm/analyze
 * بوت Gemini: يحلل منشور تواصل اجتماعي وينشئ سجلاً في العروض والطلبات
 * — السجل يُنشأ دائماً بحالة "غير مؤكد" (isVerified: false) بانتظار تأكيد الإدارة.
 *
 * body: { postUrl?, postText, commentsText?, imageBase64?, imageMimeType?, autoSave? }
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "بوت Gemini غير مفعل — أضف GEMINI_API_KEY إلى ملف البيئة وأعد تشغيل الخادم" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { postUrl, postText, commentsText, imageBase64, imageMimeType, autoSave, fetchFromUrl } = body || {};

    let finalText = typeof postText === "string" ? postText.trim() : "";
    let urlFetchNote: string | null = null;

    // استخراج محتوى المنشور من الرابط إن طلب المستخدم ذلك
    const urlToFetch = typeof postUrl === "string" && /^https?:\/\//i.test(postUrl.trim()) ? postUrl.trim() : undefined;
    if (fetchFromUrl && urlToFetch) {
      const fetched = await fetchSocialPost(urlToFetch);
      if (fetched.ok && fetched.text.length > finalText.length) {
        finalText = [fetched.title, fetched.text].filter(Boolean).join("\n\n").trim().slice(0, 6000);
      } else if (!finalText) {
        return NextResponse.json(
          { error: fetched.reason || "تعذر جلب محتوى المنشور من الرابط — الصق النص يدوياً" },
          { status: 422 }
        );
      } else {
        urlFetchNote = fetched.reason || null;
      }
    }

    if (finalText.length < 15 && !imageBase64) {
      return NextResponse.json(
        { error: "انسخ نص المنشور والصقه هنا (15 حرفاً على الأقل) — أو أرفق لقطة شاشة أو استخدم خيار جلب المحتوى من الرابط" },
        { status: 400 }
      );
    }
    if (!imageBase64 && finalText.length < 15) {
      return NextResponse.json({ error: "المحتوى غير كافٍ للتحليل" }, { status: 400 });
    }

    // 1) AI analysis
    const analysis = await analyzeSocialPostWithGemini({
      postUrl: urlToFetch,
      postText: finalText || "حلل لقطة الشاشة المرفقة",
      commentsText: commentsText?.trim() || undefined,
      imageBase64: imageBase64 || undefined,
      imageMimeType: imageMimeType || undefined,
    });

    // 2) Duplicate guard — same phone already recorded?
    let duplicateOf: string | null = null;
    if (analysis.phone) {
      const existing = dbStore.getClientRecords().find((r) => r.phone === analysis.phone);
      if (existing) duplicateOf = `${existing.name} (${existing.phone})`;
    }

    // 3) Build CRM record draft — ALWAYS unverified until admin confirms
    const recordDraft = {
      type: analysis.type as "client" | "broker",
      name: analysis.name,
      phone: analysis.phone || "01000000000", // placeholder when missing — flagged for admin
      requestedProperty: analysis.requestedProperty,
      requestedCategory: analysis.requestedCategory,
      requestedArea: analysis.requestedArea,
      requestedPriceRange: analysis.requestedPriceRange,
      priceMin: analysis.priceMin,
      priceMax: analysis.priceMax,
      transactionType: analysis.transactionType,
      requestedLocation: analysis.requestedLocation,
      availableListings: analysis.availableListings,
      listingsCount: analysis.listingsCount,
      notes: [
        analysis.notes,
        analysis.intent === "عرض" ? "🤖 عرض مستخرج من منشور تواصل اجتماعي" : "🤖 طلب مستخرج من منشور تواصل اجتماعي",
        analysis.reasoning ? `تحليل البوت: ${analysis.reasoning}` : null,
        analysis.extraPhones?.length ? `أرقام إضافية من التعليقات: ${analysis.extraPhones.join("، ")}` : null,
        postUrl ? `المصدر: ${postUrl}` : null,
        urlFetchNote ? `تنبيه جلب الرابط: ${urlFetchNote}` : null,
        `درجة الثقة: ${Math.round(analysis.confidence * 100)}%`,
        analysis.missingFields?.length ? `ناقص: ${analysis.missingFields.join("، ")}` : null,
        duplicateOf ? `⚠️ رقم مكرر مع سجل موجود: ${duplicateOf}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
        .slice(0, 1500),
      isVerified: false, // ← بانتظار تأكيد الإدارة دائماً
      sourceType: urlToFetch ? ("link" as const) : ("bot" as const),
      sourceUrl: urlToFetch,
      createdBy: `بوت Gemini (${user.name || "إدارة"})`,
    };

    // If phone missing and no image proof, don't auto-save — return draft only
    const shouldAutoSave = autoSave === true && Boolean(analysis.phone);

    if (shouldAutoSave) {
      const record = dbStore.createClientRecord(recordDraft, user);
      return NextResponse.json({
        success: true,
        saved: true,
        record,
        analysis,
        duplicateOf,
        message: "تم تحليل المنشور وإنشاء سجل غير مؤكد — راجعه وؤكده من زر التأكيد",
      });
    }

    return NextResponse.json({
      success: true,
      saved: false,
      draft: recordDraft,
      analysis,
      duplicateOf,
      urlFetchNote,
      message: analysis.phone
        ? "تم التحليل بنجاح — راجع البيانات ثم اضغط حفظ"
        : "تم التحليل لكن رقم الهاتف غير موجود — أكمله يدوياً قبل الحفظ",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "خطأ أثناء تحليل المنشور بالذكاء الاصطناعي";
    console.error("[crm/analyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
