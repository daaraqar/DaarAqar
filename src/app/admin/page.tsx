"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";

type AdminTab = AdminSection;

const TAB_ITEMS: Array<{
  id: AdminTab;
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

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<AdminTab>("projects");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const visibleTabItems = useMemo(
    () => TAB_ITEMS.filter((item) => canAccessAdminSection(currentUser, item.id)),
    [currentUser]
  );

  // Sync tab with URL query
  useEffect(() => {
    const resolvedTab = rawTab === "identity" || rawTab === "branding" ? "cms" : rawTab;
    if (resolvedTab && ["projects", "messages", "cms", "support", "staff", "ratings", "crm"].includes(resolvedTab)) {
      setActiveTab(resolvedTab as AdminTab);
    } else {
      setActiveTab("projects");
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
    if (!canAccessAdminSection(currentUser, tab)) return;
    setActiveTab(tab);
    router.push(`/admin?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    if (!currentUser || visibleTabItems.length === 0) return;
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

  const activeTabItem = visibleTabItems.find((item) => item.id === activeTab);

  return (
    <div className="admin-dashboard-shell min-h-screen bg-slate-50 text-slate-900 font-sans" dir="rtl">
      <AdminNav />
      <main className="mx-auto max-w-[1600px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 xl:px-10">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              {activeTabItem ? React.createElement(activeTabItem.icon, { className: "h-5 w-5" }) : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500">لوحة الإدارة <span className="mx-1 text-slate-300">/</span>{activeTabItem?.label || "الأقسام المتاحة"}</p>
              <h1 className="mt-0.5 truncate text-lg font-black text-slate-900 sm:text-xl">{activeTabItem?.label || "إدارة المنصة"}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{currentUser.name || currentUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/architecture"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Workflow className="h-3.5 w-3.5" />
              <span>بنية المنصة</span>
            </Link>
            {canAccessAdminSection(currentUser, "staff") && (
              <Link
                href="/admin/analytics"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700"
              >
                <span>التحليلات</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </header>
        <nav
          aria-label="أقسام لوحة الإدارة"
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden"
        >
          {visibleTabItems.map((item) => {
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
                    ? `${item.activeBg} ${item.activeText} ${item.borderColor}`
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <IconComponent className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-7">
          <aside className="sticky top-24 hidden space-y-3 lg:block">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className="text-[10px] font-black uppercase text-slate-400 px-3 pt-2 block tracking-wider">
                أقسام الإدارة
              </span>

              {visibleTabItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full text-right p-3 rounded-xl transition-colors flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? `${item.activeBg} border-r-4 ${item.borderColor}`
                        : "hover:bg-slate-50 border-r-4 border-transparent"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive
                          ? "bg-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <IconComponent
                        className={`w-5 h-5 ${isActive ? item.activeText : "text-slate-500"}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black block ${
                            isActive ? item.activeText : "text-slate-900"
                          }`}
                        >
                          {item.label}
                        </span>
                        {isActive && (
                          <ChevronLeft className={`w-3.5 h-3.5 ${item.activeText}`} />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                        {item.sublabel}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

          </aside>

          <section className="min-w-0">
            {visibleTabItems.length === 0 ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold leading-relaxed text-amber-900">
                لا توجد صلاحيات إدارية مخصصة لهذا الحساب حالياً. يُرجى التواصل مع مدير النظام لتحديد الأقسام المطلوبة.
              </div>
            ) : (
              <>
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
              </>
            )}
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
