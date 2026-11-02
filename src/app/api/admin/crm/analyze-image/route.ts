import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { analyzeImagesOnly } from "@/lib/services/geminiImageAnalyzer";

export const maxDuration = 60;

/**
 * POST /api/admin/crm/analyze-image
 * بوت تحليل الصور فقط: صورة منشور + صورة تعليقات (base64).
 * يستخرج: الأشخاص (أسماء + أرقام هواتف + أدوار)، العقار/العقارات في المنشور،
 * والتعليقات المكتشفة — ويرجع مسودة سجل CRM غير مؤكد.
 *
 * body: { postImage, postImageMimeType?, commentsImage?, commentsImageMimeType? }
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

    const body = await req.json();
    const postImage = typeof body?.postImage === "string" ? body.postImage : undefined;
    const postImageMimeType = typeof body?.postImageMimeType === "string" ? body.postImageMimeType : undefined;
    const commentsImage = typeof body?.commentsImage === "string" ? body.commentsImage : undefined;
    const commentsImageMimeType =
      typeof body?.commentsImageMimeType === "string" ? body.commentsImageMimeType : undefined;

    if (!postImage && !commentsImage) {
      return NextResponse.json(
        { error: "أرفق صورة المنشور أو صورة التعليقات — يجب صورة واحدة على الأقل" },
        { status: 400 }
      );
    }

    const analysis = await analyzeImagesOnly({
      postImage,
      postImageMimeType,
      commentsImage,
      commentsImageMimeType,
    });

    // حارس التكرار — نفس الرقم مسجل مسبقاً؟
    let duplicateOf: string | null = null;
    if (analysis.draft?.phone) {
      const existing = dbStore.getClientRecords().find((r) => r.phone === analysis.draft!.phone);
      if (existing) duplicateOf = `${existing.name} (${existing.phone})`;
    }

    return NextResponse.json({
      success: true,
      analysis,
      draft: analysis.draft || null,
      duplicateOf,
      message: analysis.people?.length
        ? `تم استخراج ${analysis.people.length} شخصاً من الصور — راجع الأسماء والأرقام ثم احفظ`
        : "تم تحليل الصورة — راجع البيانات ثم احفظ",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحليل الصور بالذكاء الاصطناعي";
    console.error("[crm/analyze-image]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
