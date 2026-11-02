"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { CmsHomepageSettings, CmsStaticPage } from "@/lib/db/types";
import {
  Info,
  ShieldCheck,
  MapPin,
  Target,
  CheckCircle2,
  FileText,
  Scale,
  Lock,
  EyeOff,
  Users,
  Sparkles,
  Phone,
  Compass,
  ArrowLeft,
  Building2,
} from "lucide-react";

type SectionKey = "overview" | "terms" | "privacy";

interface PillarItem {
  icon: React.ElementType;
  title: string;
  description: string;
  accent: string;
}

const PILLARS: PillarItem[] = [
  {
    icon: MapPin,
    title: "دقة مكانية وجغرافية",
    description:
      "خرائط تفاعلية متطورة وتحليلات مكانية دقيقة للأحياء والقرى في مركز ومدينة ميت غمر ومحافظة الدقهلية.",
    accent: "bg-brand-50 text-brand-600",
  },
  {
    icon: ShieldCheck,
    title: "أمان وحماية الخصوصية",
    description:
      "حماية كاملة لعناوين العقارات عبر خوارزمية التشويش الذكي للمواقع التقريبية، ومراجعة صارمة للإعلانات ضد التكرار والتضليل.",
    accent: "bg-purple-50 text-purple-600",
  },
  {
    icon: Target,
    title: "مطابقة ذكية وشفافة",
    description:
      "محرك توافق يعرض نسبة المطابقة مع أسباب واضحة، بدون ذكاء اصطناعي خارجي أو أسباب خفية.",
    accent: "bg-amber-50 text-amber-600",
  },
  {
    icon: Users,
    title: "سمعة موثوقة قابلة للتحقق",
    description:
      "تقييمات البائعين مقيدة بطلبات تواصل حقيقية تمت إجابتها، وشارات المشروعات تُحسب من تفاعل فعلي للمستخدمين.",
    accent: "bg-emerald-50 text-emerald-600",
  },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: "هل المنصة مجانية للمستخدمين؟",
    a: "نعم، التصفح والبحث والتواصل مع المعلنين مجاني تماماً للمستخدمين. المنصة لا تفرض أي رسوم خفية على الباحثين عن عقار.",
  },
  {
    q: "كيف أتأكد أن الإعلان حقيقي؟",
    a: "كل إعلان يمر بمراجعة إدارية قبل النشر، مع فحص التكرار والتحقق من رقم الهاتف والتحقق من هوية السمسار أو المالك عند الحاجة.",
  },
  {
    q: "هل يمكن للمالك حذف عقاره بعد النشر؟",
    a: "لا، بعد اعتماد الإعلان من الإدارة لا يمكن للمعلن حذفه مباشرة — بدلاً من ذلك يمكنه وسمه كـ (تم البيع) أو تقديم طلب حذف رسمي للإدارة.",
  },
  {
    q: "هل تُعرض عنوان العقار بدقة على الخريطة؟",
    a: "للمعلن خيار إظهار الموقع التقريبي فقط (دائرة نطاق 50 متراً) لإخفاء العنوان الدقيق حتى يتم التواصل الفعلي معه.",
  },
];

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");
  const [cmsPage, setCmsPage] = useState<CmsStaticPage | null>(null);
  const [pageUnavailable, setPageUnavailable] = useState(false);
  const [siteName, setSiteName] = useState("دار العقار");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/cms/pages/about", { cache: "no-store" }).then((response) => {
        if (response.status === 404) {
          setPageUnavailable(true);
          return null;
        }
        return response.ok ? response.json() : null;
      }),
    fetch("/api/cms/homepage", { cache: "no-store" }).then((response) =>
      response.ok ? response.json() : null
    ),
    ])
      .then(([pageData, settingsData]) => {
        if (pageData?.page) setCmsPage(pageData.page);
        const settings = settingsData?.settings as CmsHomepageSettings | undefined;
        if (settings?.visualIdentity?.siteName) setSiteName(settings.visualIdentity.siteName);
      })
      .catch((error: unknown) => console.error("[AboutPage] CMS content load failed:", error));
  }, []);

  // Read URL hash on mount if user arrived via #terms or #privacy
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash === "terms" || hash === "privacy") {
        setActiveSection(hash as SectionKey);
      }
    }
  }, []);

  if (pageUnavailable) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center font-bold text-slate-600" dir="rtl">
        هذه الصفحة غير منشورة حالياً.
      </div>
    );
  }

return (
  <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8" dir="rtl">
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Hero */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-xs text-center space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200/60 text-brand-700 text-xs font-black">
          <Sparkles className="w-4 h-4 text-brand-600" />
          <span>بوابة منصة {siteName}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          {cmsPage?.titleAr || (
            <>
              عن منصة <span className="text-brand-600">{siteName}</span>
            </>
          )}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
          {cmsPage?.contentAr ||
            `منصة ${siteName} تربط الباحثين بالمالك والوسطاء العقاريين المعتمدين باستخدام الخرائط المكانية والتحقق الموثوق وحماية خصوصية المواقع.`}
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
          >
            <Building2 className="w-4 h-4" />
            <span>تصفح العقارات</span>
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>استكشف الخريطة</span>
          </Link>
        </div>
      </section>

      {/* Section switcher */}
      <nav className="sticky top-[64px] z-30 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-1.5 flex gap-1 overflow-x-auto">
        {(
          [
            { key: "overview", label: "نبذة ورؤية المنصة", icon: Info, active: "bg-slate-900 text-white" },
            { key: "terms", label: "الشروط والأحكام", icon: FileText, active: "bg-purple-600 text-white" },
            { key: "privacy", label: "الخصوصية والأمان", icon: ShieldCheck, active: "bg-blue-600 text-white" },
          ] as Array<{ key: SectionKey; label: string; icon: React.ElementType; active: string }>
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveSection(tab.key);
                if (typeof window !== "undefined") {
                  window.history.replaceState(null, "", tab.key === "overview" ? "/about" : `/about#${tab.key}`);
                }
              }}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${activeSection === tab.key ? tab.active : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overview */}
      {activeSection === "overview" && (
        <div className="space-y-8">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className={`w-11 h-11 rounded-2xl ${pillar.accent} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">{pillar.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{pillar.description}</p>
                </div>
              );
            })}
          </section>

          {/* Mission */}
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-4">
            <h2 className="text-lg font-black text-slate-900">رسالتنا في سوق ميت غمر</h2>
            <p className="text-xs text-slate-600 leading-relaxed font-medium max-w-3xl">
              تمكين الباحثين والمعلنين المحليين بأدوات تقنية واضحة وسهلة الاستخدام، مع ضمان نزاهة السوق عبر
              المراجعة الإدارية لكل إعلان قبل اعتماده على الخريطة.
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 font-medium">
              {[
                "القضاء على الإعلانات العشوائية والوهمية من خلال الفحص المستمر والمراجعة الإدارية.",
                "قناة تواصل مباشرة وموثوقة بين الباحثين والملاك والوسطاء المرخصين.",
                "توفير بيانات شفافة حول الأسعار ومتوسط سعر المتر في أحياء وقرى مركز ميت غمر.",
                "تطوير المنصة تدريجياً لتلبية احتياجات الباحثين والمعلنين في مركز ميت غمر وقراره.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-3">
            <h2 className="text-lg font-black text-slate-900">الأسئلة الشائعة</h2>
            {FAQ_ITEMS.map((faq, index) => (
              <div key={faq.q} className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-xs font-black text-slate-900">{faq.q}</span>
                  <ArrowLeft
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${openFaq === index ? "-rotate-90" : "rotate-0"
                      }`}
                  />
                </button>
                {openFaq === index && (
                  <p className="px-5 pb-4 text-xs text-slate-600 leading-relaxed font-medium border-t border-slate-100 pt-3">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}

      {/* Terms */}
      {activeSection === "terms" && (
        <section id="terms" className="bg-white rounded-3xl border border-purple-200 p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold mb-2">
                <FileText className="w-4 h-4" />
                <span>الشروط والأحكام التنظيمية</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">شروط الاستخدام والإعلان العقاري</h2>
              <p className="text-xs text-slate-500">
                الضوابط الحاكمة لكل المعاملات ونشر الإعلانات على المنصة في مصر
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
              سارية لعام 2026
            </span>
          </div>
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-medium">
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-600" />
                <span>1. معايير نشر الإعلانات ومكافحة التضليل</span>
              </h3>
              <p>
                يلتزم المعلن (مالك أو وسيط عقاري) بتقديم بيانات دقيقة ومستندات داعمة عند الحاجة. تحتفظ المنصة
                بحق الحق في تعليق أو حذف أي إعلان يتضمن:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pr-4 text-slate-600">
                <li>أسعار وهمية أو ترويجية لا تعكس قيمة المعاملة الفعلية بالجنيه المصري.</li>
                <li>إحداثيات جغرافية غير صحيحة أو تكرار الإعلان بصور مضللة في أكثر من موقع.</li>
                <li>عدم وجود صفة قانونية واضحة أو غياب رخصة الوساطة العقارية عند الطلب.</li>
                <li>أي محتوى يخالف آداب التعامل أو قوانين القطاع العقاري في مصر.</li>
              </ul>
            </article>
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>2. مسؤولية التعاقدات المالية والتوثيق الرسمي</span>
              </h3>
              <p>
                تعتبر منصة <strong>{siteName}</strong> بيئة تقنية للاستكشاف الجغرافي والربط المباشر، ولا تعتبر
                طرفاً في التعاقد المالي أو استلام المقدمات:
              </p>
              <ul className="list-disc list-inside space-y-1.5 pr-4 text-slate-600">
                <li>يجب على الأطراف إجراء الفحص القانوني والتأكد من أوراق الملكية قبل سداد أي مبالغ.</li>
                <li>يتم توثيق المعاملات النهائية بمأموريات الشهر العقاري وفق القانون المصري.</li>
              </ul>
            </article>
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <span>3. حسابات الوسطاء والملاك والتزامات الاعتماد</span>
              </h3>
              <p>
                تخضع إعلانات الملاك والوسطاء لسياسة المراجعة الإدارية المسبقة قبل اعتماد ظهورها على الخريطة
                العامة لضمان أعلى مستويات الثقة والمصداقية.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* Privacy */}
      {activeSection === "privacy" && (
        <section id="privacy" className="bg-white rounded-3xl border border-blue-200 p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>حماية البيانات والخصوصية الجغرافية</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900">سياسة الخصوصية وأمن البيانات</h2>
              <p className="text-xs text-slate-500">
                معايير حماية سرية المستخدمين وعناوين العقارات على الخريطة التفاعلية
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
              امتثال قانون 151/2020
            </span>
          </div>
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-medium">
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-blue-600" />
                <span>1. خصوصية الموقع الجغرافي للعقارات</span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pr-4 text-slate-600">
                <li>عند اختيار &quot;الموقع التقريبي&quot;، تُخفى الإحداثيات الفعلية تماماً من الواجهات البرمجية العامة.</li>
                <li>تُعرض دائرة تقريبية بنطاق 50 متراً على الخريطة دون كشف رقم المبنى أو العنوان الدقيق.</li>
                <li>لا يُكشف العنوان الدقيق إلا بعد تواصل مباشر وموافقة المعلن لترتيب المعاينة.</li>
              </ul>
            </article>
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>2. جمع وحفظ البيانات الشخصية بأمان</span>
              </h3>
              <ul className="list-disc list-inside space-y-1.5 pr-4 text-slate-600">
                <li>نجمع فقط البيانات الأساسية اللازمة للتحقق والتواصل (الاسم، الهاتف، البريد).</li>
                <li>تُشفّر كلمات المرور ولا يمكن لأي موظف الاطلاع عليها.</li>
                <li>لا نبيع أو نشارك بيانات المستخدمين مع أي شركات تسويق خارجية.</li>
              </ul>
            </article>
            <article className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>3. الامتثال لقانون حماية البيانات المصري</span>
              </h3>
              <p>
                تخضع جميع معالجات البيانات لأحكام قانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020،
                وقواعد الجهاز القومي لتنظيم الاتصالات.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="bg-gradient-to-l from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right">
          <h3 className="text-lg font-black">هل لديك استفسار إضافي أو ترغب في التواصل معنا؟</h3>
          <p className="text-xs text-slate-300 max-w-lg">
            فريق دعم منصة {siteName} جاهز للإجابة على تساؤلات الملاك والباحثين والوسطاء في مركز ميت غمر وقراره.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>تواصل مع الدعم الفني</span>
          </Link>
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>تصفح العقارات</span>
          </Link>
        </div>
      </section>
    </div>
  </div>
);
}
