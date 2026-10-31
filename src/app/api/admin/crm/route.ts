import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import type { ClientRecordType } from "@/lib/db/store";

const PHONE_REGEX = /^(\+?2)?01[0125][0-9]{8}$/;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search")?.toLowerCase();

    let records = dbStore.getClientRecords();
    if (type === "client" || type === "broker") {
      records = records.filter((r) => r.type === type);
    }
    if (search) {
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          r.phone.toLowerCase().includes(search) ||
          (r.requestedProperty || "").toLowerCase().includes(search) ||
          (r.availableListings || "").toLowerCase().includes(search) ||
          (r.notes || "").toLowerCase().includes(search)
      );
    }
    return NextResponse.json({ records });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في جلب سجلات العملاء والسماسرة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }
    const body = await req.json();
    const {
      type,
      name,
      phone,
      requestedProperty,
      requestedCategory,
      requestedArea,
      requestedPriceRange,
      priceMin,
      priceMax,
      transactionType,
      requestedLocation,
      availableListings,
      listingsCount,
      notes,
    } = body || {};

    if (type !== "client" && type !== "broker") {
      return NextResponse.json({ error: "نوع السجل يجب أن يكون (client) أو (broker)" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2 || name.trim().length > 120) {
      return NextResponse.json({ error: "الاسم مطلوب (من حرفين إلى 120 حرفاً)" }, { status: 400 });
    }
    const normalizedPhone = String(phone || "").replace(/[\s-]/g, "");
    if (!PHONE_REGEX.test(normalizedPhone)) {
      return NextResponse.json(
        { error: "رقم هاتف مصري غير صالح — يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015" },
        { status: 400 }
      );
    }
    if (type === "client" && !requestedProperty && !requestedCategory) {
      return NextResponse.json(
        { error: "بيانات العقار المطلوب مطلوبة للعميل (العقار أو التصنيف)" },
        { status: 400 }
      );
    }
    if (type === "broker" && !availableListings) {
      return NextResponse.json({ error: "العروض المتاحة مطلوبة للسمسار" }, { status: 400 });
    }

    const record = dbStore.createClientRecord(
      {
        type: type as ClientRecordType,
        name: name.trim(),
        phone: normalizedPhone,
        requestedProperty: requestedProperty?.trim() || undefined,
        requestedCategory: requestedCategory?.trim() || undefined,
        requestedArea: Number.isFinite(Number(requestedArea)) ? Number(requestedArea) : undefined,
        requestedPriceRange: requestedPriceRange?.trim() || undefined,
        priceMin: Number.isFinite(Number(priceMin)) && Number(priceMin) > 0 ? Number(priceMin) : undefined,
        priceMax: Number.isFinite(Number(priceMax)) && Number(priceMax) > 0 ? Number(priceMax) : undefined,
        transactionType: transactionType === "rent" ? "rent" : transactionType === "sale" ? "sale" : undefined,
        requestedLocation: requestedLocation?.trim() || undefined,
        availableListings: availableListings?.trim() || undefined,
        listingsCount: Number.isFinite(Number(listingsCount)) ? Number(listingsCount) : undefined,
        notes: notes?.trim() || undefined,
      },
      user
    );
    return NextResponse.json({ success: true, record, message: "تم حفظ السجل بنجاح" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حفظ السجل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }
    const body = await req.json();
    const { id, isVerified, ...updates } = body || {};
    if (!id) {
      return NextResponse.json({ error: "معرف السجل مطلوب" }, { status: 400 });
    }
    if (updates.phone !== undefined) {
      const normalizedPhone = String(updates.phone || "").replace(/[\s-]/g, "");
      if (!PHONE_REGEX.test(normalizedPhone)) {
        return NextResponse.json({ error: "رقم هاتف مصري غير صالح" }, { status: 400 });
      }
      updates.phone = normalizedPhone;
    }
    // Verification toggle — only admins can confirm/unconfirm records
    if (typeof isVerified === "boolean") {
      updates.isVerified = isVerified;
      updates.verifiedBy = isVerified ? (user.name || user.email || "الإدارة") : undefined;
      updates.verifiedAt = isVerified ? new Date().toISOString() : undefined;
    }
    const record = dbStore.updateClientRecord(id, updates, user);
    return NextResponse.json({ success: true, record, message: "تم تحديث السجل بنجاح" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء تحديث السجل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "معرف السجل مطلوب" }, { status: 400 });
    }
    dbStore.deleteClientRecord(id, user);
    return NextResponse.json({ success: true, message: "تم حذف السجل بنجاح" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء حذف السجل";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
