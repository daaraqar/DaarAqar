"use client";

import React, { useState, useEffect } from "react";
import { User, Property, Inquiry } from "@/lib/db/types";
import Link from "next/link";
import {
  Building2,
  Users,
  Eye,
  MessageCircle,
  PlusCircle,
  CheckCircle2,
  Clock,
  Phone,
  Calendar,
  AlertCircle,
  Shield,
  Loader2,
  Heart,
  Compass,
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  XCircle,
  PauseCircle,
  FileText,
  Briefcase,
  AlertTriangle,
  Home,
  Sparkles,
  RotateCcw,
  Edit3,
  Send,
  Play,
} from "lucide-react";
import InquiryChatModal from "@/components/chat/InquiryChatModal";
import EditPropertyModal from "@/components/properties/EditPropertyModal";
import RequestDeletionModal from "@/components/properties/RequestDeletionModal";
import OfficialNoticesList from "@/components/dashboard/OfficialNoticesList";
import ListingQualityScore from "@/components/property/ListingQualityScore";
import { APPROXIMATE_LOCATION_RADIUS_METERS } from "@/lib/db/types";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [sentInquiries, setSentInquiries] = useState<Inquiry[]>([]);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"listings" | "inquiries" | "sent_inquiries">("listings");
  const [propertyStatusTab, setPropertyStatusTab] = useState<"all" | "published" | "pending_review" | "draft" | "rejected">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeChatInquiryId, setActiveChatInquiryId] = useState<string | null>(null);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletionRequestProperty, setDeletionRequestProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const statusParam = new URLSearchParams(window.location.search).get("status");
      if (statusParam && ["all", "published", "pending_review", "draft", "rejected"].includes(statusParam)) {
        setPropertyStatusTab(statusParam as any);
        setActiveTab("listings");
      }
    }
    loadDashboardData();

    const handleAuthChange = () => {
      loadDashboardData();
    };
    window.addEventListener("auth-state-changed", handleAuthChange);
    return () => window.removeEventListener("auth-state-changed", handleAuthChange);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      const meData = await meRes.json();
      setUser(meData.user);

      if (meData.user) {
        const [propRes, inqAdvRes, inqSeekRes, favRes] = await Promise.all([
          fetch("/api/dashboard/properties?status=all", { credentials: "include" }),
          fetch("/api/inquiries?mode=advertiser", { credentials: "include" }),
          fetch("/api/inquiries?mode=seeker", { credentials: "include" }),
          fetch("/api/favorites", { credentials: "include" }),
        ]);

        const [propData, inqAdvData, inqSeekData, favData] = await Promise.all([
          propRes.json().catch(() => ({ properties: [] })),
          inqAdvRes.json().catch(() => ({ inquiries: [] })),
          inqSeekRes.json().catch(() => ({ inquiries: [] })),
          favRes.json().catch(() => ({ favorites: [] })),
        ]);

        if (propData.properties) setProperties(propData.properties);
        if (inqAdvData.inquiries) setInquiries(inqAdvData.inquiries);
        if (inqSeekData.inquiries) setSentInquiries(inqSeekData.inquiries);
        if (favData.favorites) setFavoritesCount(favData.favorites.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInquiryStatus = async (inqId: string, status: Inquiry["status"]) => {
    setActionLoading(inqId);
    try {
      const res = await fetch(`/api/inquiries/${inqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setInquiries((prev) =>
          prev.map((i) => (i.id === inqId ? { ...i, status } : i))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetractToDraft = async (propertyId: string) => {
    if (!confirm("هل تريد سحب هذا العقار من المراجعة وإعادته كمسودة خاصة لتعديل بياناته؟")) {
      return;
    }
    setActionLoading(propertyId);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (res.ok) {
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, status: "draft" } : p))
        );
      } else {
        const data = await res.json();
        alert(data.error || "فشل التراجع عن الإرسال");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResubmitForReview = async (propertyId: string) => {
    setActionLoading(propertyId);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_review" }),
      });
      if (res.ok) {
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, status: "pending_review" } : p))
        );
      } else {
        const data = await res.json();
        alert(data.error || "فشل إرسال العقار للمراجعة");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePauseStatus = async (propertyId: string, currentStatus: string) => {
    const isPaused = currentStatus === "paused";
    const newStatus = isPaused ? "published" : "paused";
    const confirmMsg = isPaused
      ? "هل تريد إعادة تفعيل العقار واستئناف نشره للعامة على الخريطة التفاعلية وقوائم البحث؟"
      : "هل تريد إيقاف عرض العقار مؤقتاً (مثلاً: تم البيع أو التفاوض) وحجبه عن الخريطة العامة مع حفظه في أرشيفك؟";

    if (!confirm(confirmMsg)) return;

    setActionLoading(propertyId);
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setProperties((prev) =>
          prev.map((p) => (p.id === propertyId ? { ...p, status: newStatus as any } : p))
        );
      } else {
        const data = await res.json();
        alert(data.error || "فشل تغيير حالة العرض");
      }
    } catch {
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <span className="text-xs font-bold">جاري تحميل لوحة التحكم...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900">يجب تسجيل الدخول أولاً</h2>
        <p className="text-xs text-slate-500">
          سجل دخولك أو أنشئ حساباً لمتابعة إعلاناتك واستفساراتك العقارية.
        </p>
        <Link
          href="/login?redirect=/dashboard"
          className="inline-flex px-6 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20"
        >
          تسجيل الدخول الآن
        </Link>
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const publishedCount = properties.filter((p) => p.status === "published").length;
  const pendingCount = properties.filter((p) => p.status === "pending_review").length;
  const draftsCount = properties.filter((p) => p.status === "draft").length;
  const rejectedCount = properties.filter((p) => p.status === "rejected").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Welcome & Role Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white font-extrabold flex items-center justify-center text-xl shadow-md ring-4 ring-emerald-500/20 shrink-0">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              user.name.charAt(0)
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-900">أهلاً بك، {user.name}</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {isAdmin ? "مدير النظام" : "حساب شخصي"}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              بوابة إدارة الإعلانات العقارية ومتابعة الطلبات والمحادثات المباشرة
            </p>
          </div>
        </div>

        {/* Quick Actions Header */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>لوحة الرقابة المركزية (Admin)</span>
            </Link>
          )}

          <Link
            href="/dashboard/properties/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#00875a] hover:bg-[#00734c] text-white font-extrabold text-xs shadow-md transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ إضافة إعلان</span>
          </Link>

          <Link
            href="/explore"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            <Compass className="w-4 h-4 text-emerald-600" />
            <span>الخريطة الحية</span>
          </Link>

          <Link
            href="/account/favorites"
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
          >
            <Heart className="w-4 h-4 text-rose-500" />
            <span>المفضلة ({favoritesCount})</span>
          </Link>
        </div>
      </div>

      {/* 2. Unified Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab("listings");
            setPropertyStatusTab("all");
          }}
          className={`p-5 rounded-2xl border text-right transition-all cursor-pointer ${
            activeTab === "listings" && propertyStatusTab === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs"
          }`}
        >
          <span className={`text-xs font-bold block mb-1 ${activeTab === "listings" && propertyStatusTab === "all" ? "text-slate-300" : "text-slate-400"}`}>
            كافة العقارات
          </span>
          <span className="text-2xl font-black block">{properties.length}</span>
          <span className={`text-[10px] block mt-1 ${activeTab === "listings" && propertyStatusTab === "all" ? "text-slate-300" : "text-slate-400"}`}>
            بمحفظتك العقارية
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("listings");
            setPropertyStatusTab("published");
          }}
          className={`p-5 rounded-2xl border text-right transition-all cursor-pointer ${
            activeTab === "listings" && propertyStatusTab === "published"
              ? "bg-[#00875a] text-white border-[#00875a] shadow-md ring-2 ring-[#00875a]/30"
              : "bg-white hover:bg-emerald-50/50 border-slate-200 text-slate-900 shadow-xs"
          }`}
        >
          <span className={`text-xs font-bold block mb-1 ${activeTab === "listings" && propertyStatusTab === "published" ? "text-emerald-100" : "text-slate-400"}`}>
            عقارات منشورة
          </span>
          <span className={`text-2xl font-black block ${activeTab === "listings" && propertyStatusTab === "published" ? "text-white" : "text-emerald-700"}`}>
            {publishedCount}
          </span>
          <span className={`text-[10px] font-bold block mt-1 ${activeTab === "listings" && propertyStatusTab === "published" ? "text-emerald-100" : "text-emerald-700"}`}>
            نشطة على الخريطة
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inquiries")}
          className={`p-5 rounded-2xl border text-right transition-all cursor-pointer ${
            activeTab === "inquiries"
              ? "bg-brand-700 text-white border-brand-700 shadow-md ring-2 ring-brand-700/20"
              : "bg-white hover:bg-brand-50/50 border-slate-200 text-slate-900 shadow-xs"
          }`}
        >
          <span className={`text-xs font-bold block mb-1 ${activeTab === "inquiries" ? "text-brand-100" : "text-slate-400"}`}>
            طلبات العملاء الواردة
          </span>
          <span className={`text-2xl font-black block ${activeTab === "inquiries" ? "text-white" : "text-brand-700"}`}>
            {inquiries.length}
          </span>
          <span className={`text-[10px] font-bold block mt-1 ${activeTab === "inquiries" ? "text-brand-100" : "text-brand-600"}`}>
            مهتمون بإعلاناتك
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sent_inquiries")}
          className={`p-5 rounded-2xl border text-right transition-all cursor-pointer ${
            activeTab === "sent_inquiries"
              ? "bg-indigo-700 text-white border-indigo-700 shadow-md ring-2 ring-indigo-700/20"
              : "bg-white hover:bg-indigo-50/50 border-slate-200 text-slate-900 shadow-xs"
          }`}
        >
          <span className={`text-xs font-bold block mb-1 ${activeTab === "sent_inquiries" ? "text-indigo-100" : "text-slate-400"}`}>
            طلباتي المرسلة
          </span>
          <span className={`text-2xl font-black block ${activeTab === "sent_inquiries" ? "text-white" : "text-indigo-700"}`}>
            {sentInquiries.length}
          </span>
          <span className={`text-[10px] font-bold block mt-1 ${activeTab === "sent_inquiries" ? "text-indigo-100" : "text-indigo-600"}`}>
            استفسارات أرسلتها
          </span>
        </button>
      </div>

      {/* 3. Main Dashboard Workspace */}
      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-black text-slate-900">
            {activeTab === "listings"
              ? "إعلاناتي العقارية"
              : activeTab === "inquiries"
              ? "طلبات العملاء الواردة"
              : "الاستفسارات التي أرسلتها"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {activeTab === "listings"
              ? "تابع حالة إعلاناتك وأدر تفاصيلها من مكان واحد."
              : activeTab === "inquiries"
              ? "تابع تواصل المهتمين بعقاراتك."
              : "تابع استفساراتك على العقارات التي تهتم بها."}
          </p>
        </div>

        {activeTab === "listings" ? (
          <div className="space-y-4">
            <OfficialNoticesList
              onOpenEditProperty={(propId) => {
                const target = properties.find((p) => p.id === propId);
                if (target) setEditingProperty(target);
              }}
            />

            <div className="grid grid-cols-1 gap-2 pb-3 border-b border-slate-100 text-xs font-bold">
              {[
                { key: "all", label: "كافة المنشورات", count: properties.length },
                { key: "pending_review", label: "قيد المراجعة", count: pendingCount, color: "amber" },
                { key: "published", label: "عقارات معتمدة", count: publishedCount, color: "emerald" },
                { key: "draft", label: "المسودات", count: draftsCount, color: "slate" },
                { key: "rejected", label: "المرفوضة", count: rejectedCount, color: "rose" },
              ].map((tab) => {
                const isActive = propertyStatusTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setPropertyStatusTab(tab.key as any)}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-between gap-1.5 ${
                      isActive
                        ? tab.color === "emerald"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : tab.color === "amber"
                          ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                          : tab.color === "rose"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${isActive ? "bg-black/15 text-inherit" : "bg-slate-200 text-slate-700"}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {properties.filter((p) => propertyStatusTab === "all" || p.status === propertyStatusTab).length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-sm">لا توجد عقارات في هذا البند</h3>
                <Link
                  href="/dashboard/properties/new"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>إضافة عقار جديد الآن</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {properties
                  .filter((p) => propertyStatusTab === "all" || p.status === propertyStatusTab)
                  .map((property) => (
                    <div key={property.id} className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col gap-4 text-xs hover:border-slate-300 transition">
                      <div className="flex flex-col items-stretch gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-base">{property.title}</span>
                            {property.status === "published" && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 font-black text-xs shadow-xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>عقارات منشورة</span>
                              </span>
                            )}
                          </div>
                          <ListingQualityScore property={property} />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProperty(property)}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                            <span>تعديل ومراجعة</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : activeTab === "inquiries" ? (
          <div className="space-y-3">
            {inquiries.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <MessageCircle className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-sm">لا توجد طلبات تواصل واردة حتى الآن</h3>
              </div>
            ) : (
              inquiries.map((inq) => (
                <div key={inq.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <span className="font-black text-slate-900 text-sm block">{inq.seekerName}</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900">طلبات المعاينة والاستفسارات التي أرسلتها</h3>
          </div>
        )}
      </div>

      {activeChatInquiryId && (
        <InquiryChatModal
          inquiryId={activeChatInquiryId}
          isOpen={Boolean(activeChatInquiryId)}
          onClose={() => setActiveChatInquiryId(null)}
          currentUserRole={user?.role}
          currentUserId={user?.id}
        />
      )}

      <EditPropertyModal
        property={editingProperty}
        isOpen={editingProperty !== null}
        onClose={() => setEditingProperty(null)}
        onSaved={(updated) => {
          setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
      />

      <RequestDeletionModal
        property={deletionRequestProperty}
        isOpen={deletionRequestProperty !== null}
        onClose={() => setDeletionRequestProperty(null)}
        onRequested={loadDashboardData}
      />
    </div>
  );
}
