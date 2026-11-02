"use client";

import React, { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import AdminProjectsTab from "@/components/admin/AdminProjectsTab";
import AdminMessagesTab from "@/components/admin/AdminMessagesTab";
import AdminCmsTab from "@/components/admin/AdminCmsTab";
import AdminSupportTab from "@/components/admin/AdminSupportTab";
import AdminStaffTab from "@/components/admin/AdminStaffTab";
import AdminRatingsTab from "@/components/admin/AdminRatingsTab";
import AdminCrmTab from "@/components/admin/AdminCrmTab";
import AdminNav from "@/components/admin/AdminNav";
import ProjectSupervisorPanel from "@/components/admin/ProjectSupervisorPanel";
import {
  canAccessAdminSection,
  hasAdminPermission,
  type AdminSection,
} from "@/lib/auth/admin-permissions";
import type { User } from "@/lib/db/types";
import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  MessageSquare,
  Palette,
  HelpCircle,
  Users,
  Star,
  Loader2,
  ExternalLink,
  ChevronLeft,
  Workflow,
  ArrowUpLeft,
  Clock3,
  RefreshCw,
  ClipboardCheck,
  CheckCircle2,
  Layers3,
  AlertCircle,
} from "lucide-react";

type AdminTab = AdminSection | "overview";

const OVERVIEW_ITEM = {
  id: "overview" as const,
  label: "نظرة عامة",
  sublabel: "ملخص العمل والوصول السريع",
  icon: LayoutDashboard,
  activeBg: "bg-emerald-50",
  activeText: "text-emerald-800",
  borderColor: "border-emerald-600",
};

const TAB_ITEMS: Array<{
  id: AdminSection;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  activeBg: string;
  activeText: string;
  borderColor: string;
}> = [
  {
    id: "projects",
    label: "المشاريع والعقارات",
    sublabel: "مراجعة الإعلانات واتخاذ إجراءات الإشراف",
    icon: Building2,
    activeBg: "bg-amber-500/10",
    activeText: "text-amber-600",
    borderColor: "border-amber-500",
  },
  {
    id: "messages",
    label: "الرسائل والمحادثات",
    sublabel: "متابعة المحادثات بين العملاء والمعلنين",
    icon: MessageSquare,
    activeBg: "bg-emerald-500/10",
    activeText: "text-emerald-600",
    borderColor: "border-emerald-500",
  },
  {
    id: "support",
    label: "الدعم والطلبات",
    sublabel: "البلاغات وطلبات الخدمات وسجل المتابعة",
    icon: HelpCircle,
    activeBg: "bg-sky-500/10",
    activeText: "text-sky-600",
    borderColor: "border-sky-500",
  },
  {
    id: "cms",
    label: "المحتوى والهوية",
    sublabel: "إدارة محتوى المنصة وهويتها البصرية",
    icon: Palette,
    activeBg: "bg-purple-500/10",
    activeText: "text-purple-600",
    borderColor: "border-purple-500",
  },
  {
    id: "ratings",
    label: "التقييمات",
    sublabel: "إدارة التقييمات والبلاغات والشارات",
    icon: Star,
    activeBg: "bg-yellow-500/10",
    activeText: "text-yellow-700",
    borderColor: "border-yellow-500",
  },
  {
    id: "crm",
    label: "سجلات العملاء والسماسرة",
    sublabel: "قاعدة بيانات داخلية للعملاء وعروض السماسرة",
    icon: Users,
    activeBg: "bg-teal-500/10",
    activeText: "text-teal-600",
    borderColor: "border-teal-500",
  },
  {
    id: "staff",
    label: "المستخدمون والموظفون",
    sublabel: "مراجعة الحسابات وإدارة فريق العمل",
    icon: Users,
    activeBg: "bg-indigo-500/10",
    activeText: "text-indigo-600",
    borderColor: "border-indigo-500",
  },
];

type DashboardProperty = {
  id: string;
  title: string;
  status: string;
  price?: number;
  cityName?: string;
  districtName?: string;
  createdAt?: string;
};

type DashboardPropertyMetrics = {
  pendingCount: number;
  publishedCount: number;
  allCount: number;
  deletionRequestsCount: number;
};

function AdminOverview({
  user,
  canReviewProjects,
  visibleItems,
  onNavigate,
}: {
  user: User;
  canReviewProjects: boolean;
  visibleItems: typeof TAB_ITEMS;
  onNavigate: (tab: AdminTab) => void;
}) {
  const [metrics, setMetrics] = useState<DashboardPropertyMetrics | null>(null);
  const [pendingProperties, setPendingProperties] = useState<DashboardProperty[]>([]);
  const [loading, setLoading] = useState(canReviewProjects);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadOverview = useCallback(async () => {
    if (!canReviewProjects) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/admin/properties?status=pending&limit=5", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`تعذر تحميل ملخص الإعلانات (${response.status}). حاول التحديث مرة أخرى.`);
      }
      const data = await response.json();
      if (!data.metrics || !Array.isArray(data.properties)) {
        throw new Error("وصلت بيانات لوحة الإدارة بتنسيق غير متوقع.");
      }
      setMetrics(data.metrics as DashboardPropertyMetrics);
      setPendingProperties(data.properties as DashboardProperty[]);
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل ملخص لوحة الإدارة.");
    } finally {
      setLoading(false);
    }
  }, [canReviewProjects]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const metricCards = [
    {
      label: "بانتظار المراجعة",
      value: metrics?.pendingCount,
      icon: ClipboardCheck,
      color: "text-amber-700",
      surface: "bg-amber-50",
    },
    {
      label: "إعلانات منشورة",
      value: metrics?.publishedCount,
      icon: CheckCircle2,
      color: "text-emerald-700",
      surface: "bg-emerald-50",
    },
    {
      label: "إجمالي الإعلانات",
      value: metrics?.allCount,
      icon: Layers3,
      color: "text-sky-700",
      surface: "bg-sky-50",
    },
    {
      label: "طلبات حذف معلّقة",
      value: metrics?.deletionRequestsCount,
      icon: AlertCircle,
      color: "text-rose-700",
      surface: "bg-rose-50",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[11px] font-bold text-slate-500">مساحة العمل الخاصة بك</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">أهلاً {user.name || user.email}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            اختر القسم المناسب لمتابعة عملك. الأقسام المعروضة مرتبطة بصلاحيات حسابك.
          </p>
        </div>
        {canReviewProjects && (
          <div className="flex items-center gap-3">
            {updatedAt && (
              <span className="hidden items-center gap-1.5 text-[10px] font-semibold text-slate-400 sm:inline-flex">
                <Clock3 className="h-3.5 w-3.5" />
                آخر تحديث {updatedAt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadOverview()}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث البيانات
            </button>
          </div>
        )}
      </section>

      {visibleItems.length === 0 && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-6 text-amber-900">
          لا توجد صلاحيات إدارية مخصصة لهذا الحساب حالياً. يُرجى التواصل مع مدير النظام لتحديد الأقسام المطلوبة.
        </div>
      )}

      {canReviewProjects && (
        <>
          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-5 text-rose-800">
              {error}
            </div>
          )}
          <section aria-label="ملخص الإعلانات" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metricCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03] sm:p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 sm:text-xs">{card.label}</span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.surface} ${card.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-black tabular-nums text-slate-950">
                    {loading && card.value === undefined ? <span className="inline-block h-7 w-12 animate-pulse rounded-lg bg-slate-100" /> : card.value ?? "—"}
                  </p>
                </div>
              );
            })}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-black text-slate-900">قائمة المراجعة</h2>
                <p className="mt-1 text-[11px] text-slate-500">أحدث الإعلانات التي تنتظر قرار الإدارة</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("projects")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-[11px] font-bold text-white transition-colors hover:bg-emerald-800"
              >
                فتح إدارة الإعلانات
                <ArrowUpLeft className="h-3.5 w-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-50" />)}
              </div>
            ) : pendingProperties.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {pendingProperties.map((property) => (
                  <div key={property.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800">{property.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {[property.districtName, property.cityName].filter(Boolean).join("، ") || "موقع غير محدد"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">جديد للمراجعة</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-3 text-sm font-black text-slate-800">لا توجد إعلانات بانتظار المراجعة</p>
                <p className="mt-1 text-xs text-slate-500">ستظهر الإعلانات الجديدة هنا عند إرسالها.</p>
              </div>
            )}
          </section>
        </>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900">الوصول السريع</h2>
            <p className="mt-1 text-[11px] text-slate-500">انتقل مباشرة إلى مساحة العمل المخصصة لك</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-right shadow-sm shadow-slate-900/[0.02] transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-800">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black text-slate-900">{item.label}</span>
                  <span className="mt-1 block truncate text-[10px] text-slate-500">{item.sublabel}</span>
                </span>
                <ArrowUpLeft className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-emerald-700" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const visibleTabItems = useMemo(
    () => TAB_ITEMS.filter((item) => canAccessAdminSection(currentUser, item.id)),
    [currentUser]
  );
  const navigationItems = useMemo(
    () => [OVERVIEW_ITEM, ...visibleTabItems],
    [visibleTabItems]
  );

  // Sync tab with URL query
  useEffect(() => {
    const resolvedTab = rawTab === "identity" || rawTab === "branding" ? "cms" : rawTab;
    if (resolvedTab && ["overview", "projects", "messages", "cms", "support", "staff", "ratings", "crm"].includes(resolvedTab)) {
      setActiveTab(resolvedTab as AdminTab);
    } else {
      setActiveTab("overview");
    }
  }, [rawTab]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: User }) => {
        if (!data.user || data.user.role !== "admin") {
          router.push("/login?redirect=/admin");
        } else {
          setCurrentUser(data.user);
        }
      })
      .catch(() => router.push("/login?redirect=/admin"))
      .finally(() => setLoading(false));
  }, [router]);

  const switchTab = (tab: AdminTab) => {
    if (tab !== "overview" && !canAccessAdminSection(currentUser, tab)) return;
    setActiveTab(tab);
    router.push(`/admin?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    if (!currentUser || visibleTabItems.length === 0) return;
    if (activeTab === "overview") return;
    if (visibleTabItems.some((item) => item.id === activeTab)) return;
    const firstAllowedTab = visibleTabItems[0].id;
    setActiveTab(firstAllowedTab);
    router.replace(`/admin?tab=${firstAllowedTab}`, { scroll: false });
  }, [activeTab, currentUser, router, visibleTabItems]);

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-xs font-bold text-slate-400">جاري التحقق من صلاحيات إدارة المنصة...</p>
      </div>
    );
  }

  const activeTabItem = navigationItems.find((item) => item.id === activeTab);
  const localHour = new Date().getHours();
  const greeting = localHour < 12 ? "صباح الخير" : localHour < 17 ? "مساء الخير" : "أهلاً بك";

  return (
    <div className="admin-dashboard-shell min-h-screen bg-[#f4f7f6] font-sans text-slate-900" dir="rtl">
      <AdminNav />
      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 xl:px-10">
        <header className="relative isolate overflow-hidden rounded-[28px] bg-slate-950 px-5 py-6 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -left-20 -top-32 -z-10 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 right-1/3 -z-10 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                مساحة العمل الإدارية
              </div>
              <p className="text-sm font-semibold text-slate-300">{greeting}، {currentUser.name || "فريق دار العقار"}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {activeTabItem?.label || "إدارة المنصة"}
              </h1>
              <p className="mt-2 max-w-xl text-xs leading-6 text-slate-400 sm:text-sm">
                {activeTab === "overview"
                  ? "كل ما تحتاجه لمتابعة أعمال المنصة والوصول إلى مهام فريقك من مكان واحد."
                  : activeTabItem?.sublabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/architecture"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10"
              >
                <Workflow className="h-4 w-4" />
                بنية المنصة
              </Link>
              {canAccessAdminSection(currentUser, "staff") && (
                <Link
                  href="/admin/analytics"
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-xs font-black text-slate-950 transition-colors hover:bg-emerald-400"
                >
                  التحليلات
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </header>
        <nav
          aria-label="أقسام لوحة الإدارة"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden"
        >
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => switchTab(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors ${
                  isActive
                    ? `${item.activeBg} ${item.activeText} border-current`
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <IconComponent className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-7">
          <aside className="sticky top-24 hidden space-y-4 lg:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm shadow-slate-900/[0.03]">
              <div className="flex items-center justify-between px-3 pb-3 pt-2">
                <span className="text-[10px] font-black tracking-wide text-slate-400">مساحة العمل</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{navigationItems.length} أقسام</span>
              </div>

              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border-r-[3px] p-3 text-right transition-all ${
                      isActive
                        ? `${item.activeBg} ${item.activeText} ${item.borderColor}`
                        : "border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        isActive
                          ? "bg-white shadow-sm"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white"
                      }`}
                    >
                      <IconComponent
                        className={`h-4 w-4 ${isActive ? item.activeText : "text-slate-500"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`block text-xs font-black ${
                            isActive ? item.activeText : "text-slate-800"
                          }`}
                        >
                          {item.label}
                        </span>
                        {isActive && (
                          <ChevronLeft className={`w-3.5 h-3.5 ${item.activeText}`} />
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-400">
                        {item.sublabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-black">صلاحيات مخصصة</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-emerald-800/80">
                تظهر لك الأقسام والإجراءات المصرح بها لحسابك فقط.
              </p>
            </div>
          </aside>

          <section className="min-w-0">
            {activeTab === "overview" && (
              <AdminOverview
                user={currentUser}
                canReviewProjects={canAccessAdminSection(currentUser, "projects")}
                visibleItems={visibleTabItems}
                onNavigate={switchTab}
              />
            )}
            {activeTab === "projects" && canAccessAdminSection(currentUser, "projects") && (
              <AdminProjectsTab
                canReview={hasAdminPermission(currentUser, "projects.review")}
                canDelete={hasAdminPermission(currentUser, "projects.delete")}
              />
            )}
            {activeTab === "messages" && canAccessAdminSection(currentUser, "messages") && (
              <AdminMessagesTab canViewUserProfiles={hasAdminPermission(currentUser, "staff.manage")} />
            )}
            {activeTab === "cms" && canAccessAdminSection(currentUser, "cms") && <AdminCmsTab />}
            {activeTab === "support" && canAccessAdminSection(currentUser, "support") && <AdminSupportTab />}
            {activeTab === "ratings" && canAccessAdminSection(currentUser, "ratings") && <AdminRatingsTab />}
            {activeTab === "staff" && canAccessAdminSection(currentUser, "staff") && <AdminStaffTab />}
            {activeTab === "crm" && canAccessAdminSection(currentUser, "crm") && <AdminCrmTab />}
          </section>
        </div>
      </main>
      <ProjectSupervisorPanel />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white" dir="rtl">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
          <p className="text-xs font-bold text-slate-400">جاري تشغيل لوحة تحكم شركة الإدارة...</p>
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
