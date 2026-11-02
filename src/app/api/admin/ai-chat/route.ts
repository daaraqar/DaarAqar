import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { chatWithGemini, isGeminiConfigured, type ChatTurn } from "@/lib/services/geminiDashboardChat";

export const maxDuration = 60;

const SYSTEM_PROMPT = `أنت "مساعد دار العقار" — بوت ذكاء اصطناعي يعيش داخل لوحة تحكم منصة عقارية مصرية (مركز ميت غمر وقراه).
دورك: مساعد إداري خبير للإدارة — تحلل البيانات الحية وتجيب عن الأسئلة وتقترح إجراءات عملية.

قواعد صارمة:
1. اعتمد فقط على "بيانات لوحة التحكم الحية" المرفقة — لا تخترع أرقاماً أو أسماء أبداً. إن لم تجد الجواب في البيانات قل ذلك صراحة.
2. أجب بالعربية المصرية الواضحة والمختصرة — استخدم نقاطاً وأرقاماً عند السرد.
3. عند سؤال تحليلي (لماذا/ما رأيك) اذكر الأرقام الداعمة من البيانات ثم استنتاجك ثم اقتراح إجراء.
4. إن طُلب منك حذف أو تعديل بيانات: اشرح كيفية فعلها من اللوحة فقط — أنت لا تنفذ كتابةً، تنصح فقط.
5. تنسيق الرد: مختصر، منظم، بدون عبارات إنشائية زائدة.`;

/** يبني ملخصاً حياً ومضغوطاً لكل بيانات اللوحة ليقرأه النموذج */
function buildDashboardContext(): string {
  const stats = dbStore.getAdminStats();
  const properties = dbStore.getAllPropertiesForAdmin() as any[];
  const users = dbStore.getAllUsersForAdmin() as any[];
  const inquiries = dbStore.getAllInquiriesForAdmin() as any[];
  const notices = dbStore.getOfficialNoticesForAdmin();
  const crm = dbStore.getClientRecords();

  const fmt = (n: number) => n.toLocaleString("ar-EG");

  const byDate = <T extends { createdAt?: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const pendingProps = properties.filter((p) =>
    ["pending_review", "pending", "under_review"].includes(p.status)
  );
  const recentPending = byDate(pendingProps).slice(0, 5).map(
    (p) =>
      `- ${p.title} | ${p.advertiserName || p.contactName || "معلن"} | ${
        p.price ? fmt(Number(p.price)) + " ج.م" : "بدون سعر"
      } | ${p.category} | ${p.city || "ميت غمر"}${p.district ? "/" + p.district : ""}`
  );

  const recentProps = byDate(properties).slice(0, 5).map(
    (p) => `- ${p.title} | حالة: ${p.status} | ${p.category} | ${p.price ? fmt(Number(p.price)) + " ج.م" : "-"}`
  );

  const recentInquiries = byDate(inquiries).slice(0, 5).map(
    (i) =>
      `- ${i.name || i.userName || "مستخدم"} يهتم بـ"${i.propertyTitle || i.propertyId || "-"}" | حالة: ${i.status}`
  );

  const unreadNotices = notices.filter((n) => n.status === "unread").slice(0, 5).map(
    (n) => `- [${n.type}] ${n.title} → إلى ${n.recipientId} | ${n.message.slice(0, 80)}`
  );

  const unverifiedCrm = crm.filter((r) => !r.isVerified);
  const crmLines = byDate(crm).slice(0, 6).map(
    (r) =>
      `- [${r.type === "client" ? "طلب" : "عرض"}${r.isVerified ? " مؤكد" : " غير مؤكد"}] ${r.name} | ${r.phone} | ${
        r.requestedCategory || r.requestedProperty || r.availableListings || ""
      } | ${r.requestedPriceRange || ""} | ${r.requestedLocation || ""}`
  );

  const usersByRole = {
    owners: users.filter((u) => u.role === "owner").length,
    brokers: users.filter((u) => u.role === "broker").length,
    admins: users.filter((u) => u.role === "admin").length,
    suspended: users.filter((u) => u.isSuspended).length,
  };

  return `
## إحصائيات عامة
- عقارات: إجمالي ${fmt(stats.totalProperties)} | بانتظار المراجعة ${fmt(stats.pendingReviewCount)} | منشورة ${fmt(
    stats.publishedCount
  )} | مرفوضة ${fmt(stats.rejectedCount)} | مسودات ${fmt(stats.draftsCount)} | مباع ${fmt(stats.soldCount)} | مؤرشف ${fmt(
    stats.archivedCount
  )}
- مشاهدات العقارات: ${fmt(stats.totalPropertyViews)} | مفضلات: ${fmt(stats.totalFavoritesCount)}
- مستخدمون: إجمالي ${fmt(stats.totalUsers)} | ملاك ${fmt(usersByRole.owners)} | سماسرة ${fmt(
    usersByRole.brokers
  )} | إداريون ${fmt(usersByRole.admins)} | موثقون ${fmt(stats.verifiedUsersCount)} | موقوفون ${fmt(
    stats.suspendedAdvertisers
  )}
- استفسارات: إجمالي ${fmt(stats.totalInquiries)} | جديدة ${fmt(stats.newInquiriesCount)} | تم التواصل ${fmt(
    stats.contactedInquiriesCount
  )} | معاينة مجدولة ${fmt(stats.viewingScheduledCount)} | تفاوض ${fmt(stats.negotiatingCount)} | صفقات مغلقة ${fmt(
    stats.dealClosedCount
  )} | سبام ${fmt(stats.spamInquiriesCount)} | معدل الرد ${stats.responseRatePercent}%
- تقارير: إجمالي ${fmt(stats.totalReportsCount)} | بانتظار ${fmt(stats.pendingReportsCount)} | معدل الحل ${
    stats.reportResolutionRatePercent
  }%
- CRM (عروض وطلبات): إجمالي ${fmt(crm.length)} | غير مؤكد ${fmt(unverifiedCrm.length)} | مؤكد ${fmt(
    crm.length - unverifiedCrm.length
  )}
- إشعارات رسمية: غير مقروءة ${fmt(notices.filter((n) => n.status === "unread").length)} من ${fmt(notices.length)}

## عقارات بانتظار مراجعتك (${pendingProps.length})
${recentPending.join("\n") || "لا يوجد"}

## أحدث العقارات
${recentProps.join("\n") || "لا يوجد"}

## أحدث الاستفسارات
${recentInquiries.join("\n") || "لا يوجد"}

## إشعارات غير مقروءة
${unreadNotices.join("\n") || "لا يوجد"}

## سجلات CRM الأخيرة
${crmLines.join("\n") || "لا يوجد"}
`;
}

/** POST { message, history? } → { reply } */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح — المساعد مخصص للإدارة" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: "المساعد الذكي غير مفعل — أضف GEMINI_API_KEY إلى ملف البيئة" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const message = String(body?.message || "").trim();
    const history: ChatTurn[] = Array.isArray(body?.history)
      ? body.history
          .filter((t: any) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
          .slice(-20)
          .map((t: any) => ({ role: t.role, text: t.text.slice(0, 4000) }))
      : [];

    if (message.length < 1) {
      return NextResponse.json({ error: "اكتب سؤالك أولاً" }, { status: 400 });
    }
    if (message.length > 4000) {
      return NextResponse.json({ error: "الرسالة طويلة جداً (الحد 4000 حرف)" }, { status: 400 });
    }

    const dashboardContext = buildDashboardContext();
    const reply = await chatWithGemini(SYSTEM_PROMPT, dashboardContext, history, message);

    return NextResponse.json({ success: true, reply });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في المساعد الذكي";
    console.error("[ai-chat]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
