"use client";

import React, { useState, useEffect } from "react";
import { Property } from "@/lib/db/types";
import {
  X,
  Save,
  Send,
  AlertTriangle,
  Clock,
  Building2,
  Loader2,
  Sparkles,
  MapPin,
  FileText,
  DollarSign,
  Maximize2,
  CheckCircle2,
} from "lucide-react";

interface EditPropertyModalProps {
  property: Property | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Property) => void;
}

export default function EditPropertyModal({
  property,
  isOpen,
  onClose,
  onSaved,
}: EditPropertyModalProps) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [areaSqM, setAreaSqM] = useState<number | string>("");
  const [addressDetails, setAddressDetails] = useState("");
  const [savingAction, setSavingAction] = useState<"draft" | "pending_review" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (property) {
      setTitle(property.title || "");
      setPrice(property.price || "");
      setDescription(property.description || "");
      setAreaSqM(property.areaSqM || "");
      setAddressDetails(property.addressDetails || "");
      setErrorMsg(null);
    }
  }, [property]);

  if (!isOpen || !property) return null;

  const handleSave = async (targetStatus: "draft" | "pending_review") => {
    if (!title.trim()) {
      setErrorMsg("يرجى كتابة عنوان العقار");
      return;
    }
    if (!price || Number(price) <= 0) {
      setErrorMsg("يرجى إدخال سعر صحيح وموجب");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("يرجى كتابة وصف تفصيلي للعقار");
      return;
    }
    if (!areaSqM || Number(areaSqM) <= 0) {
      setErrorMsg("يرجى إدخال المساحة بالمتر المربع");
      return;
    }

    setSavingAction(targetStatus);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          price: Number(price),
          description: description.trim(),
          areaSqM: Number(areaSqM),
          addressDetails: addressDetails.trim(),
          status: targetStatus,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSaved(
          data.property || {
            ...property,
            title: title.trim(),
            price: Number(price),
            description: description.trim(),
            areaSqM: Number(areaSqM),
            addressDetails: addressDetails.trim(),
            status: targetStatus,
          }
        );
        onClose();
      } else {
        setErrorMsg(data.error || "فشل حفظ التعديلات");
      }
    } catch {
      setErrorMsg("خطأ في الاتصال بالخادم، يرجى المحاولة ثانية");
    } finally {
      setSavingAction(null);
    }
  };

  const isRejected = property.status === "rejected";
  const isPending = property.status === "pending_review";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-black text-slate-900">
                {isRejected
                  ? "تعديل الإعلان بعد عدم موافقة الإدارة"
                  : isPending
                  ? "تعديل بيانات العقار قيد المراجعة"
                  : "تعديل بيانات العقار"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              يمكنك تحديث التفاصيل والسعر والوصف، ثم التراجع كمسودة أو إعادة الإرسال للإدارة.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Administration Rejection Reason Notice (If Rejected) */}
        {isRejected && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-1.5 text-rose-900 text-xs">
            <div className="flex items-center gap-2 font-black text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>سبب عدم الموافقة من إدارة المنصة:</span>
            </div>
            <p className="text-rose-700 leading-relaxed font-medium pr-6">
              {property.moderationNotes || "يرجى مراجعة المواصفات والأسعار والعناوين وإعادة تقديم الإعلان."}
            </p>
            <div className="text-[11px] text-rose-600/80 pr-6 pt-1">
              قم بتعديل النقاط المذكورة أدناه ثم اضغط <strong>«حفظ وإعادة الإرسال للإدارة»</strong> للتدقيق والاعتماد.
            </div>
          </div>
        )}

        {/* Pending Review Notice */}
        {isPending && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 text-xs">
            <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">العقار مسجل حالياً في «سجل المشاريع المقيدة»:</span>
              <p className="text-amber-800 leading-relaxed">
                إذا قمت بحفظ التعديلات كمسودة خاصة، سيخرج العقار فوراً من سجل المشاريع المقيدة ويتراجع لحسابك كمسودة سرية.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4 text-xs font-medium">
          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              <span>عنوان الإعلان:</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: شقة للبيع بموقع متميز وسط ميت غمر..."
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>السعر المطلوب (ج.م):</span>
              </label>
              <input
                type="number"
                min={1}
                max={100_000_000}
                value={price}
                onChange={(e) =>
                  setPrice(
                    e.target.value
                      ? Math.min(100_000_000, Math.max(1, Number(e.target.value)))
                      : ""
                  )
                }
                placeholder="مثال: 1500000"
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-brand-600" />
                <span>المساحة بالمتر المربع:</span>
              </label>
              <input
                type="number"
                value={areaSqM}
                onChange={(e) => setAreaSqM(e.target.value)}
                placeholder="مثال: 140"
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              <span>تفاصيل العنوان والشارع:</span>
            </label>
            <input
              type="text"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder="مثال: شارع بورسعيد، بجوار ميدان المحطة، ميت غمر..."
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>الوصف التفصيلي والمواصفات:</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب مواصفات العقار، التقسيم الداخلي، التشطيب، والمرافق بالتفصيل..."
              className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 leading-relaxed font-normal"
            />
          </div>
        </div>

        {/* Dual Actions Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs transition"
          >
            إلغاء
          </button>

          {/* Option 1: Retract & Save as Draft */}
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={() => handleSave("draft")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {savingAction === "draft" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>حفظ وتراجع كمسودة خاصة</span>
          </button>

          {/* Option 2: Save and Re-submit to Admin Restricted Registry */}
          <button
            type="button"
            disabled={savingAction !== null}
            onClick={() => handleSave("pending_review")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {savingAction === "pending_review" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>حفظ وإعادة الإرسال للإدارة 🚀</span>
          </button>
        </div>
      </div>
    </div>
  );
}
