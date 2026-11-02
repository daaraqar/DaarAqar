"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import InquiryChatModal from "@/components/chat/InquiryChatModal";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Shield,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  Building2,
  MessageSquare,
  Palette,
  Star,
  HelpCircle,
  Eye,
  BadgeCheck,
  Ban,
  FileText,
  ExternalLink,
} from "lucide-react";
import { getPublishingCategory } from "@/lib/auth/admin-permissions";

interface StaffItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  adminRole?: string;
  adminPermissions?: string[];
  isStaff: boolean;
  isSuspended: boolean;
  createdAt?: string;
}

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "seeker" | "buyer" | "owner" | "broker" | "admin" | string;
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason?: string;
  companyName?: string;
  licenseNumber?: string;
  commercialRegistrationNo?: string;
  nationalId?: string;
  propertiesCount: number;
  publishedCount: number;
  publisherProjectCount?: number;
  pendingReviewCount: number;
  rejectedCount: number;
  inquiriesSentCount: number;
  inquiriesReceivedCount: number;
  totalConversationsCount: number;
  messagesCount: number;
  reportsFiledCount: number;
  reportsAgainstCount: number;
  createdAt?: string;
}

interface UserDetailRecord {
  user: AdminUserItem & { bio?: string; whatsappEnabled?: boolean };
  properties: any[];
  inquiriesSent: any[];
  inquiriesReceived: any[];
  reports: any[];
  auditLogs: any[];
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  seeker: { label: "باحث عن عقار / عميل", color: "bg-slate-100 text-slate-700 border-slate-200" },
  buyer: { label: "مشتري / مستثمر", color: "bg-sky-100 text-sky-800 border-sky-200" },
  owner: { label: "مالك عقار", color: "bg-amber-100 text-amber-800 border-amber-200" },
  broker: { label: "وسيط عقاري", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  admin: { label: "مدير نظام", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
};

const AVAILABLE_PERMISSIONS = [
  {
    id: "projects.review",
    label: "إدارة ومراجعة المشاريع",
    description: "الموافقة على المشاريع العقارية والاعتماد أو الرفض",
    icon: Building2,
    color: "text-amber-500",
  },
  {
    id: "projects.delete",
    label: "حذف المشاريع نهائياً",
    description: "صلاحية الحذف النهائي للمشاريع المخالفة من النظام",
    icon: XCircle,
    color: "text-rose-500",
  },
  {
    id: "messages.read",
    label: "مراقبة الرسائل والمحادثات",
    description: "فحص سجل المحادثات والرسائل المتبادلة بين العملاء والوسطاء",
    icon: MessageSquare,
    color: "text-emerald-500",
  },
  {
    id: "cms.edit",
    label: "التحكم بالهوية والمحتوى (CMS)",
    description: "تعديل الشعار والأيقونة وأسماء الأزرار والألوان",
    icon: Palette,
    color: "text-purple-500",
  },
  {
    id: "support.manage",
    label: "إدارة البلاغات والدعم الفني",
    description: "استقبال بلاغات المستخدمين وتحديدها كمحلولة",
    icon: HelpCircle,
    color: "text-sky-500",
  },
  {
    id: "ratings.manage",
    label: "إدارة التقييمات والتنافس",
    description: "ضبط قواعد الشارات ومراجعة تقييمات البائعين والمشاريع",
    icon: Star,
    color: "text-yellow-500",
  },
  {
    id: "staff.manage",
    label: "إدارة موظفي الشركة",
    description: "إنشاء حسابات إدارية جديدة وتعديل صلاحيات الموظفين",
    icon: Users,
    color: "text-indigo-500",
  },
];

export default function AdminStaffTab() {
  const searchParams = useSearchParams();
  const profileUserId = searchParams.get("userId");
  const [activeSubView, setActiveSubView] = useState<"all_users" | "staff">("all_users");

  // Staff State
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // All Users State
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");

  // Selected User Detail Drawer
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"properties" | "conversations" | "reports">("properties");
  const [roleChangeTarget, setRoleChangeTarget] = useState<string>("");
  const [roleChangeReason, setRoleChangeReason] = useState<string>("");
  const [activeInquiryModal, setActiveInquiryModal] = useState<any | null>(null);

  // New Staff Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("moderator");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "projects.review",
    "messages.read",
  ]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (err) {
      console.error("Failed to fetch staff:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchAllUsers();
    fetchStaff();
  }, []);

  const openUserDetail = React.useCallback(async (userId: string) => {
    setDetailLoading(true);
    setDetailTab("properties");
    setSelectedUserDetail(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذر تحميل ملف المستخدم");
      }
      setSelectedUserDetail(data);
      setRoleChangeTarget(data.user?.role || "seeker");
      setRoleChangeReason("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحميل ملف المستخدم";
      setFeedback({ type: "error", text: message });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileUserId) {
      openUserDetail(profileUserId);
    }
  }, [openUserDetail, profileUserId]);

  const handleToggleUserVerify = async (u: AdminUserItem) => {
    const nextVal = !u.isVerified;
    setActionLoading(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isVerified: nextVal,
          verificationReason: nextVal
            ? "توثيق واعتماد الحساب بعد مراجعة بيانات المعلن"
            : "إلغاء التوثيق للمراجعة الإدارية",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: nextVal ? `تم توثيق حساب (${u.name}) بنجاح` : `تم إلغاء توثيق حساب (${u.name})`,
        });
        fetchAllUsers();
        if (selectedUserDetail?.user.id === u.id) {
          openUserDetail(u.id);
        }
      } else {
        setFeedback({ type: "error", text: data.error || "تعذر تحديث حالة التوثيق" });
      }
    } catch {
      setFeedback({ type: "error", text: "حدث خطأ أثناء تحديث التوثيق" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUserSuspension = async (u: AdminUserItem) => {
    const nextState = !u.isSuspended;
    const reason = nextState
      ? window.prompt(`يرجى إدخال سبب إيقاف حساب (${u.name}) للتدقيق الأمني:`, "مخالفة سياسات النشر أو بلاغ قيد التحقيق")
      : "إعادة تفعيل الحساب بعد المراجعة الإدارية";

    if (nextState && (!reason || !reason.trim())) return;

    setActionLoading(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: nextState, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: nextState ? `تم إيقاف حساب (${u.name}) وتسجيل السبب في سجل التدقيق` : `تم إعادة تفعيل حساب (${u.name})`,
        });
        fetchAllUsers();
        if (selectedUserDetail?.user.id === u.id) {
          openUserDetail(u.id);
        }
      } else {
        setFeedback({ type: "error", text: data.error || "تعذر تحديث حالة الحساب" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ في الاتصال أثناء تحديث حالة الحساب" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveUserRole = async () => {
    if (!selectedUserDetail) return;
    const targetId = selectedUserDetail.user.id;
    if (!roleChangeReason.trim()) {
      alert("يرجى كتابة سبب تغيير الدور الوظيفي لتوثيقه في سجل التدقيق الرقابي");
      return;
    }
    setActionLoading(targetId);
    try {
      const res = await fetch(`/api/admin/users/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleChangeTarget,
          roleReason: roleChangeReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: "تم تحديث دور المستخدم وتوثيق القرار في سجل التدقيق" });
        setRoleChangeReason("");
        fetchAllUsers();
        openUserDetail(targetId);
      } else {
        setFeedback({ type: "error", text: data.error || "تعذر تغيير دور المستخدم" });
      }
    } catch {
      setFeedback({ type: "error", text: "حدث خطأ أثناء تغيير الدور" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleRolePresetChange = (role: string) => {
    setSelectedRole(role);
    if (role === "superadmin") {
      setSelectedPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id));
    } else if (role === "moderator") {
      setSelectedPermissions(["projects.review", "messages.read"]);
    } else if (role === "content_editor") {
      setSelectedPermissions(["cms.edit"]);
    } else if (role === "support_agent") {
      setSelectedPermissions(["support.manage", "messages.read"]);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert("يرجى إدخال البريد الإلكتروني للموظف");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          adminRole: selectedRole,
          adminPermissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", text: data.message || "تم إنشاء حساب الموظف وتعيين الصلاحيات بنجاح!" });
        setShowAddModal(false);
        setName("");
        setEmail("");
        fetchStaff();
        fetchAllUsers();
      } else {
        setFeedback({ type: "error", text: data.error || "فشل إنشاء حساب الموظف" });
      }
    } catch {
      setFeedback({ type: "error", text: "خطأ بالاتصال أثناء إنشاء الحساب" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspension = async (member: StaffItem) => {
    if (member.email.toLowerCase() === "mkelwayzy@gmail.com") {
      alert("لا يمكن تعطيل حساب المالك والمشرف العام للمنصة");
      return;
    }

    const nextState = !member.isSuspended;
    setActionLoading(member.id);
    try {
      const res = await fetch(`/api/admin/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSuspended: nextState }),
      });
      if (res.ok) {
        setStaff((prev) =>
          prev.map((s) => (s.id === member.id ? { ...s, isSuspended: nextState } : s))
        );
        setFeedback({
          type: "success",
          text: nextState
            ? `تم تعطيل حساب الموظف (${member.name}) مؤقتاً`
            : `تم تفعيل حساب الموظف (${member.name}) بنجاح`,
        });
        fetchAllUsers();
      } else {
        const d = await res.json();
        alert(d.error || "فشل تحديث حالة الحساب");
      }
    } catch {
      alert("خطأ أثناء تحديث حالة الموظف");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStaff = staff.filter((s) => {
    const q = search.toLowerCase().trim();
    return (
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  });

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.companyName?.toLowerCase().includes(q) ||
      u.licenseNumber?.toLowerCase().includes(q);

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "visitor" && u.role !== "admin" && getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "visitor") ||
      (roleFilter === "publisher" && u.role !== "admin" && getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "publisher") ||
      u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "suspended" ? u.isSuspended : !u.isSuspended);
    const matchesVerified =
      verifiedFilter === "all" ||
      (verifiedFilter === "verified" ? u.isVerified : !u.isVerified);

    return matchesSearch && matchesRole && matchesStatus && matchesVerified;
  });

  const totalUsersCount = users.length;
  const totalAdvertisersCount = users.filter((u) => u.role !== "admin" && getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "publisher").length;
  const totalVisitorsCount = users.filter((u) => u.role !== "admin" && getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "visitor").length;
  const verifiedUsersCount = users.filter((u) => u.isVerified).length;
  const suspendedUsersCount = users.filter((u) => u.isSuspended).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner with Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-700 text-xs font-black uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>شركة الإدارة • سجل المستخدمين وموظفي المنصة</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            إدارة بيانات المستخدمين، التوثيق، وموظفي الإدارة
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            استعراض وتحليل سجل كل مستخدم (العقارات، المحادثات، الاستفسارات، والبلاغات) وإدارة صلاحيات فريق العمل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubView("all_users")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubView === "all_users"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              سجل المستخدمين ({totalUsersCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView("staff")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeSubView === "staff"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              موظفو الإدارة ({staff.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black transition-all shadow-md shadow-indigo-700/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة موظف إدارة</span>
          </button>

          <button
            onClick={() => {
              fetchAllUsers();
              fetchStaff();
            }}
            disabled={loading || usersLoading}
            className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading || usersLoading ? "animate-spin text-indigo-700" : ""}`} />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          SUB-VIEW 1: ALL USERS & LINKED ACTIVITY RECORDS (سجل وبيانات المستخدمين)
         ===================================================================== */}
      {activeSubView === "all_users" && (
        <>
          {/* User KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block">إجمالي الحسابات المسجلة</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{totalUsersCount}</span>
              <span className="text-[10px] text-slate-400">موحدة بدون تكرار عبر قاعدة البيانات</span>
            </div>
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-800 block">ناشرو المشاريع المعتمدة</span>
              <span className="text-2xl font-black text-amber-900 mt-1 block">{totalAdvertisersCount}</span>
              <span className="text-[10px] text-amber-700">لديهم مشروع واحد معتمد على الأقل</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-600 block">الزائرون</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{totalVisitorsCount}</span>
              <span className="text-[10px] text-slate-500">لم يُعتمد لهم أي مشروع بعد</span>
            </div>
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-800 block">حسابات موثّقة ومعتمدة</span>
              <span className="text-2xl font-black text-emerald-900 mt-1 block">{verifiedUsersCount}</span>
              <span className="text-[10px] text-emerald-700">تم التحقق من هويتهم أو ترخيصهم</span>
            </div>
            <div className="bg-rose-50/60 rounded-2xl p-4 border border-rose-200/80 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-800 block">حسابات موقوفة رقابياً</span>
              <span className="text-2xl font-black text-rose-900 mt-1 block">{suspendedUsersCount}</span>
              <span className="text-[10px] text-rose-700">موقوفة بقرار إداري موثق</span>
            </div>
          </div>

          {/* Search & Multi-Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم، البريد الإلكتروني، رقم الهاتف، اسم الشركة، أو رقم الترخيص..."
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">الحالة: الكل</option>
                <option value="active">نشط فقط</option>
                <option value="suspended">موقوف فقط</option>
              </select>

              <select
                value={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">التوثيق: الكل</option>
                <option value="verified">موثّق فقط</option>
                <option value="unverified">غير موثّق</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: "all", label: "كافة الأدوار" },
                { id: "visitor", label: "زائرون" },
                { id: "publisher", label: "ناشرو مشاريع" },
                { id: "owner", label: "ملاك عقارات" },
                { id: "broker", label: "وسطاء عقاريون" },
                { id: "admin", label: "مديرو النظام" },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleFilter(r.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    roleFilter === r.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users List */}
          {usersLoading ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">جاري تحميل بيانات وسجلات المستخدمين...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-800">لا توجد حسابات مطابقة للبحث</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const roleMeta = ROLE_LABELS[u.role] || {
                  label: u.role,
                  color: "bg-slate-100 text-slate-700 border-slate-200",
                };

                return (
                  <div
                    key={u.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{u.name}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${roleMeta.color}`}>
                          {roleMeta.label}
                        </span>
                        {u.role !== "admin" && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "publisher"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            {getPublishingCategory(u.publisherProjectCount ?? u.publishedCount) === "publisher" ? "ناشر مشروع معتمد" : "زائر"}
                          </span>
                        )}
                        {u.isVerified && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            <span>موثّق</span>
                          </span>
                        )}
                        {u.isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            موقوف
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            نشط
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        {u.email && (
                          <span className="flex items-center gap-1 font-mono" dir="ltr">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {u.email}
                          </span>
                        )}
                        {u.phone && (
                          <span className="flex items-center gap-1 font-mono" dir="ltr">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {u.phone}
                          </span>
                        )}
                        {u.companyName && (
                          <span className="font-bold text-slate-700">الشركة: {u.companyName}</span>
                        )}
                        {u.licenseNumber && (
                          <span className="font-mono text-slate-500">ترخيص: {u.licenseNumber}</span>
                        )}
                      </div>

                      {/* Real Linked Activity Counters */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] font-bold">
                          العقارات: {u.propertiesCount} (منشور: {u.publishedCount} • مراجعة: {u.pendingReviewCount})
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-[11px] font-bold">
                          المحادثات: {u.totalConversationsCount} (واردة: {u.inquiriesReceivedCount} • مرسلة: {u.inquiriesSentCount})
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-900 text-[11px] font-bold">
                          الرسائل: {u.messagesCount}
                        </span>
                        {(u.reportsFiledCount > 0 || u.reportsAgainstCount > 0) && (
                          <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-900 text-[11px] font-bold">
                            البلاغات: قدّم {u.reportsFiledCount} • ضده {u.reportsAgainstCount}
                          </span>
                        )}
                      </div>

                      {u.isSuspended && u.suspensionReason && (
                        <p className="text-[11px] text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                          سبب الإيقاف: {u.suspensionReason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => openUserDetail(u.id)}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف السجل الكامل</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleUserVerify(u)}
                        disabled={actionLoading === u.id}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                          u.isVerified
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        <BadgeCheck className="w-3.5 h-3.5" />
                        <span>{u.isVerified ? "إلغاء التوثيق" : "توثيق الحساب"}</span>
                      </button>

                      {u.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleToggleUserSuspension(u)}
                          disabled={actionLoading === u.id}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                            u.isSuspended
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{u.isSuspended ? "تفعيل" : "إيقاف"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          SUB-VIEW 2: STAFF MANAGEMENT (موظفو شركة الإدارة والصلاحيات)
         ===================================================================== */}
      {activeSubView === "staff" && (
        <>
          {/* Master Account Protected Badge */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 text-amber-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-white">المشرف العام الرئيسي المعتمد</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Primary Master
                  </span>
                </div>
                <span className="text-xs text-slate-300 font-mono" dir="ltr">
                  MKELWAYZY@gmail.com
                </span>
              </div>
            </div>

            <span className="text-[11px] text-slate-400 font-medium">
              الصلاحيات: تحكم مطلق وشامل (Super Admin) لكافة مفاصل المنصة وموظفيها.
            </span>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم الموظف، البريد الإلكتروني، أو رقم الهاتف..."
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Staff List */}
          {loading ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">جاري قراءة حسابات موظفي الإدارة...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800">لا يوجد موظفين مسجلين حالياً</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                اضغط على &ldquo;إضافة موظف إدارة&rdquo; للبدء في تعيين حسابات فريق العمل وتحديد صلاحياتهم.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredStaff.map((member) => {
                const isMaster = member.email.toLowerCase() === "mkelwayzy@gmail.com";
                const perms = Array.isArray(member.adminPermissions) ? member.adminPermissions : [];

                return (
                  <div
                    key={member.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-4 sm:p-5 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{member.name}</span>

                        {isMaster ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>المالك والمشرف العام</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span>موظف إدارة معتمد</span>
                          </span>
                        )}

                        {member.isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            معطل
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            نشط
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span dir="ltr" className="font-mono">{member.email}</span>
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1.5 text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span dir="ltr">{member.phone}</span>
                          </span>
                        )}
                      </div>

                      {/* Granted Permissions Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-black text-slate-400 ml-1">الصلاحيات:</span>
                        {member.adminRole === "superadmin" || perms.includes("all") ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            كافة الصلاحيات (تحكم كامل)
                          </span>
                        ) : perms.length === 0 ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            لا توجد صلاحيات محددة
                          </span>
                        ) : (
                          perms.map((p) => {
                            const def = AVAILABLE_PERMISSIONS.find((ap) => ap.id === p);
                            return (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {def?.label || p}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isMaster && (
                      <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleToggleSuspension(member)}
                          disabled={actionLoading === member.id}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                            member.isSuspended
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                          }`}
                        >
                          {member.isSuspended ? "إلغاء التعطيل (تفعيل)" : "تعطيل الحساب"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          USER FULL PROFILE & LINKED RECORDS MODAL (سجل المستخدم الشامل)
         ===================================================================== */}
      {(selectedUserDetail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            {detailLoading || !selectedUserDetail ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-500">جاري تحميل السجل الشامل للمستخدم...</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900">{selectedUserDetail.user.name}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {ROLE_LABELS[selectedUserDetail.user.role]?.label || selectedUserDetail.user.role}
                      </span>
                      {selectedUserDetail.user.isVerified && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                          موثّق
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono" dir="ltr">
                      {selectedUserDetail.user.email} {selectedUserDetail.user.phone ? `• ${selectedUserDetail.user.phone}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedUserDetail(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Role & Governance Controls */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="text-xs font-black text-slate-800 block">
                    إدارة الدور الوظيفي والحالة الرقابية (يُسجّل تلقائياً في سجل التدقيق)
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={roleChangeTarget}
                      onChange={(e) => setRoleChangeTarget(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="seeker">باحث عن عقار / عميل (seeker)</option>
                      <option value="owner">مالك عقار (owner)</option>
                      <option value="broker">وسيط عقاري (broker)</option>
                      <option value="admin">مدير نظام (admin)</option>
                    </select>
                    <input
                      type="text"
                      value={roleChangeReason}
                      onChange={(e) => setRoleChangeReason(e.target.value)}
                      placeholder="سبب تعديل الدور (إلزامي للتدقيق الأمني)..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleSaveUserRole}
                      disabled={actionLoading === selectedUserDetail.user.id}
                      className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-black cursor-pointer"
                    >
                      حفظ الدور
                    </button>
                  </div>
                </div>

                {/* Linked Records Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setDetailTab("properties")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                      detailTab === "properties"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    العقارات المرتبطة ({selectedUserDetail.properties.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("conversations")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                      detailTab === "conversations"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    المحادثات وطلبات التواصل ({selectedUserDetail.inquiriesReceived.length + selectedUserDetail.inquiriesSent.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("reports")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer ${
                      detailTab === "reports"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    البلاغات وسجل التدقيق ({selectedUserDetail.reports.length + selectedUserDetail.auditLogs.length})
                  </button>
                </div>

                {/* Tab 1: Properties */}
                {detailTab === "properties" && (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {selectedUserDetail.properties.length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center">لا توجد عقارات مسجلة لهذا المستخدم.</p>
                    ) : (
                      selectedUserDetail.properties.map((p: any) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-black text-slate-900 block">{p.title}</span>
                            <span className="text-slate-500">
                              الحالة: <strong className="text-slate-800">{p.status}</strong> • السعر:{" "}
                              <strong className="text-emerald-700">{Number(p.price || 0).toLocaleString()} ج.م</strong>
                            </span>
                          </div>
                          <Link
                            href={`/properties/${p.slug || p.id}`}
                            target="_blank"
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-1"
                          >
                            <span>معاينة</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 2: Conversations & Inquiries */}
                {detailTab === "conversations" && (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {[...selectedUserDetail.inquiriesReceived, ...selectedUserDetail.inquiriesSent].length === 0 ? (
                      <p className="text-xs text-slate-400 py-8 text-center">لا توجد محادثات مرتبطة بهذا المستخدم.</p>
                    ) : (
                      [...selectedUserDetail.inquiriesReceived, ...selectedUserDetail.inquiriesSent].map((inq: any) => (
                        <div
                          key={inq.id}
                          className="p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900">{inq.propertyTitle || "استفسار عقاري"}</span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {inq.status}
                              </span>
                            </div>
                            <p className="text-slate-600 line-clamp-1">{inq.message}</p>
                            <span className="text-[10px] text-slate-400 block">
                            المرسل: {inq.seekerName || inq.senderName} ({inq.seekerPhone || inq.senderPhone}) • الرسائل: {inq.messagesCount || inq.messages?.length || 1}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveInquiryModal(inq)}
                            className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>فحص المحادثة</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Reports & Audit Logs */}
                {detailTab === "reports" && (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto">
                    {selectedUserDetail.reports.map((rep: any) => (
                      <div key={rep.id} className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-rose-900">بلاغ ({rep.reasonCategory})</span>
                          <span className="text-[10px] font-bold text-rose-700">{rep.status}</span>
                        </div>
                        <p className="text-slate-700">{rep.details}</p>
                      </div>
                    ))}
                    {selectedUserDetail.auditLogs.map((ev: any) => (
                      <div key={ev.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-indigo-700">{ev.action}</span>
                          <p className="text-[11px] text-slate-500 font-mono">{JSON.stringify(ev.details)}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(ev.timestamp).toLocaleString("ar-EG")}
                        </span>
                      </div>
                    ))}
                    {selectedUserDetail.reports.length === 0 && selectedUserDetail.auditLogs.length === 0 && (
                      <p className="text-xs text-slate-400 py-8 text-center">لا توجد بلاغات أو سجلات تدقيق لهذا الحساب.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Inquiry Chat Modal for inspecting user conversation directly */}
      {activeInquiryModal && (
        <InquiryChatModal
          inquiryId={activeInquiryModal.id}
          isOpen={!!activeInquiryModal}
          currentUserRole="admin"
          isSupervisor={true}
          onClose={() => setActiveInquiryModal(null)}
        />
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">إضافة موظف إدارة جديد</h3>
                  <p className="text-xs text-slate-500">
                    إنشاء حساب إداري وتحديد الصلاحيات المسموح بها للموظف
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs font-bold text-slate-700">
              <div>
                <label className="block mb-1.5">اسم الموظف (اختياري)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أحمد مصطفى"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1.5">البريد الإلكتروني لتسجيل الدخول برمز OTP</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@company.com"
                  dir="ltr"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white text-left"
                />
                <p className="mt-1.5 text-[10px] text-slate-500">يدخل الموظف باستخدام رمز التحقق المرسل إلى هذا البريد؛ لا حاجة لكلمة مرور.</p>
              </div>

              {/* Role Preset */}
              <div>
                <label className="block mb-1.5">الدور الوظيفي الرئيسي</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "moderator", label: "مشرف مشاريع" },
                    { id: "support_agent", label: "أخصائي دعم ورسائل" },
                    { id: "content_editor", label: "مسؤول محتوى وهوية" },
                    { id: "superadmin", label: "مدير بصلاحيات كاملة" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleRolePresetChange(preset.id)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedRole === preset.id
                          ? "bg-indigo-700 text-white border-indigo-700 font-black"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular Permissions Selection */}
              <div>
                <label className="block mb-2">تحديد الصلاحيات الممنوحة للموظف:</label>
                <div className="space-y-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = selectedPermissions.includes(perm.id);
                    const IconComp = perm.icon;

                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-indigo-50/70 border-indigo-200 ring-1 ring-indigo-500/20"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100/60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-700"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <IconComp className={`w-3.5 h-3.5 ${perm.color}`} />
                            <span className="font-black text-slate-900">{perm.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {perm.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white text-xs font-black cursor-pointer shadow-md shadow-indigo-700/20"
                >
                  {submitting ? "جاري الإنشاء..." : "إنشاء الحساب وتفعيل الصلاحيات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
