import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { propertyService, isSupabaseDirect } from "@/lib/services/propertyService";
import { dbStore } from "@/lib/db/store";
import {
  createAdminClient,
  createClient as createSupabaseServerClient,
} from "@/utils/supabase/server";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { applyApprovedPublisherRole } from "@/lib/services/publisher-role";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const viewer = await getCurrentUser(req);
    const prop = await propertyService.getPublicPropertyBySlugOrId(params.id, viewer || undefined);

    if (!prop) {
      return NextResponse.json({ error: "العقار غير موجود أو غير متاح للعرض" }, { status: 404 });
    }

    return NextResponse.json({ property: prop });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب بيانات العقار";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول للتعديل" }, { status: 401 });
    }

    const updates = await req.json();
    if (updates.price !== undefined) {
      const price = Number(updates.price);
      if (!Number.isFinite(price) || price < 1 || price > 100_000_000) {
        return NextResponse.json(
          { error: "يجب أن يكون سعر العقار بين 1 و100 مليون جنيه مصري" },
          { status: 400 }
        );
      }
      updates.price = price;
    }
    const canReviewProjects = hasAdminPermission(user, "projects.review");
    const safeUpdates = { ...updates };
    if (!canReviewProjects && (safeUpdates.status === "published" || safeUpdates.status === "active")) {
      safeUpdates.status = "pending_review";
    }

    if (!isSupabaseDirect()) {
      const targetProp =
        dbStore.getRawPropertyById(params.id) || dbStore.getPropertyByIdOrSlug(params.id);
      if (!targetProp) {
        return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
      }
      if (targetProp.advertiserId !== user.id && !canReviewProjects) {
        return NextResponse.json({ error: "غير مصرح لك بتعديل عقار يملكه مستخدم آخر" }, { status: 403 });
      }
      const updated = dbStore.updateProperty(targetProp.id, safeUpdates, user);
      if (canReviewProjects && (updated.status === "active" || updated.status === "published")) {
        await applyApprovedPublisherRole(targetProp.advertiserId, targetProp.advertiserType, user, false);
      }
      return NextResponse.json({ success: true, property: updated, source: "central_backend" });
    }

    const supabase = createSupabaseServerClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    // 1. Check ownership in Supabase
    let query = supabase.from("properties").select("id, advertiser_id, user_id, owner_id, title, status, advertiser_type");
    if (isUuid) {
      query = query.eq("id", params.id);
    } else {
      query = query.eq("slug", params.id);
    }
    const { data: cloudProp } = await query.single();

    if (cloudProp) {
      let isOwner = cloudProp.advertiser_id === user.id;
      if (!isOwner && user.email) {
        const { data: advUser } = await supabase.from("profiles").select("id").eq("email", user.email).single();
        if (advUser && advUser.id === cloudProp.advertiser_id) {
          isOwner = true;
        }
      }
      const isAdmin = hasAdminPermission(user, "projects.review");

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح لك بتعديل عقار يملكه مستخدم آخر" }, { status: 403 });
      }

      // Ordinary owner cannot force "published" or "active"
      let targetStatus = safeUpdates.status;
      if (!isAdmin && (targetStatus === "published" || targetStatus === "active")) {
        targetStatus = "pending_review";
      }

      // Update in Supabase
      const cloudUpdatePayload: any = {
        title: updates.title,
        description: updates.description,
        price: updates.price ? Number(updates.price) : undefined,
        area_sqm: updates.areaSqM ? Number(updates.areaSqM) : undefined,
        bedrooms: updates.bedrooms !== undefined ? Number(updates.bedrooms) : undefined,
        bathrooms: updates.bathrooms !== undefined ? Number(updates.bathrooms) : undefined,
        address_details: updates.addressDetails,
        updated_at: new Date().toISOString(),
      };
      if (targetStatus) {
        cloudUpdatePayload.status = targetStatus;
      }
      if (updates.exactLat !== undefined || updates.latitude !== undefined) {
        const latVal = updates.exactLat ?? updates.latitude;
        cloudUpdatePayload.exact_lat = latVal;
        cloudUpdatePayload.latitude = latVal;
      }
      if (updates.exactLng !== undefined || updates.longitude !== undefined) {
        const lngVal = updates.exactLng ?? updates.longitude;
        cloudUpdatePayload.exact_lng = lngVal;
        cloudUpdatePayload.longitude = lngVal;
      }
      if (cloudProp.advertiser_id) {
        cloudUpdatePayload.advertiser_id = cloudProp.advertiser_id;
        cloudUpdatePayload.user_id = cloudProp.advertiser_id;
        cloudUpdatePayload.owner_id = cloudProp.advertiser_id;
      }

      const { data: updatedCloud, error: updateErr } = await supabase
        .from("properties")
        .update(cloudUpdatePayload)
        .eq("id", cloudProp.id)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: `فشل تحديث العقار سحابياً: ${updateErr.message}` }, { status: 500 });
      }

      try {
        dbStore.updateProperty(cloudProp.id, safeUpdates, user);
      } catch {}

      if (isAdmin && (updatedCloud.status === "active" || updatedCloud.status === "published")) {
        const advertiserType = updatedCloud.advertiser_type === "broker" ? "broker" : "owner";
        await applyApprovedPublisherRole(cloudProp.advertiser_id, advertiserType, user, true);
      }

      return NextResponse.json({ success: true, property: updatedCloud, source: "supabase" });
    }

    return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث العقار";
    const status = message.includes("غير مصرح") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { status, reason } = body;

    if (!status) {
      return NextResponse.json({ error: "الحالة الجديدة مطلوبة" }, { status: 400 });
    }
    const validStatuses = new Set([
      "draft",
      "pending",
      "pending_review",
      "under_review",
      "published",
      "active",
      "rejected",
      "paused",
      "sold",
      "rented",
      "archived",
      "suspended",
    ]);
    if (typeof status !== "string" || !validStatuses.has(status)) {
      return NextResponse.json({ error: "حالة العقار غير صالحة" }, { status: 400 });
    }

    if (!isSupabaseDirect()) {
      const targetProp =
        dbStore.getRawPropertyById(params.id) || dbStore.getPropertyByIdOrSlug(params.id);
      if (!targetProp) {
        return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
      }
      const isAdmin = hasAdminPermission(user, "projects.review");
      const targetStatus =
        !isAdmin &&
        (status === "published" || status === "active") &&
        targetProp.status !== "paused"
          ? "pending_review"
          : status;
      const updated = dbStore.updatePropertyStatus(targetProp.id, targetStatus as any, user, reason);
      if (isAdmin && (targetStatus === "published" || targetStatus === "active")) {
        await applyApprovedPublisherRole(targetProp.advertiserId, targetProp.advertiserType, user, false);
      }
      return NextResponse.json({ success: true, property: updated, source: "central_backend" });
    }

    const supabase = createSupabaseServerClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    let query = supabase.from("properties").select("id, advertiser_id, user_id, owner_id, title, status, advertiser_type");
    if (isUuid) {
      query = query.eq("id", params.id);
    } else {
      query = query.eq("slug", params.id);
    }
    const { data: cloudProp } = await query.single();

    if (cloudProp) {
      let isOwner = cloudProp.advertiser_id === user.id;
      if (!isOwner && user.email) {
        const { data: advUser } = await supabase.from("profiles").select("id").eq("email", user.email).single();
        if (advUser && advUser.id === cloudProp.advertiser_id) {
          isOwner = true;
        }
      }
      const isAdmin = hasAdminPermission(user, "projects.review");

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح لك بتغيير حالة هذا العقار" }, { status: 403 });
      }
      if (
        !isAdmin &&
        status === "sold" &&
        cloudProp.status !== "published" &&
        cloudProp.status !== "active" &&
        cloudProp.status !== "paused"
      ) {
        return NextResponse.json({ error: "يمكن تسجيل البيع بعد نشر العقار فقط" }, { status: 400 });
      }
      if (
        !isAdmin &&
        status === "paused" &&
        cloudProp.status !== "published" &&
        cloudProp.status !== "active"
      ) {
        return NextResponse.json({ error: "يمكن إيقاف العقار مؤقتاً بعد نشره فقط" }, { status: 400 });
      }

      // Owners may resume only listings that were already approved and temporarily paused.
      let newStatus = status;
      if (
        !isAdmin &&
        (newStatus === "published" || newStatus === "active") &&
        cloudProp.status !== "paused"
      ) {
        newStatus = "pending_review";
      }

      const { data: updatedCloud, error: patchErr } = await supabase
        .from("properties")
        .update({
          status: newStatus,
          moderation_notes: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cloudProp.id)
        .select()
        .single();

      if (patchErr) {
        return NextResponse.json({ error: `فشل تحديث حالة العقار سحابياً: ${patchErr.message}` }, { status: 500 });
      }

      try {
        dbStore.updatePropertyStatus(cloudProp.id, newStatus as any, user, reason);
      } catch {}

      if (isAdmin && (newStatus === "published" || newStatus === "active")) {
        const advertiserType = updatedCloud.advertiser_type === "broker" ? "broker" : "owner";
        await applyApprovedPublisherRole(cloudProp.advertiser_id, advertiserType, user, true);
      }

      return NextResponse.json({ success: true, property: updatedCloud, source: "supabase" });
    }

    return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تغيير حالة العقار";
    const isPermissionError =
      message.includes("غير مصرح") ||
      message.includes("موافقة الإدارة") ||
      message.includes("مشرفي المنصة") ||
      message.includes("غير معتمد");
    const status = isPermissionError ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!isSupabaseDirect()) {
      const targetProp =
        dbStore.getRawPropertyById(params.id) || dbStore.getPropertyByIdOrSlug(params.id);
      if (!targetProp) {
        return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
      }
      dbStore.deleteProperty(targetProp.id, user);
      return NextResponse.json({ success: true, message: "تم حذف العقار بنجاح", source: "central_backend" });
    }

    const supabase = createAdminClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

    let query = supabase.from("properties").select("id, advertiser_id, user_id, owner_id, title, status");
    if (isUuid) {
      query = query.eq("id", params.id);
    } else {
      query = query.eq("slug", params.id);
    }
    const { data: cloudProp } = await query.single();

    if (cloudProp) {
      let isOwner = cloudProp.advertiser_id === user.id;
      if (!isOwner && user.email) {
        const { data: advUser } = await supabase.from("profiles").select("id").eq("email", user.email).single();
        if (advUser && advUser.id === cloudProp.advertiser_id) {
          isOwner = true;
        }
      }
      const isAdmin = hasAdminPermission(user, "projects.delete");

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح لك بحذف عقار لا تملكه" }, { status: 403 });
      }

      // Diagram rule: "يحق للمالك أو الوسيط حذف المشروع وهوا قيد المراجعة، إذا قُبل المشروع لا يحق له حذفه"
      if (cloudProp.status === "published" && !isAdmin) {
        return NextResponse.json(
          {
            error:
            "لا يمكن للمعلن حذف العقار بعد اعتماده ونشره من قبل الإدارة. يمكنك وسمه كـ (تم البيع) أو إيقافه مؤقتاً أو تقديم طلب حذف رسمي للإدارة.",
          },
          { status: 403 }
        );
      }

      const advertiserId = cloudProp.advertiser_id || cloudProp.user_id || cloudProp.owner_id;
      const inquirySnapshot: { property_title: string; advertiser_id?: string } = {
        property_title: cloudProp.title,
        ...(advertiserId ? { advertiser_id: advertiserId } : {}),
      };
      const { error: inquirySnapshotError } = await supabase
        .from("inquiries")
        .update(inquirySnapshot)
        .eq("property_id", cloudProp.id);
      if (inquirySnapshotError) {
        return NextResponse.json(
          { error: `تعذر حفظ المحادثات المرتبطة بالعقار قبل حذفه: ${inquirySnapshotError.message}` },
          { status: 500 }
        );
      }

      const { error: deleteErr } = await supabase
        .from("properties")
        .delete()
        .eq("id", cloudProp.id);

      if (deleteErr) {
        return NextResponse.json({ error: `فشل حذف العقار من السحابة: ${deleteErr.message}` }, { status: 500 });
      }

      try {
        dbStore.deleteProperty(cloudProp.id, user);
      } catch {}

      return NextResponse.json({ success: true, message: "تم حذف العقار بنجاح", source: "supabase" });
    }

    return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف العقار";
    const status = message.includes("غير مصرح") || message.includes("لا يمكن للمعلن حذف") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
