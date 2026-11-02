"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Crown,
  TrendingUp,
  FileText,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  Layers,
  X,
  Loader2,
} from "lucide-react";

export default function ServicesPage() {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", notes: "", consent: false, website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const services = [
    {
      id: "aqar-plus",
      title: "عقار+",
      category: "باقة التميز",
      desc: "مجموعة من الأدوات والخدمات الحصرية للمعلنين والباحثين للاستفادة الكاملة من التطبيق.",
      icon: Crown,
      badge: "اشتراك مميز",
      color: "from-amber-500/10 to-orange-500/10 text-amber-600 border-amber-200",
      features: [
        "فلترة عقارات المالك المباشر",
        "سجل إحصائيات ونشاط الإعلان",
        "ظهور متقدم على خريطة عقار",
        "تنبيهات فورية لطلبات المشترين",
      ],
      price: "تُحدد التكلفة عند التواصل",
    },
    {
      id: "promo",
      title: "خدمات الترويج والتسويق",
      category: "تسويق وإعلانات",
      desc: "إبراز إعلانك أو مشروعك في صدارة نتائج البحث لتسريع وتيرة البيع أو التأجير.",
      icon: TrendingUp,
      badge: "تسريع البيع",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-700 border-emerald-200",
      features: [
        "إعلان مميز في صدارة نتائج البحث",
        "شارة الإعلان المميز باللون الأخضر",
        "إشعار المشترين المهتمين في المنطقة",
        "مشاركة إعلانية على منصات التواصل",
      ],
      price: "تُحدد التكلفة حسب الخدمة",
    },
    {
      id: "inspection",
      title: "فحص وتقييم المباني",
      category: "معاينة هندسية",
      desc: "فحص فني شامل للعقار عبر مهندسين معتمدين للتأكد من السلامة الإنشائية والتشطيبات.",
      icon: ShieldCheck,
      badge: "فحص معتمد",
      color: "from-blue-500/10 to-indigo-500/10 text-blue-700 border-blue-200",
      features: [
        "فحص التمديدات الكهربائية والسباكة",
        "فحص العزل الحراري والرطوبة والتسريبات",
        "فحص الهيكل الخرساني والتشطيبات",
        "تقرير فني رسمي معتمد بنقاط القوة والملاحظات",
      ],
      price: "التوفر والتكلفة عند التواصل",
    },
    {
      id: "contracts",
      title: "عقود الإيجار والتوثيق الإلكتروني",
      category: "خدمات قانونية وتوثيق",
      desc: "إبرام وتوثيق عقود الإيجار والوساطة إلكترونياً لحفظ حقوق المالك والمستأجر.",
      icon: FileText,
      badge: "توثيق رسمي",
      color: "from-purple-500/10 to-violet-500/10 text-purple-700 border-purple-200",
      features: [
        "عقد إيجار إلكتروني موثق",
        "ربط نظامي لحفظ مستحقات الأطراف",
        "جدولة الدفعات وسندات القبض",
        "تنبيهات تلقائية بمواعيد التجديد",
      ],
      price: "التوفر والتكلفة عند التواصل",
    },
    {
      id: "mortgage-calc",
      title: "حاسبة التمويل العقاري",
      category: "استشارات بنكية",
      desc: "محاكاة فورية للأقساط الشهرية، القدرة الشرائية، وأفضل عروض جهات التمويل.",
      icon: Calculator,
      badge: "حاسبة فورية",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-700 border-cyan-200",
      features: [
        "حساب القسط الشهري بدقة",
        "مقارنة نسب الفائدة التنافسية",
        "احتساب أقصى مبلغ تمويل متاح لراتبك",
        "تنسيق مباشر مع ممثلي التمويل",
      ],
      price: "التفاصيل عند التواصل",
    },

  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-36 font-sans" dir="rtl">
      {/* 1. Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-base font-black text-slate-900 tracking-tight">الخدمات العقارية</h1>
        <div className="w-8" />
      </div>

      {/* 2. Hero Notice */}
      <div className="bg-white border-b border-slate-200 px-4 py-5 shadow-2xs">
        <div className="max-w-lg mx-auto text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-base font-black text-slate-900">منظومة الخدمات والحلول العقارية</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
            استكشف الخدمات العقارية وأرسل طلب تواصل لمعرفة التفاصيل والتوفر والتكلفة.
          </p>
        </div>
      </div>

      {/* 3. Services Grid */}
      <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium leading-relaxed text-amber-900">
          طلب التواصل لا يُعد حجزاً أو تأكيداً لتوفر الخدمة. يوضح فريق الدعم التفاصيل والتكلفة قبل أي اتفاق.
        </div>
        {successMessage && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold leading-relaxed text-emerald-800">
            {successMessage}
          </div>
        )}

        <div className="space-y-3">
          {services.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all space-y-3"
              >
                {/* Top Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${srv.color} flex items-center justify-center shrink-0 border`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{srv.title}</h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {srv.badge}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">{srv.category}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {srv.desc}
                </p>

                {/* Features list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 text-[11px] font-bold text-slate-700">
                  {srv.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom Action Row */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <span className="text-xs font-black text-emerald-700">{srv.price}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedService(srv.id);
                      setFormError(null);
                      setForm({ name: "", phone: "", notes: "", consent: false, website: "" });
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-black text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    <span>الاستفسار عن الخدمة</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedService && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setSelectedService(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-inquiry-title"
            className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
            dir="rtl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="service-inquiry-title" className="text-base font-black text-slate-900">طلب التواصل عن الخدمة</h2>
                <p className="mt-1 text-xs font-bold text-emerald-700">
                  {services.find((service) => service.id === selectedService)?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                disabled={submitting}
                aria-label="إغلاق النموذج"
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubmitting(true);
                setFormError(null);
                try {
                  const response = await fetch("/api/service-inquiries", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ serviceId: selectedService, ...form }),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error || "تعذر إرسال طلبك");
                  setSuccessMessage(result.message || "تم تسجيل طلبك بنجاح.");
                  setSelectedService(null);
                  setForm({ name: "", phone: "", notes: "", consent: false, website: "" });
                } catch (error) {
                  setFormError(error instanceof Error ? error.message : "تعذر إرسال طلبك حالياً.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>الاسم</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>رقم الهاتف</span>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>ملاحظات (اختياري)</span>
                <textarea
                  maxLength={500}
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <input
                  required
                  type="checkbox"
                  checked={form.consent}
                  onChange={(event) => setForm({ ...form, consent: event.target.checked })}
                  className="mt-0.5 accent-emerald-700"
                />
                <span>أوافق على تواصل فريق الدعم معي بخصوص هذا الطلب.</span>
              </label>
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
                className="absolute -left-[9999px] h-px w-px"
              />
              {formError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "جارٍ تسجيل الطلب..." : "إرسال طلب التواصل"}
              </button>
              <p className="text-center text-[10px] leading-relaxed text-slate-500">طلبك للاستفسار فقط، ولن يتم حجز خدمة أو تحصيل مبلغ عبر هذا النموذج.</p>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
