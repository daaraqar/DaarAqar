"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";
import GeminiBotPanel from "./GeminiBotPanel";
import {
  Users,
  Phone,
  Building2,
  Briefcase,
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Edit3,
  UserRound,
  X,
  MapPin,
  Wallet,
  Ruler,
  BadgeCheck,
  CircleDashed,
  Bot,
  SlidersHorizontal,
} from "lucide-react";

interface ClientRecord {
  id: string;
  type: "client" | "broker";
  name: string;
  phone: string;
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
  isVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

type RecordTypeFilter = "all" | "client" | "broker";
type TransactionFilter = "all" | "sale" | "rent";

interface FilterState {
  category: string;
  location: string;
  transaction: TransactionFilter;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_FILTERS: FilterState = {
  category: "",
  location: "",
  transaction: "all",
  minPrice: "",
  maxPrice: "",
};

interface FormState {
  open: boolean;
  editingId: string | null;
  type: "client" | "broker";
  name: string;
  phone: string;
  requestedProperty: string;
  requestedCategory: string;
  requestedArea: string;
  requestedPriceRange: string;
  requestedLocation: string;
  availableListings: string;
  listingsCount: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  open: false,
  editingId: null,
  type: "client",
  name: "",
  phone: "",
  requestedProperty: "",
  requestedCategory: "",
  requestedArea: "",
  requestedPriceRange: "",
  requestedLocation: "",
  availableListings: "",
  listingsCount: "",
  notes: "",
};

const CATEGORY_OPTIONS = [
  "شقة",
  "فيلا",
  "دوبلكس",
  "أرض",
  "محل تجاري",
  "مكتب إداري",
  "عيادة",
  "استوديو",
  "شاليه",
  "تاون هاوس",
];

export default function AdminCrmTab() {
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RecordTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);
  const [botPanelOpen, setBotPanelOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/crm", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error("Failed to fetch CRM records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const openCreate = (type: "client" | "broker") => {
    setForm({ ...EMPTY_FORM, open: true, type });
    setFeedback(null);
  };

  const openEdit = (record: ClientRecord) => {
    setForm({
      open: true,
      editingId: record.id,
      type: record.type,
      name: record.name,
      phone: record.phone,
      requestedProperty: record.requestedProperty || "",
      requestedCategory: record.requestedCategory || "",
      requestedArea: record.requestedArea ? String(record.requestedArea) : "",
      requestedPriceRange: record.requestedPriceRange || "",
      requestedLocation: record.requestedLocation || "",
      availableListings: record.availableListings || "",
      listingsCount: record.listingsCount ? String(record.listingsCount) : "",
      notes: record.notes || "",
    });
    setFeedback(null);
  };

  // Toggle مؤكد / غير مؤكد — optimistic UI with revert on failure
  const handleToggleVerified = async (record: ClientRecord) => {
    const next = !record.isVerified;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? { ...r, isVerified: next, verifiedBy: next ? "أنت" : undefined, verifiedAt: next ? new Date().toISOString() : undefined }
          : r
      )
    );
    try {
      const res = await apiFetch("/api/admin/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, isVerified: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "فشل تحديث حالة التأكيد");
      }
      const data = await res.json();
      if (data.record) {
        setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, ...data.record } : r)));
      }
      setFeedback({ type: "success", text: next ? `تم تأكيد سجل "${record.name}"` : `تم إلغاء تأكيد سجل "${record.name}"` });
    } catch (error) {
      // Revert optimistic change
      setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, isVerified: record.isVerified } : r)));
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "فشل تحديث حالة التأكيد" });
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setFeedback({ type: "error", text: "يرجى إدخال اسم صحيح (حرفان على الأقل)" });
      return;
    }
    const phoneDigits = form.phone.replace(/[\s-]/g, "");
    if (!/^(\+?2)?01[0125][0-9]{8}$/.test(phoneDigits)) {
      setFeedback({ type: "error", text: "رقم الهاتف غير صالح — مثال: 01012345678" });
      return;
    }
    if (form.type === "client" && !form.requestedProperty.trim() && !form.requestedCategory.trim()) {
      setFeedback({ type: "error", text: "أدخل العقار المطلوب أو التصنيف المطلوب للعميل" });
      return;
    }
    if (form.type === "broker" && !form.availableListings.trim()) {
      setFeedback({ type: "error", text: "أدخل العروض المتاحة مع السمسار" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        name: form.name.trim(),
        phone: phoneDigits,
        notes: form.notes.trim() || undefined,
      };
      if (form.type === "client") {
        payload.requestedProperty = form.requestedProperty.trim() || undefined;
        payload.requestedCategory = form.requestedCategory.trim() || undefined;
        payload.requestedArea = form.requestedArea ? Number(form.requestedArea) : undefined;
        payload.requestedPriceRange = form.requestedPriceRange.trim() || undefined;
        payload.requestedLocation = form.requestedLocation.trim() || undefined;
      } else {
        payload.availableListings = form.availableListings.trim();
        payload.listingsCount = form.listingsCount ? Number(form.listingsCount) : undefined;
      }

      const res = await apiFetch("/api/admin/crm", {
        method: form.editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.editingId ? { id: form.editingId, ...payload } : payload),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: form.editingId ? "تم تحديث السجل بنجاح!" : `تم حفظ ${form.type === "client" ? "العميل" : "السمسار"} بنجاح!`,
        });
        setForm(EMPTY_FORM);
        fetchRecords();
      } else {
        setFeedback({ type: "error", text: data.error || "فشل حفظ السجل" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء حفظ السجل" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await apiFetch(`/api/admin/crm?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setFeedback({ type: "success", text: `تم حذف سجل "${deleteTarget.name}" بنجاح.` });
        setDeleteTarget(null);
        fetchRecords();
      } else {
        const d = await res.json();
        setFeedback({ type: "error", text: d.error || "فشل حذف السجل" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء الحذف" });
    }
  };

  const activeFilterCount =
    (filters.category ? 1 : 0) +
    (filters.location ? 1 : 0) +
    (filters.transaction !== "all" ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0);

  // الفلترة المتقدمة — حسب المنطقة والتصنيف والسعر ونوع الصفقة
  // ملاحظة: الفلترة السعرية تستخدم السعر الرقمي المستخرج بالذكاء الاصطناعي،
  // وإن لم يوجد نستخرج رقمًا من النص المكتوب يدوياً كحل بديل.
  const recordPrice = (r: ClientRecord): number | null => {
    if (typeof r.priceMax === "number" && r.priceMax > 0) return r.priceMax;
    if (typeof r.priceMin === "number" && r.priceMin > 0) return r.priceMin;
    const m = (r.requestedPriceRange || "").match(/([\d,\.]+)\s*(ألف|مليون|مليار|جنيه|EGP|ج)?/i);
    if (m) {
      const n = Number(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n) || n <= 0) return null;
      const unit = (m[2] || "").toLowerCase();
      if (unit.includes("ألف")) return n * 1000;
      if (unit.includes("مليون")) return n * 1_000_000;
      if (unit.includes("مليار")) return n * 1_000_000_000;
      return n;
    }
    return null;
  };

  const filtered = records.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (filters.category && (r.requestedCategory || "") !== filters.category) return false;
    if (filters.transaction !== "all" && (r.transactionType || "sale") !== filters.transaction) return false;
    if (filters.location && !(r.requestedLocation || "").includes(filters.location)) return false;
    if (filters.minPrice || filters.maxPrice) {
      const p = recordPrice(r);
      if (p === null) return false;
      if (filters.minPrice && p < Number(filters.minPrice)) return false;
      if (filters.maxPrice && p > Number(filters.maxPrice)) return false;
    }
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(s) ||
      r.phone.includes(s) ||
      (r.requestedProperty || "").toLowerCase().includes(s) ||
      (r.availableListings || "").toLowerCase().includes(s)
    );
  });

  const clientsCount = records.filter((r) => r.type === "client").length;
  const brokersCount = records.filter((r) => r.type === "broker").length;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">سجلات العملاء والسماسرة</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            قاعدة بيانات داخلية لإدارة بيانات العملاء وعروض السماسرة داخل شركة الإدارة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer hover:shadow-xs active:scale-95"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>
          <button
            onClick={() => setBotPanelOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="تحليل منشور تواصل اجتماعي بالذكاء الاصطناعي وإنشاء سجل"
          >
            <Bot className="w-4 h-4" />
            <span>بوت المنشورات ✨</span>
          </button>
          <button
            onClick={() => openCreate("client")}
            className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>عميل جديد</span>
          </button>
          <button
            onClick={() => openCreate("broker")}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>سمسار جديد</span>
          </button>
        </div>
      </div>

      {/* Stats + filter tabs */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => setTypeFilter("all")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${typeFilter === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${typeFilter === "all" ? "text-slate-200" : "text-slate-500"}`}>
              إجمالي السجلات
            </span>
            <Users className={`w-3.5 h-3.5 ${typeFilter === "all" ? "text-white" : "text-slate-400"}`} />
          </div>
          <span className="text-xl sm:text-2xl font-black">{records.length}</span>
        </button>
        <button
          onClick={() => setTypeFilter("client")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${typeFilter === "client"
              ? "bg-brand-600 text-white border-brand-600 shadow-md"
              : "bg-white text-brand-950 border-brand-200 hover:border-brand-300"
            }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${typeFilter === "client" ? "text-brand-100" : "text-brand-800"}`}>
              العملاء
            </span>
            <UserRound className={`w-3.5 h-3.5 ${typeFilter === "client" ? "text-white" : "text-brand-600"}`} />
          </div>
          <span className="text-xl sm:text-2xl font-black">{clientsCount}</span>
        </button>
        <button
          onClick={() => setTypeFilter("broker")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${typeFilter === "broker"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
              : "bg-white text-indigo-950 border-indigo-200 hover:border-indigo-300"
            }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${typeFilter === "broker" ? "text-indigo-100" : "text-indigo-800"}`}>
              السماسرة
            </span>
            <Briefcase className={`w-3.5 h-3.5 ${typeFilter === "broker" ? "text-white" : "text-indigo-600"}`} />
          </div>
          <span className="text-xl sm:text-2xl font-black">{brokersCount}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف أو العقار المطلوب..."
          className="w-full pr-10 pl-24 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
        />
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
            showFilters || activeFilterCount > 0
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          title="فلترة متقدمة — المنطقة والتصنيف والسعر ونوع الصفقة"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          فلترة
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-white text-indigo-700 text-[9px] flex items-center justify-center font-black">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/40 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              فلترة السجلات المجمّعة — حسب المنطقة والتصنيف والسعر ونوع الصفقة
            </span>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              مسح الفلاتر ↺
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1">التصنيف</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="">الكل</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1">المنطقة</label>
              <input
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="مثال: ميت غمر"
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1">نوع الصفقة</label>
              <select
                value={filters.transaction}
                onChange={(e) => setFilters({ ...filters, transaction: e.target.value as TransactionFilter })}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="all">الكل</option>
                <option value="sale">بيع</option>
                <option value="rent">إيجار</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1">أدنى سعر (جنيه)</label>
              <input
                type="number"
                value={filters.minPrice}
                onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                placeholder="مثال: 500000"
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1">أقصى سعر (جنيه)</label>
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                placeholder="مثال: 1500000"
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
          <p className="text-[10px] text-indigo-700/70 font-bold">
            الفلترة السعرية تعمل على السجلات التي استخرج البوت سعرها رقمياً — سجلات البوت تحفظها تلقائياً.
          </p>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border ${feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
            }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Records list */}
      {loading ? (
        <div className="py-16 text-center text-xs font-bold text-slate-400">جاري تحميل السجلات...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs font-bold text-slate-500">لا توجد سجلات مطابقة — أضف أول عميل أو سمسار من الأعلى.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${record.type === "client" ? "bg-brand-50 text-brand-600" : "bg-indigo-50 text-indigo-600"
                      }`}
                  >
                    {record.type === "client" ? <UserRound className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">{record.name}</h3>
                    <span
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${record.type === "client"
                          ? "bg-brand-50 text-brand-700"
                          : "bg-indigo-50 text-indigo-700"
                        }`}
                    >
                      {record.type === "client" ? "عميل" : "سمسار"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleVerified(record)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      record.isVerified
                        ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                    }`}
                    title={record.isVerified ? "مؤكد — اضغط لإلغاء التأكيد" : "غير مؤكد — اضغط للتأكيد"}
                  >
                    {record.isVerified ? <BadgeCheck className="w-4 h-4" /> : <CircleDashed className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(record)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="تعديل السجل"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(record)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title="حذف السجل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <a
                href={`tel:${record.phone}`}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-brand-600 transition-colors w-fit"
                dir="ltr"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{record.phone}</span>
              </a>

              {/* Verification status badge */}
              <div>
                {record.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <BadgeCheck className="w-3 h-3" />
                    مؤكد
                    {record.verifiedBy && <span className="font-bold opacity-70">• {record.verifiedBy}</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                    <CircleDashed className="w-3 h-3" />
                    غير مؤكد
                  </span>
                )}
              </div>

              {record.type === "client" ? (
                <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  {record.requestedProperty && (
                    <p className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">العقار المطلوب: {record.requestedProperty}</span>
                    </p>
                  )}
                  {record.requestedCategory && (
                    <p className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>التصنيف: {record.requestedCategory}</span>
                    </p>
                  )}
                  {record.requestedArea ? (
                    <p className="flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>المساحة: {record.requestedArea} م²</span>
                    </p>
                  ) : null}
                  {record.requestedPriceRange && (
                    <p className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        الميزانية: {record.requestedPriceRange}
                        {record.transactionType ? (
                          <span className={`mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${record.transactionType === "rent" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {record.transactionType === "rent" ? "إيجار" : "بيع"}
                          </span>
                        ) : null}
                      </span>
                    </p>
                  )}
                  {record.requestedLocation && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>الموقع المطلوب: {record.requestedLocation}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <p className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>العروض المتاحة: {record.availableListings}</span>
                  </p>
                  {record.listingsCount ? (
                    <p className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>عدد الوحدات: {record.listingsCount}</span>
                    </p>
                  ) : null}
                </div>
              )}

              {record.notes && (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5 leading-relaxed border border-slate-100">
                  {record.notes}
                </p>
              )}

              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                أُضيف بواسطة {record.createdBy || "الإدارة"} • {formatDate(record.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {form.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">
                {form.editingId ? "تعديل السجل" : form.type === "client" ? "إضافة عميل جديد" : "إضافة سمسار جديد"}
              </h2>
              <button
                onClick={() => setForm(EMPTY_FORM)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type toggle (only when creating) */}
            {!form.editingId && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setForm({ ...form, type: "client" })}
                  className={`p-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${form.type === "client"
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
                    }`}
                >
                  <UserRound className="w-4 h-4" />
                  <span>عميل</span>
                </button>
                <button
                  onClick={() => setForm({ ...form, type: "broker" })}
                  className={`p-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${form.type === "broker"
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span>سمسار</span>
                </button>
              </div>
            )}

            {/* Common fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">الاسم *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="الاسم الكامل"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">رقم الهاتف *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01012345678"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-left focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>

              {form.type === "client" ? (
                <>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">العقار المطلوب *</label>
                    <input
                      value={form.requestedProperty}
                      onChange={(e) => setForm({ ...form, requestedProperty: e.target.value })}
                      placeholder="مثال: شقة 3 غرف بجوار مسجد النور"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">التصنيف</label>
                      <select
                        value={form.requestedCategory}
                        onChange={(e) => setForm({ ...form, requestedCategory: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        <option value="">— اختر —</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">المساحة (م²)</label>
                      <input
                        value={form.requestedArea}
                        onChange={(e) => setForm({ ...form, requestedArea: e.target.value.replace(/[^0-9]/g, "") })}
                        placeholder="120"
                        dir="ltr"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-left focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">الميزانية</label>
                      <input
                        value={form.requestedPriceRange}
                        onChange={(e) => setForm({ ...form, requestedPriceRange: e.target.value })}
                        placeholder="مثال: 500 - 700 ألف"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">الموقع المطلوب</label>
                      <input
                        value={form.requestedLocation}
                        onChange={(e) => setForm({ ...form, requestedLocation: e.target.value })}
                        placeholder="مثال: حي الجامعة أو شارع البحر"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">العروض المتاحة *</label>
                    <textarea
                      value={form.availableListings}
                      onChange={(e) => setForm({ ...form, availableListings: e.target.value })}
                      placeholder="مثال: 3 شقق بحي الجامعة، فيلا بكمبانى، أرض زراعية بطريق القاهرة"
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">عدد الوحدات المتاحة</label>
                    <input
                      value={form.listingsCount}
                      onChange={(e) => setForm({ ...form, listingsCount: e.target.value.replace(/[^0-9]/g, "") })}
                      placeholder="5"
                      dir="ltr"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-left focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية عن العميل أو السمسار..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? "جاري الحفظ..." : form.editingId ? "حفظ التعديلات" : "حفظ السجل"}
              </button>
              <button
                onClick={() => setForm(EMPTY_FORM)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">تأكيد حذف السجل</h3>
                <p className="text-xs text-slate-500">
                  سيتم حذف سجل &quot;{deleteTarget.name}&quot; نهائياً. هذا الإجراء لا يمكن التراجع عنه.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Social Post Analyzer Bot */}
      <GeminiBotPanel
        open={botPanelOpen}
        onClose={() => setBotPanelOpen(false)}
        onSaved={fetchRecords}
      />
    </div>
  );
}
