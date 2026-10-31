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
  Globe,
  Volume2,
  Link2,
  BotMessageSquare,
  FileBarChart2,
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
    messages?: number;
    unreadNotices?: number;
  };
  insights: Insight[];
  actions: string[];
  pricingByCategory: PricingRow[];
  demandVsSupply: DemandRow[];
}

const STORAGE_KEY = "aqar-supervisor-chat-history";

const SUGGESTIONS = [
  "أعطني جلسة إشراف كاملة على المشروع",
  "ما أطوار الخطر الحالية؟",
  "لخّص صحة المنصة اليوم",
  "ما العقارات بانتظار المراجعة؟",
  "كم سجل CRM غير مؤكد؟ وما أولوية تأكيدها؟",
  "قارن أسعار العقارات المعلنة بمتوسط السوق",
];

const SEV_STYLE: Record<Insight["severity"], { bg: string; icon: React.ReactNode; label: string }> = {
  critical: { bg: "bg-rose-50 border-rose-200 text-rose-900", icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />, label: "حرج" },
  warning: { bg: "bg-amber-50 border-amber-200 text-amber-900", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />, label: "تحذير" },
  info: { bg: "bg-sky-50 border-sky-200 text-sky-900", icon: <AlertTriangle className="w-3.5 h-3.5 text-sky-500" />, label: "معلومة" },
  good: { bg: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: <Sparkles className="w-3.5 h-3.5 text-emerald-500" />, label: "جيد" },
};

const fmt = (n: number) => Math.round(n).toLocaleString("ar-EG");

/**
 * زر البوت الموحد — المرشد الذكي للمشروع
 * دمج: مساعد الإدارة (ai-chat) + المرشد الإشرافي (ai-supervisor) في نافذة واحدة.
 * داخل النافذة: وضع محادثة + وضع تقرير.
 */
export default function ProjectSupervisorPanel() {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "report">("chat");
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const reportFresh = (r: Report | null) =>
    r && Date.now() - new Date(r.generatedAt).getTime() < 10 * 60_000;

  // استرجاع المحادثة من الجلسة (مفتاح موحد)
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
  }, [turns, sending, mode]);

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

  /** قراءة صوتية لآخر رد (Gemini TTS) */
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

  return (
    <>
      {/* ===== زر البوت الموحد الوحيد — كل شيء يبدأ من هنا ===== */}
      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            void fetchReport();
          }}
          className="fixed bottom-24 left-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-700 hover:via-purple-700 hover:to-emerald-700 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="المرشد الذكي — يشرف على كامل بيانات المشروع"
          aria-label="فتح المرشد الذكي"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-slate-900" />
          </span>
          {criticalCount > 0 && (
            <span className="absolute top-0 left-0 w-5 h-5 rounded-full bg-rose-500 border-2 border-white text-white text-[9px] font-black flex items-center justify-center">
              {criticalCount}
            </span>
          )}
        </button>
      )}

      {/* ===== نافذة البوت ===== */}
      {open && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[480px] z-50 flex flex-col max-h-[80vh]" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="bg-gradient-to-l from-indigo-700 via-purple-700 to-emerald-700 text-white p-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm flex items-center gap-1.5">
                    المرشد الذكي للمشروع
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    يشرف على كامل بيانات المنصة ويجيب أسئلتك بالأرقام الفعلية
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fetchReport(true)}
                  disabled={loadingReport}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer disabled:opacity-50"
                  title="تحديث التقرير الإشرافي"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingReport ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mode tabs: محادثة / تقرير */}
            <div className="grid grid-cols-2 bg-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setMode("chat")}
                className={`py-2.5 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${mode === "chat" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <BotMessageSquare className="w-3.5 h-3.5" />
                محادثة
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("report");
                  void fetchReport();
                }}
                className={`py-2.5 text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${mode === "report" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                <FileBarChart2 className="w-3.5 h-3.5" />
                تقرير الإشراف
                {criticalCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                    {criticalCount}
                  </span>
                )}
              </button>
            </div>

            {error && (
              <div className="mx-3 mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* ===== Mode: Report ===== */}
            {mode === "report" && (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-4 bg-slate-50">
                {/* Snapshot counters */}
                {report && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "عقارات", value: fmt(report.snapshot.properties) },
                      { label: "مستخدمون", value: fmt(report.snapshot.users) },
                      { label: "استفسارات", value: fmt(report.snapshot.inquiries) },
                      { label: "CRM", value: fmt(report.snapshot.crmRecords) },
                      { label: "مشاهدات", value: fmt(report.snapshot.totalViews) },
                      { label: "مفضلات", value: fmt(report.snapshot.totalFavorites) },
                      ...(typeof report.snapshot.messages === "number"
                        ? [{ label: "رسائل", value: fmt(report.snapshot.messages) }]
                        : []),
                      ...(typeof report.snapshot.unreadNotices === "number" && report.snapshot.unreadNotices > 0
                        ? [{ label: "إشعارات!", value: fmt(report.snapshot.unreadNotices) }]
                        : []),
                    ].map((s) => (
                      <div key={s.label} className="p-2 rounded-xl bg-white border border-slate-100 text-center">
                        <p className="text-sm font-black text-slate-800">{s.value}</p>
                        <p className="text-[8px] text-slate-500 font-bold">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Insights */}
                {report && report.insights.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      ملاحظات الإشراف ({report.insights.length})
                    </h4>
                    {report.insights.map((i, idx) => {
                      const st = SEV_STYLE[i.severity];
                      return (
                        <div key={idx} className={`p-2.5 rounded-xl border ${st.bg}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black flex items-center gap-1.5">
                              {st.icon}
                              {i.title}
                            </span>
                            <span className="text-[9px] font-black opacity-70 shrink-0">{st.label}</span>
                          </div>
                          <p className="text-[10px] leading-relaxed mt-1 opacity-90">{i.detail}</p>
                          {i.metric && <p className="text-[9px] font-black mt-1 opacity-80">📊 {i.metric}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Demand vs supply */}
                {report && report.demandVsSupply.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 mb-1.5">توازن العرض والطلب</h4>
                    <div className="space-y-1.5">
                      {report.demandVsSupply.slice(0, 6).map((d) => (
                        <div key={d.location} className="p-2 rounded-xl bg-white border border-slate-100 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-slate-800 truncate">{d.location}</span>
                          <span className="text-[9px] font-bold text-slate-500 shrink-0">عرض {d.supply} • طلب {d.demand}</span>
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${d.gap.includes("فرصة")
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

                {/* Pricing table */}
                {report && report.pricingByCategory.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 mb-1.5">متوسط الأسعار الحقيقية</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          <tr className="text-slate-500 font-black">
                            <th className="text-right p-1.5">التصنيف</th>
                            <th className="text-right p-1.5">عدد</th>
                            <th className="text-right p-1.5">المتوسط</th>
                            <th className="text-right p-1.5">النطاق</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.pricingByCategory.map((p) => (
                            <tr key={p.category} className="border-t border-slate-100">
                              <td className="p-1.5 font-black text-slate-800">{p.category}</td>
                              <td className="p-1.5 font-bold text-slate-600">{p.count}</td>
                              <td className="p-1.5 font-black text-emerald-700">{fmt(p.avgPrice)} ج.م</td>
                              <td className="p-1.5 font-bold text-slate-500">{fmt(p.min)}–{fmt(p.max)}</td>
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
                    يجري حساب التقرير من قاعدة البيانات...
                  </div>
                )}

                {!loadingReport && report && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("chat");
                      void send("أعطني جلسة إشراف كاملة على المشروع");
                    }}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <BotMessageSquare className="w-4 h-4" />
                    ناقش المرشد في هذا التقرير
                  </button>
                )}
              </div>
            )}

            {/* ===== Mode: Chat ===== */}
            {mode === "chat" && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50">
                  {turns.length === 0 && (
                    <div className="text-center py-4 space-y-2.5">
                      <div className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                        <Bot className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-black text-slate-700">اسألني عن أي شيء — أنا أرى كامل بيانات المنصة</p>
                      <div className="flex flex-wrap gap-1.5 justify-center px-2">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => void send(s)}
                            className="px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
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
                            ? "bg-white text-slate-800 border border-slate-200 rounded-br-md"
                            : "bg-gradient-to-br from-indigo-600 via-purple-600 to-emerald-600 text-white rounded-bl-md"
                          }`}
                      >
                        {t.text}
                        {/* Grounding sources */}
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
                      <div className="bg-gradient-to-br from-indigo-600 to-emerald-600 text-white px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[11px] font-bold">يحلل بيانات المشروع...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="p-2.5 border-t border-slate-100 bg-white shrink-0">
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
                  <div className="flex items-center gap-1.5 mb-2">
                    {/* Grounding toggle */}
                    <button
                      type="button"
                      onClick={() => setWebSearchOn((v) => !v)}
                      className={`px-2 py-1 rounded-lg text-[9px] font-black flex items-center gap-1 transition-colors cursor-pointer ${webSearchOn ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      title="بحث ويب جوجل — يجيب من معلومات حية خارج المنصة (1500 طلب/يوم مجاناً)"
                    >
                      <Globe className="w-3 h-3" />
                      بحث ويب {webSearchOn ? "مفعل" : ""}
                    </button>
                    {/* TTS */}
                    <button
                      type="button"
                      onClick={() => (playing && audioRef.current ? audioRef.current.pause() : void playLastReply())}
                      disabled={playing && !audioUrl}
                      className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-40"
                      title="اسمع آخر رد صوتياً (Gemini TTS)"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    {/* Clear */}
                    <button
                      type="button"
                      onClick={clearChat}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="محادثة جديدة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      placeholder={
                        webSearchOn
                          ? "سؤال ببحث ويب... مثال: أسعار الشقق في مصر حالياً"
                          : "اسأل عن العقارات، المستخدمين، CRM، التسعير..."
                      }
                      className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={sending || !input.trim()}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white flex items-center justify-center shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                      aria-label="إرسال"
                    >
                      <Send className="w-4 h-4 -scale-x-100" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
