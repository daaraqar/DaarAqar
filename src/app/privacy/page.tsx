"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, MapPin, EyeOff, ArrowLeft } from "lucide-react";
import type { CmsStaticPage } from "@/lib/db/types";

export default function PrivacyPage() {
  const [cmsPage, setCmsPage] = useState<CmsStaticPage | null>(null);
  const [pageUnavailable, setPageUnavailable] = useState(false);
  useEffect(() => {
    fetch("/api/cms/pages/privacy", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          setPageUnavailable(true);
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        setCmsPage(data.page || null);
      })
      .catch((error: unknown) => console.error("[PrivacyPage] CMS content load failed:", error));
  }, []);

  if (pageUnavailable) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center font-bold text-slate-600">هذه الصفحة غير منشورة حالياً.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Integration Banner */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-between gap-4 text-xs font-bold text-blue-900">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>يمكن تعديل المحتوى العام لهذه الصفحة من لوحة إدارة الهوية والمحتوى.</span>
        </div>
        <Link
          href="/about#privacy"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shrink-0 transition-all shadow-xs"
        >
          <span>عرض في صفحة عن المنصة</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2 border-b border-slate-200 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>حماية البيانات والخصوصية الجغرافية</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">{cmsPage?.titleAr || "سياسة الخصوصية وأمن البيانات"}</h1>
        <p className="text-xs text-slate-500">آخر تحديث: 2026 | امتثال قانون حماية البيانات الشخصية رقم 151 لسنة 2020</p>
      </div>

      {cmsPage?.contentAr && (
        <section className="whitespace-pre-wrap p-5 bg-white rounded-2xl border border-brand-100 text-xs text-slate-700 leading-7">
          {cmsPage.contentAr}
        </section>
      )}

      <div className="space-y-6 text-xs text-slate-700 leading-relaxed font-medium">
        <section className="space-y-2 p-5 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-brand-600" />
            <span>1. خصوصية الموقع الجغرافي للعقارات (Geospatial Privacy)</span>
          </h2>
          <p>
            تطبق منصة دار العقار معياراً صارماً لحماية خصوصية عناوين الملاك. عند تفعيل خيار "الموقع التقريبي":
          </p>
          <ul className="list-disc list-inside space-y-1 pr-4 text-slate-600">
            <li>يتم تشويش الإحداثيات الفعلية وحجبها تماماً من أي استجابة برمجية عامة (Public API Response).</li>
            <li>يتم رسم دائرة تقريبية بنطاق 50 مترًا على الخريطة لحماية خصوصية العقار.</li>
            <li>لا يتم الإفصاح عن العنوان التفصيلي الدقيق إلا بعد تواصل جاد وتنسيق موعد معاينة مؤكد.</li>
          </ul>
        </section>

        <section className="space-y-2 p-5 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-600" />
            <span>2. جمع ومعالجة البيانات الشخصية</span>
          </h2>
          <p>
            نجمع فقط البيانات الضرورية لتسهيل التواصل العقاري الآمن (الاسم، رقم الهاتف، والبريد الإلكتروني). لا نقوم ببيع بيانات المستخدمين أو مشاركتها مع أطراف ثالثة غير مصرح بها.
          </p>
        </section>

        <section className="space-y-2 p-5 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-600" />
            <span>3. الامتثال لقوانين جمهورية مصر العربية</span>
          </h2>
          <p>
            تلتزم المنصة بأحكام قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020، وكافة القواعد المنظمة لنشاط التسويق والوساطة العقارية الإلكترونية.
          </p>
        </section>
      </div>
    </div>
  );
}
