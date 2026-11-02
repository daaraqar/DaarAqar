"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, Loader2, Send, Phone, User, MessageSquare, Building2 } from "lucide-react";

interface RegisterInterestModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
  availableUnits?: Array<{ id: string; title: string; price: number; areaSqM?: number }>;
  defaultUnitTitle?: string;
}

export default function RegisterInterestModal({
  isOpen,
  onClose,
  projectName,
  projectId,
  availableUnits = [],
  defaultUnitTitle = "",
}: RegisterInterestModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(defaultUnitTitle || "all");
  const [message, setMessage] = useState("أرغب في تسجيل اهتمامي بهذا المشروع والحصول على تفاصيل الأسعار وجدول الدفعات والمعاينة.");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultUnitTitle) {
      setSelectedUnit(defaultUnitTitle);
    }
  }, [defaultUnitTitle]);

  // Try auto-filling from logged-in user session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          if (data.user.name && !name) setName(data.user.name);
          if (data.user.phone && !phone) setPhone(data.user.phone);
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("يرجى إدخال اسمك الكريم");
      return;
    }
    if (!phone.trim()) {
      setError("يرجى إدخال رقم الجوال للتواصل");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const chosenUnitText = selectedUnit === "all" ? "كافة الوحدات / استفسار عام" : selectedUnit;
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: projectId,
          propertyTitle: `${projectName} - ${chosenUnitText}`,
          seekerName: name.trim(),
          seekerPhone: phone.trim(),
          message: `${message.trim()} (الوحدة المطلوبة: ${chosenUnitText})`,
          preferredContact: "call",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "تعذر إرسال طلب الاهتمام، يرجى المحاولة لاحقاً");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء الإرسال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right pb-safe"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-base font-black text-slate-900">تسجيل اهتمام بالمشروع</h3>
            <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[80vh] overflow-y-auto space-y-4">
          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900">تم تسجيل اهتمامك بنجاح!</h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  شكراً لتواصلك. سيقوم مستشار المبيعات المعتمد لمشروع <span className="font-bold text-slate-800">{projectName}</span> بالتواصل معك هاتفياً أو عبر واتساب بأقرب وقت.
                </p>
              </div>
              <button
                onClick={() => {
                  setSuccess(false);
                  onClose();
                }}
                className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs transition-colors shadow-xs"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  {error}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: محمد عبد العزيز"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  رقم الجوال للتواصل <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05XXXXXXXX أو 010XXXXXXXX"
                    dir="ltr"
                    className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 text-right focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Preferred Unit Type */}
              {availableUnits.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700">الوحدة المفضلة</label>
                  <div className="relative">
                    <select
                      value={selectedUnit}
                      onChange={(e) => setSelectedUnit(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      <option value="all">كافة الوحدات / استفسار عام عن المشروع</option>
                      {availableUnits.map((u) => (
                        <option key={u.id} value={u.title}>
                          {u.title} ({u.price.toLocaleString("ar-EG")} ج.م {u.areaSqM ? `- ${u.areaSqM} م²` : ""})
                        </option>
                      ))}
                    </select>
                    <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">ملاحظات أو استفسار إضافي</label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب استفسارك هنا..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال الاهتمام...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>تأكيد تسجيل الاهتمام</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
