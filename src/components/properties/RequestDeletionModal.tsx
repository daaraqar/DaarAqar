"use client";

import React, { useState } from "react";
import { Property } from "@/lib/db/types";
import { X, Send, AlertTriangle, Building2, Loader2, FileText } from "lucide-react";

interface RequestDeletionModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onRequested?: () => void;
}

export default function RequestDeletionModal({
  property,
  isOpen,
  onClose,
  onRequested,
}: RequestDeletionModalProps) {
  const [reasonCategory, setReasonCategory] = useState("sold_externally");
  const [detailedReason, setDetailedReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !property) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedReason.trim()) {
      setErrorMsg("يرجى كتابة سبب طلب الحذف للإدارة");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const reasonsMap: Record<string, string> = {
      sold_externally: "تم البيع / التأجير خارج المنصة",
      cancelled_by_owner: "تراجع المالك نهائياً عن عرض العقار",
      data_error: "خطأ جوهري في بيانات العقار ويرغب في إعادة إدخاله",
      other: "سبب آخر",
    };

    const fullMessage = `طلب حذف معتمد للعقار:\nالسبب الأساسي: ${reasonsMap[reasonCategory] || reasonCategory}\nالتفاصيل: ${detailedReason.trim()}`;

    try {
      const res = await fetch("/api/official-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          propertyTitle: property.title,
          type: "deletion_request",
          title: `طلب حذف عقار منشور: ${property.title}`,
          message: fullMessage,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert("تم إرسال طلب الحذف الرسمي لإدارة المنصة بنجاح، وستتم مراجعته والتأكيد في أقرب وقت.");
        if (onRequested) onRequested();
        onClose();
      } else {
        setErrorMsg(data.error || "فشل إرسال طلب الحذف");
      }
    } catch {
      setErrorMsg("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">طلب حذف عقار منشور</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                مخاطبة رسمية لإدارة المنصة لطلب حذف أو أرشفة الإعلان
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
          <div className="font-black text-amber-950">تنويه إداري وتنظيمي:</div>
          <p>
            حسب سياسة المنصة المعتمدة، لا يحق للمعلن حذف العقار المنشور بنفسه بعد اعتماده ونشره. يتم رفع هذا الطلب لإدارة المنصة لاتخاذ قرار الحذف أو الأرشفة رسمياً.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 font-bold mb-1">العقار المعني:</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold flex items-center gap-2 truncate">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{property.title}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">سبب طلب الحذف:</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-brand-500"
            >
              <option value="sold_externally">تم البيع / التأجير خارج المنصة</option>
              <option value="cancelled_by_owner">تراجع المالك نهائياً عن عرض العقار</option>
              <option value="data_error">خطأ جوهري في البيانات</option>
              <option value="other">سبب آخر</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">توضيح إضافي للإدارة (إلزامي):</label>
            <textarea
              rows={3}
              value={detailedReason}
              onChange={(e) => setDetailedReason(e.target.value)}
              placeholder="اكتب التوضيح أو سبب رغبتك في الحذف بالتفصيل..."
              className="w-full p-2.5 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>إرسال طلب الحذف للإدارة</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
