"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Bot,
  X,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  FileText,
  Globe,
  Volume2,
  Link2,
  Square,
} from "lucide-react";

interface Turn {
  role: "user" | "model";
  text: string;
  sources?: Array<{ title: string; uri: string }>;
}

interface Insight {
  severity: "critical" | "warning" | "info" | "good";
  title: string;
  detail: string;
  metric?: string;
}

interface PricingRow {
  category: string;
  count: number;
  avgPrice: number;
  min: number;
  max: number;
}

interface DemandRow {
  location: string;
  supply: number;
  demand: number;
  gap: string;
}

interface Report {
  generatedAt: string;
  snapshot: {
    properties: number;
    users: number;
    inquiries: number;
    crmRecords: number;
    totalViews: number;
    totalFavorites: number;
  };
  insights: Insight[];
  actions: string[];
  pricingByCategory: PricingRow[];
  demandVsSupply: DemandRow[];
}

const STORAGE_KEY = "aqar-supervisor-chat-history";
const FRESH_MINUTES = 10;

const SUGGESTIONS = [
  "أعطني جلسة إشراف كاملة على المشروع",
  "ما أطوار الخطر الحالية؟",
  "لخّص صحة المنصة اليوم",
  "أين الفرص الموجودة؟",
  "خطة الأسبوع القادم بخطوات محددة",
  "قارن أسعار العقارات المعلنة بمتوسط السوق",
];

const SEV_STYLE: Record<Insight["severity"], { bg: string; icon: React.ReactNode; label: string }> = {
  critical: { bg: "bg-rose-50 border-rose-200 text-rose-900", icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />, label: "حرج" },
  warning: { bg: "bg-amber-50 border-amber-200 text-amber-900", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, label: "تحذير" },
  info: { bg: "bg-sky-50 border-sky-200 text-sky-900", icon: <Info className="w-3.5 h-3.5 text-sky-500" />, label: "معلومة" },
  good: { bg: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />, label: "جيد" },
};

const fmt = (n: number) => Math.round(n).toLocaleString("ar-EG");

export default function ProjectSupervisorPanel() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const reportFresh = (r: Report | null) =>
    r && Date.now() - new Date(r.generatedAt).getTime() < FRESH_MINUTES * 60_000;

  // استرجاع المحادثة من الجلسة
  useEffect(() => {
    if (open && turns.length === 0) {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) setTurns(JSON.parse(saved).slice(-30));
      } catch {
        /* ignore */
      }
    }
  }, [open, turns.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  const fetchReport = async (force = false) => {
    if (report && !force && reportFresh(report)) return;
    setLoadingReport(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/ai-supervisor", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل بناء تقرير الإشراف");
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل بناء التقرير");
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (open) void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setError(null);
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user", text: msg }];
    setTurns(nextTurns);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextTurns.slice(-30)));
    } catch {
      /* ignore */
    }
    setSending(true);
    try {
      const res = await apiFetch("/api/admin/ai-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: turns.slice(-12), webSearch: webSearchOn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رد المرشد");
      if (data.report) setReport(data.report);
      const finalTurns: Turn[] = [
        ...nextTurns,
        {
          role: "model",
          text: data.reply,
          sources: webSearchOn && Array.isArray(data.sources) ? data.sources : undefined,
        },
      ];
      setTurns(finalTurns);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(finalTurns.slice(-30)));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل رد المرشد");
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setTurns([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  /** قراءة صوتية لآخر رد من المرشد (Gemini TTS) */
  const playLastReply = async () => {
    const lastModelReply = [...turns].reverse().find((t) => t.role === "model");
    if (!lastModelReply) {
      setError("لا يوجد رد لقراءته بعد — اسأل المرشد أولاً");
      return;
    }
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setPlaying(true);
      return;
    }
    setPlaying(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/ai-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastModelReply.text.slice(0, 2500) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل توليد الصوت");
      const url = `data:${data.mimeType || "audio/mpeg"};base64,${data.audioBase64}`;
      setAudioUrl(url);
      setTimeout(() => {
        audioRef.current?.play();
      }, 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل توليد الصوت");
      setPlaying(false);
    }
  };

  const criticalCount = report?.insights.filter((i) => i.severity === "critical").length || 0;
  const warningCount = report?.insights.filter((i) => i.severity === "warning").length || 0;

  return (
    <>
      {/* زر الإطلاق العائم */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-20 z-50 h-14 px-4 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="المرشد الذكي — يشرف على كامل بيانات المشروع"
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-black">المرشد الذكي</span>
          {criticalCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {criticalCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6" dir="rtl">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 p-4 flex items-center justify-between rounded-t-3xl z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                    المرشد الذكي للمشروع
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    يشرف على كامل بيانات المنصة ويعطي تحاليل وإجراءات حقيقية — مبنية على أرقام محسوبة فعلياً
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchReport(true)}
                  disabled={loadingReport}
                  className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="تحديث التقرير الإشرافي"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingReport ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* لوحة الحالة السريعة */}
              {report && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: "عقارات", value: fmt(report.snapshot.properties), color: "text-brand-700" },
                    { label: "مستخدمون", value: fmt(report.snapshot.users), color: "text-indigo-700" },
                    { label: "استفسارات", value: fmt(report.snapshot.inquiries), color: "text-sky-700" },
                    { label: "سجلات CRM", value: fmt(report.snapshot.crmRecords), color: "text-purple-700" },
                    { label: "مشاهدات", value: fmt(report.snapshot.totalViews), color: "text-amber-700" },
                    { label: "مفضلات", value: fmt(report.snapshot.totalFavorites), color: "text-rose-700" },
                  ].map((s) => (
                    <div key={s.label} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] text-slate-500 font-bold">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ملاحظات الإشراف */}
              {report && report.insights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    ملاحظات الإشراف — مُحسب فعلياً ({report.insights.length})
                    <span className="text-[10px] text-slate-400 font-bold">
                      • أُنشئ {new Date(report.generatedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </h4>
                  {report.insights.map((i, idx) => {
                    const st = SEV_STYLE[i.severity];
                    return (
                      <div key={idx} className={`p-3 rounded-xl border ${st.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5">{st.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-black">{i.title}</span>
                              <span className="text-[9px] font-black opacity-70 shrink-0">{st.label}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed mt-0.5 opacity-90">{i.detail}</p>
                            {i.metric && (
                              <p className="text-[10px] font-black mt-1 opacity-80">📊 {i.metric}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* توازن العرض والطلب */}
              {report && report.demandVsSupply.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    توازن العرض والطلب لكل منطقة
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {report.demandVsSupply.slice(0, 8).map((d) => (
                      <div key={d.location} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-slate-800 truncate">{d.location}</span>
                        <span className="text-[10px] font-bold text-slate-500 shrink-0">
                          عرض {d.supply} • طلب {d.demand}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${d.gap.includes("فرصة")
                              ? "bg-emerald-100 text-emerald-700"
                              : d.gap.includes("تسويق")
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          {d.gap}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* الأسعار لكل تصنيف */}
              {report && report.pricingByCategory.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2">
                    <Info className="w-3.5 h-3.5 text-emerald-600" />
                    متوسط الأسعار الحقيقية لكل تصنيف
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="text-slate-500 font-black">
                          <th className="text-right p-2">التصنيف</th>
                          <th className="text-right p-2">عدد</th>
                          <th className="text-right p-2">المتوسط</th>
                          <th className="text-right p-2">النطاق</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.pricingByCategory.map((p) => (
                          <tr key={p.category} className="border-t border-slate-100">
                            <td className="p-2 font-black text-slate-800">{p.category}</td>
                            <td className="p-2 font-bold text-slate-600">{p.count}</td>
                            <td className="p-2 font-black text-emerald-700">{fmt(p.avgPrice)} ج.م</td>
                            <td className="p-2 font-bold text-slate-500">
                              {fmt(p.min)} – {fmt(p.max)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {loadingReport && !report && (
                <div className="py-8 text-center text-xs font-bold text-slate-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  يجري حساب تقرير الإشراف من قاعدة البيانات...
                </div>
              )}

              {/* قسم المحادثة مع المرشد */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowChat((v) => !v)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  {showChat ? "إخفاء المحادثة" : "اسأل المرشد عن أي شيء في المشروع"}
                </button>
              </div>

              {showChat && (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-500">محادثة المرشد الذكي</span>
                    <div className="flex items-center gap-1">
                      {/* زر بحث ويب — Grounding with Google Search */}
                      <button
                        onClick={() => setWebSearchOn((v) => !v)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 transition-colors cursor-pointer ${
                          webSearchOn
                            ? "bg-sky-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        title="بحث ويب جوجل — يجيب من معلومات حية خارج المنصة (1500 طلب/يوم مجاناً)"
                      >
                        <Globe className="w-3 h-3" />
                        بحث ويب {webSearchOn ? "مفعل" : ""}
                      </button>
                      {/* زر القراءة الصوتية — Gemini TTS */}
                      <button
                        onClick={() => (playing && audioRef.current ? audioRef.current.pause() : void playLastReply())}
                        disabled={playing && !audioUrl}
                        className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40"
                        title="اسمع آخر رد صوتياً (Gemini TTS)"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={clearChat}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="مسح المحادثة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div ref={scrollRef} className="h-64 overflow-y-auto p-3 space-y-2.5 bg-slate-50/50">
                    {turns.length === 0 && (
                      <div className="text-center space-y-2 py-4">
                        <p className="text-[11px] text-slate-500 font-bold">جرّب واحدة من هذه الأسئلة:</p>
                        <div className="flex flex-wrap gap-1.5 justify-center px-2">
                          {SUGGESTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => void send(s)}
                              className="px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {turns.map((t, i) => (
                      <div key={i} className={`flex ${t.role === "user" ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap font-medium ${t.role === "user"
                              ? "bg-white border border-slate-200 text-slate-800 rounded-br-md"
                              : "bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-bl-md"
                            }`}
                        >
                          {t.text}
                          {/* مصادر بحث الويب — Grounding */}
                          {t.sources && t.sources.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/20 space-y-1">
                              <p className="text-[9px] font-black opacity-80">🌐 المصادر:</p>
                              {t.sources.slice(0, 4).map((s, j) => (
                                <a
                                  key={j}
                                  href={s.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-[9px] opacity-90 hover:opacity-100 underline truncate"
                                >
                                  <Link2 className="w-2.5 h-2.5 inline mr-1" />
                                  {s.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {sending && (
                      <div className="flex justify-end">
                        <div className="px-3 py-2 rounded-2xl bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          المرشد يحلل بيانات المشروع...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 border-t border-slate-100 bg-white">
                    {audioUrl && (
                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setPlaying(false)}
                        onPause={() => setPlaying(false)}
                        onPlay={() => setPlaying(true)}
                        className="hidden"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        placeholder={webSearchOn ? "سؤال ببحث ويب... مثال: أسعار الشقق في مصر حالياً" : "اسأل المرشد... مثال: قارن أسعار الشقق بالمتوسط"}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                      <button
                        onClick={() => void send()}
                        disabled={sending || !input.trim()}
                        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <Send className="w-4 h-4 -scale-x-100" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
