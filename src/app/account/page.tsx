"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Building2,
  Heart,
  Bell,
  Crown,
  Flag,
  BarChart2,
  Phone,
  Shield,
  LogOut,
  ChevronLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { User } from "@/lib/db/types";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store", credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        else setUser(null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth-state-changed"));
      }
      router.push("/");
      router.refresh();
    } catch {
      // Ignore
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="text-xs font-bold text-slate-500">جاري تحميل بيانات الحساب...</span>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-36 text-right" dir="rtl">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
        <h1 className="text-xl font-black text-slate-900">حسابي</h1>
      </div>

      {user ? (
        <div className="space-y-4">
          {/* 1. Profile Summary Card */}
          <Link
            href="/account/profile"
            className="block bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-emerald-500/40 transition-all group"
          >
            <div className="flex items-center justify-between text-right w-full">
              {/* Right side: Avatar on far right, Email/Name next to it */}
              <div className="flex items-center gap-3.5 text-right">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-2xs">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div className="text-right">
                  <span className="font-black text-sm sm:text-base text-slate-900 block" dir="ltr">
                    {user.email || user.phone || user.name}
                  </span>
                  {user.name && user.email && (
                    <span className="text-xs text-slate-500 font-medium block mt-0.5">
                      {user.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Left side: Navigation chevron */}
              <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            </div>
          </Link>

          {/* 2. Quick Action Row: المفضلة والتنبيهات */}
          <div className="grid grid-cols-2 gap-3 text-right">
            <Link
              href="/account/favorites"
              className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 font-bold text-xs shadow-2xs transition-all active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 shrink-0" />
                <span>المفضلة</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </Link>

            <Link
              href="/dashboard/inquiries"
              className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 font-bold text-xs shadow-2xs transition-all active:scale-98"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                <span>التنبيهات والمحادثات</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </Link>
          </div>

          {/* 3. Promotional Value-Add Cards */}
          <div className="space-y-2.5">
            {/* عقار+ Card (مغلق مؤقتاً) */}
            <div className="w-full flex items-center justify-between p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs text-right opacity-80 cursor-not-allowed">
              <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-slate-700 block">+عقار</span>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    استكشف مزايا عقار+
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                  مغلق مؤقتاً
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </div>
            </div>

            {/* خدمات الترويج Card (مغلق مؤقتاً) */}
            <div className="w-full flex items-center justify-between p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs text-right opacity-80 cursor-not-allowed">
              <div className="flex items-center gap-3 text-right">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                  <Flag className="w-5 h-5 text-slate-500" />
                </div>
                <div className="text-right">
                  <span className="font-black text-xs text-slate-700 block">
                    خدمات الترويج
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium block">
                    خدمات تساعدك على تسريع بيع وتأجير العقار
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  مغلق مؤقتاً
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          </div>

          {/* 4. Section: النشاط */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-1.5 px-1 text-right">
              <BarChart2 className="w-4 h-4 text-slate-600" />
              <span className="font-black text-xs text-slate-800">النشاط</span>
            </div>

            {/* Big Green Add Button */}
            <Link
              href="/dashboard/properties/new"
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-black text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>إضافة +</span>
            </Link>

            {/* كارت مشاريعي */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <Link
                href="/dashboard/properties"
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group text-right w-full"
              >
                {/* Right side: Icon, title "مشاريعي" and subtitle starting from far right */}
                <div className="flex items-center gap-3 text-right">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xs sm:text-sm text-slate-900 block">مشاريعي</span>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      إدارة ومتابعة المشاريع والعقارات المضافة
                    </span>
                  </div>
                </div>

                {/* Left side: Navigation chevron */}
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              </Link>
            </div>
          </div>

          {/* 5. Section: إدارة الحساب */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center gap-1.5 px-1 text-right">
              <UserIcon className="w-4 h-4 text-slate-600" />
              <span className="font-black text-xs text-slate-800">إدارة الحساب</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {/* الملف الشخصي */}
              <Link
                href="/account/profile"
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors group text-right w-full"
              >
                <div className="flex items-center gap-3 text-right">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-slate-500" />
                  </div>
                  <span className="font-black text-xs text-slate-900 block">الملف الشخصي</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              </Link>

              {/* تغيير رقم الجوال (مغلق مؤقتاً) */}
              <div className="w-full flex items-center justify-between p-3.5 text-right opacity-70 cursor-not-allowed">
                <div className="flex items-center gap-3 text-right">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="font-black text-xs text-slate-600 block">تغيير رقم الجوال</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                    مغلق مؤقتاً
                  </span>
                  <ChevronLeft className="w-4 h-4 text-slate-300" />
                </div>
              </div>

              {/* لوحة الإدارة للمدير */}
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="flex items-center justify-between p-3.5 hover:bg-amber-50 text-amber-900 transition-colors group text-right w-full"
                >
                  <div className="flex items-center gap-3 text-right">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-black text-xs block">لوحة الإدارة المركزية (Admin)</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-amber-600 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                </Link>
              )}

              {/* تسجيل الخروج */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-between p-3.5 hover:bg-rose-50 text-rose-600 font-black text-xs transition-colors group text-right disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-3 text-right">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4 text-rose-600" />
                  </div>
                  <span>{loggingOut ? "جاري تسجيل الخروج..." : "تسجيل الخروج"}</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-rose-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Guest View */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center mx-auto text-brand-700">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="font-black text-base text-slate-900">أهلاً بك في منصة عقار</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              سجل دخولك برقم جوالك أو بريدك الإلكتروني للوصول إلى لوحة التحكم، وإضافة العقارات، ومتابعة المشاريع.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            <span>تسجيل الدخول</span>
          </Link>
        </div>
      )}
    </div>
  );
}
