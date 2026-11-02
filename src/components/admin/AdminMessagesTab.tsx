"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  RefreshCw,
  User,
  Phone,
  Mail,
  Building2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Eye,
  Send,
  MessageCircle,
  X,
  ArrowRight,
  Filter,
} from "lucide-react";
import InquiryChatModal from "@/components/chat/InquiryChatModal";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: "seeker" | "advertiser" | "admin" | string;
  content: string;
  createdAt: string;
}

interface InquiryItem {
  id: string;
  propertyId: string;
  propertyTitle?: string;
  propertySlug?: string;
  propertyPrice?: number;
  seekerId: string;
  seekerName: string;
  seekerPhone: string;
  seekerEmail?: string;
  advertiserId: string;
  advertiserName?: string;
  advertiserPhone?: string;
  message: string;
  preferredContact?: "call" | "whatsapp" | "in_app";
  status: "new" | "contacted" | "viewing_scheduled" | "negotiating" | "deal_closed" | "closed" | "spam" | string;
  createdAt: string;
  lastMessageAt?: string;
  unreadCount?: number;
  messagesCount?: number;
  waitingForAdvertiser?: boolean;
  waitingSince?: string | null;
  responseOverdue?: boolean;
  messages?: ChatMessage[];
}

const STATUS_BADGE_MAP: Record<string, { label: string; className: string }> = {
  new: { label: "طلب جديد (بانتظار الرد)", className: "bg-blue-50 text-blue-800 border-blue-200" },
  contacted: { label: "تم الرد والتواصل 💬", className: "bg-amber-50 text-amber-800 border-amber-200" },
  viewing_scheduled: { label: "موعد معاينة محدد 📅", className: "bg-purple-50 text-purple-800 border-purple-200" },
  negotiating: { label: "قيد التفاوض السعري 🤝", className: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  deal_closed: { label: "صفقة ناجحة 🎉", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  closed: { label: "مكتمل / مغلق 🔒", className: "bg-slate-100 text-slate-700 border-slate-200" },
  spam: { label: "مخالف / بلاغ إداري ⚠️", className: "bg-rose-50 text-rose-800 border-rose-200" },
};

export default function AdminMessagesTab({ canViewUserProfiles = false }: { canViewUserProfiles?: boolean }) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeInquiry, setActiveInquiry] = useState<InquiryItem | null>(null);
  const [filterContact, setFilterContact] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inquiries?mode=admin", { cache: "no-store", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.inquiries || []);
      }
    } catch (err) {
      console.error("Failed to fetch admin inquiries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleQuickSupervisoryStatus = async (inquiryId: string, newStatus: string) => {
    setUpdatingStatusId(inquiryId);
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchInquiries();
      }
    } catch (err) {
      console.error("Failed to update inquiry status:", err);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const totalCount = inquiries.length;
  const respondedCount = inquiries.filter((i) => i.status && i.status !== "new" && i.status !== "spam").length;
  const responseRate = totalCount > 0 ? Math.round((respondedCount / totalCount) * 100) : 0;
  const viewingScheduledCount = inquiries.filter((i) => i.status === "viewing_scheduled").length;
  const dealsClosedCount = inquiries.filter((i) => i.status === "deal_closed").length;
  const awaitingAdvertiserCount = inquiries.filter((i) => i.waitingForAdvertiser).length;
  const overdueResponseCount = inquiries.filter((i) => i.responseOverdue).length;

  const filtered = inquiries.filter((inq) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      inq.seekerName?.toLowerCase().includes(q) ||
      inq.seekerPhone?.includes(search) ||
      inq.advertiserName?.toLowerCase().includes(q) ||
      inq.advertiserPhone?.includes(search) ||
      inq.propertyTitle?.toLowerCase().includes(q) ||
      inq.message?.toLowerCase().includes(q);

    const matchesContact =
      filterContact === "all" ||
      inq.preferredContact === filterContact;

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "unread"
        ? Boolean(inq.unreadCount && inq.unreadCount > 0)
        : filterStatus === "overdue"
          ? Boolean(inq.responseOverdue)
          : inq.status === filterStatus);

    return matchesSearch && matchesContact && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase tracking-wider mb-1">
            <MessageSquare className="w-4 h-4" />
            <span>إشراف الإدارة • مراقبة المحادثات والرسائل</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            متابعة التواصل بين العملاء والملاك / الوسطاء
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            الإشراف المركزي والتدقيق على جودة التواصل، معدلات الاستجابة، والملاحظات الرقابية لمنع المخالفات وضمان رضا المستفيدين.
          </p>
        </div>

        <button
          onClick={fetchInquiries}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-700" : ""}`} />
          <span>تحديث المحادثات</span>
        </button>
      </div>

      {/* 2. Key Supervisory & Funnel Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 block mb-1">إجمالي المحادثات والطلبات</span>
          <span className="text-2xl font-black text-slate-900">{totalCount}</span>
        </div>

        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-xs">
          <span className="text-xs font-bold text-blue-800 block mb-1">بانتظار استجابة المعلن</span>
          <span className="text-2xl font-black text-blue-700">
            {awaitingAdvertiserCount}
          </span>
        </div>

        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-800">تجاوزت مهلة الرد (24 ساعة)</span>
            <Clock className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <span className="text-2xl font-black text-rose-700">{overdueResponseCount}</span>
        </div>

        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-800">معدل استجابة المعلنين</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-700">{responseRate}%</span>
        </div>

        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-800">معاينات مجدولة</span>
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <span className="text-2xl font-black text-purple-700">{viewingScheduledCount}</span>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-800">صفقات مكتملة</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <span className="text-2xl font-black text-amber-700">{dealsClosedCount}</span>
        </div>
      </div>

      {/* 3. Search & Multi-Dimensional Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم العميل، المعلن، رقم الهاتف، أو اسم المشروع العقاري..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "كافة القنوات" },
              { id: "in_app", label: "داخل المنصة" },
              { id: "whatsapp", label: "واتساب" },
              { id: "call", label: "اتصال هاتفي" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterContact(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  filterContact === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          {[
            { id: "all", label: "جميع الحالات" },
            { id: "overdue", label: "متأخرة عن الرد 24 ساعة" },
            { id: "unread", label: "غير مقروءة 🔴" },
            { id: "new", label: "جديد (بانتظار الرد)" },
            { id: "contacted", label: "قيد التواصل 💬" },
            { id: "viewing_scheduled", label: "موعد معاينة 📅" },
            { id: "negotiating", label: "قيد التفاوض 🤝" },
            { id: "deal_closed", label: "صفقة ناجحة 🎉" },
            { id: "closed", label: "مغلق 🔒" },
            { id: "spam", label: "مخالف / بلاغ ⚠️" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                filterStatus === st.id
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/70"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Inquiries List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">جاري قراءة سجل الرسائل والمحادثات...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-slate-800">لا توجد محادثات مطابقة للفلاتر المحددة</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            عند قيام أي عميل بالتواصل مع مالك عقار أو وسيط، ستظهر تفاصيل الرسالة والمحادثة هنا للرقابة والمتابعة.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((inq) => {
            const messageCount =
              inq.messagesCount || (Array.isArray(inq.messages) && inq.messages.length > 0 ? inq.messages.length : 1);
            const statusBadge = STATUS_BADGE_MAP[inq.status || "new"] || STATUS_BADGE_MAP.new;

            return (
              <div
                key={inq.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>العميل: {inq.seekerName || "زائر"}</span>
                      {inq.seekerPhone && (
                        <span className="font-mono text-emerald-900 mr-1" dir="ltr">
                          ({inq.seekerPhone})
                        </span>
                      )}
                    </span>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span>المعلن: {inq.advertiserName || "معلن"}</span>
                      {inq.advertiserPhone && (
                        <span className="font-mono text-slate-600 mr-1" dir="ltr">
                          ({inq.advertiserPhone})
                        </span>
                      )}
                    </span>

                    {inq.preferredContact && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {inq.preferredContact === "whatsapp"
                          ? "عبر الواتساب"
                          : inq.preferredContact === "call"
                          ? "اتصال هاتفي"
                          : "رسالة داخل المنصة"}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        آخر نشاط:{" "}
                        {inq.lastMessageAt || inq.createdAt
                          ? new Date(inq.lastMessageAt || inq.createdAt).toLocaleString("ar-EG", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "الآن"}
                      </span>
                    </span>

                    {Boolean(inq.unreadCount && inq.unreadCount > 0) && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shadow-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span>{inq.unreadCount} رسالة غير مقروءة</span>
                      </span>
                    )}
                    {inq.waitingForAdvertiser && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
                        inq.responseOverdue
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>
                          {inq.responseOverdue ? "متأخرة عن الرد" : "بانتظار رد المعلن"}
                          {inq.waitingSince
                            ? ` • ${new Date(inq.waitingSince).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Target project */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>العقار المرتبط:</span>
                      <span className="text-emerald-700 truncate">{inq.propertyTitle || `عقار #${inq.propertyId}`}</span>
                      {inq.propertyPrice ? (
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {Number(inq.propertyPrice).toLocaleString("ar-EG")} ج.م
                        </span>
                      ) : null}
                    </div>

                    {inq.propertyId && (
                      <Link
                        href={inq.propertySlug ? `/properties/${inq.propertySlug}` : `/properties/${inq.propertyId}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-colors shrink-0"
                        title="معاينة الإعلان في صفحة جديدة"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-600" />
                        <span>معاينة الإعلان</span>
                      </Link>
                    )}
                  </div>

                  {/* Message snippet */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 font-medium leading-relaxed">
                    "{inq.message}"
                  </div>
                </div>

                {/* Supervisory Actions & Inspect Thread */}
                <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => setActiveInquiry(inq)}
                    className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer relative"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>إشراف وفحص المحادثة ({messageCount})</span>
                    {Boolean(inq.unreadCount && inq.unreadCount > 0) && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute -top-1 -right-1" />
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 justify-end">
                    {canViewUserProfiles && inq.seekerId && inq.seekerId !== "guest" && (
                      <Link
                        href={`/admin?tab=staff&userId=${encodeURIComponent(inq.seekerId)}`}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold whitespace-nowrap"
                      >
                        ملف العميل
                      </Link>
                    )}
                    {canViewUserProfiles && inq.advertiserId && inq.advertiserId !== "guest" && (
                      <Link
                        href={`/admin?tab=staff&userId=${encodeURIComponent(inq.advertiserId)}`}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold whitespace-nowrap"
                      >
                        ملف المعلن
                      </Link>
                    )}
                    <select
                      aria-label="تحديث حالة المحادثة إدارياً"
                      disabled={updatingStatusId === inq.id}
                      value={inq.status || "new"}
                      onChange={(e) => handleQuickSupervisoryStatus(inq.id, e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-[11px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="new">طلب جديد</option>
                      <option value="contacted">قيد التواصل</option>
                      <option value="viewing_scheduled">موعد معاينة</option>
                      <option value="negotiating">قيد التفاوض</option>
                      <option value="deal_closed">صفقة مكتملة</option>
                      <option value="closed">إغلاق الطلب</option>
                      <option value="spam">تصنيف كمخالف / بلاغ</option>
                    </select>

                    {inq.seekerPhone && (
                      <>
                        <a
                          href={`tel:${inq.seekerPhone.replace(/[^0-9+]/g, "")}`}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-200"
                          title="اتصال هاتفي بالعميل"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>

                        <a
                          href={`https://wa.me/${inq.seekerPhone.replace(/\+/g, "").replace(/\s/g, "")}?text=${encodeURIComponent(
                            `مرحباً ${inq.seekerName}، بخصوص طلبك على منصة دار العقار.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors border border-emerald-200"
                          title="فتح واتساب العميل"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Supervisory Chat Modal */}
      {activeInquiry && (
        <InquiryChatModal
          inquiryId={activeInquiry.id}
          isOpen={Boolean(activeInquiry)}
          onClose={() => {
            setActiveInquiry(null);
            fetchInquiries();
          }}
          isSupervisor={true}
          currentUserRole="admin"
        />
      )}
    </div>
  );
}
