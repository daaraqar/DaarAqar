import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveInquiry, isCentralDbEnabled } from "@/lib/services/inquiryResolver";
import { createAdminClient } from "@/utils/supabase/server";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sortMessagesDeterministically<T extends { id?: string; createdAt?: string; created_at?: string }>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
    const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

async function evaluateInquiryAccess(user: any, inquiry: any, isProd: boolean, hasCentralDb: boolean) {
  const cleanUserPhone = typeof user.phone === "string" ? user.phone.trim() : "";
  const cleanInqPhone = typeof inquiry.seekerPhone === "string" ? inquiry.seekerPhone.trim() : "";
  const cleanUserEmail = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  const cleanInqEmail = typeof inquiry.seekerEmail === "string" ? inquiry.seekerEmail.trim().toLowerCase() : "";

  const isSeeker =
    inquiry.seekerId === user.id ||
    (Boolean(cleanUserPhone) && cleanInqPhone === cleanUserPhone) ||
    (Boolean(cleanUserEmail) && cleanInqEmail === cleanUserEmail);

  const isAdvertiser = Boolean(inquiry.advertiserId && inquiry.advertiserId === user.id);
  const isAdmin = hasAdminPermission(user, "messages.read");

  let isPropertyOwner = false;
  if (!isAdvertiser && !isSeeker && !isAdmin && inquiry.propertyId) {
    if (hasCentralDb && UUID_REGEX.test(inquiry.propertyId)) {
      try {
        const supabaseAdmin = createAdminClient();
        const { data: propRow } = await supabaseAdmin
          .from("properties")
          .select("advertiser_id, user_id, owner_id")
          .eq("id", inquiry.propertyId)
          .maybeSingle();
        if (
          propRow &&
          (propRow.advertiser_id === user.id ||
            propRow.user_id === user.id ||
            propRow.owner_id === user.id)
        ) {
          isPropertyOwner = true;
        }
      } catch {}
    }
    if (!isPropertyOwner && !isProd) {
      const prop =
        dbStore.getRawPropertyById(inquiry.propertyId) ||
        dbStore.getPropertyByIdOrSlug(inquiry.propertyId);
      if (
        prop &&
        (prop.advertiserId === user.id ||
          (prop as any).userId === user.id ||
          (prop as any).ownerId === user.id)
      ) {
        isPropertyOwner = true;
      }
    }
  }

  const authorized = isSeeker || isAdvertiser || isAdmin || isPropertyOwner;
  const participantRole: "admin" | "owner" | "buyer" = isAdmin
    ? "admin"
    : isAdvertiser || isPropertyOwner
    ? "owner"
    : "buyer";

  return {
    authorized,
    isSeeker,
    isAdvertiser,
    isAdmin,
    isPropertyOwner,
    participantRole,
  };
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const inquiryId = params?.id?.trim();
  if (!inquiryId) {
    return NextResponse.json({ error: "معرف المحادثة مطلوب" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "انتهت الجلسة أو يجب تسجيل الدخول لعرض رسائل المحادثة", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "يلزم ضبط مفتاح خدمة قاعدة البيانات المركزي على الخادم لتفعيل المحادثات", code: "DB_UNAVAILABLE" },
        { status: 503 }
      );
    }

    let inquiry;
    try {
      inquiry = await resolveInquiry(inquiryId);
    } catch (resolveErr: any) {
      console.error("[InquiryMessages][GET] Failed to resolve inquiry:", {
        inquiryId,
        userId: user.id,
        error: resolveErr?.message,
      });
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات المركزية حالياً، يرجى المحاولة بعد قليل.", code: "DB_ERROR" },
        { status: 503 }
      );
    }

    if (!inquiry) {
      return NextResponse.json(
        { error: "طلب التواصل والمعاينة غير موجود", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const access = await evaluateInquiryAccess(user, inquiry, isProd, hasCentralDb);
    if (!access.authorized) {
      console.warn("[InquiryMessages][GET] Unauthorized access blocked:", {
        inquiryId,
        userId: user.id,
        role: user.role,
      });
      return NextResponse.json(
        { error: "غير مصرح لك بالاطلاع على رسائل هذا الطلب", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const isUuid = UUID_REGEX.test(inquiryId);
    let messages: any[] = [];

    // 1. Authoritative Central Database Path
    if (hasCentralDb && isUuid) {
      const supabaseAdmin = createAdminClient();
      const { data: cloudMsgs, error: msgsErr } = await supabaseAdmin
        .from("inquiry_messages")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (msgsErr) {
        console.error("[InquiryMessages][GET] Supabase inquiry_messages select error:", {
          inquiryId,
          userId: user.id,
          code: msgsErr.code,
          message: msgsErr.message,
        });
        return NextResponse.json(
          { error: "تعذر جلب رسائل المحادثة من قاعدة البيانات حالياً، يرجى إعادة المحاولة.", code: "DB_QUERY_FAILED" },
          { status: 503 }
        );
      }

      const isParticipantViewer =
        access.isSeeker ||
        access.isAdvertiser ||
        access.isPropertyOwner ||
        access.isAdmin; // Admin viewing the chat also marks messages read
      const isUserUuid = UUID_REGEX.test(user.id);

      messages = (cloudMsgs || []).map((m: any) => {
        const rawContent = String(m.content || "");
        const isInternal = Boolean(
          m.is_internal_note || rawContent.startsWith("[ملاحظة داخلية للإدارة]")
        );
        const shouldMarkReadNow =
          isParticipantViewer &&
          !isInternal &&
          m.is_read === false &&
          m.sender_id !== user.id;

        return {
          id: m.id,
          inquiryId: m.inquiry_id,
          senderId: m.sender_id || "guest",
          senderName: m.sender_name || "مستخدم",
          senderRole: m.sender_role || "buyer",
          content: rawContent,
          isAdminNote: Boolean(m.is_admin_note),
          isInternalNote: isInternal,
          isRead: Boolean(m.is_read || shouldMarkReadNow),
          createdAt: m.created_at,
        };
      });

      // Mark unread incoming messages as read in Supabase when an actual participant opens the chat.
      // Uses .or('sender_id.is.null,sender_id.neq.<uuid>') because SQL `NULL <> uuid` evaluates to UNKNOWN.
      const hasUnreadToUpdate =
        isParticipantViewer &&
        (cloudMsgs || []).some(
          (m: any) =>
            m.is_read === false &&
            m.sender_id !== user.id &&
            !String(m.content || "").startsWith("[ملاحظة داخلية للإدارة]")
        );

      if (hasUnreadToUpdate) {
        try {
          let readUpdateQuery = supabaseAdmin
            .from("inquiry_messages")
            .update({ is_read: true })
            .eq("inquiry_id", inquiryId)
            .eq("is_read", false);

          if (isUserUuid) {
            readUpdateQuery = readUpdateQuery.or(`sender_id.is.null,sender_id.neq.${user.id}`);
          } else {
            readUpdateQuery = readUpdateQuery.is("sender_id", null);
          }

          const { error: readErr } = await readUpdateQuery;
          if (readErr) {
            console.warn("[InquiryMessages][GET] Could not update read status:", {
              inquiryId,
              code: readErr.code,
              message: readErr.message,
            });
          }
        } catch (readEx) {
          console.warn("[InquiryMessages][GET] Read status update exception:", readEx);
        }
      }
    } else if (!isProd) {
      // 2. Isolated Local Dev/Test Mode Path (Never used in production)
      if (access.isSeeker || access.isAdvertiser || access.isPropertyOwner || access.isAdmin) {
        dbStore.markInquiryMessagesAsRead(inquiryId, user.id);
      }
      messages = dbStore.getInquiryMessages(inquiryId) || [];
    }

    // 3. Filter internal admin notes for non-admins and sort deterministically
    if (!access.isAdmin) {
      messages = messages.filter(
        (m: any) =>
          !m.isInternalNote &&
          !String(m.content || "").startsWith("[ملاحظة داخلية للإدارة]")
      );
    }

    messages = sortMessagesDeterministically(messages);

    return NextResponse.json({
      success: true,
      inquiry,
      messages,
      viewer: {
        id: user.id,
        name: user.name,
        role: user.role,
        participantRole: access.participantRole,
      },
    });
  } catch (err: unknown) {
    console.error("[InquiryMessages][GET] Unexpected error:", {
      inquiryId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "حدث خطأ غير متوقع أثناء جلب رسائل المحادثة", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const inquiryId = params?.id?.trim();
  if (!inquiryId) {
    return NextResponse.json({ error: "معرف المحادثة مطلوب", code: "INVALID_INQUIRY_ID" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "انتهت الجلسة أو يجب تسجيل الدخول لإرسال رسالة", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "يلزم ضبط مفتاح خدمة قاعدة البيانات المركزي على الخادم لتفعيل المحادثات", code: "DB_UNAVAILABLE" },
        { status: 503 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة", code: "INVALID_JSON" }, { status: 400 });
    }

    const { content, isAdminNote, isInternalNote, clientTempId } = body || {};

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "محتوى الرسالة مطلوب ولا يمكن أن يكون فارغاً", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (content.trim().length > 5000) {
      return NextResponse.json(
        { error: "محتوى الرسالة طويل جداً (الحد الأقصى 5000 حرف)", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    let inquiry;
    try {
      inquiry = await resolveInquiry(inquiryId);
    } catch (resolveErr: any) {
      console.error("[InquiryMessages][POST] Failed to resolve inquiry:", {
        inquiryId,
        userId: user.id,
        error: resolveErr?.message,
      });
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات المركزية حالياً، يرجى المحاولة بعد قليل.", code: "DB_ERROR" },
        { status: 503 }
      );
    }

    if (!inquiry) {
      return NextResponse.json(
        { error: "طلب التواصل والمعاينة غير موجود", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const access = await evaluateInquiryAccess(user, inquiry, isProd, hasCentralDb);
    if (!access.authorized) {
      console.warn("[InquiryMessages][POST] Unauthorized send attempt blocked:", {
        inquiryId,
        userId: user.id,
        role: user.role,
      });
      return NextResponse.json(
        { error: "غير مصرح لك بإرسال رسائل في هذا الطلب", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Authenticated sender resolution (Strictly prevent sender impersonation)
    const senderId = user.id;
    let senderName =
      user.name || (user.email ? user.email.split("@")[0] : "مستخدم دار العقار");
    let senderRole: "buyer" | "seeker" | "owner" | "broker" | "admin" = "buyer";

    // Ordinary users can NEVER set administrator notes or internal notes or impersonate admin role
    const safeIsInternalNote = access.isAdmin ? Boolean(isInternalNote) : false;
    const safeIsAdminNote = access.isAdmin
      ? Boolean(isAdminNote || safeIsInternalNote)
      : false;

    if (access.isAdmin) {
      senderRole = "admin";
      if (safeIsInternalNote) {
        senderName = "ملاحظة رقابية داخلية (للإدارة فقط 🔒)";
      } else if (safeIsAdminNote) {
        senderName = "إدارة منصة دار العقار (تنبيه إشرافي 🛡️)";
      } else {
        senderName = "إدارة منصة دار العقار 🛡️";
      }
    } else if (access.isAdvertiser || access.isPropertyOwner) {
      senderRole = user.role === "broker" ? "broker" : "owner";
      senderName = user.name || user.companyName || inquiry.advertiserName || "المالك / المعلن";
    } else {
      senderRole = "buyer";
      senderName = user.name || inquiry.seekerName || "المشتري";
    }

    const formattedContent =
      safeIsInternalNote && !content.trim().startsWith("[ملاحظة داخلية للإدارة]")
        ? `[ملاحظة داخلية للإدارة] ${content.trim()}`
        : content.trim();

    const isUuid = UUID_REGEX.test(inquiryId);
    const safeClientTempId =
      typeof clientTempId === "string" && clientTempId.trim()
        ? clientTempId.trim()
        : undefined;

    // 1. Authoritative Central Database Path
    if (hasCentralDb && isUuid) {
      const supabaseAdmin = createAdminClient();
      const isUserUuid = UUID_REGEX.test(senderId);

      // Idempotency guard against network retry / rapid double-submit within 10s
      const { data: recentRows } = await supabaseAdmin
        .from("inquiry_messages")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .eq("sender_role", senderRole)
        .eq("content", formattedContent)
        .order("created_at", { ascending: false })
        .limit(1);

      const recentExisting = recentRows?.[0];
      if (
        recentExisting &&
        (isUserUuid
          ? recentExisting.sender_id === senderId
          : recentExisting.sender_name === senderName) &&
        Date.now() - new Date(recentExisting.created_at).getTime() < 10000
      ) {
        const rawContent = String(recentExisting.content || "");
        const dedupMsg = {
          id: recentExisting.id,
          inquiryId: recentExisting.inquiry_id,
          senderId: recentExisting.sender_id || senderId,
          senderName: recentExisting.sender_name || senderName,
          senderRole: recentExisting.sender_role || senderRole,
          content: rawContent,
          isAdminNote: Boolean(recentExisting.is_admin_note),
          isInternalNote: Boolean(
            recentExisting.is_internal_note ||
              rawContent.startsWith("[ملاحظة داخلية للإدارة]")
          ),
          isRead: Boolean(recentExisting.is_read),
          createdAt: recentExisting.created_at,
          clientTempId: safeClientTempId,
        };

        return NextResponse.json({
          success: true,
          message: dedupMsg,
          inquiry,
          deduplicated: true,
          clientTempId: safeClientTempId,
        });
      }

      const insertPayload: Record<string, any> = {
        inquiry_id: inquiryId,
        sender_id: isUserUuid ? senderId : null,
        sender_name: senderName,
        sender_role: senderRole,
        content: formattedContent,
        is_admin_note: safeIsAdminNote,
        is_read: false,
      };

      let { data: insertedRow, error: insertErr } = await supabaseAdmin
        .from("inquiry_messages")
        .insert(insertPayload)
        .select("*")
        .single();

      // Fallback only if legacy foreign key constraint on sender_id rejects the UUID
      if (
        insertErr &&
        insertPayload.sender_id !== null &&
        (insertErr.code === "23503" || insertErr.message?.includes("foreign key"))
      ) {
        const retryRes = await supabaseAdmin
          .from("inquiry_messages")
          .insert({
            ...insertPayload,
            sender_id: null,
          })
          .select("*")
          .single();
        insertedRow = retryRes.data;
        insertErr = retryRes.error;
      }

      if (insertErr || !insertedRow) {
        console.error("[InquiryMessages][POST] Authoritative database insert failed:", {
          inquiryId,
          userId: senderId,
          senderRole,
          code: insertErr?.code,
          message: insertErr?.message,
        });
        return NextResponse.json(
          {
            error: "تعذر حفظ الرسالة في قاعدة البيانات حالياً، يرجى المحاولة مرة أخرى.",
            code: "DB_INSERT_FAILED",
          },
          { status: 503 }
        );
      }

      const persistedMessage = {
        id: insertedRow.id,
        inquiryId: insertedRow.inquiry_id,
        senderId: insertedRow.sender_id || senderId,
        senderName: insertedRow.sender_name || senderName,
        senderRole: insertedRow.sender_role || senderRole,
        content: String(insertedRow.content || formattedContent),
        isAdminNote: Boolean(insertedRow.is_admin_note),
        isInternalNote: Boolean(
          insertedRow.is_internal_note ||
            safeIsInternalNote ||
            String(insertedRow.content || "").startsWith("[ملاحظة داخلية للإدارة]")
        ),
        isRead: Boolean(insertedRow.is_read),
        createdAt: insertedRow.created_at,
        clientTempId: safeClientTempId,
      };

      // Update inquiry timestamp & transition 'new' -> 'contacted' when advertiser replies
      const inquiryUpdatePayload: Record<string, any> = {};
      if (!safeIsInternalNote) {
        inquiryUpdatePayload.updated_at = insertedRow.created_at;
        inquiry.lastMessageAt = insertedRow.created_at;
        if (
          inquiry.status === "new" &&
          (senderRole === "owner" || senderRole === "broker")
        ) {
          inquiryUpdatePayload.status = "contacted";
          inquiry.status = "contacted";
        }
      }

      if (Object.keys(inquiryUpdatePayload).length > 0) {
        try {
          await supabaseAdmin
            .from("inquiries")
            .update(inquiryUpdatePayload)
            .eq("id", inquiryId);
        } catch (updErr) {
          console.warn("[InquiryMessages][POST] Inquiry metadata sync warning:", updErr);
        }
      }

      if (access.isAdmin && (safeIsAdminNote || safeIsInternalNote)) {
        try {
          await supabaseAdmin.from("audit_events").insert({
            user_id: isUserUuid ? senderId : null,
            action: safeIsInternalNote
              ? "ADMIN_INTERNAL_NOTE"
              : "ADMIN_SUPERVISORY_NOTE",
            entity_type: "inquiry",
            entity_id: inquiryId,
            details: {
              isInternalNote: safeIsInternalNote,
              propertyId: inquiry.propertyId,
              messageId: insertedRow.id,
            },
          });
        } catch (auditErr) {
          console.warn("[InquiryMessages][POST] Audit log warning:", auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: persistedMessage,
        inquiry,
        clientTempId: safeClientTempId,
      });
    }

    // 2. Isolated Local Dev/Test Mode Path (Only when central DB is not configured in non-prod)
    if (isProd) {
      return NextResponse.json(
        { error: "معرف المحادثة غير صالح في بيئة الإنتاج", code: "INVALID_INQUIRY_ID" },
        { status: 400 }
      );
    }

    const existingMsgs = dbStore.getInquiryMessages(inquiryId) || [];
    const lastExisting = existingMsgs[existingMsgs.length - 1];
    if (
      lastExisting &&
      lastExisting.senderId === senderId &&
      lastExisting.content === formattedContent &&
      Date.now() - new Date(lastExisting.createdAt).getTime() < 10000
    ) {
      return NextResponse.json({
        success: true,
        message: { ...lastExisting, clientTempId: safeClientTempId },
        inquiry: dbStore.getInquiryById(inquiryId) || inquiry,
        deduplicated: true,
        clientTempId: safeClientTempId,
      });
    }

    const newMessage = dbStore.addInquiryMessage(inquiryId, {
      senderId,
      senderName,
      senderRole,
      content: formattedContent,
      isAdminNote: safeIsAdminNote,
      isInternalNote: safeIsInternalNote,
    });

    if (access.isAdmin && (safeIsAdminNote || safeIsInternalNote)) {
      dbStore.recordAuditEvent(
        user.id,
        safeIsInternalNote ? "ADMIN_INTERNAL_NOTE" : "ADMIN_SUPERVISORY_NOTE",
        "inquiry",
        inquiryId,
        {
          isInternalNote: safeIsInternalNote,
          propertyId: inquiry.propertyId,
          messageId: newMessage.id,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: { ...newMessage, clientTempId: safeClientTempId },
      inquiry: dbStore.getInquiryById(inquiryId) || inquiry,
      clientTempId: safeClientTempId,
    });
  } catch (err: unknown) {
    console.error("[InquiryMessages][POST] Unexpected error:", {
      inquiryId,
      error: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : "خطأ أثناء إرسال الرسالة";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
