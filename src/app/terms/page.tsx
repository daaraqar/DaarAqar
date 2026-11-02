"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ArrowLeft, ShieldCheck, Scale, AlertTriangle } from "lucide-react";
import type { CmsStaticPage } from "@/lib/db/types";

export default function TermsPage() {
  const [cmsPage, setCmsPage] = useState<CmsStaticPage | null>(null);
  const [pageUnavailable, setPageUnavailable] = useState(false);
  useEffect(() => {
    fetch("/api/cms/pages/terms", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) {
          setPageUnavailable(true);
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        setCmsPage(data.page || null);
      })
      .catch((error: unknown) => console.error("[TermsPage] CMS content load failed:", error));
  }, []);

  if (pageUnavailable) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center font-bold text-slate-600">هذه الصفحة غير منشورة حالياً.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Integration Banner */}
      <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-between gap-4 text-xs font-bold text-purple-900">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-purple-600 shrink-0" />
          <span>يمكن تعديل المحتوى العام لهذه الصفحة من لوحة إدارة الهوية والمحتوى.</span>
        </div>
        <Link
          href="/about#terms"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shrink-0 transition-all shadow-xs"
        >
          <span>عرض في صفحة عن المنصة</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2 border-b border-slate-200 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
          <FileText className="w-4 h-4 text-slate-600" />
          <span>الشروط والأحكام التنظيمية</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">{cmsPage?.titleAr || "شروط الاستخدام والإعلان"}</h1>
        <p className="text-xs text-slate-500">سارية لجميع مستخدمي المنصة داخل جمهورية مصر العربية</p>
      </div>

      {cmsPage?.contentAr && (
        <section className="whitespace-pre-wrap p-5 bg-white rounded-2xl border border-purple-100 text-xs text-slate-700 leading-7">
          {cmsPage.contentAr}
        </section>
      )}

      <div className="space-y-6 text-xs text-slate-700 leading-relaxed font-medium">
        <section className="space-y-2 p-5 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-600" />
            <span>1. معايير نشر الإعلانات العقارية ومكافحة التضليل</span>
          </h2>
          <p>
            يلتزم المعلن (مالك أو وسيط) بدقة وصحة كافة المواصفات والأسعار وموقع العقار على الخريطة. تحتفظ المنصة بالحق في تعليق أو حذف أي إعلان يتضمن:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pr-4 text-slate-600">
            <li>أسعار وهمية أو مضللة تختلف عن سعر المعاملة الفعلي بالجنيه المصري.</li>
            <li>إحداثيات جغرافية غير صحيحة أو تكرار نفس العقار بصور مضللة في أكثر من موقع.</li>
            <li>عدم وجود صفة قانونية واضحة للإعلان عن العقار.</li>
          </ul>
        </section>

        <section className="space-y-2 p-5 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>2. مسؤولية التعاقدات المالية والتوثيق الرسمي</span>
          </h2>
          <p>
            تعد منصة دار العقار بيئة وسيطة رقمية للعرض والاستكشاف الجغرافي. لا تتولى المنصة استلام أموال أو تحرير عقود بيع أو إيجار نهائية، ويتعين على الأطراف إجراء الفحص النافي للجهالة القانوني والتوثيق بالشهر العقاري المختص.
          </p>
        </section>
      </div>
    </div>
  );
}
