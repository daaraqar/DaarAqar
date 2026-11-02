import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveInquiry, isCentralDbEnabled } from "@/lib/services/inquiryResolver";
import { createAdminClient } from "@/utils/supabase/server";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function checkInquiryAccess(user: any, inquiry: any, isProd: boolean, hasCentralDb: boolean) {
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

  return {
    authorized: isSeeker || isAdvertiser || isAdmin || isPropertyOwner,
    isSeeker,
    isAdvertiser,
    isAdmin,
    isPropertyOwner,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const inquiryId = params?.id?.trim();
  if (!inquiryId) {
    return NextResponse.json({ error: "معرف الطلب مطلوب" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج" },
        { status: 503 }
      );
    }

    let inquiry;
    try {
      inquiry = await resolveInquiry(inquiryId);
    } catch (resolveErr: any) {
      console.error("[InquiryPATCH] Failed to resolve inquiry:", {
        inquiryId,
        error: resolveErr?.message,
      });
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات المركزية حالياً" },
        { status: 503 }
      );
    }

    if (!inquiry) {
      return NextResponse.json({ error: "طلب التواصل غير موجود" }, { status: 404 });
    }

    const access = await checkInquiryAccess(user, inquiry, isProd, hasCentralDb);
    if (!access.authorized) {
      return NextResponse.json({ error: "غير مصرح بتعديل هذا الطلب" }, { status: 403 });
    }

    const { status, note } = await req.json();
    if (!status) {
      return NextResponse.json({ error: "الحالة مطلوبة" }, { status: 400 });
    }

    if (status === "spam" && !access.isAdmin) {
      return NextResponse.json(
        { error: "صلاحية تصنيف المحادثة كبلاغ أو مخالفة مقتصرة على مشرفي الإدارة" },
        { status: 403 }
      );
    }

    const prevStatus = inquiry.status;

    // Formulate a friendly system event notice for the chat timeline
    let statusNotice = "";
    if (status === "viewing_scheduled") {
      statusNotice = "📅 تم تأكيد وحجز موعد معاينة العقار بين الطرفين.";
    } else if (status === "negotiating") {
      statusNotice = "🤝 تم الانتقال لمرحلة التفاوض والاتفاق على الشروط والسعر.";
    } else if (status === "deal_closed") {
      statusNotice = "🎉 تهانينا! تم إتمام الاتفاق والصفقة بنجاح بين المشتري والمالك.";
    } else if (status === "contacted") {
      statusNotice = "💬 تم الرد وبدء التواصل المباشر بين الطرفين.";
    } else if (status === "closed") {
      statusNotice = "🔒 تم إغلاق طلب التواصل والمعاينة.";
    } else if (status === "spam") {
      statusNotice = "⚠️ تم وضع علامة بلاغ / ملغي على هذا الطلب من قبل الإدارة.";
    }

    if (note && typeof note === "string" && note.trim()) {
      statusNotice += `\nملاحظة: ${note.trim()}`;
    }

    const isUuid = UUID_REGEX.test(inquiryId);
    const isUserUuid = UUID_REGEX.test(user.id);

    // 1. Authoritative Central Database Update
    if (hasCentralDb && isUuid) {
      const supabaseAdmin = createAdminClient();
      const nowIso = new Date().toISOString();

      const { error: updErr } = await supabaseAdmin
        .from("inquiries")
        .update({ status, updated_at: nowIso })
        .eq("id", inquiryId);

      if (updErr) {
        console.error("[InquiryPATCH] Supabase status update failed:", {
          inquiryId,
          status,
          code: updErr.code,
          message: updErr.message,
        });
        return NextResponse.json(
          { error: "تعذر تحديث حالة الطلب في قاعدة البيانات المركزية" },
          { status: 503 }
        );
      }

      if (statusNotice) {
        const noticePayload = {
          inquiry_id: inquiryId,
          sender_id: isUserUuid ? user.id : null,
          sender_name: access.isAdmin
            ? "إشراف الإدارة (نظام 🛡️)"
            : user.name || "نظام المنصة",
          sender_role: access.isAdmin
            ? "admin"
            : access.isAdvertiser || access.isPropertyOwner
            ? "owner"
            : "buyer",
          content: statusNotice,
          is_admin_note: access.isAdmin,
          is_read: false,
        };

        const { error: noticeErr } = await supabaseAdmin
          .from("inquiry_messages")
          .insert(noticePayload);

        if (noticeErr && noticePayload.sender_id !== null) {
          await supabaseAdmin
            .from("inquiry_messages")
            .insert({ ...noticePayload, sender_id: null });
        }
      }

      if (access.isAdmin) {
        try {
          await supabaseAdmin.from("audit_events").insert({
            user_id: isUserUuid ? user.id : null,
            action: "ADMIN_SUPERVISE_INQUIRY_STATUS",
            entity_type: "inquiry",
            entity_id: inquiryId,
            details: {
              previousStatus: prevStatus,
              newStatus: status,
              note: note?.trim(),
              propertyId: inquiry.propertyId,
            },
          });
        } catch {}
      }

      const updatedInquiry = {
        ...inquiry,
        status,
        lastMessageAt: nowIso,
      };

      return NextResponse.json({ success: true, inquiry: updatedInquiry });
    }

    // 2. Isolated Local Dev/Test Mode Path
    if (isProd) {
      return NextResponse.json({ error: "معرف الطلب غير صالح" }, { status: 400 });
    }

    const updated = dbStore.updateInquiryStatus(
      inquiryId,
      status,
      user.id,
      access.isAdmin ? "admin" : user.role
    );

    if (access.isAdmin) {
      dbStore.recordAuditEvent(
        user.id,
        "ADMIN_SUPERVISE_INQUIRY_STATUS",
        "inquiry",
        inquiryId,
        {
          previousStatus: prevStatus,
          newStatus: status,
          note: note?.trim() || undefined,
          propertyId: inquiry.propertyId,
        }
      );
    }

    if (statusNotice) {
      dbStore.addInquiryMessage(inquiryId, {
        senderId: user.id,
        senderName: access.isAdmin
          ? "إشراف الإدارة (نظام 🛡️)"
          : user.name || "نظام المنصة",
        senderRole: access.isAdmin
          ? "admin"
          : access.isAdvertiser || access.isPropertyOwner
          ? "owner"
          : "buyer",
        content: statusNotice,
        isAdminNote: access.isAdmin,
      });
    }

    return NextResponse.json({ success: true, inquiry: updated || { ...inquiry, status } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث حالة الطلب";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const inquiryId = params?.id?.trim();
  if (!inquiryId) {
    return NextResponse.json({ error: "معرف الطلب مطلوب" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول لعرض تفاصيل طلب التواصل" },
        { status: 401 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج" },
        { status: 503 }
      );
    }

    let inquiry;
    try {
      inquiry = await resolveInquiry(inquiryId);
    } catch (resolveErr: any) {
      console.error("[InquiryGET] Failed to resolve inquiry:", {
        inquiryId,
        error: resolveErr?.message,
      });
      return NextResponse.json(
        { error: "تعذر الاتصال بقاعدة البيانات المركزية حالياً" },
        { status: 503 }
      );
    }

    if (!inquiry) {
      return NextResponse.json(
        { error: "طلب التواصل والمعاينة غير موجود" },
        { status: 404 }
      );
    }

    const access = await checkInquiryAccess(user, inquiry, isProd, hasCentralDb);
    if (!access.authorized) {
      return NextResponse.json(
        { error: "غير مصرح لك بالاطلاع على هذا الطلب" },
        { status: 403 }
      );
    }

    const isUuid = UUID_REGEX.test(inquiryId);
    let messages: any[] = [];

    if (hasCentralDb && isUuid) {
      const supabaseAdmin = createAdminClient();
      const { data: rows, error: rowsErr } = await supabaseAdmin
        .from("inquiry_messages")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (rowsErr) {
        console.error("[InquiryGET] Supabase inquiry_messages select error:", {
          inquiryId,
          code: rowsErr.code,
          message: rowsErr.message,
        });
        return NextResponse.json(
          { error: "تعذر جلب رسائل الطلب من قاعدة البيانات المركزية" },
          { status: 503 }
        );
      }

      messages = (rows || []).map((r: any) => ({
        id: r.id,
        inquiryId: r.inquiry_id,
        senderId:
          r.sender_id ||
          (r.sender_role === "buyer" ? inquiry.seekerId : inquiry.advertiserId),
        senderName: r.sender_name,
        senderRole: r.sender_role,
        content: r.content,
        isAdminNote: Boolean(r.is_admin_note),
        isInternalNote: Boolean(
          r.is_internal_note ||
            String(r.content || "").startsWith("[ملاحظة داخلية للإدارة]")
        ),
        isRead: Boolean(r.is_read),
        createdAt: r.created_at,
      }));
    } else if (!isProd) {
      messages = dbStore.getInquiryMessages(inquiryId) || [];
    }

    if ((!messages || messages.length === 0) && inquiry.message) {
      messages = [
        {
          id: `msg-${inquiry.id}-initial`,
          inquiryId: inquiry.id,
          senderId: inquiry.seekerId || "guest",
          senderName: inquiry.seekerName || "العميل",
          senderRole: "buyer",
          content: inquiry.message,
          createdAt: inquiry.createdAt,
          isRead: false,
        },
      ];
    }

    if (!access.isAdmin) {
      messages = messages.filter(
        (m: any) =>
          !m.isInternalNote &&
          !String(m.content || "").startsWith("[ملاحظة داخلية للإدارة]")
      );
    }

    return NextResponse.json({ success: true, inquiry, messages });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "خطأ أثناء جلب تفاصيل الطلب";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
