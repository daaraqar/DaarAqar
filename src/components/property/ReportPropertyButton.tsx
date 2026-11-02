"use client";

import React, { useState } from "react";
import { Flag, X, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ReportReasonCategory } from "@/lib/db/types";

interface ReportPropertyButtonProps {
  propertyId: string;
  propertyTitle: string;
}

export default function ReportPropertyButton({ propertyId, propertyTitle }: ReportPropertyButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<ReportReasonCategory>("misleading_details");
  const [details, setDetails] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      setError("يرجى كتابة تفاصيل البلاغ لتوضيح المخالفة");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          reasonCategory,
          details: details.trim(),
          reporterName: reporterName.trim() || undefined,
          reporterPhone: reporterPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setDetails("");
        }, 2000);
      } else {
        setError(data.error || "فشل إرسال البلاغ");
      }
    } catch {
      setError("حدث خطأ في الاتصال، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 text-xs font-bold transition-colors"
      >
        <Flag className="w-3.5 h-3.5" />
        <span>إبلاغ عن مخالفة</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>إبلاغ عن محتوى أو إعلان مخالف</span>
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="font-black text-slate-900 text-sm">تم استلام بلاغك بنجاح</h4>
                <p className="text-xs text-slate-500">
                  يقوم فريق الرقابة والامتثال بمراجعة الإعلان والتحقق من صحته. شكرًا لمساعدتنا في الحفاظ على موثوقية المنصة.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">سبب البلاغ:</label>
                  <select
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value as ReportReasonCategory)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 font-bold bg-slate-50"
                  >
                    <option value="misleading_details">بيانات غير صحيحة، سعر غير حقيقي، أو صور مضللة</option>
                    <option value="duplicate_listing">إعلان مكرر لنفس العقار</option>
                    <option value="unavailable">العقار تم بيعه/تأجيره ولم يعد متاحاً</option>
                    <option value="suspected_fraud">اشتباه احتيال، انتحال هوية، أو عمولة غير مشروعة</option>
                    <option value="other">مخالفة أخرى لشروط الاستخدام</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">تفاصيل البلاغ (إلزامي):</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    placeholder="وضح سبب البلاغ بالتفصيل لمساعدة فريق الإشراف..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">الاسم (اختياري):</label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="اسمك"
                      className="w-full p-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block mb-1">رقم الهاتف (اختياري):</label>
                    <input
                      type="text"
                      value={reporterPhone}
                      onChange={(e) => setReporterPhone(e.target.value)}
                      placeholder="للتواصل معك"
                      className="w-full p-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                {error && <p className="text-rose-600 font-bold text-[11px]">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>إرسال البلاغ</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
