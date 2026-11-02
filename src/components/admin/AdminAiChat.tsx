"use client";

import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Bot, X, Loader2, Send, Sparkles, Trash2, MessageCircle } from "lucide-react";

interface Turn {
  role: "user" | "model";
  text: string;
}

const STORAGE_KEY = "aqar-admin-ai-chat-history";

/** اقتراحات جاهزة حسب ما تحتاجه الإدارة عادةً */
const SUGGESTIONS = [
  "لخّص لي وضع اللوحة اليوم",
  "ما العقارات بانتظار المراجعة؟",
  "حلل آخر الاستفسارات وأعطني توصيات",
  "كم سجل CRM غير مؤكد؟ وما أولوية تأكيدها؟",
];

export default function AdminAiChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // استرجاع المحادثة من الجلسة السابقة (نفس المتصفح)
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

  const persist = (next: Turn[]) => {
    setTurns(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-30)));
    } catch {
      /* quota */
    }
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setError(null);
    setInput("");
    const nextTurns: Turn[] = [...turns, { role: "user" as const, text: msg }];
    persist(nextTurns);
    setSending(true);
    try {
      const res = await apiFetch("/api/admin/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: turns.slice(-12) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رد المساعد");
      persist([...nextTurns, { role: "model", text: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الاتصال بالمساعد");
      // أزل رسالة المستخدم من الواجهة؟ لا — نتركها ويظهر الخطأ أسفلها
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    persist([]);
    setError(null);
  };

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="مساعد الإدارة الذكي"
          aria-label="فتح المساعد الذكي"
        >
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-slate-900" />
          </span>
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:w-[420px] z-50" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="bg-gradient-to-l from-indigo-700 to-purple-700 text-white p-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm flex items-center gap-1.5">
                    مساعد دار العقار الذكي
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h3>
                  <p className="text-[10px] text-indigo-200 font-medium">
                    يقرأ بيانات اللوحة الحية ويجيب أسئلتك
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  title="محادثة جديدة"
                >
                  <Trash2 className="w-4 h-4" />
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

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50">
              {turns.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-slate-700">اسألني عن أي شيء في لوحة التحكم</p>
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
                        : "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-bl-md"
                      }`}
                  >
                    {t.text}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-end">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[11px] font-bold">يفكر في بيانات اللوحة...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold p-2.5 rounded-xl">
                  {error}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-slate-100 bg-white shrink-0">
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
                  placeholder="اسأل عن العقارات، المستخدمين، الاستفسارات..."
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || !input.trim()}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white flex items-center justify-center shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  aria-label="إرسال"
                >
                  <Send className="w-4 h-4 -scale-x-100" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
