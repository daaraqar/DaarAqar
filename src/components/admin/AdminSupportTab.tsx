"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  HelpCircle,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  MessageCircle,
  Phone,
  Mail,
  ExternalLink,
  Activity,
  Server,
  Database,
  Lock,
  Layers,
  ChevronRight,
  Eye,
  Users,
} from "lucide-react";

interface ReportItem {
  id: string;
  propertyId?: string;
  propertyTitle?: string;
  propertySlug?: string;
  advertiserId?: string;
  advertiserName?: string;
  advertiserPhone?: string;
  reporterId?: string;
  reporterName?: string;
  reporterPhone?: string;
  reason: string;
  reasonCategory?: string;
  details?: string;
  status: "pending" | "investigating" | "resolved" | "dismissed";
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

interface VisitorLogItem {
  id: string;
  name: string;
  phone: string;
  propertyTitle: string;
  category: string;
  transactionType: "sale" | "rent";
  isProject: boolean;
  submittedBy: "guest" | "account";
  createdAt: string;
}

type ServiceInquiryStatus = "new" | "contacted" | "converted" | "closed";

interface ServiceInquiryItem {
  id: string;
  serviceId: string;
  serviceName: string;
  name: string;
  phone: string;
  notes: string;
  status: ServiceInquiryStatus;
  createdAt: string;
}

export default function AdminSupportTab() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);
  const [visitorLogs, setVisitorLogs] = useState<VisitorLogItem[]>([]);
  const [serviceInquiries, setServiceInquiries] = useState<ServiceInquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitorLoading, setVisitorLoading] = useState(true);
  const [visitorError, setVisitorError] = useState<string | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(true);
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquiryActionError, setInquiryActionError] = useState<string | null>(null);
  const [inquiryActionLoading, setInquiryActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [showVisitorLogs, setShowVisitorLogs] = useState(false);
  const [showServiceInquiries, setShowServiceInquiries] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setAuditEvents(data.auditEvents || []);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorLogs = async () => {
    setVisitorLoading(true);
    setVisitorError(null);
    try {
      const res = await fetch("/api/admin/visitor-log", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذر تحميل سجل الزوار");
      }
      setVisitorLogs(data.visitors || []);
    } catch (error) {
      console.error("Failed to fetch visitor log:", error);
      setVisitorError(error instanceof Error ? error.message : "تعذر تحميل سجل الزوار");
    } finally {
      setVisitorLoading(false);
    }
  };

  const fetchServiceInquiries = async () => {
    setInquiryLoading(true);
    setInquiryError(null);
    try {
      const res = await fetch("/api/admin/service-inquiries", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تحميل طلبات الخدمات");
      setServiceInquiries(data.inquiries || []);
    } catch (error) {
      console.error("Failed to fetch service inquiries:", error);
      setInquiryError(error instanceof Error ? error.message : "تعذر تحميل طلبات الخدمات");
    } finally {
      setInquiryLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchVisitorLogs();
    fetchServiceInquiries();
  }, []);

  const handleServiceInquiryStatus = async (inquiryId: string, status: ServiceInquiryStatus) => {
    setInquiryActionLoading(inquiryId);
    setInquiryActionError(null);
    try {
      const res = await fetch("/api/admin/service-inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تحديث حالة الطلب");
      setServiceInquiries((previous) =>
        previous.map((inquiry) => inquiry.id === inquiryId ? { ...inquiry, status } : inquiry)
      );
    } catch (error) {
      console.error("Failed to update service inquiry:", error);
      setInquiryActionError(error instanceof Error ? error.message : "تعذر تحديث حالة الطلب");
    } finally {
      setInquiryActionLoading(null);
    }
  };

  const handleUpdateStatus = async (
    reportId: string,
    status: "pending" | "investigating" | "resolved" | "dismissed"
  ) => {
    setActionLoading(reportId);
    const resolutionNotes = noteInputs[reportId]?.trim();
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status, resolutionNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status,
                  resolutionNotes: resolutionNotes || r.resolutionNotes,
                  resolvedAt: data.report?.resolvedAt || new Date().toISOString(),
                }
              : r
          )
        );
        setFeedback(
          status === "resolved"
            ? "تم تحديد البلاغ كـ (محلول) وحفظ ملاحظات الإشراف"
            : status === "investigating"
            ? "تم تحويل البلاغ إلى (قيد التحقيق الرقابي)"
            : "تم استبعاد وإغلاق البلاغ"
        );
        setTimeout(() => setFeedback(null), 3500);
        fetchReports();
      }
    } catch {
      alert("حدث خطأ أثناء تحديث حالة البلاغ");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.reason?.toLowerCase().includes(q) ||
      r.details?.toLowerCase().includes(q) ||
      r.propertyTitle?.toLowerCase().includes(q) ||
      r.reporterName?.toLowerCase().includes(q) ||
      r.advertiserName?.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = reports.filter((r) => r.status === "pending" || r.status === "investigating").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-sky-700 text-xs font-black uppercase tracking-wider mb-1">
            <HelpCircle className="w-4 h-4" />
            <span>شركة الإدارة • مركز الدعم الفني والعمليات الرقابية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            الدعم الفني، البلاغات، وسجل التدقيق الرقابي
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الشكاوى، معالجة بلاغات المستخدمين بالملاحظات الداخلية، ومتابعة سجل التدقيق للإجراءات الحساسة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowServiceInquiries((visible) => !visible)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
              showServiceInquiries
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>طلبات الخدمات ({serviceInquiries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setShowVisitorLogs((visible) => !visible)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
              showVisitorLogs
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>سجل الزوار ({visitorLogs.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAuditLogs((v) => !v)}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
              showAuditLogs
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>سجل التدقيق الرقابي ({auditEvents.length})</span>
          </button>

          <button
            onClick={() => {
              fetchReports();
              fetchVisitorLogs();
              fetchServiceInquiries();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-700" : ""}`} />
            <span>تحديث البلاغات</span>
          </button>
        </div>
      </div>

      {showServiceInquiries && (
        <section className="space-y-3 rounded-3xl border border-sky-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">طلبات التواصل عن الخدمات</h3>
              <p className="mt-1 text-[11px] text-slate-500">تابع الاستفسارات الواردة وتواصل مع أصحابها لتأكيد التفاصيل والتوفر والتكلفة.</p>
            </div>
            <button
              type="button"
              onClick={fetchServiceInquiries}
              disabled={inquiryLoading}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              تحديث
            </button>
          </div>
          {inquiryActionError && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{inquiryActionError}</p>
          )}
          {inquiryLoading ? (
            <p className="py-4 text-center text-xs font-bold text-slate-500">جاري تحميل طلبات الخدمات...</p>
          ) : inquiryError ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{inquiryError}</p>
          ) : serviceInquiries.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">لا توجد طلبات خدمات مسجلة بعد.</p>
          ) : (
            <div className="max-h-[30rem] space-y-2 overflow-y-auto">
              {serviceInquiries.map((inquiry) => (
                <article key={inquiry.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div className="space-y-1 text-xs">
                      <p className="font-black text-slate-900">{inquiry.name} <span className="font-bold text-sky-700">• {inquiry.serviceName}</span></p>
                      <div className="flex flex-wrap items-center gap-3">
                        <a href={`tel:${inquiry.phone}`} dir="ltr" className="font-bold text-emerald-700 hover:underline">{inquiry.phone}</a>
                        <a
                          href={`https://wa.me/${inquiry.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> واتساب
                        </a>
                      </div>
                      {inquiry.notes && <p className="max-w-2xl whitespace-pre-wrap text-slate-600">{inquiry.notes}</p>}
                      <time className="block text-[10px] text-slate-500" dir="ltr">{new Date(inquiry.createdAt).toLocaleString("ar-EG")}</time>
                    </div>
                    <select
                      aria-label={`حالة طلب ${inquiry.name}`}
                      value={inquiry.status}
                      disabled={inquiryActionLoading === inquiry.id}
                      onChange={(event) => handleServiceInquiryStatus(inquiry.id, event.target.value as ServiceInquiryStatus)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                    >
                      <option value="new">جديد</option>
                      <option value="contacted">تم التواصل</option>
                      <option value="converted">تحول إلى عميل</option>
                      <option value="closed">مغلق</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {showVisitorLogs && (
        <section className="space-y-3 rounded-3xl border border-emerald-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900">سجل زوار إضافة العقارات</h3>
              <p className="mt-1 text-[11px] text-slate-500">بيانات التواصل التي أُرسلت قبل متابعة نشر الإعلان.</p>
            </div>
            <button
              type="button"
              onClick={fetchVisitorLogs}
              disabled={visitorLoading}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              تحديث
            </button>
          </div>
          {visitorLoading ? (
            <p className="py-4 text-center text-xs font-bold text-slate-500">جاري تحميل سجل الزوار...</p>
          ) : visitorError ? (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{visitorError}</p>
          ) : visitorLogs.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">لا توجد بيانات زوار مسجلة بعد.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {visitorLogs.map((visitor) => (
                <article key={visitor.id} className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                  <div className="space-y-1 text-xs">
                    <p className="font-black text-slate-900">{visitor.name}</p>
                    <a href={`tel:${visitor.phone}`} dir="ltr" className="inline-block font-bold text-emerald-700 hover:underline">
                      {visitor.phone}
                    </a>
                    <p className="text-slate-600">
                      {visitor.propertyTitle} • {visitor.isProject ? "مشروع" : "عقار"} • {visitor.transactionType === "sale" ? "للبيع" : "للإيجار"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {visitor.submittedBy === "guest" ? "زائر غير مسجل" : "مستخدم مسجل"}{visitor.category ? ` • ${visitor.category}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-[10px] text-slate-500" dir="ltr">
                    {new Date(visitor.createdAt).toLocaleString("ar-EG")}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Supervisory Audit Log Panel */}
      {showAuditLogs && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-black text-white">سجل التدقيق الرقابي (Audit Log)</h3>
                <p className="text-[11px] text-slate-400">
                  يوثّق كافة الإجراءات الإدارية الحساسة (تغيير الأدوار، إيقاف الحسابات، معالجة البلاغات، والإشراف على المحادثات)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAuditLogs(false)}
              className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              إخفاء
            </button>
          </div>
          {auditEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">لا توجد أحداث تدقيق مسجلة بعد.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {auditEvents.slice(0, 30).map((ev) => (
                <div
                  key={ev.id}
                  className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
                        {ev.action}
                      </span>
                      <span className="text-slate-300 font-bold">
                        الكيان: {ev.entityType} ({ev.entityId})
                      </span>
                    </div>
                    {ev.details && Object.keys(ev.details).length > 0 && (
                      <p className="text-[11px] text-slate-400 font-mono break-all">
                        {JSON.stringify(ev.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono" dir="ltr">
                    {new Date(ev.timestamp).toLocaleString("ar-EG")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Platform Health & Direct Support Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Support direct channels */}
        <div className="bg-gradient-to-br from-emerald-700 to-teal-800 text-white p-5 rounded-3xl shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-100">خط المساندة الفورية</span>
            <MessageCircle className="w-4 h-4 text-emerald-200" />
          </div>
          <h3 className="text-lg font-black">الدعم عبر الواتساب المباشر</h3>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            استقبال استفسارات المعلنين والمستفيدين والرد المباشر لحل المشكلات اللحظية.
          </p>
          <a
            href="https://wa.me/966500000000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-900 text-xs font-black hover:bg-emerald-50 transition-colors shadow-xs"
          >
            <span>فتح قناة الدعم</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Operational Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">حالة البنية التحتية</span>
            <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
          <h3 className="text-lg font-black text-slate-900">الأنظمة السحابية مستقرة</h3>
          <div className="space-y-1.5 text-xs font-bold text-slate-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>قاعدة البيانات (Supabase):</span>
              </span>
              <span className="text-emerald-700 font-black">متصل 100%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>محرك المصادقة والأمان:</span>
              </span>
              <span className="text-emerald-700 font-black">آمن ونشط</span>
            </div>
          </div>
        </div>

        {/* Tickets summary */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">مؤشر البلاغات</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-lg font-black text-slate-900">
            {pendingCount > 0 ? `${pendingCount} بلاغ نشط يحتاج للمراجعة` : "لا توجد بلاغات معلقة"}
          </h3>
          <p className="text-xs text-slate-500">
            تمت معالجة وحل {resolvedCount} بلاغ بنجاح حتى الآن.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in">
          {feedback}
        </div>
      )}

      {/* 3. Search & Status Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في تفاصيل البلاغ، اسم المشروع، اسم المبلّغ أو المعلن..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "كافة البلاغات" },
            { id: "pending", label: "قيد المراجعة" },
            { id: "investigating", label: "قيد التحقيق" },
            { id: "resolved", label: "تم الحل" },
            { id: "dismissed", label: "مستبعد" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Reports List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-sky-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري قراءة تذاكر وبلاغات الدعم...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-800">سجل البلاغات خالٍ ونظيف</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            لا توجد أي شكاوى أو بلاغات مسجلة وفق الفلتر المحدد حالياً.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((item) => {
            const isPending = item.status === "pending";
            const isInvestigating = item.status === "investigating";
            const isResolved = item.status === "resolved";
            const isOpen = isPending || isInvestigating;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPending ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>قيد المراجعة</span>
                        </span>
                      ) : isInvestigating ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>قيد التحقيق الرقابي</span>
                        </span>
                      ) : isResolved ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تم الحل والتعامل</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                          مستبعد
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400">
                        تاريخ: {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-SA") : "الآن"}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900">
                      سبب البلاغ: {item.reason}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      {item.propertyTitle && (
                        <div>
                          المشروع المعني:{" "}
                          <span className="font-bold text-slate-900">{item.propertyTitle}</span>
                        </div>
                      )}
                      {item.advertiserName && (
                        <div>
                          المعلن:{" "}
                          <span className="font-bold text-emerald-800">{item.advertiserName}</span>
                          {item.advertiserPhone && (
                            <span className="text-slate-400 mr-1" dir="ltr">({item.advertiserPhone})</span>
                          )}
                        </div>
                      )}
                      {item.reporterName && (
                        <div>
                          المُبلِّغ:{" "}
                          <span className="font-bold text-slate-800">{item.reporterName}</span>
                          {item.reporterPhone && (
                            <span className="text-slate-400 mr-1" dir="ltr">({item.reporterPhone})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {item.details && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        &ldquo;{item.details}&rdquo;
                      </p>
                    )}

                    {item.resolutionNotes && (
                      <div className="text-xs bg-amber-50/80 border border-amber-200 text-amber-900 p-2.5 rounded-xl">
                        <span className="font-black block mb-0.5">🔒 ملاحظات وقرار الإشراف الداخلي:</span>
                        <span>{item.resolutionNotes}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {item.propertyId && (
                      <Link
                        href={`/properties/${item.propertySlug || item.propertyId}`}
                        target="_blank"
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">معاينة المشروع</span>
                      </Link>
                    )}

                    {isPending && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, "investigating")}
                        disabled={actionLoading === item.id}
                        className="px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 disabled:opacity-50 text-sky-800 text-xs font-bold transition-colors cursor-pointer"
                      >
                        بدء التحقيق
                      </button>
                    )}

                    {isOpen && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(item.id, "resolved")}
                          disabled={actionLoading === item.id}
                          className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تم الحل</span>
                        </button>

                        <button
                          onClick={() => handleUpdateStatus(item.id, "dismissed")}
                          disabled={actionLoading === item.id}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        >
                          تجاهل
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Internal Supervisory Note input for open reports */}
                {isOpen && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={noteInputs[item.id] ?? item.resolutionNotes ?? ""}
                      onChange={(e) =>
                        setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="أضف ملاحظة رقابية داخلية أو قرار الإشراف قبل الحل أو الاستبعاد..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:bg-white"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
