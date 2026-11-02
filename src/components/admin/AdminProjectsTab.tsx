"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { CATEGORY_LABELS_AR } from "@/lib/db/types";
import type { ProjectAuditEntry } from "@/lib/db/store";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  MapPin,
  User,
  Tag,
  X,
  ExternalLink,
  Star,
  Edit3,
  ChevronDown,
  History,
  FileClock,
} from "lucide-react";

export interface PropertyItem {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  status: "pending_review" | "pending" | "under_review" | "published" | "active" | "rejected" | "suspended" | "draft" | "sold" | "rented" | string;
  price: number;
  category: string;
  transactionType: string;
  cityId?: string;
  cityName?: string;
  districtName?: string;
  advertiserId?: string;
  advertiserName?: string;
  advertiserPhone?: string;
  images?: Array<string | { url: string }>;
  moderationReason?: string;
  moderationNotes?: string;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

type ProjectSection = "all" | "pending" | "active" | "sold" | "rejected";

export default function AdminProjectsTab({
  canReview = true,
  canDelete = true,
}: {
  canReview?: boolean;
  canDelete?: boolean;
} = {}) {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ProjectSection>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Status helper functions
  const isPendingStatus = (s?: string) => s === "pending_review" || s === "pending" || s === "under_review";
  const isActiveStatus = (s?: string) => s === "published" || s === "active";
  const isRejectedStatus = (s?: string) => s === "rejected";
  const isSuspendedStatus = (s?: string) => s === "suspended";
  const isSoldOrRented = (s?: string) => s === "sold" || s === "rented";
  const getStatusLabel = (status?: string) => {
    if (isPendingStatus(status)) return "قيد المراجعة";
    if (isActiveStatus(status)) return "منشور";
    if (isRejectedStatus(status)) return "مرفوض";
    if (isSuspendedStatus(status)) return "معلق";
    if (isSoldOrRented(status)) return status === "sold" ? "تم البيع" : "تم التأجير";
    if (status === "draft") return "مسودة";
    return status || "غير محدد";
  };
  const getLifecycleStep = (status?: string) => {
    if (isPendingStatus(status) || isRejectedStatus(status)) return 1;
    if (isActiveStatus(status) || isSuspendedStatus(status) || isSoldOrRented(status)) return 2;
    return status === "draft" ? -1 : 0;
  };
  const formatElapsed = (value?: string) => {
    if (!value) return "وقت الإرسال غير متاح";
    const elapsed = Date.now() - new Date(value).getTime();
    if (!Number.isFinite(elapsed) || elapsed < 0) return "تاريخ غير صالح";
    const minutes = Math.floor(elapsed / (60 * 1000));
    const hours = Math.floor(elapsed / (60 * 60 * 1000));
    if (hours < 1) return `منذ ${Math.max(1, minutes)} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  // Modals state
  const [selectedProject, setSelectedProject] = useState<PropertyItem | null>(null);
  const [auditModal, setAuditModal] = useState<{ open: boolean; property: PropertyItem | null; entries: ProjectAuditEntry[]; loading: boolean }>({
    open: false,
    property: null,
    entries: [],
    loading: false,
  });
  const [rejectModal, setRejectModal] = useState<{ open: boolean; property: PropertyItem | null; reason: string }>({
    open: false,
    property: null,
    reason: "",
  });
  const [suspendModal, setSuspendModal] = useState<{ open: boolean; property: PropertyItem | null; reason: string }>({
    open: false,
    property: null,
    reason: "",
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; property: PropertyItem | null }>({
    open: false,
    property: null,
  });
  const [editModal, setEditModal] = useState<{
    open: boolean;
    property: PropertyItem | null;
    title: string;
    price: number | string;
    category: string;
    transactionType: string;
    description: string;
  }>({
    open: false,
    property: null,
    title: "",
    price: 0,
    category: "apartment",
    transactionType: "sale",
    description: "",
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/properties?limit=200", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProperties(data.properties || []);
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  // 1. Approve & Activate (الموافقة والنشر والتفعيل الفوري)
  const handleApprove = async (prop: PropertyItem) => {
    setActionLoading(prop.id);
    setFeedback(null);
    try {
      const res = await apiFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: prop.id, decision: "approve", status: "active" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `تمت الموافقة على المشروع "${prop.title}" وتفعيله بنجاح!` });
        // Immediate reactive local state update
        setProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, status: "active" } : p))
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) => (prev ? { ...prev, status: "active" } : null));
        }
        // Background sync
        fetchProperties();
      } else {
        setFeedback({ type: "error", text: data.error || "فشلت الموافقة على المشروع" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء الموافقة" });
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Reject with reason (الرفض مع تسجيل السبب)
  const handleConfirmReject = async () => {
    if (!rejectModal.property || !rejectModal.reason.trim()) {
      alert("يرجى كتابة سبب الرفض لتوضيحه للمعلن");
      return;
    }
    const prop = rejectModal.property;
    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: prop.id,
          decision: "reject",
          reason: rejectModal.reason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `تم تسجيل رفض المشروع "${prop.title}".` });
        setProperties((prev) =>
          prev.map((p) =>
            p.id === prop.id
              ? { ...p, status: "rejected", moderationReason: rejectModal.reason, moderationNotes: rejectModal.reason }
              : p
          )
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) =>
            prev ? { ...prev, status: "rejected", moderationReason: rejectModal.reason, moderationNotes: rejectModal.reason } : null
          );
        }
        setRejectModal({ open: false, property: null, reason: "" });
      } else {
        setFeedback({ type: "error", text: data.error || "فشل تسجيل الرفض" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ أثناء تسجيل الرفض" });
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Suspend (تعليق مؤقت للمشاريع النشطة)
  const handleConfirmSuspend = async () => {
    if (!suspendModal.property) return;
    const prop = suspendModal.property;
    const reasonText = suspendModal.reason.trim() || "تم التعليق المؤقت بواسطة إدارة المنصة للمراجعة";

    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: prop.id,
          decision: "suspend",
          reason: reasonText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `تم تعليق المشروع "${prop.title}" مؤقتاً بنجاح.` });
        setProperties((prev) =>
          prev.map((p) =>
            p.id === prop.id
              ? { ...p, status: "suspended", moderationReason: reasonText, moderationNotes: reasonText }
              : p
          )
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) =>
            prev ? { ...prev, status: "suspended", moderationReason: reasonText, moderationNotes: reasonText } : null
          );
        }
        setSuspendModal({ open: false, property: null, reason: "" });
      } else {
        setFeedback({ type: "error", text: data.error || "فشل تعليق المشروع" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ أثناء تعليق المشروع" });
    } finally {
      setActionLoading(null);
    }
  };

  // 4. Restore to review (إعادة التنشيط أو الفتح للمراجعة)
  const handleRestore = async (prop: PropertyItem) => {
    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: prop.id, decision: "restore" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `تمت إعادة المشروع "${prop.title}" إلى قائمة قيد المراجعة.` });
        setProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, status: "pending_review" } : p))
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) => (prev ? { ...prev, status: "pending_review" } : null));
        }
      } else {
        setFeedback({ type: "error", text: data.error || "فشلت إعادة المشروع" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ أثناء إعادة المشروع" });
    } finally {
      setActionLoading(null);
    }
  };

  // 5. Delete (إزالة المشروع نهائياً)
  const handleConfirmDelete = async () => {
    if (!deleteModal.property) return;
    const prop = deleteModal.property;
    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/moderation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: prop.id,
          decision: "delete",
          reason: "إزالة المشروع بواسطة شركة الإدارة",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: `تمت إزالة المشروع "${prop.title}" نهائياً.` });
        setProperties((prev) => prev.filter((p) => p.id !== prop.id));
        if (selectedProject?.id === prop.id) {
          setSelectedProject(null);
        }
        setDeleteModal({ open: false, property: null });
      } else {
        setFeedback({ type: "error", text: data.error || "فشلت إزالة المشروع" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ أثناء إزالة المشروع" });
    } finally {
      setActionLoading(null);
    }
  };

  // 6. Toggle Featured (تمييز المشروع في الصفحة الرئيسية)
  const handleToggleFeatured = async (prop: PropertyItem) => {
    const nextVal = !prop.featured;
    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: prop.id, featured: nextVal }),
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: nextVal ? `تم تمييز المشروع "${prop.title}" بنجاح!` : `تم إلغاء تمييز المشروع "${prop.title}".`,
        });
        setProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, featured: nextVal } : p))
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) => (prev ? { ...prev, featured: nextVal } : null));
        }
      } else {
        const d = await res.json();
        setFeedback({ type: "error", text: d.error || "فشل تغيير حالة التمييز" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء تغيير حالة التمييز" });
    } finally {
      setActionLoading(null);
    }
  };

  // 7. Change Status (تغيير الحالة إلى تم البيع / تم التأجير / نشط)
  const handleChangeStatus = async (prop: PropertyItem, newStatus: string) => {
    if (
      newStatus === "sold" &&
      !confirm(`هل تؤكد إتمام بيع «${prop.title}»؟ سيختفي المشروع من العرض العام وينتقل إلى المشاريع المباعة.`)
    ) {
      return;
    }

    setActionLoading(prop.id);
    try {
      const res = await apiFetch("/api/admin/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: prop.id, status: newStatus }),
      });
      if (res.ok) {
        const label =
          newStatus === "sold"
            ? "تم البيع"
            : newStatus === "rented"
            ? "تم التأجير"
            : newStatus === "active"
            ? "نشط ومعروض"
            : newStatus;
        setFeedback({ type: "success", text: `تم تحديث حالة المشروع إلى (${label}) بنجاح.` });
        setProperties((prev) =>
          prev.map((p) => (p.id === prop.id ? { ...p, status: newStatus } : p))
        );
        if (selectedProject?.id === prop.id) {
          setSelectedProject((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } else {
        const d = await res.json();
        setFeedback({ type: "error", text: d.error || "فشل تغيير حالة المشروع" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء تغيير حالة المشروع" });
    } finally {
      setActionLoading(null);
    }
  };

  // 8. Save Edit (حفظ تعديلات بيانات المشروع)
  const handleSaveEdit = async () => {
    if (!editModal.property) return;
    const propId = editModal.property.id;
    setActionLoading(propId);
    try {
      const res = await apiFetch("/api/admin/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: propId,
          title: editModal.title,
          price: Number(editModal.price),
          category: editModal.category,
          transactionType: editModal.transactionType,
          description: editModal.description,
        }),
      });
      if (res.ok) {
        setFeedback({ type: "success", text: "تم تحديث بيانات ومواصفات المشروع بنجاح!" });
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propId
              ? {
                  ...p,
                  title: editModal.title,
                  price: Number(editModal.price),
                  category: editModal.category,
                  transactionType: editModal.transactionType,
                  description: editModal.description,
                }
              : p
          )
        );
        if (selectedProject?.id === propId) {
          setSelectedProject((prev) =>
            prev
              ? {
                  ...prev,
                  title: editModal.title,
                  price: Number(editModal.price),
                  category: editModal.category,
                  transactionType: editModal.transactionType,
                  description: editModal.description,
                }
              : null
          );
        }
        setEditModal({ open: false, property: null, title: "", price: 0, category: "", transactionType: "", description: "" });
      } else {
        const d = await res.json();
        setFeedback({ type: "error", text: d.error || "فشل حفظ التعديلات" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء حفظ التعديلات" });
    } finally {
      setActionLoading(null);
    }
  };

  // 9. Open project audit log (سجل المشروع الكامل)
  const openAuditLog = async (prop: PropertyItem) => {
    setAuditModal({ open: true, property: prop, entries: [], loading: true });
    try {
      const res = await apiFetch(`/api/admin/project-audit?projectId=${encodeURIComponent(prop.id)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setAuditModal({ open: true, property: prop, entries: data.entries || [], loading: false });
      } else {
        setAuditModal({ open: false, property: null, entries: [], loading: false });
        setFeedback({ type: "error", text: data.error || "فشل جلب سجل المشروع" });
      }
    } catch {
      setAuditModal({ open: false, property: null, entries: [], loading: false });
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء جلب سجل المشروع" });
    }
  };

  const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
    submit: { label: "إرسال للمراجعة", color: "bg-slate-100 text-slate-700" },
    approve: { label: "موافقة ونشر", color: "bg-emerald-50 text-emerald-700" },
    reject: { label: "رفض", color: "bg-rose-50 text-rose-700" },
    suspend: { label: "تعليق", color: "bg-amber-50 text-amber-700" },
    restore: { label: "إعادة للمراجعة", color: "bg-sky-50 text-sky-700" },
    delete: { label: "حذف نهائي", color: "bg-red-50 text-red-700" },
    edit: { label: "تعديل بيانات", color: "bg-indigo-50 text-indigo-700" },
    feature: { label: "تمييز/إلغاء تمييز", color: "bg-yellow-50 text-yellow-700" },
    status_change: { label: "تغيير حالة", color: "bg-purple-50 text-purple-700" },
  };

  const formatAuditDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  // Counters
  const countAll = properties.length;
  const countPending = properties.filter((p) => isPendingStatus(p.status)).length;
  const countActive = properties.filter((p) => isActiveStatus(p.status)).length;
  const countSold = properties.filter((p) => p.status === "sold").length;
  const countRejected = properties.filter((p) => isRejectedStatus(p.status) || isSuspendedStatus(p.status)).length;

  // Filtered list based on active section
  const sectionFiltered = properties.filter((p) => {
    if (activeSection === "pending") return isPendingStatus(p.status);
    if (activeSection === "active") return isActiveStatus(p.status);
    if (activeSection === "sold") return p.status === "sold";
    if (activeSection === "rejected") return isRejectedStatus(p.status) || isSuspendedStatus(p.status);
    return true; // "all"
  });

  // Search filter
  const displayed = sectionFiltered.filter((p) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      p.title?.toLowerCase().includes(s) ||
      p.cityName?.toLowerCase().includes(s) ||
      p.districtName?.toLowerCase().includes(s) ||
      p.advertiserName?.toLowerCase().includes(s) ||
      p.id?.toLowerCase().includes(s)
    );
  });

  const getFirstImage = (prop: PropertyItem) => {
    if (Array.isArray(prop.images) && prop.images.length > 0) {
      const img = prop.images[0];
      return typeof img === "string" ? img : (img as any).url;
    }
    return null;
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 1. Header with refresh button */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            لوحة الإشراف على المشاريع
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة كافة المشاريع، المراجعة الفورية، التمييز، التعديل، والتحكم بالحالات
          </p>
        </div>

        <button
          onClick={fetchProperties}
          disabled={loading}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer hover:shadow-xs active:scale-95"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          <span className="hidden sm:inline">تحديث</span>
        </button>
      </div>

      {/* 2. Interactive Status Filter Tabs (كروت الإحصائيات كفلاتر تبويب تفاعلية) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* بند 1: إجمالي المشاريع */}
        <button
          type="button"
          onClick={() => setActiveSection("all")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
            activeSection === "all"
              ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/30 scale-[1.01]"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${activeSection === "all" ? "text-slate-200" : "text-slate-500"}`}>
              إجمالي المشاريع
            </span>
            <Building2 className={`w-3.5 h-3.5 ${activeSection === "all" ? "text-white" : "text-slate-400"}`} />
          </div>
          <span className="text-xl sm:text-2xl font-black">{countAll}</span>
          {activeSection === "all" && (
            <span className="absolute bottom-1.5 left-2 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
              محدد
            </span>
          )}
        </button>

        {/* بند 2: مشاريع قيد الموافقة */}
        <button
          type="button"
          onClick={() => setActiveSection("pending")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
            activeSection === "pending"
              ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/30 scale-[1.01]"
              : "bg-white text-amber-950 border-amber-200 hover:border-amber-300 hover:bg-amber-50/40"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${activeSection === "pending" ? "text-amber-100" : "text-amber-800"}`}>
              مشاريع قيد الموافقة
            </span>
            <Clock className={`w-3.5 h-3.5 ${activeSection === "pending" ? "text-white" : "text-amber-600"}`} />
          </div>
          <span className={`text-xl sm:text-2xl font-black ${activeSection === "pending" ? "text-white" : "text-amber-700"}`}>
            {countPending}
          </span>
          {activeSection === "pending" && (
            <span className="absolute bottom-1.5 left-2 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
              محدد
            </span>
          )}
        </button>

        {/* بند 3: مشاريع نشطة */}
        <button
          type="button"
          onClick={() => setActiveSection("active")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
            activeSection === "active"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/30 scale-[1.01]"
              : "bg-white text-emerald-950 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50/40"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${activeSection === "active" ? "text-emerald-100" : "text-emerald-800"}`}>
              مشاريع نشطة
            </span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${activeSection === "active" ? "text-white" : "text-emerald-600"}`} />
          </div>
          <span className={`text-xl sm:text-2xl font-black ${activeSection === "active" ? "text-white" : "text-emerald-700"}`}>
            {countActive}
          </span>
          {activeSection === "active" && (
            <span className="absolute bottom-1.5 left-2 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
              محدد
            </span>
          )}
        </button>

        {/* المشاريع المباعة */}
        <button
          type="button"
          onClick={() => setActiveSection("sold")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
            activeSection === "sold"
              ? "bg-purple-700 text-white border-purple-700 shadow-md ring-2 ring-purple-700/30 scale-[1.01]"
              : "bg-white text-purple-950 border-purple-200 hover:border-purple-300 hover:bg-purple-50/40"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${activeSection === "sold" ? "text-purple-100" : "text-purple-800"}`}>
              مشاريع مباعة
            </span>
            <Tag className={`w-3.5 h-3.5 ${activeSection === "sold" ? "text-white" : "text-purple-600"}`} />
          </div>
          <span className={`text-xl sm:text-2xl font-black ${activeSection === "sold" ? "text-white" : "text-purple-700"}`}>
            {countSold}
          </span>
          {activeSection === "sold" && (
            <span className="absolute bottom-1.5 left-2 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
              محدد
            </span>
          )}
        </button>

        {/* بند 4: مشاريع مرفوضة ومعلقة */}
        <button
          type="button"
          onClick={() => setActiveSection("rejected")}
          className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer relative ${
            activeSection === "rejected"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/30 scale-[1.01]"
              : "bg-white text-rose-950 border-rose-200 hover:border-rose-300 hover:bg-rose-50/40"
          }`}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-[11px] font-bold ${activeSection === "rejected" ? "text-rose-100" : "text-rose-800"}`}>
              مشاريع مرفوضة
            </span>
            <XCircle className={`w-3.5 h-3.5 ${activeSection === "rejected" ? "text-white" : "text-rose-600"}`} />
          </div>
          <span className={`text-xl sm:text-2xl font-black ${activeSection === "rejected" ? "text-white" : "text-rose-700"}`}>
            {countRejected}
          </span>
          {activeSection === "rejected" && (
            <span className="absolute bottom-1.5 left-2 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-md font-bold">
              محدد
            </span>
          )}
        </button>
      </div>

      {/* Description banner for currently selected section */}
      <div className="px-4 py-2.5 bg-slate-100/90 rounded-xl text-[11px] font-medium text-slate-700 flex items-center justify-between border border-slate-200/80">
        <span>
          {activeSection === "all" && "إجمالي المشاريع: عرض شامل لكافة المشاريع في النظام مع إمكانية التمييز، التعديل، والمتابعة."}
          {activeSection === "pending" && "مشاريع قيد الموافقة: المشاريع المرسلة من الملاك بانتظار الاعتماد؛ يتاح فحص محتوى العرض والموافقة أو الرفض بالسبب."}
          {activeSection === "active" && "مشاريع نشطة: المشاريع المنشورة حالياً؛ يتاح التمييز بالصفحة الأولى، التعديل الفوري، التعليق المؤقت، أو البيع."}
          {activeSection === "sold" && "المشاريع المباعة: سجل للمشاريع التي تم تأكيد بيعها، وهي مخفية عن الزوار وقوائم العرض العامة."}
          {activeSection === "rejected" && "مشاريع مرفوضة ومعلقة: سجل بالمشاريع المرفوضة مع أسبابها وإمكانية إعادة الفتح أو الحذف."}
        </span>
        <span className="font-black text-slate-900 shrink-0 mr-2 bg-white px-2 py-0.5 rounded-md border border-slate-200">
          {displayed.length} مشاريع
        </span>
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم المشروع، المدينة، المعلن، أو المعرف..."
          className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-xs"
              : "bg-rose-50 border border-rose-300 text-rose-900 shadow-xs"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Projects List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل المشروعات...</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-800">
            {search ? "لا توجد نتائج تطابق البحث" : "لا توجد مشاريع في هذا القسم حالياً"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeSection === "pending" && "لا توجد طلبات جديدة بانتظار الموافقة في الوقت الحالي."}
            {activeSection === "active" && "لا توجد مشاريع منشورة نشطة حالياً."}
            {activeSection === "sold" && "لا توجد مشاريع مباعة حتى الآن."}
            {activeSection === "rejected" && "لا توجد مشاريع مرفوضة أو معلقة."}
            {activeSection === "all" && "لم يتم إضافة أي مشروع حتى الآن."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((prop) => {
            const firstImg = getFirstImage(prop);
            const isPending = isPendingStatus(prop.status);
            const isActive = isActiveStatus(prop.status);
            const isRejected = isRejectedStatus(prop.status);
            const isSuspended = isSuspendedStatus(prop.status);
            const isSoldRented = isSoldOrRented(prop.status);

            return (
              <div
                key={prop.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Details Section */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Thumbnail */}
                  <div
                    onClick={() => setSelectedProject(prop)}
                    className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 relative cursor-pointer group"
                    title="اضغط لرؤية تفاصيل المشروع"
                  >
                    {firstImg ? (
                      <img
                        src={firstImg}
                        alt={prop.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <Building2 className="w-5 h-5" />
                        <span className="text-[9px] mt-1">بدون صورة</span>
                      </div>
                    )}
                    {prop.featured && (
                      <div className="absolute top-1 right-1 bg-amber-400 text-amber-950 p-1 rounded-full shadow-xs" title="مشروع مميز">
                        <Star className="w-3 h-3 fill-amber-950 text-amber-950" />
                      </div>
                    )}
                  </div>

                  {/* Text details */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{prop.id.slice(0, 8)}
                      </span>

                      {/* Precise Status Badges */}
                      {isActive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>نشط / منشور 🟢</span>
                        </span>
                      )}

                      {isPending && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>قيد المراجعة 🟡</span>
                        </span>
                      )}

                      {isRejected && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>مرفوض 🔴</span>
                        </span>
                      )}

                      {isSuspended && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                          <PauseCircle className="w-3 h-3 text-slate-500" />
                          <span>معلق مؤقتاً ⏸️</span>
                        </span>
                      )}

                      {isSoldRented && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-purple-600" />
                          <span>{prop.status === "sold" ? "تم البيع 🏷️" : "تم التأجير 🔑"}</span>
                        </span>
                      )}

                      {prop.featured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 fill-amber-950" />
                          <span>مميز</span>
                        </span>
                      )}
                    </div>

                    <h3
                      onClick={() => setSelectedProject(prop)}
                      className="text-sm font-black text-slate-900 truncate cursor-pointer hover:text-emerald-700 transition-colors"
                      title={prop.title}
                    >
                      {prop.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500 font-medium">
                      <span className="font-black text-emerald-700">
                        {prop.price ? `${Number(prop.price).toLocaleString("ar-EG")} ج.م` : "السعر غير محدد"}
                      </span>
                      {prop.cityName && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{prop.cityName} {prop.districtName ? `• ${prop.districtName}` : ""}</span>
                        </span>
                      )}
                      {prop.advertiserName && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>المعلن: {prop.advertiserName}</span>
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openAuditLog(prop);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-black transition-colors cursor-pointer"
                        title="عرض السجل الكامل لعمليات هذا المشروع"
                      >
                        <History className="w-3 h-3" />
                        <span>السجل الكامل</span>
                      </button>
                    </div>

                    {(prop.moderationReason || prop.moderationNotes) && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 inline-block font-semibold">
                        سبب الرفض/الملاحظة: {prop.moderationReason || prop.moderationNotes}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500">
                      <span className="text-slate-700">المسار: تم الإرسال ← المراجعة ← النشر</span>
                      <span className="text-emerald-700">الحالة الحالية: {getStatusLabel(prop.status)}</span>
                      {isPending && <span className="text-amber-700">بانتظار الإجراء {formatElapsed(prop.updatedAt || prop.createdAt)}</span>}
                    </div>
                  </div>
                </div>

                {/* ========================================================
                    STATUS-AWARE MANAGEMENT ACTIONS (أدوات الإدارة حسب الحالة)
                   ======================================================== */}
                <div className="flex items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0 flex-wrap justify-end">
                  {/* Common: زر معاينة تفاصيل المشروع */}
                  <button
                    type="button"
                    onClick={() => setSelectedProject(prop)}
                    className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                    title="معاينة تفاصيل ومحتوى العرض"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">معاينة</span>
                  </button>

                  {/* ----------------------------------------------------
                      حالة A: المشروع قيد الموافقة (Pending)
                     ---------------------------------------------------- */}
                  {isPending && (
                    <>
                      {canReview && (
                        <>
                      <button
                        type="button"
                        onClick={() => handleApprove(prop)}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>موافقة ونشر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRejectModal({ open: true, property: prop, reason: "" })}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>
                        </>
                      )}

                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ open: true, property: prop })}
                        disabled={actionLoading === prop.id}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="حذف الطلب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </>
                  )}

                  {/* ----------------------------------------------------
                      حالة B: المشروع نشط / منشور (Active / Published)
                     ---------------------------------------------------- */}
                  {isActive && (
                    <>
                      {canReview && (
                        <>
                      {/* زر تمييز المشروع Star */}
                      <button
                        type="button"
                        onClick={() => handleToggleFeatured(prop)}
                        disabled={actionLoading === prop.id}
                        className={`p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border ${
                          prop.featured
                            ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                        title={prop.featured ? "إلغاء التمييز" : "تمييز المشروع بالرئيسية"}
                      >
                        <Star className={`w-3.5 h-3.5 ${prop.featured ? "fill-amber-500 text-amber-500" : ""}`} />
                        <span className="hidden sm:inline">{prop.featured ? "مميز" : "تمييز"}</span>
                      </button>

                      {/* زر تعديل المشروع */}
                      <button
                        type="button"
                        onClick={() =>
                          setEditModal({
                            open: true,
                            property: prop,
                            title: prop.title,
                            price: prop.price || 0,
                            category: prop.category || "apartment",
                            transactionType: prop.transactionType || "sale",
                            description: prop.description || "",
                          })
                        }
                        disabled={actionLoading === prop.id}
                        className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="تعديل بيانات المشروع"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        <span className="hidden sm:inline">تعديل</span>
                      </button>

                      {/* زر تعليق مؤقت */}
                      <button
                        type="button"
                        onClick={() => setSuspendModal({ open: true, property: prop, reason: "" })}
                        disabled={actionLoading === prop.id}
                        className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="تعليق المشروع مؤقتاً"
                      >
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">تعليق</span>
                      </button>

                      {/* زر تغيير الحالة إلى تم البيع */}
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(prop, "sold")}
                        disabled={actionLoading === prop.id}
                        className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="وسم العقار بـ تم البيع"
                      >
                        <Tag className="w-3.5 h-3.5 text-purple-600" />
                        <span className="hidden sm:inline">تم البيع</span>
                      </button>
                        </>
                      )}

                      {/* معاينة حية في الموقع */}
                      <Link
                        href={`/properties/${prop.slug || prop.id}`}
                        target="_blank"
                        className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1"
                        title="معاينة في الموقع بصفحة خارجية"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                        <span className="hidden sm:inline">صفحة العرض</span>
                      </Link>

                      {/* إزالة / حذف نهائي */}
                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ open: true, property: prop })}
                        disabled={actionLoading === prop.id}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </>
                  )}

                  {/* ----------------------------------------------------
                      حالة C: المشروع مرفوض (Rejected)
                     ---------------------------------------------------- */}
                  {isRejected && (
                    <>
                      {canReview && (
                        <>
                      <button
                        type="button"
                        onClick={() => handleApprove(prop)}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="إعادة الموافقة ونشر المشروع"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>موافقة ونشر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRestore(prop)}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="إعادة المشروع لقائمة المراجعة"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة للمراجعة</span>
                      </button>
                        </>
                      )}

                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ open: true, property: prop })}
                        disabled={actionLoading === prop.id}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </>
                  )}

                  {/* ----------------------------------------------------
                      حالة D: المشروع معلق مؤقتاً (Suspended)
                     ---------------------------------------------------- */}
                  {isSuspended && (
                    <>
                      {canReview && (
                        <>
                      <button
                        type="button"
                        onClick={() => handleApprove(prop)}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="إلغاء التعليق وتنشيط المشروع"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>إعادة التنشيط</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditModal({
                            open: true,
                            property: prop,
                            title: prop.title,
                            price: prop.price || 0,
                            category: prop.category || "apartment",
                            transactionType: prop.transactionType || "sale",
                            description: prop.description || "",
                          })
                        }
                        disabled={actionLoading === prop.id}
                        className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title="تعديل بيانات المشروع"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">تعديل</span>
                      </button>
                        </>
                      )}

                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ open: true, property: prop })}
                        disabled={actionLoading === prop.id}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </>
                  )}

                  {/* ----------------------------------------------------
                      حالة E: تم البيع أو التأجير (Sold / Rented)
                     ---------------------------------------------------- */}
                  {isSoldRented && (
                    <>
                      {canReview && (
                      <button
                        type="button"
                        onClick={() => handleChangeStatus(prop, "active")}
                        disabled={actionLoading === prop.id}
                        className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="إعادة العقار إلى الحالة النشطة"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة للنشطة</span>
                      </button>
                      )}

                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteModal({ open: true, property: prop })}
                        disabled={actionLoading === prop.id}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          PROJECT DETAILS MODAL (رؤية تفاصيل المشروع ومحتوى العرض)
         ======================================================== */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تفاصيل ومحتوى المشروع</h3>
                  <span className="text-xs text-slate-400 font-mono">
                    معرف: #{selectedProject.id}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Images Gallery */}
            {Array.isArray(selectedProject.images) && selectedProject.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedProject.images.map((img, idx) => {
                  const url = typeof img === "string" ? img : (img as any).url;
                  return (
                    <div
                      key={idx}
                      className="w-28 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200"
                    >
                      <img src={url} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Project Info Block */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-black text-slate-900">{selectedProject.title}</h4>
                <span className="text-base font-black text-emerald-700">
                  {selectedProject.price ? `${Number(selectedProject.price).toLocaleString("ar-EG")} ج.م` : "السعر غير محدد"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600 font-medium pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">المدينة والحي:</span>
                  <span className="font-bold text-slate-800">
                    {selectedProject.cityName || "غير محدد"} {selectedProject.districtName ? `• ${selectedProject.districtName}` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">نوع العقار:</span>
                  <span className="font-bold text-slate-800">
                    {CATEGORY_LABELS_AR[selectedProject.category] || selectedProject.category || "عقار"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">نوع المعاملة:</span>
                  <span className="font-bold text-slate-800">{selectedProject.transactionType || "بيع"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">المعلن:</span>
                  <span className="font-bold text-slate-800">{selectedProject.advertiserName || "غير محدد"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">هاتف التواصل:</span>
                  <span className="font-bold text-slate-800" dir="ltr">{selectedProject.advertiserPhone || "غير متوفر"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">الحالة الحالية:</span>
                  <span className="font-bold text-slate-800">
                    {isActiveStatus(selectedProject.status)
                      ? "نشط ومعروض"
                      : isPendingStatus(selectedProject.status)
                      ? "قيد الموافقة"
                      : isRejectedStatus(selectedProject.status)
                      ? "مرفوض"
                      : isSuspendedStatus(selectedProject.status)
                      ? "معلق مؤقتاً"
                      : selectedProject.status}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black text-slate-500">مسار المشروع</span>
                  <span className="text-[10px] font-black text-emerald-700">{getStatusLabel(selectedProject.status)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["تم الإرسال", "مراجعة الإدارة", "منشور للعملاء"].map((step, index) => {
                    const currentStep = getLifecycleStep(selectedProject.status);
                    const rejectedStep = isRejectedStatus(selectedProject.status) && index === currentStep;
                    const reached = index < currentStep || (index === currentStep && !rejectedStep);
                    return (
                      <div key={step} className={`rounded-xl px-2.5 py-2 text-center border text-[10px] font-black ${
                        rejectedStep
                          ? "bg-rose-50 text-rose-800 border-rose-200"
                          : reached
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-white text-slate-400 border-slate-200"
                      }`}>
                        <span className="block mb-0.5">{index + 1}</span>
                        {step}
                      </div>
                    );
                  })}
                </div>
                {(isRejectedStatus(selectedProject.status) || isSuspendedStatus(selectedProject.status) || isSoldOrRented(selectedProject.status)) && (
                  <p className={`mt-2 text-[10px] font-bold ${
                    isRejectedStatus(selectedProject.status) ? "text-rose-700" : "text-slate-600"
                  }`}>
                    {isRejectedStatus(selectedProject.status)
                      ? "توقف المسار عند المراجعة؛ راجع سبب الرفض والإجراء المطلوب."
                      : isSuspendedStatus(selectedProject.status)
                      ? "المشروع منشور سابقًا ثم عُلّق مؤقتًا."
                      : "اكتمل مسار العرض بعد إتمام البيع أو التأجير."}
                  </p>
                )}
                <p className="mt-2 text-[10px] text-slate-500">
                  تاريخ الإرسال: {selectedProject.createdAt ? new Date(selectedProject.createdAt).toLocaleString("ar-EG") : "غير متاح"}
                  {selectedProject.updatedAt ? ` • آخر تحديث: ${new Date(selectedProject.updatedAt).toLocaleString("ar-EG")}` : ""}
                  {selectedProject.publishedAt ? ` • تاريخ النشر: ${new Date(selectedProject.publishedAt).toLocaleString("ar-EG")}` : ""}
                </p>
              </div>

              {selectedProject.description && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px] mb-1">وصف العرض:</span>
                  <p className="text-slate-700 leading-relaxed font-normal whitespace-pre-line">
                    {selectedProject.description}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
              <Link
                href={`/properties/${selectedProject.slug || selectedProject.id}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <span>معاينة في صفحة خارجية</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <div className="flex items-center gap-2">
                {/* Approving if pending or rejected */}
                {canReview && !isActiveStatus(selectedProject.status) && (
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedProject)}
                    disabled={actionLoading === selectedProject.id}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black shadow-xs cursor-pointer"
                  >
                    موافقة ونشر
                  </button>
                )}

                {/* Suspend if active */}
                {canReview && isActiveStatus(selectedProject.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSuspendModal({ open: true, property: selectedProject, reason: "" });
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    تعليق مؤقت
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT MODAL (تعديل بيانات المشروع من الإدارة)
         ======================================================== */}
      {editModal.open && editModal.property && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تعديل بيانات المشروع</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{editModal.property.title}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان المشروع:</label>
                <input
                  type="text"
                  value={editModal.title}
                  onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">السعر (ج.م):</label>
                  <input
                    type="number"
                    min={1}
                    max={100_000_000}
                    value={editModal.price}
                    onChange={(e) =>
                      setEditModal({
                        ...editModal,
                        price: e.target.value
                          ? Math.min(100_000_000, Math.max(1, Number(e.target.value)))
                          : "",
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع المعاملة:</label>
                  <select
                    value={editModal.transactionType}
                    onChange={(e) => setEditModal({ ...editModal, transactionType: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  >
                    <option value="sale">بيع</option>
                    <option value="rent">إيجار</option>
                    <option value="investment">استثمار</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف:</label>
                <input
                  type="text"
                  value={editModal.category}
                  onChange={(e) => setEditModal({ ...editModal, category: e.target.value })}
                  placeholder="apartment, villa, land..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف:</label>
                <textarea
                  value={editModal.description}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  rows={4}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditModal({ open: false, property: null, title: "", price: 0, category: "", transactionType: "", description: "" })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={actionLoading === editModal.property.id || !editModal.title.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-black cursor-pointer shadow-md"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && rejectModal.property && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">إبداء سبب رفض المشروع</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{rejectModal.property.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              يرجى كتابة سبب الرفض لتوضيحه للمعلن حتى يتمكن من تعديله:
            </p>

            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="اكتب سبب الرفض (مثال: عدم وضوح الصور، مخالفة السعر، نقص المستندات)..."
              rows={3}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, property: null, reason: "" })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading === rejectModal.property.id || !rejectModal.reason.trim()}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer shadow-md"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal (تعليق مؤقت) */}
      {suspendModal.open && suspendModal.property && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center">
                <PauseCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تعليق المشروع مؤقتاً</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{suspendModal.property.title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              سيتم إيقاف عرض المشروع على المنصة مؤقتاً مع إمكانية إعادة تنشيطه لاحقاً:
            </p>

            <input
              type="text"
              value={suspendModal.reason}
              onChange={(e) => setSuspendModal({ ...suspendModal, reason: e.target.value })}
              placeholder="سبب التعليق (اختياري)..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspendModal({ open: false, property: null, reason: "" })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                disabled={actionLoading === suspendModal.property.id}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer shadow-md"
              >
                تأكيد التعليق المؤقت
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal (إزالة المشروع نهائياً) */}
      {canDelete && deleteModal.open && deleteModal.property && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">إزالة المشروع نهائياً</h3>
                <p className="text-xs text-rose-600 font-bold">هذا الإجراء سيقوم بإزالة المشروع نهائياً من المنصة</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف المشروع{" "}
              <span className="font-black text-slate-900">"{deleteModal.property.title}"</span>؟ لا يمكن التراجع عن هذا الإجراء.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, property: null })}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading === deleteModal.property.id}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer shadow-md"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Full Audit Log Modal (سجل المشروع الكامل) */}
      {auditModal.open && auditModal.property && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FileClock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-900 truncate">السجل الكامل: {auditModal.property.title}</h2>
                  <p className="text-[11px] text-slate-500">كل إجراء تم على هذا المشروع من قبل موظفي الإدارة، بالترتيب من الأحدث</p>
                </div>
              </div>
              <button
                onClick={() => setAuditModal({ open: false, property: null, entries: [], loading: false })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {auditModal.loading ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">جاري جلب السجل...</div>
            ) : auditModal.entries.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <History className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-500">
                  لا توجد إجراءات مسجلة بعد على هذا المشروع. ستظهر هنا كل عملية موافقة أو رفض أو تعديل أو حذف تلقائياً.
                </p>
              </div>
            ) : (
              <ol className="space-y-2.5">
                {auditModal.entries.map((entry) => {
                  const meta = AUDIT_ACTION_LABELS[entry.action] || { label: entry.action, color: "bg-slate-100 text-slate-700" };
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50"
                    >
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">
                          بواسطة: {entry.actorName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">{formatAuditDate(entry.createdAt)}</p>
                        {entry.details?.reason ? (
                          <p className="text-[11px] text-slate-600 font-medium mt-1 bg-white rounded-lg px-2.5 py-1.5 border border-slate-200">
                            السبب/الملاحظة: {String(entry.details.reason)}
                          </p>
                        ) : null}
                        {entry.details?.updates ? (
                          <p className="text-[10px] text-slate-500 font-mono mt-1 truncate" dir="ltr">
                            {Object.keys(entry.details.updates as Record<string, unknown>).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
