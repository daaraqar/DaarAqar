"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Send,
  Shield,
  ShieldCheck,
  Building2,
  User,
  Clock,
  CheckCheck,
  Loader2,
  Phone,
  MessageCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Tag,
  ExternalLink,
  MapPin,
  CheckCircle,
  ChevronDown,
  Lock,
} from "lucide-react";
import { ChatMessage, Inquiry, InquiryStatus, UserRole } from "@/lib/db/types";
import { App } from "@capacitor/app";
import { createClient as createSupabaseClient } from "@/utils/supabase/client";
import { playMessageChime } from "@/lib/utils/chatSound";
import {
  DisplayMessage,
  MAX_REALTIME_RECONNECT_ATTEMPTS,
  computeReconnectDelayMs,
  mergeMessages,
  markOptimisticMessageFailed,
  markOptimisticMessageSending,
} from "@/lib/chat/messageReliability";

export { mergeMessages };

interface InquiryChatModalProps {
  inquiryId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: UserRole;
  currentUserId?: string;
  isSupervisor?: boolean;
}

const INQUIRY_STATUS_CONFIG: Record<string, { label: string; badgeClass: string; desc: string }> = {
  new: { label: "طلب جديد", badgeClass: "bg-blue-500/20 text-blue-300 border-blue-400/40", desc: "بانتظار رد المالك" },
  contacted: { label: "قيد التواصل 💬", badgeClass: "bg-amber-500/20 text-amber-300 border-amber-400/40", desc: "المحادثة جارية بين الطرفين" },
  viewing_scheduled: { label: "موعد معاينة محدد 📅", badgeClass: "bg-purple-500/20 text-purple-300 border-purple-400/40", desc: "تم الاتفاق على موعد معاينة ميداني" },
  negotiating: { label: "قيد التفاوض 🤝", badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-400/40", desc: "جاري التفاوض على السعر والشروط" },
  deal_closed: { label: "تم الاتفاق والصفقة 🎉", badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40", desc: "تمت الصفقة بنجاح" },
  closed: { label: "مكتمل / مغلق 🔒", badgeClass: "bg-slate-500/20 text-slate-300 border-slate-400/40", desc: "تم إغلاق هذا الطلب" },
  spam: { label: "ملغي / بلاغ ⚠️", badgeClass: "bg-rose-500/20 text-rose-300 border-rose-400/40", desc: "طلب غير جاد أو تم الإبلاغ عنه" },
};

export default function InquiryChatModal({
  inquiryId,
  isOpen,
  onClose,
  currentUserRole,
  currentUserId,
  isSupervisor = false,
}: InquiryChatModalProps) {
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendBannerError, setSendBannerError] = useState<string | null>(null);
  const [serverViewer, setServerViewer] = useState<{
    id: string;
    name?: string;
    role?: string;
    participantRole?: "admin" | "owner" | "buyer";
  } | null>(null);
  const [adminNoteMode, setAdminNoteMode] = useState(false);
  const [internalNoteMode, setInternalNoteMode] = useState(false);

  // Modals for Buyer & Owner specific actions
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [viewingDate, setViewingDate] = useState("غداً عصراً (4:00 - 6:00 مساءً)");
  const [customViewingDate, setCustomViewingDate] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pausePollingUntilRef = useRef<number>(0);
  const failedAttemptsRef = useRef<number>(0);
  const hasLoadedSuccessfullyRef = useRef<boolean>(false);
  const activeInquiryIdRef = useRef<string>(inquiryId);
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnectedRef = useRef<boolean>(false);

  const effectiveUserId = currentUserId || serverViewer?.id;
  const effectiveIsSupervisor = Boolean(
    isSupervisor ||
      serverViewer?.participantRole === "admin" ||
      currentUserRole === "admin"
  );

  // Accurately determine whether the viewer is the property advertiser/owner or the buyer in THIS inquiry
  const isOwner = Boolean(
    !effectiveIsSupervisor &&
      (serverViewer?.participantRole
        ? serverViewer.participantRole === "owner"
        : inquiry && effectiveUserId
        ? inquiry.advertiserId === effectiveUserId &&
          inquiry.seekerId !== effectiveUserId
        : currentUserRole === "owner" || currentUserRole === "broker")
  );

  const isBuyer = Boolean(
    !effectiveIsSupervisor &&
      (serverViewer?.participantRole
        ? serverViewer.participantRole === "buyer"
        : !isOwner)
  );

  const effectiveUserIdRef = useRef<string | undefined>(effectiveUserId);
  effectiveUserIdRef.current = effectiveUserId;
  const isSupervisorRef = useRef<boolean>(effectiveIsSupervisor);
  isSupervisorRef.current = effectiveIsSupervisor;

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  // Stable fetchMessages callback (depends ONLY on inquiryId so it never triggers an effect loop on state updates)
  const fetchMessages = useCallback(
    async (silent = false) => {
      const targetId = inquiryId?.trim();
      if (!targetId) return;

      if (silent && Date.now() < pausePollingUntilRef.current) {
        return;
      }

      if (!silent && !hasLoadedSuccessfullyRef.current) {
        setLoading(true);
      }

      if (!silent && fetchAbortControllerRef.current) {
        try {
          fetchAbortControllerRef.current.abort();
        } catch {}
      }

      const controller = new AbortController();
      if (!silent) {
        fetchAbortControllerRef.current = controller;
      }

      try {
        const res = await fetch(`/api/inquiries/${targetId}/messages`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        // Guard against stale response if user switched conversation while request was in flight
        if (activeInquiryIdRef.current !== targetId) {
          return;
        }

        const data = await res.json();

        if (activeInquiryIdRef.current !== targetId) {
          return;
        }

        if (res.ok && data.success) {
          failedAttemptsRef.current = 0;
          hasLoadedSuccessfullyRef.current = true;
          if (data.inquiry) setInquiry(data.inquiry);
          if (data.viewer) setServerViewer(data.viewer);
          setMessages((prev) =>
            mergeMessages(prev, data.messages || [], targetId)
          );
          setError(null);
          if (typeof window !== "undefined" && !silent) {
            window.dispatchEvent(new CustomEvent("messages-read"));
          }
        } else {
          if (res.status === 401 || res.status === 403) {
            const authErrMsg =
              data?.error ||
              (res.status === 401
                ? "انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول."
                : "غير مصرح لك بالاطلاع على هذه المحادثة.");
            setError(authErrMsg);
            setSendBannerError(authErrMsg);
            return;
          }

          if (hasLoadedSuccessfullyRef.current) {
            console.warn(
              "[ChatModal] Background sync warning:",
              { inquiryId: targetId, status: res.status }
            );
            return;
          }

          failedAttemptsRef.current += 1;
          if (failedAttemptsRef.current >= 2 || res.status === 404) {
            setError(data?.error || "طلب التواصل والمعاينة غير موجود");
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || activeInquiryIdRef.current !== targetId) {
          return;
        }

        if (hasLoadedSuccessfullyRef.current) {
          console.warn(
            "[ChatModal] Transient network glitch during background sync:",
            { inquiryId: targetId }
          );
          return;
        }

        failedAttemptsRef.current += 1;
        if (failedAttemptsRef.current >= 2) {
          setError("خطأ في الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت.");
        }
      } finally {
        if (!silent && activeInquiryIdRef.current === targetId) {
          setLoading(false);
        }
      }
    },
    [inquiryId]
  );

  // Conversation lifecycle, Realtime subscription with controlled backoff recovery, and background sync
  useEffect(() => {
    const targetId = inquiryId?.trim();
    activeInquiryIdRef.current = targetId;

    if (!isOpen || !targetId) {
      failedAttemptsRef.current = 0;
      return;
    }

    // Reset state cleanly when opening or switching conversation IDs to prevent cross-chat leakage
    setInquiry(null);
    setMessages([]);
    setError(null);
    setSendBannerError(null);
    setServerViewer(null);
    setLoading(true);
    failedAttemptsRef.current = 0;
    hasLoadedSuccessfullyRef.current = false;
    reconnectAttemptRef.current = 0;
    wasDisconnectedRef.current = false;

    fetchMessages(false);

    let isDisposed = false;
    let currentChannel: any = null;
    let supabaseInstance: any = null;

    const cleanupChannel = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (currentChannel && supabaseInstance) {
        try {
          supabaseInstance.removeChannel(currentChannel);
        } catch {}
        currentChannel = null;
      }
    };

    const setupRealtimeChannel = () => {
      if (isDisposed || activeInquiryIdRef.current !== targetId) return;
      cleanupChannel();

      try {
        supabaseInstance = createSupabaseClient();
        currentChannel = supabaseInstance
          .channel(`inquiry_chat_${targetId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "inquiry_messages",
              filter: `inquiry_id=eq.${targetId}`,
            },
            (payload: any) => {
              if (
                isDisposed ||
                activeInquiryIdRef.current !== targetId ||
                !payload?.new ||
                payload.new.inquiry_id !== targetId
              ) {
                return;
              }

              const rawContent = String(payload.new.content || "");
              const isInternal = Boolean(
                payload.new.is_internal_note ||
                  rawContent.startsWith("[ملاحظة داخلية للإدارة]")
              );
              if (isInternal && !isSupervisorRef.current) return;

              const incomingMsg: ChatMessage = {
                id: payload.new.id,
                inquiryId: payload.new.inquiry_id,
                senderId: payload.new.sender_id || "guest",
                senderName: payload.new.sender_name || "عضو",
                senderRole: payload.new.sender_role || "buyer",
                content: rawContent,
                createdAt: payload.new.created_at || new Date().toISOString(),
                isAdminNote: Boolean(payload.new.is_admin_note),
                isInternalNote: isInternal,
                isRead: Boolean(payload.new.is_read),
              };
              setMessages((prev) =>
                mergeMessages(prev, [incomingMsg], targetId)
              );
              scrollToBottom(true);
              if (
                incomingMsg.senderId &&
                incomingMsg.senderId !== effectiveUserIdRef.current
              ) {
                playMessageChime();
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "inquiry_messages",
              filter: `inquiry_id=eq.${targetId}`,
            },
            (payload: any) => {
              if (
                isDisposed ||
                activeInquiryIdRef.current !== targetId ||
                !payload?.new ||
                payload.new.inquiry_id !== targetId
              ) {
                return;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === payload.new.id
                    ? { ...m, isRead: Boolean(payload.new.is_read) }
                    : m
                )
              );
            }
          )
          .subscribe((status: string) => {
            if (isDisposed || activeInquiryIdRef.current !== targetId) return;

            if (status === "SUBSCRIBED") {
              const shouldResync =
                wasDisconnectedRef.current || reconnectAttemptRef.current > 0;
              reconnectAttemptRef.current = 0;
              wasDisconnectedRef.current = false;
              if (shouldResync) {
                fetchMessages(true);
              }
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              wasDisconnectedRef.current = true;
              if (
                reconnectAttemptRef.current < MAX_REALTIME_RECONNECT_ATTEMPTS
              ) {
                reconnectAttemptRef.current += 1;
                const delayMs = computeReconnectDelayMs(
                  reconnectAttemptRef.current
                );
                if (reconnectTimerRef.current) {
                  clearTimeout(reconnectTimerRef.current);
                }
                reconnectTimerRef.current = setTimeout(() => {
                  if (!isDisposed && activeInquiryIdRef.current === targetId) {
                    setupRealtimeChannel();
                    fetchMessages(true);
                  }
                }, delayMs);
              }
            }
          });
      } catch (err) {
        console.warn("[ChatModal] Realtime channel setup notice:", {
          inquiryId: targetId,
        });
      }
    };

    setupRealtimeChannel();

    const interval = setInterval(() => {
      fetchMessages(true);
    }, 3500);

    const handleResume = () => {
      if (isDisposed || activeInquiryIdRef.current !== targetId) return;
      fetchMessages(true);
      if (wasDisconnectedRef.current || !currentChannel) {
        reconnectAttemptRef.current = 0;
        setupRealtimeChannel();
      }
    };

    const handleOffline = () => {
      wasDisconnectedRef.current = true;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleResume);
    window.addEventListener("online", handleResume);
    window.addEventListener("offline", handleOffline);

    let appListenerHandle: { remove: () => void } | null = null;
    try {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          handleResume();
        }
      }).then((handle) => {
        if (isDisposed) {
          try {
            handle.remove();
          } catch {}
        } else {
          appListenerHandle = handle;
        }
      });
    } catch {}

    return () => {
      isDisposed = true;
      clearInterval(interval);
      if (fetchAbortControllerRef.current) {
        try {
          fetchAbortControllerRef.current.abort();
        } catch {}
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("online", handleResume);
      window.removeEventListener("offline", handleOffline);
      if (appListenerHandle) {
        try {
          appListenerHandle.remove();
        } catch {}
      }
      cleanupChannel();
    };
  }, [isOpen, inquiryId, fetchMessages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom(!loading);
    }
  }, [messages.length, isOpen, loading, scrollToBottom]);

  // Core send function supporting direct action triggers and idempotent retry of failed messages
  const sendMessageDirectly = async (
    text: string,
    asAdminNote = false,
    asInternalNote = false,
    existingTempId?: string
  ) => {
    if (!text.trim() || sending) return;

    const targetId = inquiryId?.trim();
    if (!targetId) return;

    const rawText = text.trim();
    const contentToSend =
      effectiveIsSupervisor &&
      asInternalNote &&
      !rawText.startsWith("[ملاحظة داخلية للإدارة]")
        ? `[ملاحظة داخلية للإدارة] ${rawText}`
        : rawText;
    const tempId =
      existingTempId ||
      `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    pausePollingUntilRef.current = Date.now() + 3500;
    setSending(true);
    setSendBannerError(null);

    let safeSenderRole: "buyer" | "seeker" | "owner" | "broker" | "admin" = "buyer";
    if (effectiveIsSupervisor) {
      safeSenderRole = "admin";
    } else if (isOwner) {
      safeSenderRole = "owner";
    }

    if (existingTempId) {
      setMessages((prev) => markOptimisticMessageSending(prev, tempId));
    } else {
      const optimisticMsg: DisplayMessage = {
        id: tempId,
        clientTempId: tempId,
        inquiryId: targetId,
        senderId: effectiveUserId || "me",
        senderName: effectiveIsSupervisor
          ? asInternalNote
            ? "ملاحظة رقابية داخلية (للإدارة فقط 🔒)"
            : "إدارة منصة دار العقار 🛡️"
          : isBuyer
          ? serverViewer?.name || inquiry?.seekerName || "أنا (المشتري)"
          : serverViewer?.name || inquiry?.advertiserName || "أنا (المالك / المعلن)",
        senderRole: safeSenderRole,
        content: contentToSend,
        createdAt: new Date().toISOString(),
        isAdminNote: effectiveIsSupervisor && (asAdminNote || asInternalNote),
        isInternalNote: effectiveIsSupervisor && asInternalNote,
        asAdminNote,
        asInternalNote,
        isPending: true,
        sendStatus: "sending",
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToBottom(true);
    }

    try {
      const res = await fetch(`/api/inquiries/${targetId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: rawText,
          isAdminNote: effectiveIsSupervisor && (asAdminNote || asInternalNote),
          isInternalNote: effectiveIsSupervisor && asInternalNote,
          clientTempId: tempId,
        }),
      });

      const data = await res.json();
      if (activeInquiryIdRef.current !== targetId) return;

      if (res.ok && data.success && data.message?.id) {
        setMessages((prev) =>
          mergeMessages(
            prev,
            [{ ...data.message, clientTempId: tempId, sendStatus: "sent" }],
            targetId
          )
        );
        if (data.inquiry) setInquiry(data.inquiry);
        setSendBannerError(null);
        scrollToBottom(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("messages-updated"));
        }
      } else {
        const failReason =
          data?.error ||
          (res.status === 401
            ? "انتهت الجلسة، يرجى إعادة تسجيل الدخول ثم إعادة المحاولة."
            : res.status === 403
            ? "غير مصرح لك بإرسال رسائل في هذه المحادثة."
            : "تعذر حفظ الرسالة في الخادم، يمكنك إعادة المحاولة.");
        setMessages((prev) =>
          markOptimisticMessageFailed(prev, tempId, failReason)
        );
        setSendBannerError(failReason);
      }
    } catch {
      if (activeInquiryIdRef.current !== targetId) return;
      const netErr =
        "تعذر الاتصال بالخادم أثناء الإرسال. تم الاحتفاظ برسالتك لإعادة المحاولة.";
      setMessages((prev) => markOptimisticMessageFailed(prev, tempId, netErr));
      setSendBannerError(netErr);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending) return;
    const text = inputText;
    setInputText("");
    await sendMessageDirectly(
      text,
      effectiveIsSupervisor && adminNoteMode,
      effectiveIsSupervisor && internalNoteMode
    );
  };

  // Status Updater
  const handleUpdateStatus = async (newStatus: InquiryStatus) => {
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.inquiry) setInquiry(data.inquiry);
        fetchMessages(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSendBannerError(errData?.error || "تعذر تحديث حالة الطلب حالياً");
      }
    } catch {
      setSendBannerError("خطأ في الاتصال أثناء تحديث حالة الطلب");
    }
  };

  // Buyer Specific Action Handlers
  const handleSendViewingProposal = (dateStr: string) => {
    const text = `📅 طلب موعد معاينة ميدانية:\nأقترح زيارة ومعاينة العقار في موعد: [${dateStr}].\nيرجى تأكيد الموعد ومشاركة تفاصيل التنسيق.`;
    sendMessageDirectly(text);
  };

  const handleSendPriceOffer = (amountStr: string) => {
    const num = Number(amountStr);
    const formatted = !isNaN(num) ? `${num.toLocaleString("ar-EG")} ج.م` : `${amountStr} ج.م`;
    const text = `💰 تقديم سومة / عرض سعر:\nأود تقديم عرض سعر جاد بقيمة [${formatted}] لشراء/استئجار هذا العقار. هل السعر يناسبكم؟`;
    sendMessageDirectly(text);
  };

  // Owner Specific Action Handlers
  const handleConfirmViewing = async () => {
    const text = `✅ تم تأكيد موعد المعاينة!\nنرحب بكم في موقع العقار. يُرجى التواصل قبل الموعد بنصف ساعة للتنسيق الميداني المباشر.`;
    await sendMessageDirectly(text);
    await handleUpdateStatus("viewing_scheduled");
  };

  const handleShareLocation = () => {
    const text = `📍 تفاصيل الموقع والوصول:\nالعقار متاح بالحي المحدد في تفاصيل الإعلان، ويسعدنا استقبالكم في الموعد المحدد للتنسيق المباشر والمرافقة للمعاينة.`;
    sendMessageDirectly(text);
  };

  if (!isOpen) return null;

  const currentStatus = inquiry?.status || "new";
  const statusInfo = INQUIRY_STATUS_CONFIG[currentStatus] || INQUIRY_STATUS_CONFIG.new;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[92vh] max-h-[740px] animate-in zoom-in-95 duration-200">
        
        {/* ========================================================
            1. PRIMARY HEADER (Brand Gradient + Close)
            ======================================================== */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white flex items-center justify-between border-b border-brand-800/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-brand-600/30 border border-brand-400/40 flex items-center justify-center text-brand-300 shrink-0 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-white truncate">
                  شات التواصل والمعاينة المباشر
                </h3>
                {isSupervisor ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold text-[10px] flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>وضع إشراف الإدارة 🛡️</span>
                  </span>
                ) : isOwner ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 font-bold text-[10px]">
                    أنت صاحب الإعلان 👑
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/40 font-bold text-[10px]">
                    مشتري 👤
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                محادثة مباشرة بين المهتم والمعلن
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================
            2. INTERACTIVE PROPERTY & STATUS CONTEXT BAR
            ======================================================== */}
        <div className="bg-slate-900/95 text-white px-3.5 py-2.5 flex items-center justify-between gap-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {inquiry?.propertyImage ? (
              <img
                src={inquiry.propertyImage}
                alt={inquiry.propertyTitle || "عقار"}
                className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700 bg-slate-800"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                <Building2 className="w-5 h-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-white text-xs truncate max-w-[180px] sm:max-w-xs">
                  {inquiry?.propertyTitle || "طلب العقار"}
                </h4>
                {inquiry?.propertyPrice ? (
                  <span className="text-emerald-400 font-extrabold text-[11px] shrink-0 font-mono">
                    {inquiry.propertyPrice.toLocaleString("ar-EG")} ج.م
                  </span>
                ) : null}
              </div>

              {/* Status Pill Indicator */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${statusInfo.badgeClass}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>{statusInfo.label}</span>
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">• {statusInfo.desc}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* View Property Page in New Tab */}
            {(inquiry?.propertySlug || inquiry?.propertyId) && (
              <a
                href={`/properties/${inquiry.propertySlug || inquiry.propertyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition"
                title="فتح صفحة العقار في نافذة جديدة"
              >
                <span>معاينة العقار</span>
                <ExternalLink className="w-3 h-3 text-emerald-400" />
              </a>
            )}

            {/* Status Update Trigger for Owner / Admin */}
            {(isOwner || isSupervisor) && (
              <button
                type="button"
                onClick={() => setShowStatusModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-black flex items-center gap-1 shadow-xs transition cursor-pointer"
                title="تحديث حالة ومرحلة الطلب"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">تحديث الحالة</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            4. CLIENT & ADVERTISER LEAD INFORMATION BAR
            ======================================================== */}
        {inquiry && (
          <div className="bg-slate-100/90 border-b border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 flex-wrap">
              {(isOwner || isSupervisor) && (
                <>
                  <span className="flex items-center gap-1 font-black text-slate-900">
                    <User className="w-3.5 h-3.5 text-brand-600" />
                    <span>العميل: {inquiry.seekerName || "زائر مهتم"}</span>
                  </span>

                  {inquiry.seekerPhone && (
                    <span className="flex items-center gap-1 font-bold text-slate-700 font-mono text-[11px]" dir="ltr">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{inquiry.seekerPhone}</span>
                    </span>
                  )}
                </>
              )}

              {(isBuyer || isSupervisor) && (
                <span className="flex items-center gap-1 font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[11px]">
                  <Building2 className="w-3 h-3 text-emerald-600" />
                  <span>المعلن: {inquiry.advertiserName || "المالك / الوسيط"}</span>
                  {isSupervisor && inquiry.advertiserPhone ? (
                    <span className="font-mono text-emerald-700 mr-1" dir="ltr">
                      ({inquiry.advertiserPhone})
                    </span>
                  ) : null}
                </span>
              )}

              {inquiry.preferredContact && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                  المفضل: {inquiry.preferredContact === "whatsapp" ? "واتساب" : inquiry.preferredContact === "call" ? "اتصال" : "رسائل المنصة"}
                </span>
              )}
            </div>

            {(isOwner || isSupervisor) && (
              <div className="flex items-center gap-1.5">
                {inquiry.seekerPhone && (
                  <>
                    <a
                      href={`tel:${inquiry.seekerPhone.replace(/[^0-9+]/g, "")}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-2xs transition active:scale-95"
                      title="اتصال هاتفي مباشر بالعميل"
                    >
                      <Phone className="w-3 h-3 text-brand-300" />
                      <span>اتصال</span>
                    </a>
                    <a
                      href={`https://wa.me/${inquiry.seekerPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                        `مرحباً ${inquiry.seekerName || ""}، بخصوص طلبك واستفسارك عن العقار "${inquiry.propertyTitle || ""}" على منصة دار العقار.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] shadow-2xs transition active:scale-95"
                      title="محادثة واتساب مباشرة"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>واتساب</span>
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            5. MESSAGE TIMELINE STREAM
            ======================================================== */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-50/70 text-xs">
          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <p className="font-medium text-xs">جاري تحميل رسائل المحادثة...</p>
            </div>
          ) : error && messages.length === 0 ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-center space-y-3 my-8">
              <AlertTriangle className="w-8 h-8 mx-auto text-rose-500" />
              <p className="font-bold text-sm">{error}</p>
              <button
                type="button"
                onClick={() => {
                  failedAttemptsRef.current = 0;
                  setError(null);
                  fetchMessages(false);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <MessageCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600">لا توجد رسائل سابقة</p>
              <p className="text-[11px]">ابدأ بكتابة استفسارك أو طلب موعد للمعاينة الميدانية.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isInternal = Boolean(
                msg.isInternalNote || String(msg.content || "").startsWith("[ملاحظة داخلية للإدارة]")
              );
              const isAdmin = msg.senderRole === "admin" || msg.isAdminNote || isInternal;
              const isBuyerMsg = msg.senderRole === "buyer" || msg.senderRole === "seeker";

              const isFailed = msg.sendStatus === "failed";
              const isSending = Boolean(msg.isPending || msg.sendStatus === "sending");

              const renderFailedRetryControls = () =>
                isFailed ? (
                  <div className="mt-2 pt-2 border-t border-rose-300/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                      <span>{(msg as any).errorMessage || "فشل حفظ الرسالة"}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          sendMessageDirectly(
                            msg.content,
                            Boolean(msg.asAdminNote || msg.isAdminNote),
                            Boolean(msg.asInternalNote || msg.isInternalNote),
                            msg.id
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] shadow-2xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>إعادة المحاولة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputText(
                            String(msg.content || "").replace(/^\[ملاحظة داخلية للإدارة\]\s*/, "")
                          );
                          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
                        }}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10px] transition cursor-pointer"
                      >
                        تعديل النص
                      </button>
                    </div>
                  </div>
                ) : null;

              // Special Confidential Internal Admin Note Bubble (Visible to Admins Only)
              if (isInternal) {
                const cleanInternalText = String(msg.content || "").replace(/^\[ملاحظة داخلية للإدارة\]\s*/, "");
                return (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl bg-gradient-to-r from-purple-950 to-slate-900 border-2 ${
                      isFailed ? "border-rose-500" : "border-purple-500/50"
                    } shadow-sm text-white my-2 max-w-lg mx-auto`}
                  >
                    <div className="flex items-center gap-1.5 text-purple-300 font-black text-[11px] mb-1">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>ملاحظة رقابية داخلية سرية (للإدارة فقط 🔒)</span>
                      <span className="text-[10px] text-purple-300/70 font-normal mr-auto">
                        {isSending
                          ? "جاري الحفظ..."
                          : isFailed
                          ? "تعذر الحفظ"
                          : new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed font-semibold text-purple-50 whitespace-pre-wrap">
                      {cleanInternalText}
                    </p>
                    {renderFailedRetryControls()}
                  </div>
                );
              }

              // Special Admin Supervisory Bubble
              if (isAdmin) {
                return (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 ${
                      isFailed ? "border-rose-400" : "border-amber-300"
                    } shadow-xs text-slate-900 my-2 max-w-lg mx-auto`}
                  >
                    <div className="flex items-center gap-1.5 text-amber-800 font-black text-[11px] mb-1">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>{msg.senderName || "إشراف إدارة دار العقار 🛡️"}</span>
                      <span className="text-[10px] text-amber-600/70 font-normal mr-auto">
                        {isSending
                          ? "جاري الإرسال..."
                          : isFailed
                          ? "تعذر الإرسال"
                          : new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed font-semibold text-amber-950 whitespace-pre-wrap">{msg.content}</p>
                    {renderFailedRetryControls()}
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBuyerMsg ? "items-start" : "items-end"} max-w-[85%] ${
                    isBuyerMsg ? "mr-auto" : "ml-auto"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        isBuyerMsg
                          ? "bg-brand-100 text-brand-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {isBuyerMsg ? "المشتري / الباحث" : "المالك / الوسيط"}
                    </span>
                    <span className="font-bold text-[11px] text-slate-700">{msg.senderName}</span>

                    {isSending ? (
                      <span className="flex items-center gap-1 text-[10px] text-brand-600 font-medium animate-pulse">
                        <Clock className="w-2.5 h-2.5" />
                        <span>جاري الإرسال...</span>
                      </span>
                    ) : isFailed ? (
                      <span className="flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>فشل الإرسال</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            msg.isRead ? "text-emerald-600" : "text-slate-400"
                          }`}
                          title={msg.isRead ? "مقروءة" : "تم الإرسال"}
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span className="text-[9px]">{msg.isRead ? "مقروءة" : "مرسلة"}</span>
                        </span>
                      </span>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl shadow-xs text-xs leading-relaxed transition-opacity ${
                      isSending ? "opacity-80" : "opacity-100"
                    } ${
                      isFailed
                        ? "bg-rose-50 text-slate-900 border-2 border-rose-300"
                        : isBuyerMsg
                        ? "bg-brand-600 text-white rounded-br-none"
                        : "bg-white text-slate-900 border border-slate-200 rounded-bl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {renderFailedRetryControls()}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ========================================================
            6. ROLE-TAILORED ACTION TOOLS & SMART CHIPS
            ======================================================== */}
        <div className="bg-white border-t border-slate-200 px-3.5 py-2 space-y-2">
          
          {/* A. Buyer Action Tools */}
          {isBuyer && !isSupervisor && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setShowViewingModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-[11px] shadow-xs shrink-0 transition active:scale-95 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>طلب موعد معاينة 📅</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOfferModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] shadow-xs shrink-0 transition active:scale-95 cursor-pointer"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>تقديم سومة / عرض سعر 💰</span>
              </button>

              {[
                "هل العقار متاح للمعاينة اليوم؟",
                "هل الأوراق والتراخيص جاهزة ونظامية؟",
                "هل يمكن تزويدي بفيديو تفصيلي؟",
                "هل السعر نهائي أم قابل للتفاوض؟",
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessageDirectly(chip)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-[11px] whitespace-nowrap shrink-0 transition cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* B. Owner Action Tools */}
          {isOwner && !isSupervisor && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={handleConfirmViewing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] shadow-xs shrink-0 transition active:scale-95 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تأكيد موعد المعاينة ✅</span>
              </button>

              <button
                type="button"
                onClick={handleShareLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[11px] shadow-xs shrink-0 transition active:scale-95 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>تفاصيل الموقع 📍</span>
              </button>

              {[
                "العقار متاح للمعاينة، متى يناسبك الحضور؟",
                "السعر قابل للتفاوض البسيط للجادين.",
                "الأوراق ورخصة البناء مستوفاة ومتاحة للاطلاع.",
                "الوحدة شاغرة وجاهزة للاستلام الفوري.",
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessageDirectly(chip)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium text-[11px] whitespace-nowrap shrink-0 transition cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* C. Admin Supervisory Action Tools */}
          {isSupervisor && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminNoteMode}
                    onChange={(e) => {
                      setAdminNoteMode(e.target.checked);
                      if (e.target.checked) setInternalNoteMode(false);
                    }}
                    className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                  />
                  <span>تنبيه إشرافي للطرفين 🛡️</span>
                </label>

                <label className="flex items-center gap-1.5 font-bold text-purple-900 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={internalNoteMode}
                    onChange={(e) => {
                      setInternalNoteMode(e.target.checked);
                      if (e.target.checked) setAdminNoteMode(false);
                    }}
                    className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                  />
                  <Lock className="w-3 h-3 text-purple-700" />
                  <span>ملاحظة داخلية سرية للإدارة فقط 🔒</span>
                </label>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { label: "⚠️ تحذير عدم دفع عربون", text: "⚠️ تنبيه من إدارة المنصة: يرجى عدم تحويل أي مبالغ مالية أو دفع عربون إلا بعد إتمام المعاينة الميدانية وفحص سندات الملكية." },
                  { label: "🛡️ متابعة إشرافية", text: "🛡️ تنويه إداري: نرحب بالطرفين، إدارة منصة دار العقار تشرف على هذا الطلب لضمان سرعة الاستجابة وحماية حقوق الطرفين." },
                  { label: "⚖️ توثيق العقود", text: "⚖️ توجيه نظامي: نحث الطرفين على توثيق كافة بنود الاتفاق المالي وكتابة العقد الرسمي عبر القنوات المعتمدة." },
                ].map((adv, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendMessageDirectly(adv.text, true, false)}
                    className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] whitespace-nowrap shrink-0 transition cursor-pointer"
                  >
                    {adv.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            7. INPUT BAR
            ======================================================== */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-3.5 bg-white border-t border-slate-200">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isSupervisor
                  ? internalNoteMode
                    ? "اكتب ملاحظة رقابية داخلية سرية (تظهر للمشرفين فقط)..."
                    : adminNoteMode
                    ? "اكتب التنبيه الإداري الإشرافي للطرفين..."
                    : "اكتب رسالتك كمشرف على المحادثة..."
                  : isBuyer
                  ? "اكتب رسالتك للمالك بخصوص المعاينة والسعر..."
                  : "اكتب ردك للعميل بخصوص العقار والموعد..."
              }
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-900 focus:bg-white focus:border-brand-600 focus:ring-2 focus:ring-brand-500/10 outline-none transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-brand-600/20 transition-all disabled:opacity-40 cursor-pointer shrink-0 active:scale-95"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">إرسال</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* ========================================================
            8. MODALS (Viewing Proposal, Price Offer, Status Update)
            ======================================================== */}

        {/* Modal: Request Viewing (For Buyer) */}
        {showViewingModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-sm text-slate-900">طلب موعد معاينة ميدانية</h4>
                </div>
                <button onClick={() => setShowViewingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">اختر الموعد المقترح:</label>
                {[
                  "اليوم عصراً (4:00 - 6:00 مساءً)",
                  "غداً صباحاً (10:00 - 12:00 ظهراً)",
                  "غداً عصراً (4:00 - 6:00 مساءً)",
                  "نهاية الأسبوع (الجمعة 3:00 عصراً)",
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setViewingDate(opt)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-right border transition ${
                      viewingDate === opt
                        ? "bg-purple-50 text-purple-800 border-purple-500 shadow-2xs font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}

                <div className="pt-1">
                  <input
                    type="text"
                    value={customViewingDate}
                    onChange={(e) => {
                      setCustomViewingDate(e.target.value);
                      setViewingDate(e.target.value);
                    }}
                    placeholder="أو اكتب موعداً مخصصاً (مثال: يوم الأحد الساعة 5 مساءً)..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSendViewingProposal(viewingDate || customViewingDate || "غداً عصراً");
                    setShowViewingModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs shadow-md shadow-purple-700/20 transition active:scale-95"
                >
                  إرسال طلب الموعد للمالك
                </button>
                <button
                  type="button"
                  onClick={() => setShowViewingModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Make Price Offer (For Buyer) */}
        {showOfferModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <Tag className="w-4 h-4" />
                  </div>
                  <h4 className="font-black text-sm text-slate-900">تقديم سومة / عرض سعر</h4>
                </div>
                <button onClick={() => setShowOfferModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">المبلغ المقترح (بالجنيه المصري):</label>
                <input
                  type="number"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="مثال: 1200000"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                />
                {inquiry?.propertyPrice ? (
                  <p className="text-[11px] text-slate-500">
                    السعر الأصلي المعروض بالإعلان: <strong className="text-slate-800">{inquiry.propertyPrice.toLocaleString("ar-EG")} ج.م</strong>
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={!offerAmount.trim()}
                  onClick={() => {
                    handleSendPriceOffer(offerAmount);
                    setShowOfferModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md shadow-amber-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  إرسال العرض للمالك
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfferModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Update Status (For Owner & Admin) */}
        {showStatusModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900">تحديث مرحلة الطلب</h4>
                <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { key: "new", label: "طلب جديد", desc: "بانتظار رد المالك" },
                  { key: "contacted", label: "قيد التواصل 💬", desc: "المحادثة جارية" },
                  { key: "viewing_scheduled", label: "موعد معاينة محدد 📅", desc: "تم تأكيد موعد المعاينة" },
                  { key: "negotiating", label: "قيد التفاوض 🤝", desc: "تفاوض على السعر والشروط" },
                  { key: "deal_closed", label: "تم الاتفاق والصفقة 🎉", desc: "إتمام الصفقة بنجاح" },
                  { key: "closed", label: "مكتمل / مغلق 🔒", desc: "إنهاء هذا الطلب" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      handleUpdateStatus(item.key as InquiryStatus);
                      setShowStatusModal(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-right border transition flex items-center justify-between ${
                      inquiry?.status === item.key
                        ? "bg-emerald-50 text-emerald-800 border-emerald-500 font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <div>
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{item.desc}</div>
                    </div>
                    {inquiry?.status === item.key && <CheckCheck className="w-4 h-4 text-emerald-600" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
