import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (hasAdminPermission(user, "support.manage")) {
      const notices = dbStore.getOfficialNoticesForAdmin();
      return NextResponse.json({ notices });
    } else {
      const notices = dbStore.getOfficialNoticesForUser(user.id);
      return NextResponse.json({ notices });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب المراسلات الرسمية";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { propertyId, propertyTitle, recipientId, type, title, message } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: "البيانات الأساسية للمراسلة الرسمية مطلوبة" }, { status: 400 });
    }

    // Advertisers sending official deletion request to admin
    if (type === "deletion_request") {
      if (!propertyId) {
        return NextResponse.json({ error: "معرف العقار مطلوب لطلب الحذف" }, { status: 400 });
      }

      const notice = dbStore.createOfficialNotice({
        propertyId,
        propertyTitle: propertyTitle || "عقار منشور",
        recipientId: "admin",
        recipientRole: "admin",
        senderId: user.id,
        senderName: user.name || "معلن",
        senderRole: user.role as any,
        type: "deletion_request",
        title: title || "طلب حذف عقار منشور",
        message: message.trim(),
      });

      return NextResponse.json({ success: true, notice, message: "تم إرسال طلب الحذف الرسمي للإدارة بنجاح" });
    }

    // Admin sending official edit request or notice to advertiser
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "صلاحية إرسال التوجيهات الرسمية مقتصرة على الإدارة" }, { status: 403 });
    }

    if (!recipientId) {
      return NextResponse.json({ error: "المستلم مطلوب" }, { status: 400 });
    }

    const notice = dbStore.createOfficialNotice({
      propertyId,
      propertyTitle,
      recipientId,
      recipientRole: "owner",
      senderId: user.id,
      senderName: "إدارة عقار بلس",
      senderRole: "admin",
      type: type || "edit_request",
      title: title.trim(),
      message: message.trim(),
    });

    return NextResponse.json({ success: true, notice, message: "تم إرسال المراسلة الرسمية إلى حساب المعلن بنجاح" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء إرسال المراسلة الرسمية";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { noticeId, action } = body;

    if (!noticeId || !action) {
      return NextResponse.json({ error: "المعرف والإجراء مطلوبان" }, { status: 400 });
    }

    if (action === "read") {
      const ok = dbStore.markOfficialNoticeRead(noticeId, user.id);
      return NextResponse.json({ success: ok });
    } else if (action === "resolve") {
      if (!hasAdminPermission(user, "support.manage")) {
        return NextResponse.json({ error: "لا تملك صلاحية معالجة المراسلات الرسمية" }, { status: 403 });
      }
      const ok = dbStore.resolveOfficialNotice(noticeId, user.id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في تحديث حالة المراسلة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
