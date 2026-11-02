"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Flame,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Send,
  Star,
  Trophy,
} from "lucide-react";
import {
  CATEGORY_LABELS_AR,
  OFFICIAL_PROPERTY_CATEGORIES,
} from "@/lib/db/types";
import type { RatingsConfig } from "@/lib/ratings/reputation";

interface SellerRanking {
  id: string;
  name: string;
  ratingAverage: number;
  reviewCount: number;
}

interface TrendingProject {
  id: string;
  title: string;
  slug: string;
  favoritesCount: number;
}

interface PublishedReview {
  id: string;
  sellerName: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  propertyTitle: string;
  propertySlug: string;
}

interface EligibleReview {
  inquiryId: string;
  sellerId: string;
  sellerName: string;
  propertyTitle: string;
  propertySlug: string;
}

interface CityOption {
  id: string;
  nameAr: string;
}

interface DistrictOption {
  id: string;
  cityId: string;
  nameAr: string;
}

interface RatingsResponse {
  success: boolean;
  error?: string;
  config: RatingsConfig;
  requiresFilters: boolean;
  sellers: SellerRanking[];
  projects: TrendingProject[];
  reviews: PublishedReview[];
  eligibleReviews: EligibleReview[];
}

export default function RatingsPage() {
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [category, setCategory] = useState("apartment");
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sellers" | "projects">("sellers");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);
  const ratingsRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ratings/filters", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل المناطق");
        if (!cancelled) {
          const availableDistricts: DistrictOption[] = result.districts || [];
          setCities(result.cities || []);
          setDistricts(availableDistricts);
          setCityId(result.cities?.[0]?.id || availableDistricts[0]?.cityId || "");
          setDistrictId(availableDistricts[0]?.id || "");
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المناطق");
      })
      .finally(() => {
        if (!cancelled) setTaxonomyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRatings = useCallback(async () => {
    ratingsRequestRef.current?.abort();
    const controller = new AbortController();
    ratingsRequestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (districtId) params.set("districtId", districtId);
      if (cityId) params.set("cityId", cityId);
      if (category) params.set("category", category);
      const response = await fetch(`/api/ratings?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحميل التقييمات");
      if (!controller.signal.aborted) setData(result);
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setError(loadError instanceof Error ? loadError.message : "تعذر تحميل التقييمات");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [category, cityId, districtId]);

  useEffect(() => {
    if (!taxonomyLoading) void loadRatings();
  }, [loadRatings, taxonomyLoading]);

  useEffect(
    () => () => {
      ratingsRequestRef.current?.abort();
    },
    []
  );

  const visibleDistricts = useMemo(
    () => districts.filter((district) => !cityId || district.cityId === cityId),
    [cityId, districts]
  );

  const submitReview = async (eligible: EligibleReview) => {
    const rating = ratings[eligible.inquiryId] || 0;
    const comment = (comments[eligible.inquiryId] || "").trim();
    if (rating < 1 || comment.length < 3) {
      setError("اختر تقييمًا من نجمة إلى خمس واكتب تعليقًا لا يقل عن 3 أحرف.");
      return;
    }
    setActionId(eligible.inquiryId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId: eligible.inquiryId, rating, comment }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر إرسال التقييم");
      setNotice("شكرًا لك، تم تسجيل تقييمك بعد التحقق من المحادثة.");
      setRatings((current) => ({ ...current, [eligible.inquiryId]: 0 }));
      setComments((current) => ({ ...current, [eligible.inquiryId]: "" }));
      await loadRatings();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر إرسال التقييم");
    } finally {
      setActionId(null);
    }
  };

  const reportReview = async (review: PublishedReview) => {
    const reason = (reportDrafts[review.id] || "").trim();
    if (reason.length < 5) {
      setError("اكتب سبب البلاغ بوضوح (5 أحرف على الأقل).");
      return;
    }
    setActionId(review.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/ratings/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر إرسال البلاغ");
      setNotice("تم إرسال البلاغ إلى فريق المراجعة.");
      setReportDrafts((current) => ({ ...current, [review.id]: "" }));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "تعذر إرسال البلاغ");
    } finally {
      setActionId(null);
    }
  };

  const activeDistrict = districts.find((district) => district.id === districtId);
  const selectedCategoryLabel = CATEGORY_LABELS_AR[category] || category;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-36" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-200">
                <Trophy className="h-4 w-4" />
                منافسة عادلة بتقييمات موثوقة
              </div>
              <h1 className="text-2xl font-black sm:text-3xl">التقييمات والمشاريع الرائجة</h1>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-300 sm:text-sm">
                نعرض تقييم البائع من تواصل موثق داخل المنصة، وشعبية المشروع من إضافاته الفعلية للمفضلة.
                لا نحتسب نقرات الخريطة أو التقييمات غير المرتبطة بمحادثة.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20"
            >
              <MapPin className="h-4 w-4" />
              استكشف الخريطة
            </Link>
          </div>
        </header>

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
          {data?.config.rankingScope === "district_category" && (
            <label className="space-y-1 text-xs font-bold text-slate-600">
              المنطقة
              <select
                value={districtId}
                onChange={(event) => {
                  setDistrictId(event.target.value);
                  const district = districts.find((item) => item.id === event.target.value);
                  if (district) setCityId(district.cityId);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {visibleDistricts.map((district) => (
                  <option key={district.id} value={district.id}>{district.nameAr}</option>
                ))}
              </select>
            </label>
          )}
          {data?.config.rankingScope === "city_category" && (
            <label className="space-y-1 text-xs font-bold text-slate-600">
              المدينة
              <select
                value={cityId}
                onChange={(event) => setCityId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.nameAr}</option>
                ))}
              </select>
            </label>
          )}
          {data?.config.rankingScope !== "platform_wide" && (
            <label className="space-y-1 text-xs font-bold text-slate-600">
              نوع العقار
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {OFFICIAL_PROPERTY_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadRatings()}
              disabled={loading || taxonomyLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              تحديث الترتيب
            </button>
          </div>
        </section>

        {data && !data.requiresFilters && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
              <MapPin className="ml-1 inline h-3.5 w-3.5 text-emerald-700" />
              {data.config.rankingScope === "district_category"
                ? activeDistrict?.nameAr || "المنطقة المختارة"
                : data.config.rankingScope === "city_category"
                ? "المدينة المختارة"
                : "كل المنصة"}
            </span>
            {data.config.rankingScope !== "platform_wide" && (
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{selectedCategoryLabel}</span>
            )}
            <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
              شارة الرواج: {data.config.projectMinFavorites} إضافات للمفضلة خلال {data.config.projectWindowDays} يومًا
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("sellers")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black ${
              activeTab === "sellers" ? "bg-amber-100 text-amber-900" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Star className="h-4 w-4" />
            البائعون الأعلى تقييمًا
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-black ${
              activeTab === "projects" ? "bg-orange-100 text-orange-900" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Flame className="h-4 w-4" />
            المشاريع الرائجة
          </button>
        </div>

        {loading && !data ? (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            جاري احتساب النتائج...
          </div>
        ) : data?.requiresFilters ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
            اختر المنطقة ونوع العقار لعرض منافسة عادلة داخل النطاق المحدد.
          </div>
        ) : activeTab === "sellers" ? (
          <section className="space-y-3">
            {!data?.config.sellerRatingsEnabled ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                أوقفت الإدارة تقييمات البائعين مؤقتًا.
              </div>
            ) : data?.sellers.length ? data.sellers.map((seller, index) => (
              <article key={`${seller.id}:${index}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black ${index < 3 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-black text-slate-900">{seller.name}</h2>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {seller.reviewCount} تقييمًا موثقًا
                  </p>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 text-lg font-black text-amber-700">
                    {seller.ratingAverage.toFixed(1)}
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">من 5</span>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Star className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-black text-slate-600">لا يوجد بائعون استوفوا شروط الترتيب بعد</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  لا يظهر الترتيب إلا بعد بلوغ حد التقييمات والعدد الأدنى الذي تحدده الإدارة.
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            {data?.projects.length ? data.projects.map((project, index) => (
              <Link
                key={project.id}
                href={`/properties/${encodeURIComponent(project.slug)}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${index < 3 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                  <Flame className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-black text-slate-900">{project.title}</h2>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">مشروع أضيف للمفضلة من أشخاص أكثر مؤخرًا</p>
                </div>
                <div className="text-left">
                  <div className="text-lg font-black text-orange-700">{project.favoritesCount}</div>
                  <span className="text-[10px] font-bold text-slate-400">مهتمًا</span>
                </div>
              </Link>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <Flame className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-black text-slate-600">لا توجد مشاريع رائجة في هذا النطاق حاليًا</p>
                <p className="mt-1 text-xs text-slate-400">ستظهر المشاريع عند بلوغ حد الإضافات للمفضلة خلال الفترة المحددة.</p>
              </div>
            )}
          </section>
        )}

        {data?.config.sellerRatingsEnabled && data.eligibleReviews.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-6">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-emerald-950">
                <MessageSquare className="h-5 w-5" />
                قيّم بائعًا تواصلت معه
              </h2>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                تظهر هنا المحادثات التي رد فيها البائع. تقييم واحد لكل بائع من العميل، ولا يُقبل التقييم الذاتي.
              </p>
            </div>
            {data.eligibleReviews.map((eligible) => (
              <article key={eligible.inquiryId} className="rounded-xl border border-emerald-100 bg-white p-4">
                <p className="text-sm font-black text-slate-900">{eligible.sellerName}</p>
                <Link href={`/properties/${encodeURIComponent(eligible.propertySlug)}`} className="mt-1 block text-xs text-slate-500 hover:text-emerald-700">
                  {eligible.propertyTitle}
                </Link>
                <div className="my-3 flex items-center gap-1" role="radiogroup" aria-label={`تقييم ${eligible.sellerName}`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={ratings[eligible.inquiryId] === value}
                      aria-label={`${value} من 5`}
                      onClick={() => setRatings({ ...ratings, [eligible.inquiryId]: value })}
                      className="rounded-md p-1"
                    >
                      <Star className={`h-6 w-6 ${value <= (ratings[eligible.inquiryId] || 0) ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={comments[eligible.inquiryId] || ""}
                  onChange={(event) => setComments({ ...comments, [eligible.inquiryId]: event.target.value })}
                  minLength={3}
                  maxLength={1200}
                  rows={3}
                  placeholder="اكتب تجربتك باحترام وموضوعية..."
                  className="w-full resize-y rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-emerald-500"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-400">{(comments[eligible.inquiryId] || "").length}/1200</span>
                  <button
                    type="button"
                    onClick={() => void submitReview(eligible)}
                    disabled={actionId === eligible.inquiryId}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {actionId === eligible.inquiryId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    إرسال التقييم
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === "sellers" && !!data?.reviews.length && (
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-black text-slate-900">آخر التقييمات المنشورة</h2>
              <p className="mt-1 text-xs text-slate-500">يمكن الإبلاغ عن تقييم لمراجعته من فريق الإدارة.</p>
            </div>
            {data.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{review.sellerName}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {review.reviewerName} · {review.propertyTitle} · {new Date(review.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
                    {review.rating} <Star className="h-3 w-3 fill-amber-400" />
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-700">{review.comment}</p>
                <details className="mt-3 border-t border-slate-100 pt-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-500">الإبلاغ عن هذا التقييم</summary>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={reportDrafts[review.id] || ""}
                      onChange={(event) => setReportDrafts({ ...reportDrafts, [review.id]: event.target.value })}
                      maxLength={500}
                      placeholder="سبب البلاغ"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void reportReview(review)}
                      disabled={actionId === review.id}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      إرسال البلاغ
                    </button>
                  </div>
                </details>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
