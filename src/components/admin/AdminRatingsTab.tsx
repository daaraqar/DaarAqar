"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Star,
  ThumbsUp,
} from "lucide-react";
import type { RatingsConfig } from "@/lib/ratings/reputation";
import { DEFAULT_RATINGS_CONFIG } from "@/lib/ratings/reputation";

interface AdminReview {
  id: string;
  seller_name: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  status: "published" | "hidden";
  created_at: string;
  properties?: { title?: string } | Array<{ title?: string }> | null;
}

interface AdminReport {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  resolution_note?: string;
  created_at: string;
  seller_reviews?: {
    seller_name?: string;
    reviewer_name?: string;
    rating?: number;
    comment?: string;
  } | null;
}

interface RatingSubject {
  id: string;
  label: string;
  type: "seller" | "project";
}

interface RatingsAdminData {
  config: RatingsConfig;
  reviews: AdminReview[];
  reports: AdminReport[];
  page: number;
  pageSize: number;
  reviewCount: number;
  reportCount: number;
  hasMoreReviews: boolean;
  hasMoreReports: boolean;
  auditEvents: Array<{
    id: string;
    user_id: string | null;
    action: string;
    entity_id: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  overrides: Array<{
    subject_type: "seller" | "project";
    subject_id: string;
    badge_type: string;
    enabled: boolean;
    reason: string;
    updated_at: string;
  }>;
  subjects: RatingSubject[];
}

const SCOPE_LABELS = {
  district_category: "المنطقة ونوع النشاط",
  city_category: "المدينة ونوع النشاط",
  platform_wide: "المنصة بالكامل",
} as const;

function getPropertyTitle(review: AdminReview): string {
  const property = Array.isArray(review.properties) ? review.properties[0] : review.properties;
  return property?.title || "عقار";
}

export default function AdminRatingsTab() {
  const [data, setData] = useState<RatingsAdminData | null>(null);
  const [config, setConfig] = useState<RatingsConfig>(DEFAULT_RATINGS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [overrideSubject, setOverrideSubject] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async (pageNumber = page) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ratings?page=${pageNumber}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحميل لوحة التقييمات");
      setData(result);
      setConfig(result.config);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل لوحة التقييمات");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر حفظ الإعدادات");
      setConfig(result.config);
      setFeedback("تم حفظ قواعد التقييم والشارات وتسجيل التغيير.");
      await load(page);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const moderateReview = async (review: AdminReview) => {
    const reason = reviewReasons[review.id]?.trim() || "";
    if (reason.length < 5) {
      setError("اكتب سببًا واضحًا لا يقل عن 5 أحرف قبل تغيير حالة التقييم.");
      return;
    }
    setActionId(review.id);
    setError(null);
    try {
      const status = review.status === "published" ? "hidden" : "published";
      const response = await fetch(`/api/admin/ratings/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحديث التقييم");
      setFeedback("تم تحديث حالة التقييم وتسجيل سبب القرار.");
      setReviewReasons((current) => ({ ...current, [review.id]: "" }));
      await load(page);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "تعذر تحديث التقييم");
    } finally {
      setActionId(null);
    }
  };

  const resolveReport = async (report: AdminReport, status: "resolved" | "dismissed") => {
    const note = reportNotes[report.id]?.trim() || "";
    if (note.length < 5) {
      setError("اكتب ملاحظة توضح نتيجة معالجة البلاغ.");
      return;
    }
    setActionId(report.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/ratings/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر حفظ قرار البلاغ");
      setFeedback("تم حفظ قرار البلاغ وتسجيله في سجل التدقيق.");
      setReportNotes((current) => ({ ...current, [report.id]: "" }));
      await load(page);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "تعذر حفظ قرار البلاغ");
    } finally {
      setActionId(null);
    }
  };

  const saveOverride = async (enabled: boolean) => {
    const subject = data?.subjects.find((item) => `${item.type}:${item.id}` === overrideSubject);
    if (!subject || overrideReason.trim().length < 5) {
      setError("اختر بائعًا أو مشروعًا واكتب سبب الاعتماد/الإزالة.");
      return;
    }
    setActionId("override");
    setError(null);
    try {
      const response = await fetch("/api/admin/ratings/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectType: subject.type,
          subjectId: subject.id,
          badgeType: subject.type === "seller" ? "seller_highly_rated" : "project_trending",
          enabled,
          reason: overrideReason.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحديث الشارة");
      setOverrideReason("");
      setFeedback("تم تسجيل قرار الشارة الاستثنائية في سجل التدقيق.");
      await load(page);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "تعذر تحديث الشارة");
    } finally {
      setActionId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-bold text-slate-500" dir="rtl">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        جاري تحميل أدوات إدارة التقييمات...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <Star className="h-6 w-6 fill-amber-300 text-amber-500" />
            التقييمات والمنافسة
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            تحكم بالقواعد والشارات، راجع المحتوى والبلاغات، وتابع كل قرار في سجل التدقيق.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          تحديث البيانات
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {feedback && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {feedback}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-black text-slate-900">قواعد الاحتساب والظهور</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            لا تعدّل هذه الإعدادات عدد النجوم أو المفضلات المسجل؛ بل تغيّر شروط استحقاق الشارات والترتيب فقط.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            الحد الأدنى لمتوسط تقييم البائع (من 5)
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={config.sellerMinRating}
              onChange={(event) => setConfig({ ...config, sellerMinRating: Number(event.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            أقل عدد للتقييمات المؤهلة
            <input
              type="number"
              min={1}
              max={1000}
              step={1}
              value={config.sellerMinReviews}
              onChange={(event) => setConfig({ ...config, sellerMinReviews: Number(event.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            حد المستخدمين الفريدين لشارة المشروع الرائج
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              value={config.projectMinFavorites}
              onChange={(event) => setConfig({ ...config, projectMinFavorites: Number(event.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            نافذة احتساب المفضلات (بالأيام)
            <input
              type="number"
              min={1}
              max={365}
              step={1}
              value={config.projectWindowDays}
              onChange={(event) => setConfig({ ...config, projectWindowDays: Number(event.target.value) })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-slate-700">
            نطاق المنافسة
            <select
              value={config.rankingScope}
              onChange={(event) =>
                setConfig({ ...config, rankingScope: event.target.value as RatingsConfig["rankingScope"] })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4">
          {[
            ["sellerRatingsEnabled", "السماح بتقييم البائعين"],
            ["sellerBadgeEnabled", "إظهار شارة البائع عالي التقييم"],
            ["projectBadgeEnabled", "إظهار شارة المشروع الرائج"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={config[key as keyof RatingsConfig] as boolean}
                onChange={(event) => setConfig({ ...config, [key]: event.target.checked })}
                className="h-4 w-4 accent-emerald-700"
              />
              {label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void saveConfig()}
          disabled={saving}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ القواعد
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-black text-slate-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          اعتماد أو إزالة شارة يدويًا
        </h2>
        <p className="mb-4 text-xs leading-6 text-slate-500">
          الاستثناء لا يغيّر التقييم أو المفضلات. اختر العنصر وسجّل مبرر القرار؛ سيظهر الإجراء في سجل التدقيق.
        </p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            value={overrideSubject}
            onChange={(event) => setOverrideSubject(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
          >
            <option value="">اختر بائعًا أو مشروعًا</option>
            {(data?.subjects ?? []).map((subject) => (
              <option key={`${subject.type}:${subject.id}`} value={`${subject.type}:${subject.id}`}>
                {subject.type === "seller" ? "بائع" : "مشروع"} — {subject.label}
              </option>
            ))}
          </select>
          <input
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            maxLength={500}
            placeholder="سبب القرار (5 أحرف على الأقل)"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveOverride(true)}
              disabled={actionId === "override"}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              اعتماد
            </button>
            <button
              type="button"
              onClick={() => void saveOverride(false)}
              disabled={actionId === "override"}
              className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              إزالة
            </button>
          </div>
        </div>
        {!!data?.overrides.length && (
          <div className="mt-4 space-y-2">
            {data.overrides.map((override) => (
              <div key={`${override.subject_type}:${override.subject_id}:${override.badge_type}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="font-bold text-slate-700">
                  {override.subject_type === "seller" ? "بائع" : "مشروع"} · {override.subject_id}
                </span>
                <span className={override.enabled ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>
                  {override.enabled ? "شارة معتمدة يدويًا" : "تمت إزالة الشارة"}
                </span>
                <span className="text-slate-500">{override.reason}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-black text-slate-900">
          <Star className="h-5 w-5 text-amber-500" />
          مراجعة تقييمات البائعين
        </h2>
        {!data?.reviews.length ? (
          <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-500">لا توجد تقييمات حتى الآن.</p>
        ) : (
          <div className="space-y-3">
            {data.reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900">{review.seller_name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {review.reviewer_name} · {getPropertyTitle(review)} · تواصل موثق · {new Date(review.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                    {review.rating} <Star className="h-3 w-3 fill-amber-400" />
                  </span>
                </div>
                <p className="my-3 whitespace-pre-wrap text-xs leading-6 text-slate-700">{review.comment}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={reviewReasons[review.id] || ""}
                    onChange={(event) => setReviewReasons({ ...reviewReasons, [review.id]: event.target.value })}
                    maxLength={500}
                    placeholder="سبب إظهار/إخفاء التقييم"
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void moderateReview(review)}
                    disabled={actionId === review.id}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-60 ${
                      review.status === "published" ? "bg-rose-700" : "bg-emerald-700"
                    }`}
                  >
                    {actionId === review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : review.status === "published" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {review.status === "published" ? "إخفاء" : "إعادة النشر"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">
        <span>
          التقييمات: {data?.reviewCount ?? 0} · البلاغات: {data?.reportCount ?? 0}
          {" · "}الصفحة {page + 1}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0 || loading}
            className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            الأحدث
          </button>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={loading || (!data?.hasMoreReviews && !data?.hasMoreReports)}
            className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"
          >
            الأقدم
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-black text-slate-900">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          بلاغات التقييمات
        </h2>
        {!data?.reports.length ? (
          <p className="rounded-xl bg-slate-50 p-4 text-xs font-bold text-slate-500">لا توجد بلاغات.</p>
        ) : (
          <div className="space-y-3">
            {data.reports.map((report) => (
              <article key={report.id} className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs font-black text-slate-800">
                  بلاغ على تقييم {report.seller_reviews?.seller_name || report.review_id}
                  {report.seller_reviews?.rating ? ` · ${report.seller_reviews.rating}/5` : ""}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-600">{report.reason}</p>
                {report.seller_reviews?.comment && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">
                    {report.seller_reviews.comment}
                  </p>
                )}
                <p className="mt-1 text-[10px] font-bold text-slate-400">الحالة: {report.status}</p>
                {report.status === "open" && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={reportNotes[report.id] || ""}
                      onChange={(event) => setReportNotes({ ...reportNotes, [report.id]: event.target.value })}
                      maxLength={500}
                      placeholder="ملاحظة القرار"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void resolveReport(report, "resolved")}
                      disabled={actionId === report.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      {actionId === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      تم اتخاذ إجراء
                    </button>
                    <button
                      type="button"
                      onClick={() => void resolveReport(report, "dismissed")}
                      disabled={actionId === report.id}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      رفض البلاغ
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 text-base font-black text-slate-900">سجل تدقيق التغييرات</h2>
        {!data?.auditEvents.length ? (
          <p className="text-xs text-slate-500">ستظهر هنا تغييرات القواعد وإجراءات المراجعة والاعتمادات اليدوية.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-auto">
            {data.auditEvents.map((event) => (
              <div key={event.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-black text-slate-800">{event.action}</span>
                  <time className="text-slate-400">{new Date(event.created_at).toLocaleString("ar-EG")}</time>
                </div>
                <p className="mt-1 text-slate-500">
                  المنفذ: {event.user_id || "غير متاح"} · العنصر: {event.entity_id}
                </p>
                {!!(event.details.reason || event.details.note) && (
                  <p className="mt-1 text-slate-600">
                    السبب: {String(event.details.reason || event.details.note)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
