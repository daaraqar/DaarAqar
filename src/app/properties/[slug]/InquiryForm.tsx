"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Building2,
  MessageSquare,
  ArrowRight,
  Lock,
  Sparkles,
  UserCheck,
} from "lucide-react";

import InquiryChatModal from "@/components/chat/InquiryChatModal";

interface InquiryFormProps {
  propertyId: string;
  propertyTitle: string;
  advertiserId?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
  initialUser?: any;
  autoOpenExistingChat?: boolean;
}

export default function InquiryForm({
  propertyId,
  propertyTitle,
  advertiserId,
  isOwner = false,
  isAdmin = false,
  initialUser,
  autoOpenExistingChat = false,
}: InquiryFormProps) {
  const pathname = usePathname();
  const redirectUrl = pathname || `/properties/${propertyId}`;

  const [currentUser, setCurrentUser] = useState<any>(initialUser || null);
  const [authLoaded, setAuthLoaded] = useState(initialUser !== undefined);
  const [seekerName, setSeekerName] = useState(initialUser?.name || "");
  const [seekerPhone, setSeekerPhone] = useState(initialUser?.phone || "");
  const [message, setMessage] = useState("مرحباً، أنا مهتم بهذا العقار وأود تحديد موعد للمعاينة والاستفسار عن تفاصيل إضافية.");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInquiryId, setCreatedInquiryId] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          setSeekerName(data.user.name || "");
          setSeekerPhone(data.user.phone || "");

          // Check if user already has an active inquiry/chat for this property
          fetch("/api/inquiries?mode=seeker")
            .then((r) => r.json())
            .then((inqData) => {
              if (Array.isArray(inqData?.inquiries)) {
                const existing = inqData.inquiries.find(
                  (inq: any) => inq.propertyId === propertyId || inq.propertySlug === propertyId
                );
                if (existing?.id) {
                  setCreatedInquiryId(existing.id);
                  if (autoOpenExistingChat) {
                    setShowChatModal(true);
                  }
                }
              }
            })
            .catch(() => {});
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, [propertyId, autoOpenExistingChat]);

  const isUserAdmin = Boolean(
    isAdmin ||
    currentUser?.role === "admin" ||
    currentUser?.role === "superadmin" ||
    initialUser?.role === "admin" ||
    initialUser?.role === "superadmin"
  );

  const isUserOwner = Boolean(
    isOwner ||
    (currentUser && advertiserId && currentUser.id === advertiserId)
  );

  // 1. Admin Supervisory Oversight View
  if (isUserAdmin) {
    return (
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white text-center space-y-4 shadow-lg border border-slate-700 animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <ShieldCheck className="w-7 h-7 text-amber-400" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-xs">
            <span>لوحة رقابة الإدارة 🛡️</span>
          </span>
          <h5 className="font-black text-white text-sm pt-2">شريط الإشراف والتحكم الإداري</h5>
          <p className="text-xs text-slate-300 leading-relaxed font-medium max-w-sm mx-auto">
            أنت تشاهد هذا الإعلان بصفة إدارة المنصة. استمارة التواصل مخصصة للمشترين فقط.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-slate-700/60 text-xs font-bold">
          <Link
            href={`/admin?tab=projects&search=${encodeURIComponent(propertyTitle || propertyId)}`}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Building2 className="w-4 h-4" />
            <span>تعديل وحالة الإعلان في الإدارة</span>
          </Link>

          <Link
            href="/admin?tab=projects"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>إيقاف مؤقت / تعليق الإعلان</span>
          </Link>

          <Link
            href="/admin?tab=messages"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>سجل الرسائل في الإدارة</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Owner Management View
  if (isUserOwner) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-50/90 via-white to-amber-50/70 border border-brand-200/90 text-center space-y-4 animate-in fade-in shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto shadow-inner">
          <ShieldCheck className="w-7 h-7 text-brand-600" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-brand-600 text-white shadow-xs">
            <span>أنت صاحب هذا الإعلان 👑</span>
          </span>
          <h5 className="font-black text-slate-900 text-sm pt-1.5">إدارة الإعلان والطلبات الواردة</h5>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            نموذج التواصل مخصص للعملاء والمشترين. يمكنك متابعة الاستفسارات الواردة، الرد على الرسائل، أو تعديل وتحديث تفاصيل العقار من لوحة التحكم الخاصة بك.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-brand-200/60">
          <Link
            href="/dashboard/properties"
            className="w-full py-2.5 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 transition-all cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>لوحة تحكم إعلاناتي</span>
          </Link>
          <Link
            href="/dashboard/inquiries"
            className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <span>الرسائل والاستفسارات</span>
          </Link>
        </div>
      </div>
    );
  }

  // 2. Loading State Placeholder
  if (!authLoaded) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 animate-pulse space-y-4 text-center">
        <div className="w-12 h-12 bg-slate-200 rounded-2xl mx-auto" />
        <div className="h-4 bg-slate-200 rounded-md w-3/4 mx-auto" />
        <div className="h-3 bg-slate-200 rounded-md w-1/2 mx-auto" />
        <div className="h-10 bg-slate-200 rounded-xl w-full" />
      </div>
    );
  }

  // 3. Guest / Visitor Login Prompt Card (Gated Inquiries)
  if (!currentUser) {
    return (
      <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-brand-50/80 via-white to-slate-50 border border-brand-200/90 text-center space-y-4 animate-in fade-in shadow-xs">
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-white flex items-center justify-center mx-auto shadow-md shadow-brand-600/30">
          <MessageSquare className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
            <Lock className="w-2.5 h-2.5 stroke-[3]" />
          </span>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-black text-slate-900">
            تواصل مباشرة مع صاحب العقار 💬
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed font-medium max-w-sm mx-auto">
            لضمان أمان التواصل وجدية المعاينة، يرجى تسجيل الدخول أو إنشاء حساب سريع للبدء في مراسلة المعلن.
          </p>
        </div>

        {/* Security & Benefits Badges */}
        <div className="bg-white/90 rounded-xl p-3 border border-brand-100 text-[11px] text-slate-700 space-y-2 text-right font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
            <span>محادثة خاصة ومباشرة مع صاحب الإعلان.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>حفظ مواعيد المعاينة ومتابعة الردود بسهولة من حسابك.</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>توثيق الهوية لضمان جدية الطرفين وحماية البيانات.</span>
          </div>
        </div>

        <div className="pt-1 space-y-2">
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}
            className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-all cursor-pointer active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            <span>تسجيل الدخول للتواصل</span>
          </Link>
          <p className="text-[10px] text-slate-400 font-medium">
            تسجيل دخول سريع برمز تحقق يُرسل إلى بريدك الإلكتروني، دون الحاجة إلى كلمة مرور
          </p>
        </div>
      </div>
    );
  }

  // 4. Authenticated Inquiry Form Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          propertyTitle,
          seekerId: currentUser.id,
          seekerName: seekerName.trim(),
          seekerPhone: seekerPhone.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setError(null);
        setMessage("");
        if (data.inquiry?.id) {
          setCreatedInquiryId(data.inquiry.id);
          setShowChatModal(true);
        }
      } else {
        setError(data.error || "تعذر إرسال الطلب، يرجى المحاولة لاحقاً.");
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Success State
  if (success) {
    return (
      <div className="p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-center space-y-3.5 animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h5 className="font-black text-slate-900 text-sm">تم إرسال طلب التواصل والمعاينة بنجاح!</h5>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            تم ربط طلبك بحسابك وفتح محادثة مباشرة مع المعلن.
          </p>
        </div>

        {createdInquiryId && (
          <button
            type="button"
            onClick={() => setShowChatModal(true)}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-all cursor-pointer active:scale-95"
          >
            <MessageCircle className="w-4 h-4" />
            <span>فتح الشات الخاص للمعاينة الآن 💬</span>
          </button>
        )}

        <div className="pt-1">
          <button
            onClick={() => {
              setSuccess(false);
              setMessage("مرحباً، أود استفساراً إضافياً بخصوص العقار.");
            }}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition-colors"
          >
            إرسال طلب أو استفسار آخر
          </button>
        </div>

        {createdInquiryId && (
          <InquiryChatModal
            inquiryId={createdInquiryId}
            isOpen={showChatModal}
            onClose={() => setShowChatModal(false)}
            currentUserRole="buyer"
            currentUserId={currentUser?.id}
          />
        )}
      </div>
    );
  }

  // 6. Authenticated Inquiry Form
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      <div className="border-b border-slate-100 pb-2.5 mb-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="text-sm font-extrabold text-slate-900">
            طلب معاينة أو استفسار
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-brand-600" />
            <span>حساب مسجل</span>
          </span>
        </div>
        <p className="text-xs text-slate-500">
          أدخل اسمك ورقم هاتفك ليتواصل معك المعلن، ثم أرسل رسالتك الأولية.
        </p>
      </div>

      {createdInquiryId && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-emerald-900">
            لديك محادثة مفتوحة بخصوص هذا العقار
          </span>
          <button
            type="button"
            onClick={() => setShowChatModal(true)}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[11px] flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>فتح الشات المباشر</span>
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="inquiry-seeker-name" className="block font-bold text-slate-700 mb-1">الاسم</label>
        <input
          id="inquiry-seeker-name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          value={seekerName}
          onChange={(e) => setSeekerName(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all"
        />
      </div>

      <div>
        <label htmlFor="inquiry-seeker-phone" className="block font-bold text-slate-700 mb-1">رقم الهاتف</label>
        <input
          id="inquiry-seeker-phone"
          type="tel"
          required
          maxLength={24}
          autoComplete="tel"
          dir="ltr"
          value={seekerPhone}
          onChange={(e) => setSeekerPhone(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 text-left focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all"
        />
      </div>

      <div>
        <label className="block font-bold text-slate-700 mb-1">الرسالة الأولية</label>
        <textarea
          required
          rows={3}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all leading-relaxed"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-brand-600/25 transition-all cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري إرسال طلبك...</span>
          </>
        ) : (
          <>
            <Send className="w-3.5 h-3.5" />
            <span>إرسال طلب التواصل والمعاينة</span>
          </>
        )}
      </button>

      {createdInquiryId && (
        <InquiryChatModal
          inquiryId={createdInquiryId}
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          currentUserRole="buyer"
          currentUserId={currentUser?.id}
        />
      )}
    </form>
  );
}
