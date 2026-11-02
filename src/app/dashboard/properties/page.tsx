"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Eye,
  Trash2,
  ArrowUpRight,
  Loader2,
  Send,
  Sparkles,
  MapPin,
  RotateCcw,
  Edit3,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Play,
  Tag,
} from "lucide-react";
import { Property } from "@/lib/db/types";
import { apiFetch } from "@/lib/apiClient";
import EditPropertyModal from "@/components/properties/EditPropertyModal";
import RequestDeletionModal from "@/components/properties/RequestDeletionModal";
import OfficialNoticesList from "@/components/dashboard/OfficialNoticesList";
import ListingQualityScore from "@/components/property/ListingQualityScore";

interface OwnerProperty {
  id: string;
  slug: string;
  title: string;
  price: number;
  transactionType: "sale" | "rent";
  category: string;
  areaSqM: number;
  status: "draft" | "pending_review" | "pending" | "under_review" | "published" | "active" | "rejected" | "paused" | "sold" | "archived";
  createdAt: string;
  images: string[];
  viewsCount?: number;
  inquiriesCount?: number;
  addressDetails?: string;
  description?: string;
  moderationNotes?: string;
  isProject?: boolean;
}

export default function OwnerPropertiesPage() {
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    published: 0,
    sold: 0,
    pending: 0,
    drafts: 0,
    rejected: 0,
  });
  const [currentTab, setCurrentTab] = useState<"all" | "published" | "pending_review" | "draft" | "rejected" | "sold">(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search).get("status");
      if (sp === "active") return "published";
      if (sp && ["all", "published", "pending_review", "draft", "rejected", "sold"].includes(sp)) {
        return sp as any;
      }
    }
    return "all";
  });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletionRequestProperty, setDeletionRequestProperty] = useState<Property | null>(null);
  const fetchRequestIdRef = React.useRef(0);

  useEffect(() => {
    fetchOwnerListings(currentTab);
  }, [currentTab]);

  const fetchOwnerListings = async (tab: string) => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/dashboard/properties?status=${tab}`);
      if (requestId !== fetchRequestIdRef.current) return;

      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.properties)) {
        setProperties(data.properties);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error("[Dashboard] Error fetching owner listings:", err);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  // Submit draft/rejected listing for review
  const handleSubmitForReview = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await apiFetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_review" }),
      });
      if (res.ok) {
        await fetchOwnerListings(currentTab);
      } else {
        const err = await res.json();
        alert(err.error || "فشل إرسال العقار للمراجعة");
      }
    } catch (e) {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Retract listing back to draft
  const handleRetractToDraft = async (id: string) => {
    if (
      !confirm(
        "هل تريد سحب هذا العقار من المراجعة وإعادته كمسودة خاصة لتعديل بياناته؟"
      )
    ) {
      return;
    }
    setActionLoadingId(id);
    try {
      const res = await apiFetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) {
        await fetchOwnerListings(currentTab);
      } else {
        const err = await res.json();
        alert(err.error || "فشل التراجع عن الإرسال");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Pause (Sold / Temporarily Paused) status
  const handleTogglePauseStatus = async (id: string, currentStatus: string) => {
    const isPaused = currentStatus === "paused";
    const newStatus = isPaused ? "published" : "paused";
    const confirmMsg = isPaused
      ? "هل تريد إعادة تفعيل العقار واستئناف نشره للعامة على الخريطة التفاعلية وقوائم البحث؟"
      : "هل تريد إيقاف عرض العقار مؤقتاً وحجبه عن الخريطة العامة مع حفظه في أرشيفك؟";

    if (!confirm(confirmMsg)) return;

    setActionLoadingId(id);
    try {
      const res = await apiFetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchOwnerListings(currentTab);
      } else {
        const err = await res.json();
        alert(err.error || "فشل تغيير حالة العرض");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkSold = async (id: string, title: string) => {
    if (!confirm(`هل تؤكد إتمام بيع «${title}»؟ سيختفي المشروع من العرض العام وينتقل إلى المشاريع المباعة.`)) return;

    setActionLoadingId(id);
    try {
      const res = await apiFetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sold" }),
      });
      if (res.ok) {
        await fetchOwnerListings(currentTab);
      } else {
        const err = await res.json();
        alert(err.error || "فشل تسجيل المشروع كمباع");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete listing (strictly for drafts, pending review, or rejected)
  const handleDeleteListing = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف العقار: "${title}"؟`)) return;

    setActionLoadingId(id);
    try {
      const res = await apiFetch(`/api/properties/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProperties((prev) => prev.filter((p) => p.id !== id));
      } else {
        const err = await res.json();
        alert(err.error || "فشل حذف العقار");
      }
    } catch (e) {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: OwnerProperty["status"]) => {
    switch (status) {
      case "published":
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>بند عقارات منشورة ونشطة (معتمد)</span>
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-800 text-white shadow-xs">
            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>متوقف مؤقتاً</span>
          </span>
        );
      case "sold":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-950 border border-purple-300 shadow-xs">
            <Tag className="w-3.5 h-3.5 text-purple-600" />
            <span>تم البيع</span>
          </span>
        );
      case "pending_review":
      case "pending":
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <span>قيد المراجعة</span>
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-950 border border-rose-300 shadow-xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>لم توافق الإدارة على المشروع (مرفوض)</span>
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>مسودة خاصة</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-700 mb-1">
            <Building2 className="w-4 h-4" />
            <span>لوحة تحكم المالك والوسيط</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">إدارة عقاراتي ومشاريعي</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            متابعة حالة العقارات قيد المراجعة، الوحدات المعتمدة، والطلبات المقدمة للاعتماد
          </p>
        </div>
      </div>

      {/* Official Admin Communication Channel Notices */}
      <OfficialNoticesList
        onOpenEditProperty={(propId) => {
          const target = properties.find((p) => p.id === propId);
          if (target) setEditingProperty(target as any);
        }}
      />

      <div className="grid grid-cols-1 gap-2 pb-3 border-b border-slate-200 text-xs font-bold">
        {[
          { key: "all", label: "كافة المنشورات", count: metrics.total },
          { key: "pending_review", label: "قيد المراجعة", count: metrics.pending, color: "amber" },
          { key: "published", label: "عقارات معتمدة ونشطة", count: metrics.published, color: "emerald" },
          { key: "sold", label: "المباعة", count: metrics.sold, color: "purple" },
          { key: "draft", label: "المسودات", count: metrics.drafts, color: "slate" },
          { key: "rejected", label: "المرفوضة", count: metrics.rejected, color: "rose" },
        ].map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setCurrentTab(tab.key as any)}
              className={`p-2.5 rounded-xl transition flex items-center justify-between gap-1.5 ${
                isActive
                  ? tab.color === "emerald"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : tab.color === "amber"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : tab.color === "rose"
                    ? "bg-rose-600 text-white shadow-sm"
                      : tab.color === "purple"
                      ? "bg-purple-700 text-white shadow-sm"
                      : "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? "bg-black/15 text-inherit" : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Listings Table / Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-xs font-bold text-slate-500">جاري تحميل قائمة العقارات الخاصة بك...</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">لا توجد عقارات في هذا التصنيف</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            لم تقم بإضافة أي عقارات ضمن هذا القسم بعد. يمكنك إضافة عقار جديد أو مراجعة المسودات المحفوظة.
          </p>
          <Link
            href="/dashboard/properties/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة عقار جديد الآن</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {properties.map((prop) => (
            <div
              key={prop.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col"
            >
              {/* Image Preview & Badges */}
              <div className="relative h-44 bg-slate-100 overflow-hidden">
                <img
                  src={prop.images[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=80"}
                  alt={prop.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2">{getStatusBadge(prop.status)}</div>
                <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px] font-bold">
                  {prop.transactionType === "sale" ? "للبيع" : "للإيجار"} • {prop.category}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="text-lg font-black text-brand-800">
                    {prop.price?.toLocaleString("ar-EG")} <span className="text-xs">ج.م</span>
                  </div>
                  <h3 className="font-black text-sm text-slate-900 line-clamp-1" title={prop.title}>
                    {prop.title}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{prop.addressDetails || "موقع متميز، مصر"}</span>
                  </div>

                  {/* مؤشر جاهزية الإعلان للمالك (Listing Quality Score) */}
                  <ListingQualityScore property={prop} />

                  {/* Pending review actions */}
                  {(prop.status === "pending_review" || prop.status === "pending" || prop.status === "under_review") && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                        {prop.isProject ? (
                          <Link
                            href={`/projects/${prop.id}`}
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة المشروع</span>
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRetractToDraft(prop.id)}
                          disabled={actionLoadingId === prop.id}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>تراجع وسحب كمسودة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProperty(prop as any)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل ✏️</span>
                        </button>
                    </div>
                  )}

                  {/* Rejected Rejection Banner & Quick Retract/Resubmit */}
                  {prop.status === "rejected" && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-2">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                          <span className="font-black text-rose-900">سبب عدم موافقة الإدارة: </span>
                          <span className="font-medium text-rose-800">
                            {prop.moderationNotes || "يرجى مراجعة تفاصيل وسعر ومواصفات العقار وتصحيحها لإعادة النشر."}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-rose-200">
                        <button
                          type="button"
                          onClick={() => setEditingProperty(prop as any)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل وإعادة التقديم ✏️</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRetractToDraft(prop.id)}
                          disabled={actionLoadingId === prop.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold text-[11px] transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>تراجع كمسودة 💾</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview(prop.id)}
                          disabled={actionLoadingId === prop.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] shadow-xs transition cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>إرسال للإدارة 🚀</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Draft Notice */}
                  {prop.status === "draft" && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-center justify-between gap-2">
                      <span className="font-medium">مسودة غير مرسلة</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingProperty(prop as any)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-[11px] transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitForReview(prop.id)}
                          disabled={actionLoadingId === prop.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>إرسال 🚀</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* General In-place Edit Button */}
                    <button
                      type="button"
                      onClick={() => setEditingProperty(prop as any)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                      title="تعديل بيانات الإعلان"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>تعديل ومراجعة</span>
                    </button>

                    {/* View full page if published or active */}
                    {(prop.status === "published" || prop.status === "active") && (
                      <Link
                        href={`/properties/${prop.slug}`}
                        target="_blank"
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        title="عرض العقار المنشور"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Link>
                    )}

                    {/* Pause toggle for published, active, or paused listings */}
                    {(prop.status === "published" || prop.status === "active" || prop.status === "paused") && (
                      <>
                        <button
                          type="button"
                          disabled={actionLoadingId === prop.id}
                          onClick={() => handleTogglePauseStatus(prop.id, prop.status)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                            prop.status === "paused"
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                          }`}
                          title={prop.status === "paused" ? "استئناف العرض على الخريطة" : "إيقاف العرض مؤقتاً"}
                        >
                          {prop.status === "paused" ? (
                            <>
                              <Play className="w-3.5 h-3.5 text-emerald-600" />
                              <span>استئناف العرض ▶️</span>
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span>إيقاف مؤقت ⏸️</span>
                            </>
                          )}
                        </button>
                        {prop.transactionType === "sale" && (
                          <button
                            type="button"
                            disabled={actionLoadingId === prop.id}
                            onClick={() => handleMarkSold(prop.id, prop.title)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs transition cursor-pointer"
                            title="تسجيل العقار كمباع"
                          >
                            <Tag className="w-3.5 h-3.5 text-purple-600" />
                            <span>تم البيع</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Official Deletion Request from Admin for published, active, or paused listings */}
                    {(prop.status === "published" || prop.status === "active" || prop.status === "paused" || prop.status === "sold") && (
                      <button
                        type="button"
                        onClick={() => setDeletionRequestProperty(prop as any)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs transition cursor-pointer"
                        title="إرسال طلب حذف رسمي لإدارة المنصة"
                      >
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        <span>طلب حذف للإدارة 📨</span>
                      </button>
                    )}
                  </div>

                  {/* Direct Delete Button: STRICTLY for drafts, pending review, or rejected */}
                  {prop.status !== "published" &&
                    prop.status !== "active" &&
                    prop.status !== "paused" &&
                    prop.status !== "sold" && (
                    <button
                      onClick={() => handleDeleteListing(prop.id, prop.title)}
                      disabled={actionLoadingId === prop.id}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="حذف المشروع مباشرة (مسموح وهو قيد المراجعة)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reusable In-place Property Edit and Retraction Modal */}
      <EditPropertyModal
        property={editingProperty}
        isOpen={editingProperty !== null}
        onClose={() => setEditingProperty(null)}
        onSaved={async () => {
          await fetchOwnerListings(currentTab);
        }}
      />

      {/* Official Deletion Request Modal */}
      <RequestDeletionModal
        property={deletionRequestProperty}
        isOpen={deletionRequestProperty !== null}
        onClose={() => setDeletionRequestProperty(null)}
        onRequested={async () => {
          await fetchOwnerListings(currentTab);
        }}
      />
    </div>
  );
}
