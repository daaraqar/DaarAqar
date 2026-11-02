"use client";

import React, { useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import {
  Bot,
  X,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Save,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  UploadCloud,
  Phone,
  Users,
  Tag,
  Wallet,
  Copy,
} from "lucide-react";

interface AnalyzeDraft {
  type: "client" | "broker";
  name: string;
  phone?: string;
  requestedProperty?: string;
  requestedCategory?: string;
  requestedArea?: number;
  requestedPriceRange?: string;
  priceMin?: number;
  priceMax?: number;
  transactionType?: "sale" | "rent";
  requestedLocation?: string;
  availableListings?: string;
  listingsCount?: number;
  notes?: string;
  sourceType?: "manual" | "bot" | "link";
  sourceUrl?: string;
  isVerified: boolean;
  createdBy: string;
}

interface ExtractedEntry {
  name: string;
  phone?: string;
  role?: string;
  comment?: string;
}

interface AnalyzeResult {
  intent: string;
  confidence: number;
  priceMin?: number;
  priceMax?: number;
  transactionType?: "sale" | "rent";
  reasoning?: string;
  missingFields?: string[];
  /** أسماء وأرقام مستخرجة من صورة المنشور + صورة التعليقات */
  people: ExtractedEntry[];
  /** إجمالي التعليقات المكتشفة */
  commentsFound?: number;
  /** صفوف العقار المكتشفة داخل الصورة */
  propertiesFound?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS = [
  "شقة",
  "فيلا",
  "دوبلكس",
  "بنتهاوس",
  "رووف",
  "استوديو",
  "تاون هاوس",
  "توين هاوس",
  "شاليه",
  "أرض",
  "محل",
  "مكتب",
  "عيادة",
  "مخزن",
  "مصنع",
  "عمارة",
  "قطعة أرض",
  "أخرى",
];

export default function GeminiBotPanel({ open, onClose, onSaved }: Props) {
  const [postImage, setPostImage] = useState<string | null>(null);
  const [commentsImage, setCommentsImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOverPost, setDragOverPost] = useState(false);
  const [dragOverComments, setDragOverComments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [draft, setDraft] = useState<AnalyzeDraft | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const postInputRef = useRef<HTMLInputElement>(null);
  const commentsInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setPostImage(null);
    setCommentsImage(null);
    setResult(null);
    setDraft(null);
    setError(null);
  };

  const handleImagePick = (file: File | undefined, target: "post" | "comments") => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("الملف المرفق ليس صورة — اسحب ملف صورة فقط (PNG / JPG / WEBP)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("حجم الصورة كبير — الحد الأقصى 4 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (target === "post") setPostImage(dataUrl);
      else setCommentsImage(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e: React.DragEvent, target: "post" | "comments") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPost(false);
    setDragOverComments(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImagePick(file, target);
  };

  const analyze = async () => {
    if (!postImage && !commentsImage) {
      setError("أرفق أو اسحب صورة المنشور أولاً — ويفضل إرفاق صورة التعليقات أيضاً");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setResult(null);
    setDraft(null);
    try {
      const res = await apiFetch("/api/admin/crm/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postImage: postImage || undefined,
          postImageMimeType: postImage?.startsWith("data:image/png") ? "image/png" : "image/jpeg",
          commentsImage: commentsImage || undefined,
          commentsImageMimeType: commentsImage?.startsWith("data:image/png") ? "image/png" : "image/jpeg",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تحليل الصور");
      setResult(data.analysis);
      setDraft(data.draft || null);
      if (data.duplicateOf) {
        setError(`⚠️ رقم الهاتف موجود مسبقاً في السجل: ${data.duplicateOf}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تحليل الصور");
    } finally {
      setAnalyzing(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل حفظ السجل");
      onSaved();
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const field = (
    label: string,
    value: string | number | undefined,
    onChange: (v: string) => void,
    opts?: { type?: string; dir?: string }
  ) => (
    <label className="block">
      <span className="block text-[10px] font-black text-slate-600 mb-1">{label}</span>
      <input
        type={opts?.type || "text"}
        dir={opts?.dir}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
      />
    </label>
  );

  const imageSlot = (
    target: "post" | "comments",
    image: string | null,
    dragOver: boolean,
    setDragOver: (v: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement | any>,
    label: string,
    hint: string
  ) => (
    <div>
      <span className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 mb-1">
        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
        {label}
      </span>
      {image ? (
        <div className="p-2 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={label} className="h-20 w-32 object-cover rounded-lg border border-slate-200" />
          <div className="flex-1 text-[10px] text-slate-600 font-bold">تم إرفاق الصورة ✓</div>
          <button
            type="button"
            onClick={() => (target === "post" ? setPostImage(null) : setCommentsImage(null))}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 transition-colors cursor-pointer"
            title="إزالة الصورة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => handleImageDrop(e, target)}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-all ${dragOver
              ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
              : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40"
            }`}
        >
          <UploadCloud className={`w-6 h-6 mx-auto mb-1 ${dragOver ? "text-indigo-600" : "text-slate-400"}`} />
          <p className="text-[11px] font-black text-slate-600">{hint}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">أو الصقها مباشرة بـ Ctrl+V (PNG / JPG / WEBP حتى 4MB)</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => handleImagePick(e.target.files?.[0], target)}
        className="hidden"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" dir="rtl">
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs animate-in fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onPaste={(e) => {
          const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
          if (item) {
            const file = item.getAsFile();
            if (file) {
              // أول صورة تُلصق → المنشور، الثانية → التعليقات
              handleImagePick(file, !postImage ? "post" : "comments");
            }
          }
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 p-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                بوت تحليل صور المنشورات
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                أرفق لقطة شاشة المنشور والتعليقات — يستخرج الأسماء والأرقام والتصنيفات تلقائياً
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {imageSlot(
            "post",
            postImage,
            dragOverPost,
            setDragOverPost,
            postInputRef,
            "صورة المنشور *",
            "اسحب لقطة شاشة المنشور وأفلتها هنا"
          )}

          {imageSlot(
            "comments",
            commentsImage,
            dragOverComments,
            setDragOverComments,
            commentsInputRef,
            "صورة التعليقات (اختيارية — لكنها مفيدة لاستخراج كل الأرقام)",
            "اسحب لقطة شاشة التعليقات وأفلتها هنا"
          )}

          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || (!postImage && !commentsImage)}
            className="w-full py-3 rounded-2xl bg-gradient-to-l from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري قراءة الصور واستخراج البيانات...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>تحليل الصور واستخراج البيانات ✨</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* نتيجة التحليل */}
          {result && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                  <Bot className="w-4 h-4" />
                  نتيجة تحليل الصور
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${result.confidence >= 0.75
                      ? "bg-emerald-100 text-emerald-800"
                      : result.confidence >= 0.45
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                >
                  ثقة {Math.round(result.confidence * 100)}%
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {result.intent} — {draft?.type === "client" ? "طلب بحث" : "عرض عقار"}
                </span>
                {(result.propertiesFound ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    🏠 {result.propertiesFound} عقار مكتشف
                  </span>
                )}
                {(result.commentsFound ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 flex items-center gap-1">
                    💬 {result.commentsFound} تعليق
                  </span>
                )}
              </div>

              {result.reasoning && (
                <p className="text-[11px] text-indigo-800/80 leading-relaxed">💡 {result.reasoning}</p>
              )}

              {(result.priceMin || result.priceMax) && (
                <p className="text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  السعر المستخرج: {result.priceMin?.toLocaleString("ar-EG")}
                  {result.priceMax && result.priceMax !== result.priceMin ? ` — ${result.priceMax.toLocaleString("ar-EG")}` : ""} جنيه
                  {result.transactionType ? (result.transactionType === "rent" ? " (إيجار)" : " (بيع)") : ""}
                </p>
              )}

              {/* الأشخاص المكتشفون — أسماء وأرقام من المنشور والتعليقات */}
              {result.people?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    الأشخاص والأرقام المكتشفة ({result.people.length})
                  </h5>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {result.people.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-100"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-slate-800 truncate flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            {p.name}
                            {p.role && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {p.role}
                              </span>
                            )}
                          </p>
                          {p.phone && (
                            <p className="text-[10px] font-bold text-slate-600 flex items-center gap-1" dir="ltr">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {p.phone}
                            </p>
                          )}
                          {p.comment && (
                            <p className="text-[9px] text-slate-400 truncate">💬 {p.comment}</p>
                          )}
                        </div>
                        {p.phone && (
                          <button
                            type="button"
                            onClick={() => void copyPhone(p.phone!)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                            title="نسخ الرقم"
                          >
                            {copiedPhone === p.phone ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.missingFields && result.missingFields.length > 0 && (
                <p className="text-[11px] text-amber-800 font-bold">
                  ⚠️ بيانات ناقصة يُفضل إكمالها: {result.missingFields.join("، ")}
                </p>
              )}
            </div>
          )}

          {/* مراجعة السجل قبل الحفظ */}
          {draft && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-800">مراجعة السجل قبل الحفظ (قابل للتعديل)</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                  سيُحفظ "غير مؤكد" ⏳
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="block text-[10px] font-black text-slate-600 mb-1">النوع</span>
                  <select
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value as "client" | "broker" })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="client">طلب بحث (عميل)</option>
                    <option value="broker">عرض عقار (سمسار/معلن)</option>
                  </select>
                </label>
                {field("الاسم", draft.name, (v) => setDraft({ ...draft, name: v }))}
                {field("رقم الهاتف", draft.phone, (v) => setDraft({ ...draft, phone: v }), { dir: "ltr", type: "tel" })}
                <label className="block">
                  <span className="block text-[10px] font-black text-slate-600 mb-1">التصنيف</span>
                  <select
                    value={draft.requestedCategory || ""}
                    onChange={(e) => setDraft({ ...draft, requestedCategory: e.target.value || undefined })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="">— اختر التصنيف —</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                {field("المساحة (م²)", draft.requestedArea, (v) => setDraft({ ...draft, requestedArea: Number(v) || undefined }), { type: "number" })}
                {field("السعر", draft.requestedPriceRange, (v) => setDraft({ ...draft, requestedPriceRange: v }))}
                <label className="block">
                  <span className="block text-[10px] font-black text-slate-600 mb-1">نوع الصفقة (للفلترة)</span>
                  <select
                    value={draft.transactionType || ""}
                    onChange={(e) => setDraft({ ...draft, transactionType: (e.target.value || undefined) as "sale" | "rent" | undefined })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="">— غير محدد —</option>
                    <option value="sale">بيع</option>
                    <option value="rent">إيجار</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="block text-[10px] font-black text-slate-600 mb-1">الموقع</span>
                  <input
                    value={draft.requestedLocation ?? ""}
                    onChange={(e) => setDraft({ ...draft, requestedLocation: e.target.value })}
                    placeholder="استخرج من الصورة تلقائياً — عدّله إن لزم"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-[10px] font-black text-slate-600 mb-1">
                  {draft.type === "client" ? "العقار المطلوب" : "وصف العرض المتاح"}
                </span>
                <textarea
                  rows={3}
                  value={draft.type === "client" ? draft.requestedProperty ?? "" : draft.availableListings ?? ""}
                  onChange={(e) =>
                    setDraft(
                      draft.type === "client"
                        ? { ...draft, requestedProperty: e.target.value }
                        : { ...draft, availableListings: e.target.value }
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-black text-slate-600 mb-1">ملاحظات البوت (تُحفظ تلقائياً)</span>
                <textarea
                  rows={2}
                  readOnly
                  value={draft.notes ?? ""}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-[11px] text-slate-600 leading-relaxed resize-none"
                />
              </label>

              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ كسجل غير مؤكد ⏳</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
