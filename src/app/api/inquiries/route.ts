import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { createAdminClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isCentralDbEnabled } from "@/lib/services/inquiryResolver";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { getInquiryResponseState } from "@/lib/services/inquiry-response-state";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getPrivilegedSupabaseClient() {
  return createAdminClient();
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    if (mode === "admin" && !hasAdminPermission(user, "messages.read")) {
      return NextResponse.json({ error: "لا تملك صلاحية عرض جميع المحادثات" }, { status: 403 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "يلزم ضبط مفتاح خدمة قاعدة البيانات المركزي على الخادم لتفعيل المحادثات" },
        { status: 503 }
      );
    }

    const isAdminUser = hasAdminPermission(user, "messages.read");

    let inquiries: any[] = [];
    const enrichInquiryWithPropertyAndUsers = (item: any, profileMap?: Map<string, any>) => {
      const prop = !isProd
        ? dbStore.getRawPropertyById(item.propertyId) ||
          dbStore.getPropertyByIdOrSlug(item.propertyId)
        : null;
      const advId = item.advertiserId || prop?.advertiserId;
      const cloudAdv = advId && profileMap ? profileMap.get(advId) : null;
      const cloudSeeker = item.seekerId && profileMap ? profileMap.get(item.seekerId) : null;
      const adv = !isProd && advId ? dbStore.findUserById(advId) : null;
      const seeker = !isProd && item.seekerId ? dbStore.findUserById(item.seekerId) : null;

      return {
        ...item,
        advertiserId: advId || item.advertiserId,
        advertiserName:
          item.advertiserName ||
          cloudAdv?.company_name ||
          cloudAdv?.name ||
          cloudAdv?.full_name ||
          adv?.companyName ||
          adv?.name ||
          "معلن",
        advertiserPhone:
          item.advertiserPhone || cloudAdv?.phone || adv?.phone || undefined,
        seekerName:
          item.seekerName ||
          cloudSeeker?.name ||
          cloudSeeker?.full_name ||
          seeker?.name ||
          "عميل مهتم",
        seekerPhone:
          item.seekerPhone || cloudSeeker?.phone || seeker?.phone || "",
        seekerEmail:
          item.seekerEmail || cloudSeeker?.email || seeker?.email || "",
        propertyTitle: item.propertyTitle || prop?.title || "عقار",
        propertySlug: item.propertySlug || prop?.slug,
        propertyPrice: item.propertyPrice ?? prop?.price,
        propertyImage:
          item.propertyImage ||
          (Array.isArray(prop?.images) ? prop.images[0] : undefined),
      };
    };

    if (!hasCentralDb) {
      if (isAdminUser && mode === "admin") {
        inquiries = dbStore
          .getAllInquiriesForAdmin()
          .map((i) => enrichInquiryWithPropertyAndUsers(i));
      } else if (mode === "seeker") {
        inquiries = dbStore
          .getInquiriesForSeeker(user.id, user.phone, user.email)
          .map((i) => enrichInquiryWithPropertyAndUsers(i));
      } else if (mode === "advertiser") {
        inquiries = dbStore
          .getInquiriesForAdvertiser(user.id)
          .map((i) => enrichInquiryWithPropertyAndUsers(i));
      } else {
        const adv = dbStore.getInquiriesForAdvertiser(user.id);
        const seek = dbStore.getInquiriesForSeeker(user.id, user.phone, user.email);
        const map = new Map<string, any>();
        [...adv, ...seek].forEach((item) => {
          map.set(item.id, enrichInquiryWithPropertyAndUsers(item));
        });
        inquiries = Array.from(map.values());
      }
    } else {
      const supabase = getPrivilegedSupabaseClient();
      let query = supabase
        .from("inquiries")
        .select("*, properties(id, title, slug, price, advertiser_id, user_id, owner_id)");

      const seekerConditions = [`seeker_id.eq.${user.id}`];
      if (user.phone && typeof user.phone === "string" && user.phone.trim()) {
        seekerConditions.push(`seeker_phone.eq.${user.phone.trim()}`);
      }
      if (user.email && typeof user.email === "string" && user.email.trim()) {
        seekerConditions.push(`seeker_email.eq.${user.email.trim().toLowerCase()}`);
      }

      if (!(isAdminUser && mode === "admin")) {
        const ownedPropertyIds: string[] = [];
        if (mode !== "seeker" && UUID_REGEX.test(user.id)) {
          try {
            const { data: ownedProps } = await supabase
              .from("properties")
              .select("id")
              .or(
                `advertiser_id.eq.${user.id},user_id.eq.${user.id},owner_id.eq.${user.id}`
              );
            if (Array.isArray(ownedProps)) {
              ownedProps.forEach((p: any) => {
                if (p?.id && UUID_REGEX.test(p.id)) ownedPropertyIds.push(p.id);
              });
            }
          } catch {}
        }

        const advConditions = [`advertiser_id.eq.${user.id}`];
        if (ownedPropertyIds.length > 0) {
          advConditions.push(`property_id.in.(${ownedPropertyIds.join(",")})`);
        }

        if (mode === "seeker") {
          query = query.or(seekerConditions.join(","));
        } else if (mode === "advertiser") {
          query = query.or(advConditions.join(","));
        } else {
          query = query.or([...advConditions, ...seekerConditions].join(","));
        }
      }

      const { data: cloudInquiries, error: cloudInqError } = await query;
      if (cloudInqError) {
        return NextResponse.json(
          {
            error: `فشل جلب طلبات التواصل من قاعدة البيانات المركزية: ${cloudInqError.message}`,
          },
          { status: 503 }
        );
      }

      const profileIdsToFetch = new Set<string>();
      (cloudInquiries || []).forEach((ci: any) => {
        const advId =
          ci.advertiser_id ||
          ci.properties?.advertiser_id ||
          ci.properties?.user_id ||
          ci.properties?.owner_id;
        if (advId && UUID_REGEX.test(advId)) profileIdsToFetch.add(advId);
        if (ci.seeker_id && UUID_REGEX.test(ci.seeker_id)) {
          profileIdsToFetch.add(ci.seeker_id);
        }
      });

      const profileMap = new Map<string, any>();
      if (profileIdsToFetch.size > 0) {
        try {
          const { data: profileRows } = await supabase
            .from("profiles")
            .select("*")
            .in("id", Array.from(profileIdsToFetch));
          if (Array.isArray(profileRows)) {
            profileRows.forEach((p: any) => {
              if (p?.id) profileMap.set(p.id, p);
            });
          }
        } catch {}
      }

      inquiries = (cloudInquiries || []).map((ci: any) => {
        const isUserSeeker =
          ci.seeker_id === user.id ||
          (Boolean(user.phone?.trim()) &&
            ci.seeker_phone?.trim() === user.phone.trim()) ||
          (Boolean(user.email?.trim()) &&
            ci.seeker_email?.trim().toLowerCase() ===
              user.email?.trim().toLowerCase());

        const resolvedAdvId =
          ci.advertiser_id ||
          ci.properties?.advertiser_id ||
          ci.properties?.user_id ||
          ci.properties?.owner_id;

        return enrichInquiryWithPropertyAndUsers(
          {
            id: ci.id,
            propertyId: ci.property_id,
            propertyTitle: ci.property_title || ci.properties?.title || "عقار",
            propertySlug: ci.properties?.slug,
            propertyPrice: ci.properties?.price
              ? Number(ci.properties.price)
              : undefined,
            seekerId: isUserSeeker ? user.id : ci.seeker_id || "guest",
            seekerName: ci.seeker_name,
            seekerPhone: ci.seeker_phone,
            seekerEmail: ci.seeker_email,
            advertiserId: resolvedAdvId,
            message: ci.message,
            preferredContact: ci.preferred_contact || "call",
            status: ci.status || "new",
            createdAt: ci.created_at,
            lastMessageAt: ci.updated_at || ci.created_at,
          },
          profileMap
        );
      });
    }

    let totalUnread = 0;
    const inquiryIds = inquiries.map((i: any) => i.id).filter(Boolean);

    const cloudUnreadMap = new Map<string, number>();
    const cloudCountMap = new Map<string, number>();
    const cloudLastMessageAtMap = new Map<string, string>();
    const cloudLatestResponseMap = new Map<string, { senderId: string | null; senderRole: string; createdAt: string }>();

    if (hasCentralDb && inquiryIds.length > 0) {
      const adminClient = createAdminClient();
      const { data: msgRows, error: msgError } = await adminClient
        .from("inquiry_messages")
        .select("inquiry_id, sender_id, sender_role, is_read, content, created_at")
        .in("inquiry_id", inquiryIds)
        .order("created_at", { ascending: true });

      if (msgError && isProd) {
        return NextResponse.json(
          {
            error: `فشل جلب رسائل المحادثات من قاعدة البيانات المركزية: ${msgError.message}`,
          },
          { status: 503 }
        );
      }

      if (msgRows) {
        for (const row of msgRows) {
          const isInternal =
            String(row.content || "").startsWith("[ملاحظة داخلية للإدارة]");

          if (isInternal) {
            continue;
          }

          cloudCountMap.set(
            row.inquiry_id,
            (cloudCountMap.get(row.inquiry_id) || 0) + 1
          );
          if (row.created_at) {
            cloudLastMessageAtMap.set(row.inquiry_id, row.created_at);
            if (row.sender_role !== "admin") {
              cloudLatestResponseMap.set(row.inquiry_id, {
                senderId: row.sender_id || null,
                senderRole: row.sender_role || "",
                createdAt: row.created_at,
              });
            }
          }
          if (
            row.is_read === false &&
            row.sender_id !== user.id
          ) {
            cloudUnreadMap.set(
              row.inquiry_id,
              (cloudUnreadMap.get(row.inquiry_id) || 0) + 1
            );
          }
        }
      }
    }

    const enrichedInquiries = inquiries
      .map((inq: any) => {
        const unread = hasCentralDb
          ? cloudUnreadMap.get(inq.id) || 0
          : dbStore.getInquiryUnreadCount(inq.id, user.id);
        totalUnread += unread;

        const messagesCount = hasCentralDb
          ? cloudCountMap.get(inq.id) || 1
          : Array.isArray(inq.messages)
          ? inq.messages.length
          : 1;

        const lastMessageAt =
          cloudLastMessageAtMap.get(inq.id) ||
          inq.lastMessageAt ||
          (Array.isArray(inq.messages) && inq.messages.length > 0
            ? inq.messages[inq.messages.length - 1].createdAt
            : inq.createdAt);

        const localMessages = Array.isArray(inq.messages)
          ? inq.messages.filter((message: any) =>
              message.senderRole !== "admin" &&
              !message.isAdminNote &&
              !message.isInternalNote &&
              !String(message.content || "").startsWith("[ملاحظة داخلية للإدارة]")
            )
          : [];
        const latestLocalMessage = localMessages.reduce((latest: any, message: any) =>
          !latest || new Date(message.createdAt || 0).getTime() > new Date(latest.createdAt || 0).getTime()
            ? message
            : latest,
        null);
        const latestMessage = hasCentralDb
          ? cloudLatestResponseMap.get(inq.id)
          : latestLocalMessage
            ? {
                senderId: latestLocalMessage.senderId || null,
                senderRole: latestLocalMessage.senderRole || "",
                createdAt: latestLocalMessage.createdAt || lastMessageAt,
              }
            : null;
        const responseState = getInquiryResponseState({
          status: inq.status,
          seekerId: inq.seekerId,
          createdAt: inq.createdAt,
          latestMessage,
        });

        return {
          ...inq,
          unreadCount: unread,
          messagesCount,
          lastMessageAt,
          ...responseState,
        };
      })
      .sort(
        (a: any, b: any) =>
          new Date(b.lastMessageAt || b.createdAt).getTime() -
          new Date(a.lastMessageAt || a.createdAt).getTime()
      );

    return NextResponse.json({
      inquiries: enrichedInquiries,
      totalUnread,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "خطأ أثناء جلب طلبات التواصل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً لإرسال طلب استفسار أو حجز معاينة." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      propertyId,
      message,
      seekerName,
      seekerPhone,
      seekerEmail,
      preferredContact,
    } = body;

    if (
      !propertyId ||
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return NextResponse.json(
        { error: "الرسالة الأولية مطلوبة" },
        { status: 400 }
      );
    }

    if (message.trim().length > 5000) {
      return NextResponse.json(
        { error: "محتوى الرسالة طويل جداً (الحد الأقصى 5000 حرف)" },
        { status: 400 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const hasCentralDb = isCentralDbEnabled();

    if (isProd && !hasCentralDb) {
      return NextResponse.json(
        { error: "يلزم ضبط مفتاح خدمة قاعدة البيانات المركزي على الخادم لتفعيل المحادثات" },
        { status: 503 }
      );
    }

    let canonicalPropId = propertyId;
    let propertyTitle: string | undefined = undefined;
    let propertySlug: string | undefined = undefined;
    let propertyPrice: number | undefined = undefined;
    let advertiserId: string | undefined = undefined;
    let propertyStatus: string | undefined = undefined;
    const rawProp = !isProd ? dbStore.getRawPropertyById(propertyId) : null;

    if (hasCentralDb) {
      const isUuid = UUID_REGEX.test(propertyId);
      const supabaseAdmin = createAdminClient();
      let query = supabaseAdmin
        .from("properties")
        .select("id, title, slug, status, advertiser_id, user_id, owner_id, price, project_details");

      if (isUuid) {
        query = query.eq("id", propertyId);
      } else {
        query = query.eq("slug", propertyId);
      }

      const { data: cloudData, error: queryErr } = await query.maybeSingle();
      if (queryErr && isProd) {
        return NextResponse.json(
          {
            error: `فشل التحقق من العقار في قاعدة البيانات المركزية: ${queryErr.message}`,
          },
          { status: 503 }
        );
      }
      if (cloudData) {
        canonicalPropId = cloudData.id;
        propertyTitle = cloudData.title;
        propertySlug = cloudData.slug;
        propertyPrice = cloudData.price ? Number(cloudData.price) : undefined;
        advertiserId =
          cloudData.advertiser_id ||
          cloudData.user_id ||
          cloudData.owner_id ||
          cloudData.project_details?.creatorSessionId ||
          "admin";
        propertyStatus = cloudData.status;
      }
    }

    if (!propertyTitle && !isProd) {
      if (rawProp) {
        propertyTitle = rawProp.title;
        propertySlug = rawProp.slug;
        propertyPrice = rawProp.price;
        advertiserId = rawProp.advertiserId;
        propertyStatus = rawProp.status;
      } else {
        const bySlug = dbStore.getPropertyByIdOrSlug(propertyId, user || undefined);
        if (bySlug) {
          canonicalPropId = bySlug.id;
          propertyTitle = bySlug.title;
          propertySlug = bySlug.slug;
          propertyPrice = bySlug.price;
          advertiserId =
            bySlug.advertiserId ||
            (bySlug as any).userId ||
            (bySlug as any).ownerId ||
            "admin";
          propertyStatus = bySlug.status;
        }
      }
    }

    if (!propertyTitle) {
      return NextResponse.json(
        { error: "العقار المطلوب غير موجود" },
        { status: 404 }
      );
    }
    const resolvedPropertyTitle = propertyTitle;

    const isAvailable =
      propertyStatus === "active" || propertyStatus === "published";
    if (!isAvailable) {
      return NextResponse.json(
        { error: "لا يمكن إرسال طلب تواصل لعقار غير متاح أو قيد المراجعة" },
        { status: 400 }
      );
    }

    const finalAdvId: string = advertiserId || "admin";

    if (
      user &&
      (user.id === finalAdvId ||
        user.id === rawProp?.userId ||
        user.id === (rawProp as any)?.ownerId)
    ) {
      return NextResponse.json(
        { error: "لا يمكنك إرسال استفسار أو طلب معاينة لإعلانك الخاص." },
        { status: 400 }
      );
    }

    if (user && body.seekerId && body.seekerId !== user.id) {
      return NextResponse.json(
        {
          error: "لا يمكن انتحال هوية باحث آخر (Seeker Impersonation Violation)",
        },
        { status: 400 }
      );
    }

    const isPropUuid = UUID_REGEX.test(canonicalPropId);
    const finalSeekerName =
      (typeof seekerName === "string" ? seekerName.trim() : "") ||
      user.name ||
      "عميل مهتم";
    const finalSeekerPhone =
      (typeof seekerPhone === "string" ? seekerPhone.trim() : "") ||
      user.phone ||
      "";
    const finalSeekerEmail = (
      (typeof seekerEmail === "string" ? seekerEmail.trim() : "") ||
      user.email ||
      ""
    ).toLowerCase();

    if (!finalSeekerPhone) {
      return NextResponse.json(
        { error: "أضف رقم هاتف إلى حسابك لإرسال طلب المعاينة." },
        { status: 400 }
      );
    }

    if (hasCentralDb && isPropUuid) {
      const supabase = getPrivilegedSupabaseClient();
      const validSeekerId = UUID_REGEX.test(user.id) ? user.id : null;
      const validAdvertiserId = UUID_REGEX.test(finalAdvId) ? finalAdvId : null;
      const ensureInitialMessage = async (inquiryId: string) => {
        const { data: existingMessage, error: lookupError } = await supabase
          .from("inquiry_messages")
          .select("*")
          .eq("inquiry_id", inquiryId)
          .eq("sender_role", "buyer")
          .eq("content", message.trim())
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (lookupError || existingMessage) {
          return { message: existingMessage, error: lookupError };
        }

        const initialMessagePayload = {
          inquiry_id: inquiryId,
          sender_id: validSeekerId,
          sender_name: finalSeekerName,
          sender_role: "buyer",
          content: message.trim(),
          is_admin_note: false,
          is_read: false,
        };

        let { data: insertedMessage, error: insertError } = await supabase
          .from("inquiry_messages")
          .insert(initialMessagePayload)
          .select("*")
          .single();

        if (
          insertError &&
          initialMessagePayload.sender_id !== null &&
          (insertError.code === "23503" ||
            insertError.message?.includes("foreign key"))
        ) {
          const retryResult = await supabase
            .from("inquiry_messages")
            .insert({ ...initialMessagePayload, sender_id: null })
            .select("*")
            .single();
          insertedMessage = retryResult.data;
          insertError = retryResult.error;
        }

        return { message: insertedMessage, error: insertError };
      };

      let dedupQuery = supabase
        .from("inquiries")
        .select("*")
        .eq("property_id", canonicalPropId)
        .eq("message", message.trim())
        .order("created_at", { ascending: false })
        .limit(1);

      if (validSeekerId) {
        dedupQuery = dedupQuery.eq("seeker_id", validSeekerId);
      } else {
        dedupQuery = dedupQuery.eq("seeker_phone", finalSeekerPhone);
      }

      const { data: recentRows, error: dedupError } = await dedupQuery;
      if (dedupError) {
        console.error("[InquiryPOST] Inquiry retry lookup failed:", {
          propertyId: canonicalPropId,
          userId: user.id,
          code: dedupError.code,
          message: dedupError.message,
        });
        return NextResponse.json(
          { error: "تعذر التحقق من طلب التواصل السابق. يرجى إعادة المحاولة.", code: "INQUIRY_LOOKUP_FAILED" },
          { status: 503 }
        );
      }

      const recentRow = recentRows?.[0];
      if (
        recentRow &&
        Date.now() - new Date(recentRow.created_at).getTime() < 15000
      ) {
        const initialMessageResult = await ensureInitialMessage(recentRow.id);
        if (initialMessageResult.error || !initialMessageResult.message) {
          console.error("[InquiryPOST] Could not restore initial chat message:", {
            inquiryId: recentRow.id,
            userId: user.id,
            code: initialMessageResult.error?.code,
            message: initialMessageResult.error?.message,
          });
          return NextResponse.json(
            { error: "تعذر تجهيز المحادثة حالياً، يرجى إعادة المحاولة.", code: "INITIAL_MESSAGE_FAILED" },
            { status: 503 }
          );
        }

        return NextResponse.json({
          success: true,
          inquiry: {
            id: recentRow.id,
            propertyId: recentRow.property_id,
            propertyTitle,
            propertySlug,
            propertyPrice,
            seekerId: recentRow.seeker_id || user.id,
            seekerName: recentRow.seeker_name,
            seekerPhone: recentRow.seeker_phone,
            seekerEmail: recentRow.seeker_email,
            advertiserId: recentRow.advertiser_id || finalAdvId,
            message: recentRow.message,
            preferredContact: recentRow.preferred_contact || "call",
            status: recentRow.status || "new",
            createdAt: recentRow.created_at,
            lastMessageAt: recentRow.updated_at || recentRow.created_at,
          },
          deduplicated: true,
        });
      }

      const inquiryPayload = {
        property_id: canonicalPropId,
        property_title: propertyTitle,
        seeker_id: validSeekerId,
        advertiser_id: validAdvertiserId,
        seeker_name: finalSeekerName,
        seeker_phone: finalSeekerPhone,
        seeker_email: finalSeekerEmail,
        message: message.trim(),
        preferred_contact: preferredContact || "call",
        status: "new",
      };

      let { data: cloudInquiry, error: cloudErr } = await supabase
        .from("inquiries")
        .insert(inquiryPayload)
        .select("*")
        .single();

      if (
        cloudErr &&
        (cloudErr.code === "23503" || cloudErr.message?.includes("foreign key"))
      ) {
        const isSeekerFk = cloudErr.message?.includes("seeker_id");
        const isAdvFk = cloudErr.message?.includes("advertiser_id");
        const retryPayload = {
          ...inquiryPayload,
          seeker_id: isSeekerFk || !isAdvFk ? null : inquiryPayload.seeker_id,
          advertiser_id: isAdvFk || !isSeekerFk ? null : inquiryPayload.advertiser_id,
        };
        const retryRes = await supabase
          .from("inquiries")
          .insert(retryPayload)
          .select("*")
          .single();
        cloudInquiry = retryRes.data;
        cloudErr = retryRes.error;
      }

      if (cloudErr || !cloudInquiry) {
        return NextResponse.json(
          {
            error: `فشل حفظ طلب التواصل في قاعدة البيانات المركزية: ${cloudErr?.message || "Unknown error"}`,
          },
          { status: 503 }
        );
      }

      const cloudInquiryId = cloudInquiry.id;
      const initialMessageResult = await ensureInitialMessage(cloudInquiryId);
      const insertedMsg = initialMessageResult.message;
      const msgErr = initialMessageResult.error;

      if (msgErr || !insertedMsg) {
        console.error("[InquiryPOST] Initial chat message insert failed:", {
          inquiryId: cloudInquiryId,
          userId: user.id,
          code: msgErr?.code,
          message: msgErr?.message,
        });
        const { error: cleanupError } = await supabase
          .from("inquiries")
          .delete()
          .eq("id", cloudInquiryId);
        if (cleanupError) {
          console.error("[InquiryPOST] Could not remove inquiry without its initial message:", {
            inquiryId: cloudInquiryId,
            code: cleanupError.code,
            message: cleanupError.message,
          });
        }
        return NextResponse.json(
          { error: "تعذر حفظ أول رسالة في المحادثة. يرجى إعادة المحاولة.", code: "INITIAL_MESSAGE_FAILED" },
          { status: 503 }
        );
      }

      const persistedInquiry = {
        id: cloudInquiryId,
        propertyId: canonicalPropId,
        propertyTitle,
        propertySlug,
        propertyPrice,
        seekerId: user.id,
        seekerName: finalSeekerName,
        seekerPhone: finalSeekerPhone,
        seekerEmail: finalSeekerEmail,
        advertiserId: finalAdvId,
        message: message.trim(),
        preferredContact: preferredContact || "call",
        status: cloudInquiry.status || "new",
        createdAt: cloudInquiry.created_at,
        lastMessageAt: cloudInquiry.updated_at || cloudInquiry.created_at,
        messages: insertedMsg
          ? [
              {
                id: insertedMsg.id,
                inquiryId: cloudInquiryId,
                senderId: insertedMsg.sender_id || user.id,
                senderName: insertedMsg.sender_name || finalSeekerName,
                senderRole: insertedMsg.sender_role || "buyer",
                content: insertedMsg.content,
                createdAt: insertedMsg.created_at,
                isRead: false,
              },
            ]
          : [],
      };

      return NextResponse.json({ success: true, inquiry: persistedInquiry });
    }

    if (isProd) {
      return NextResponse.json(
        { error: "قاعدة البيانات المركزية غير مهيأة لحفظ طلب التواصل" },
        { status: 503 }
      );
    }

    const existingLocalForSeeker = dbStore.getInquiriesForSeeker(
      user.id,
      finalSeekerPhone,
      finalSeekerEmail
    );
    const nowMs = Date.now();
    const recentIdentical = existingLocalForSeeker.find(
      (i) =>
        i.propertyId === canonicalPropId &&
        i.message.trim() === message.trim() &&
        nowMs - new Date(i.createdAt).getTime() < 15000
    );
    if (recentIdentical) {
      return NextResponse.json({
        success: true,
        inquiry: recentIdentical,
        deduplicated: true,
      });
    }

    const inquiry = dbStore.createInquiry({
      propertyId: canonicalPropId,
      propertyTitle: resolvedPropertyTitle,
      propertySlug,
      propertyPrice,
      seekerId: user.id,
      seekerName: finalSeekerName,
      seekerPhone: finalSeekerPhone,
      seekerEmail: finalSeekerEmail,
      advertiserId: finalAdvId,
      message: message.trim(),
      preferredContact: preferredContact || "call",
    });

    return NextResponse.json({ success: true, inquiry });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "خطأ أثناء إرسال طلب التواصل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
