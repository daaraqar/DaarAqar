/**
 * Project Supervisor — محرك التحليل العميق للمنصة
 * ------------------------------------------------
 * يحسب إحصاءات حقيقية من قاعدة البيانات (عقارات، مستخدمون، استفسارات، CRM)
 * ويعطيها للنموذج كـ"حقائق محسوبة" فيجيب استناداً إليها — لا تخمين.
 *
 * كل رقم هنا محسوب فعلياً — النموذج مجرد "مرشد" يشرحها ويرتبها ويقترح.
 */

import { dbStore } from "@/lib/db/store";
import type { StoredClientRecord } from "@/lib/db/store";
import { OFFICIAL_PROPERTY_CATEGORIES } from "@/lib/db/types";

/**
 * معرفة المنصة المرجعية — نص ثابت يُضاف للسياق المُكاش.
 * يخدم هدفين: (1) يجعل حجم الكاش يتجاوز الحد الأدنى 1024 رموز، (2) يعطي النموذج
 * تعريفات دقيقة لحالات المنصة والتصنيفات فيجيب بدقة.
 */
const PLATFORM_REFERENCE = `
=== معرفة المنصة المرجعية (ثابتة — استخدمها لتفسير الأرقام) ===
حالات العقار: published = منشور للعامة | pending_review = بانتظار مراجعة الإدارة | draft = مسودة | rejected = مرفوض | sold = مباع | archived = مؤرشف.
حالات الاستفسار: new = جديدة | contacted = تم تواصل | viewing_scheduled = معاينة مجدولة | negotiating = تفاوض | closed = صفقة مغلقة | spam = سبام.
أنواع مستخدمي المنصة: owner = مالك يعرض عقاره | broker = سمسار معتمد | seeker = باحث عن عقار | admin = إدارة.
حالات CRM: client = طلب بحث من عميل | broker = عرض/إيصال من سمسار. السجلات غير المؤكدة بيانات مجهول المصدر — لا تحسبها كحقائق نهائية.
أنواع الصفقات: sale = بيع | rent = إيجار. الأسعار كلها بالجنيه المصري.
تصنيفات العقار المقبولة: ${OFFICIAL_PROPERTY_CATEGORIES.map((c) => c.label).join("، ")}.
مركز التشغيل: ميت غمر وقراها — الدقهلية، مصر. القرى المحيطة تعتبر مناطق فرعية عند تحليل التوزيع الجغرافي.
الفرق بين "معدل الرد" (رد المالك على الاستفسار) و"معدل التحويل" (وصول الاستفسار لصفقة مغلقة).
قاعدة التسعير: المتوسط المحسوب من العروض المفعّلة فعلاً — قد يختلف عن أسعار الإعلانات الخارجية.
`;

export interface SupervisorInsight {
  severity: "critical" | "warning" | "info" | "good";
  title: string;
  detail: string;
  metric?: string;
}

export interface SupervisorReport {
  generatedAt: string;
  snapshot: {
    properties: number;
    users: number;
    inquiries: number;
    crmRecords: number;
    totalViews: number;
    totalFavorites: number;
    messages: number;
    unreadNotices: number;
  };
  /** أرقام حقيقية مفصلة — النموذج يشرحها فقط */
  facts: string[];
  /** ملاحظات إشرافية مشتقة من قواعد ثابتة (ليست من النموذج) */
  insights: SupervisorInsight[];
  /** إجراءات مقترحة مرتبة حسب الأولوية */
  actions: string[];
  /** تحليل الأسعار الحقيقي — متوسط/أدنى/أقصى لكل تصنيف */
  pricingByCategory: Array<{ category: string; count: number; avgPrice: number; min: number; max: number }>;
  /** التوزيع الجغرافي الحقيقي للعقارات والطلبات */
  demandVsSupply: Array<{ location: string; supply: number; demand: number; gap: string }>;
}

const CATEGORY_AR: Record<string, string> = Object.fromEntries(
  OFFICIAL_PROPERTY_CATEGORIES.map((c) => [c.value, c.label])
);

function fmt(n: number): string {
  return Math.round(n).toLocaleString("ar-EG");
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function daysAgo(iso: string | undefined): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function buildSupervisorReport(): SupervisorReport {
  const stats = dbStore.getAdminStats();
  const properties = dbStore.getAllPropertiesForAdmin() as any[];
  const users = dbStore.getAllUsersForAdmin() as any[];
  const inquiries = dbStore.getAllInquiriesForAdmin() as any[];
  const crm = dbStore.getClientRecords() as StoredClientRecord[];
  const auditLog = dbStore.getProjectAuditLog();
  const notices = dbStore.getOfficialNoticesForAdmin();

  const now = new Date().toISOString();
  const insights: SupervisorInsight[] = [];
  const actions: string[] = [];

  // ===== 1) سلامة خط أنابيب النشر =====
  const pending = properties.filter((p) => ["pending_review", "pending", "under_review"].includes(p.status));
  const published = properties.filter((p) => ["published", "active"].includes(p.status));
  const stalePublished = published.filter((p) => daysAgo(p.updatedAt) > 90);
  const noImageProps = published.filter((p) => !p.images?.length);

  if (pending.length > 0) {
    insights.push({
      severity: pending.length > 10 ? "critical" : "warning",
      title: "عقارات بانتظار المراجعة",
      detail: `${fmt(pending.length)} عقار معلّق في قائمة المراجعة — كل يوم تأخير يعني advertiser محبط. أقدمهم يعود لتاريخ أقدم طلب.`,
      metric: `${pending.length} عقار`,
    });
    actions.push(`راجع ${Math.min(pending.length, 10)} عقاراً معلقاً — ابدأ بالأقدم`);
  }
  if (noImageProps.length > 0) {
    insights.push({
      severity: "warning",
      title: "عقارات منشورة بدون صور",
      detail: `${noImageProps.length} عقار منشور بلا صورة واحدة — هذه لا تظهر في البحث المصور وتبقى غير مرئية للمستخدمين.`,
      metric: `${noImageProps.length} عقار`,
    });
    actions.push(`اطلب صوراً من معلني ${Math.min(noImageProps.length, 5)} عقارات بلا صور`);
  }
  if (stalePublished.length > 5) {
    insights.push({
      severity: "info",
      title: "عقارات قديمة لم تتحدث",
      detail: `${stalePublished.length} عقار منشور لم يُحدَّث لأكثر من 90 يوماً — قد تكون مباعة فعلاً أو السعر قديم. تواصل مع معلنيها.`,
    });
    actions.push("دوريات تحديث العقارات الأقدم من 90 يوماً");
  }

  // ===== 2) جودة محتوى العقارات =====
  const shortDesc = published.filter((p) => (p.description || "").length < 120);
  if (shortDesc.length > 0) {
    insights.push({
      severity: "info",
      title: "أوصاف قصيرة جداً",
      detail: `${shortDesc.length} عقار منشور بوصف أقل من 120 حرفاً — عقارات كثيرة مشابهة لن يتميز بينها. الوصف الجيد يرفع معدل التحويل.`,
    });
  }

  // ===== 3) معدل التحويل الفعلي =====
  const conv = stats.dealConversionPercent;
  const resp = stats.responseRatePercent;
  insights.push({
    severity: conv < 5 ? "warning" : conv < 15 ? "info" : "good",
    title: "معدل التحويل للصفقات",
    detail: `${conv}% من الاستفسارات تتحول لصفقة مغلقة (${fmt(stats.dealClosedCount)} من ${fmt(stats.totalInquiries)}). ومعدل الرد ${resp}%. ${resp < 50
        ? "معدل الرد منخفض — الملاك لا يجيبون بسرعة، وهذه أكبر ثغرة في سلسلة البيع."
        : "معدل الرد صحي — الفرصة الأكبر في تسريع المراحل اللاحقة (معاينة → تفاوض → صفقة)."
      }`,
    metric: `تحويل ${conv}% • رد ${resp}%`,
  });
  if (resp < 50) {
    actions.push("اتصل بملاك العقارات التي لم يُرد على استفساراتها وأشعِرهم بقيمة الرد السريع");
  }

  // ===== 4) طلبات مقابل عرض (من CRM + الاستفسارات) =====
  const crmDemands = crm.filter((r) => r.type === "client");
  const crmOffers = crm.filter((r) => r.type === "broker");
  const unverified = crm.filter((r) => !r.isVerified);
  if (unverified.length > 0) {
    insights.push({
      severity: unverified.length > 10 ? "critical" : "warning",
      title: "سجلات CRM غير مؤكدة",
      detail: `${unverified.length} من ${crm.length} سجل غير مؤكد — بيانات مجهول المصدر تُدخل ضوضاء في التحليلات. راجعها وأكد أو احذف.`,
      metric: `${unverified.length}/${crm.length}`,
    });
    actions.push(`تأكد من ${Math.min(unverified.length, 10)} سجل CRM معلّق`);
  }

  const priceByCat = computePricingByCategory(properties, crm);
  const demandSupply = computeDemandVsSupply(properties, crm, inquiries);

  // ===== 5) توازن العرض والطلب =====
  const biggestGap = demandSupply.find((d) => d.demand > d.supply * 2);
  if (biggestGap) {
    insights.push({
      severity: "info",
      title: "منطقة بها طلب بدون عرض كافٍ",
      detail: `${biggestGap.location}: ${biggestGap.demand} طلب مقابل ${biggestGap.supply} عرض فقط — فرصة واضحة لجلب عرض جديد في هذه المنطقة.`,
      metric: `طلب ${biggestGap.demand} / عرض ${biggestGap.supply}`,
    });
    actions.push(`ابحث عن عروض في ${biggestGap.location} — الطريق للتوسع`);
  }

  // ===== 6) جودة المستخدمين =====
  const suspendedUsers = users.filter((u) => u.isSuspended);
  const unverifiedUsers = users.filter((u) => (u.role === "owner" || u.role === "broker") && !u.isVerified);
  insights.push({
    severity: suspendedUsers.length > 0 ? "warning" : "good",
    title: "حالة المعلنين",
    detail: `${fmt(users.length)} مستخدم إجمالاً — ${fmt(unverifiedUsers.length)} معلن غير موثق، ${fmt(suspendedUsers.length)} موقوف. المعلنون الموثقون يرفعون ثقة الباحثين.`,
    metric: `${unverifiedUsers.length} غير موثق`,
  });
  if (unverifiedUsers.length > 0) {
    actions.push(`وثّق ${Math.min(unverifiedUsers.length, 5)} معلن نشط (رخصة/بطاقة)`);
  }

  // ===== 7) سجل الإحالات (Audit) =====
  const recentAudit = auditLog.slice(0, 5);

  // ===== 8) الإشعارات الرسمية =====
  const unreadNotices = notices.filter((n) => n.status === "unread");
  if (unreadNotices.length > 5) {
    insights.push({
      severity: "warning",
      title: "إشعارات لم تُقرأ",
      detail: `${unreadNotices.length} إشعار إداري غير مقروء — بعضها قد يحتوي رفضاً أو تعديلاً مطلوباً. راجعها من صفحة الإشعارات.`,
      metric: `${unreadNotices.length} غير مقروء`,
    });
  }

  // ===== 9) رسائل الاستفسارات (النص من المستخدمين) =====
  const messagesCount = inquiries.reduce((sum, i) => sum + (Array.isArray(i.messages) ? i.messages.length : 0), 0);
  const recentUserMessages = inquiries
    .flatMap((i) => (i.messages || []).filter((m: any) => m.senderRole !== "owner" && m.senderRole !== "broker").slice(-1))
    .slice(-5)
    .map((m: any) => (m.text || "").slice(0, 80));
  const silentInquiries = inquiries.filter((i) => !Array.isArray(i.messages) || i.messages.length === 0).length;
  if (silentInquiries > 0) {
    insights.push({
      severity: resp < 50 ? "warning" : "info",
      title: "استفسارات بدون أي رسالة",
      detail: `${fmt(silentInquiries)} استفسار لم تُرسل فيه أي رسالة متابعة — هذه فرصة ضائعة. الرد السريع يرفع التحويل.`,
      metric: `${fmt(silentInquiries)} صامتة`,
    });
    actions.push("تابع الاستفسارات الصامتة برسالة ترحيب من المالك");
  }

  // ===== سطر الحقائق =====
  const facts = [
    `العقارات: إجمالي ${fmt(properties.length)} | منشور ${fmt(published.length)} | بانتظار المراجعة ${fmt(pending.length)} | مسودة ${fmt(stats.draftsCount)} | مرفوض ${fmt(stats.rejectedCount)} | مباع ${fmt(stats.soldCount)} | مؤرشف ${fmt(stats.archivedCount)}`,
    `مشاهدات: ${fmt(stats.totalPropertyViews)} إجمالاً | متوسط لكل عقار ${fmt(properties.length ? Math.round(stats.totalPropertyViews / properties.length) : 0)}`,
    `المفضلات: ${fmt(stats.totalFavoritesCount)}`,
    `المستخدمون: ${fmt(users.length)} | ملاك ${fmt(users.filter((u) => u.role === "owner").length)} | سماسرة ${fmt(users.filter((u) => u.role === "broker").length)} | باحثون ${fmt(stats.seekersCount)} | موثقون ${fmt(stats.verifiedUsersCount)} | موقوفون ${fmt(suspendedUsers.length)}`,
    `الاستفسارات: إجمالي ${fmt(stats.totalInquiries)} | جديدة ${fmt(stats.newInquiriesCount)} | تم تواصل ${fmt(stats.contactedInquiriesCount)} | معاينة مجدولة ${fmt(stats.viewingScheduledCount)} | تفاوض ${fmt(stats.negotiatingCount)} | صفقات مغلقة ${fmt(stats.dealClosedCount)} | سبام ${fmt(stats.spamInquiriesCount)}`,
    `معدل التحويل للصفقة: ${conv}% | معدل الرد: ${resp}% | تحويل للمعاينة: ${stats.viewingConversionPercent}%`,
    `CRM: إجمالي ${fmt(crm.length)} | طلبات عملاء ${fmt(crmDemands.length)} | عروض سماسرة ${fmt(crmOffers.length)} | مؤكد ${fmt(crm.length - unverified.length)} | غير مؤكد ${fmt(unverified.length)}`,
    `مصادر CRM: من البوت ${fmt(crm.filter((r) => r.sourceType === "bot" || r.sourceType === "link").length)} | يدوي ${fmt(crm.filter((r) => r.sourceType === "manual").length)}`,
    `التقارير: ${fmt(stats.totalReportsCount)} إجمالاً | بانتظار ${fmt(stats.pendingReportsCount)} | معدل الحل ${stats.reportResolutionRatePercent}%`,
    `أخطر عقارات في الانتظار: ${pending.slice(0, 5).map((p) => `${p.title} (${daysAgo(p.createdAt)} يوم)`).join(" • ") || "لا يوجد"}`,
    `أحدث إجراءات إشراف: ${recentAudit.map((a) => `${a.projectTitle}: ${a.action}`).join(" • ") || "لا يوجد"}`,
    `الإشعارات: ${fmt(notices.length)} إجمالاً | غير مقروءة ${fmt(unreadNotices.length)}`,
    `الرسائل في الاستفسارات: ${fmt(messagesCount)} رسالة | ${fmt(silentInquiries)} استفسار بدون أي رسالة`,
    `أحدث رسائل المستخدمين: ${recentUserMessages.map((m: string) => `«${m}»`).join(" • ") || "لا يوجد"}`,
    ...priceByCat.map((p) => `أسعار ${p.category}: ${p.count} عقار | متوسط ${fmt(p.avgPrice)} ج.م | نطاق ${fmt(p.min)}–${fmt(p.max)} ج.م`),
    ...demandSupply.slice(0, 8).map((d) => `${d.location}: ${d.supply} عرض | ${d.demand} طلب | ${d.gap}`),
  ];

  return {
    generatedAt: now,
    snapshot: {
      properties: properties.length,
      users: users.length,
      inquiries: inquiries.length,
      crmRecords: crm.length,
      totalViews: stats.totalPropertyViews,
      totalFavorites: stats.totalFavoritesCount,
      messages: messagesCount,
      unreadNotices: unreadNotices.length,
    },
    facts,
    insights,
    actions,
    pricingByCategory: priceByCat,
    demandVsSupply: demandSupply,
  };
}

/** متوسط/أدنى/أقصى سعر لكل تصنيف — من العقارات المنشورة + سجلات CRM */
function computePricingByCategory(properties: any[], crm: StoredClientRecord[]) {
  const buckets = new Map<string, number[]>();
  for (const p of properties) {
    if (!["published", "active"].includes(p.status)) continue;
    const price = Number(p.price) || 0;
    if (price <= 0) continue;
    const key = CATEGORY_AR[p.category] || p.category || "غير محدد";
    const arr = buckets.get(key) || [];
    arr.push(price);
    buckets.set(key, arr);
  }
  // من CRM المؤكد — استخدم priceMax/priceMin المستخرجين بالبوت
  for (const r of crm) {
    if (!r.isVerified) continue;
    const price = r.priceMax || r.priceMin;
    if (!price) continue;
    const key = r.requestedCategory || "غير محدد";
    const arr = buckets.get(key) || [];
    arr.push(price);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries())
    .filter(([, arr]) => arr.length >= 2)
    .map(([category, arr]) => ({
      category,
      count: arr.length,
      avgPrice: arr.reduce((a: number, b: number) => a + b, 0) / arr.length,
      min: Math.min(...arr),
      max: Math.max(...arr),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

  /** توازن العرض والطلب لكل منطقة — من العقارات + الطلبات + الاستفسارات */
  function computeDemandVsSupply(properties: any[], crm: StoredClientRecord[], inquiries: any[]) {
    const map = new Map<string, { supply: number; demand: number }>();
    const bump = (loc: string, key: "supply" | "demand", n = 1) => {
      const l = loc.trim() || "غير محدد";
      const cur = map.get(l) || { supply: 0, demand: 0 };
      cur[key] += n;
      map.set(l, cur);
    };
    for (const p of properties) {
      if (!["published", "active"].includes(p.status)) continue;
      bump(p.city || "ميت غمر", "supply");
    }
    for (const r of crm) {
      if (r.type !== "client") continue;
      bump(r.requestedLocation || "غير محدد", "demand");
    }
    for (const i of inquiries) {
      if (["closed", "spam"].includes(i.status)) continue;
      bump(i.propertyCity || i.city || "ميت غمر", "demand");
    }
    return Array.from(map.entries())
      .filter(([, v]) => v.supply + v.demand > 0)
      .map(([location, v]) => ({
        location,
        supply: v.supply,
        demand: v.demand,
        gap:
          v.demand > v.supply * 2
            ? "طلب يفوق العرض بشدة ← فرصة"
            : v.supply > v.demand * 3
              ? "عرض يفوق الطلب ← تسويق أكثر"
              : "متوازن",
      }))
      .sort((a, b) => b.supply + b.demand - (a.supply + a.demand))
      .slice(0, 15);
}

  /** سياق نصي مضغوط يُمرر للنموذج — نفس التقرير لكن كنص */
  export function buildSupervisorContext(report: SupervisorReport): string {
    return [
      PLATFORM_REFERENCE,
      `=== تقرير الإشراف المُحسب فعلياً من قاعدة البيانات (${new Date(report.generatedAt).toLocaleString("ar-EG")}) ===`,
      `## حقائق محسوبة (اعتمد عليها فقط)\n${report.facts.join("\n")}`,
      `## ملاحظات الإشراف (مُستخرجة بقواعد ثابتة — وليست رأيك)\n${report.insights.map((i) => `- [${i.severity}] ${i.title}: ${i.detail}`).join("\n")}`,
      `## إجراءات مقترحة من القواعد\n${report.actions.map((a) => `- ${a}`).join("\n")}`,
      `## توازن العرض والطلب\n${report.demandVsSupply.map((d) => `- ${d.location}: عرض ${d.supply} / طلب ${d.demand} — ${d.gap}`).join("\n")}`,
      `## نطاق الأسعار لكل تصنيف\n${report.pricingByCategory.map((p) => `- ${p.category}: متوسط ${Math.round(p.avgPrice).toLocaleString("ar-EG")} ج.م | نطاق ${Math.round(p.min).toLocaleString("ar-EG")}–${Math.round(p.max).toLocaleString("ar-EG")} | ${p.count} عقار`).join("\n")}`,
    ].join("\n\n");
  }
