"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

type AdminMetrics = {
  totalUsers?: number;
  ownersCount?: number;
  brokersCount?: number;
  verifiedUsersCount?: number;
  responseRatePercent?: number;
  totalInquiries?: number;
  totalMessagesCount?: number;
  newInquiriesCount?: number;
  viewingConversionPercent?: number;
  dealClosedCount?: number;
  viewingScheduledCount?: number;
  negotiatingCount?: number;
  totalPropertyViews?: number;
  reportResolutionRatePercent?: number;
  publishedCount?: number;
  soldCount?: number;
  pendingReportsCount?: number;
};

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
      if (authResponse.status === 401) {
        router.replace("/login?redirect=%2Fadmin%2Fanalytics");
        return;
      }
      if (!authResponse.ok) {
        throw new Error("تعذر التحقق من صلاحيات الحساب.");
      }
      const authData = await authResponse.json();
      if (authData.user?.role !== "admin") {
        router.replace("/login?redirect=%2Fadmin%2Fanalytics");
        return;
      }

      const response = await fetch("/api/admin/metrics", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("تعذر تحميل المؤشرات التشغيلية. حاول التحديث مرة أخرى.");
      }
      const data = await response.json();
      if (!data.stats || typeof data.stats !== "object") {
        throw new Error("لم تصل بيانات المؤشرات بالشكل المتوقع.");
      }
      setStats(data.stats as AdminMetrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "حدث خطأ أثناء تحميل المؤشرات.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-4 py-6 pb-32 sm:px-6" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-700">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">مركز التحليلات والمؤشرات</h1>
              <p className="text-xs text-slate-500">مؤشرات المنصة التشغيلية المباشرة</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadMetrics()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              تحديث المؤشرات
            </button>
            <Link
              href="/admin?tab=staff"
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              العودة للوحة التحكم
            </Link>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex min-h-52 items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-700" />
            جاري تحميل المؤشرات...
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-700">
                <h2 className="text-sm font-black">المستخدمون والتوثيق</h2>
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-3xl font-black text-slate-900">{stats.totalUsers ?? 0}</p>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-lg bg-slate-50 px-2 py-1">ملاك: {stats.ownersCount ?? 0}</span>
                <span className="rounded-lg bg-slate-50 px-2 py-1">وسطاء: {stats.brokersCount ?? 0}</span>
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">موثّق: {stats.verifiedUsersCount ?? 0}</span>
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5">
              <div className="flex items-center justify-between text-emerald-900">
                <h2 className="text-sm font-black">المحادثات ومعدل الاستجابة</h2>
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-3xl font-black text-emerald-950">{stats.responseRatePercent ?? 0}%</p>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-emerald-900">
                <span className="rounded-lg bg-white px-2 py-1">المحادثات: {stats.totalInquiries ?? 0}</span>
                <span className="rounded-lg bg-white px-2 py-1">الرسائل: {stats.totalMessagesCount ?? 0}</span>
                <span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-900">بانتظار الرد: {stats.newInquiriesCount ?? 0}</span>
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
              <div className="flex items-center justify-between text-sky-900">
                <h2 className="text-sm font-black">المعاينات والصفقات</h2>
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <p className="text-3xl font-black text-sky-950">{stats.viewingConversionPercent ?? 0}%</p>
                  <span className="text-[11px] font-bold text-sky-700">تحويل لمعاينة/تفاوض</span>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-800">{stats.dealClosedCount ?? 0}</p>
                  <span className="text-[11px] font-bold text-emerald-700">صفقات مكتملة</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-sky-900">
                <span className="rounded-lg bg-white px-2 py-1">معاينات مجدولة: {stats.viewingScheduledCount ?? 0}</span>
                <span className="rounded-lg bg-white px-2 py-1">تفاوض: {stats.negotiatingCount ?? 0}</span>
              </div>
            </section>

            <section className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50/50 p-5">
              <div className="flex items-center justify-between text-amber-900">
                <h2 className="text-sm font-black">تفاعل العقارات والبلاغات</h2>
                <Eye className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-4">
                <div>
                  <p className="text-3xl font-black text-amber-950">{Number(stats.totalPropertyViews ?? 0).toLocaleString()}</p>
                  <span className="text-[11px] font-bold text-amber-700">مشاهدة للعقارات</span>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900">{stats.reportResolutionRatePercent ?? 0}%</p>
                  <span className="text-[11px] font-bold text-slate-600">معالجة البلاغات</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold text-amber-900">
                <span className="rounded-lg bg-white px-2 py-1">منشور: {stats.publishedCount ?? 0}</span>
                <span className="rounded-lg bg-white px-2 py-1">مباع/مؤجر: {stats.soldCount ?? 0}</span>
                <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-900">بلاغات معلقة: {stats.pendingReportsCount ?? 0}</span>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
