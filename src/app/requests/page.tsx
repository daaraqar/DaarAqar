"use client";

import React, { useState, useEffect } from "react";
import { ReversePropertyRequest } from "@/lib/types/smartFeatures";
import {
  Sparkles,
  Search,
  Plus,
  Building2,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Check,
  Send,
  Loader2,
  DollarSign,
  Maximize2,
} from "lucide-react";

export default function ReverseRequestsPage() {
  const [requests, setRequests] = useState<ReversePropertyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [districtNameAr, setDistrictNameAr] = useState("ميت غمر");
  const [minBudget, setMinBudget] = useState(4000000);
  const [maxBudget, setMaxBudget] = useState(6000000);
  const [minArea, setMinArea] = useState(150);
  const [bedrooms, setBedrooms] = useState(3);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smart-features/reverse-requests");
      const data = await res.json();
      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !userName || !userPhone) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/smart-features/reverse-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          districtNameAr,
          minBudget,
          maxBudget,
          minArea,
          bedrooms,
          userName,
          userPhone,
          notes,
          category: "apartment",
          transactionType: "sale",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setSuccessToast("تم نشر طلبك العقاري بنجاح! سيتنافس الوسطاء والملاك لتوفير أفضل العروض.");
        fetchRequests();
        setTimeout(() => setSuccessToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              الميزة رقم 24: سوق «عقار مطلوب» العكسي
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">طلبات المشترين الجادين (Reverse Marketplace)</h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
            لم تجد طلبك بين العقارات المعروضة؟ انشر مواصفاتك وميزانيتك بدقة، ودع الوسطاء والملاك يتنافسون لتقديم أفضل العروض المباشرة.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>أضف طلبك العقاري الآن</span>
        </button>
      </div>

      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Requests Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs text-slate-500">جاري تحميل طلبات المشترين...</span>
        </div>
      ) : requests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-emerald-500/50 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-black">
                      مطلوب للشراء
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(req.createdAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">{req.title}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                  {req.offersCount} عروض مقدمة
                </span>
              </div>

              {/* Specs pill row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">المنطقة والحي</span>
                  <strong className="text-slate-800">{req.districtNameAr}</strong>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block mb-0.5">الميزانية المستهدفة</span>
                  <strong className="text-emerald-700 font-bold">
                    {req.minBudget.toLocaleString("ar-EG")} - {req.maxBudget.toLocaleString("ar-EG")} ج.م
                  </strong>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block mb-0.5">المساحة والغرف</span>
                  <strong className="text-slate-800">{req.minArea} م² • {req.bedrooms || 3} غرف</strong>
                </div>
              </div>

              {req.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                  💬 {req.notes}
                </p>
              )}

              {/* Action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  صاحب الطلب: <strong className="text-slate-700">{req.userName}</strong>
                </span>
                <a
                  href={`https://wa.me/${req.userPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                    `مرحباً ${req.userName}، تواصلت معك من منصة دار العقار بخصوص طلبك: ${req.title}. لدي عقار مطابق لمواصفاتك.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تقديم عرضك الآن</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Modal to Post Request */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">نشر طلب عقاري جديد</h3>
            <p className="text-xs text-slate-500">
              حدد رغباتك وسيتواصل معك الوسطاء والملاك بعروض حصرية.
            </p>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">عنوان الطلب</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مطلوب شقة بحري 3 غرف دور ثاني في النرجس"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">المنطقة أو الحي</label>
                  <input
                    type="text"
                    required
                    value={districtNameAr}
                    onChange={(e) => setDistrictNameAr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">المساحة المطلوبة (م²)</label>
                  <input
                    type="number"
                    value={minArea}
                    onChange={(e) => setMinArea(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">أدنى ميزانية (ج.م)</label>
                  <input
                    type="number"
                    value={minBudget}
                    onChange={(e) => setMinBudget(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">أقصى ميزانية (ج.م)</label>
                  <input
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسمك الكريم</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: د. حسام"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">رقم الهاتف / واتساب</label>
                  <input
                    type="tel"
                    required
                    placeholder="010xxxxxxxx"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ملاحظات وشروط إضافية</label>
                <textarea
                  rows={3}
                  placeholder="جاهز للكاش فوراً، يشترط وجود مصعد، يفضل استلام فوري..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-600"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition-colors cursor-pointer flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>نشر الطلب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
