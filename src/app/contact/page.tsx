"use client";

import React, { useEffect, useState } from "react";
import { Mail, Phone, MessageCircle } from "lucide-react";
import type { CmsHomepageSettings, CmsStaticPage } from "@/lib/db/types";

export default function ContactPage() {
  const [cmsPage, setCmsPage] = useState<CmsStaticPage | null>(null);
  const [pageUnavailable, setPageUnavailable] = useState(false);
  const [contact, setContact] = useState<Pick<CmsHomepageSettings, "contactPhone" | "contactWhatsApp" | "contactEmail"> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/cms/pages/contact", { cache: "no-store" }).then((response) => {
        if (response.status === 404) {
          setPageUnavailable(true);
          return null;
        }
        return response.ok ? response.json() : null;
      }),
      fetch("/api/cms/homepage", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
    ])
      .then(([pageData, settingsData]) => {
        if (pageData?.page) setCmsPage(pageData.page);
        if (settingsData?.settings) setContact(settingsData.settings);
      })
      .catch((error: unknown) => console.error("[ContactPage] CMS content load failed:", error));
  }, []);

  const phone = contact?.contactPhone || "+20 2 2790 0000";
  const whatsapp = contact?.contactWhatsApp || "+20 100 111 2233";
  const email = contact?.contactEmail || "info@aqarpulse.eg";

  if (pageUnavailable) {
    return <div className="mx-auto max-w-3xl px-4 py-24 text-center font-bold text-slate-600">هذه الصفحة غير منشورة حالياً.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-slate-900">{cmsPage?.titleAr || "اتصل بفريق منصة دار العقار"}</h1>
        <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
          {cmsPage?.contentAr || "يسعدنا تقديم الدعم الفني والإجابة عن استفسارات الملاك والوسطاء العقاريين في مركز ميت غمر وقراه"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
            <Phone className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">الاتصال الهاتفي</h3>
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-xs text-slate-500 font-mono" dir="ltr">{phone}</a>
          <span className="text-[11px] text-slate-400 block">يومياً من 9 صباحاً حتى 6 مساءً</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <MessageCircle className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">الدعم عبر واتساب</h3>
          <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} className="text-xs text-slate-500 font-mono" dir="ltr">{whatsapp}</a>
          <span className="text-[11px] text-slate-400 block">رد سريع خلال ساعات العمل</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">البريد الإلكتروني للدعم</h3>
          <a href={`mailto:${email}`} className="text-xs text-slate-500 leading-relaxed" dir="ltr">{email}</a>
        </div>
      </div>
    </div>
  );
}
