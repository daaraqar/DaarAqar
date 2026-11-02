import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { PropertyReport, ReportStatus } from "@/lib/db/types";
import { createAdminClient } from "@/utils/supabase/server";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as ReportStatus | null;
    const propertyId = searchParams.get("propertyId") || undefined;

    const localReports = dbStore.getPropertyReports({
      status: status && status !== ("all" as any) ? status : undefined,
      propertyId,
    });

    const reportMap = new Map<string, PropertyReport>();
    for (const r of localReports) {
      reportMap.set(r.id, r);
    }

    // Merge reports from Supabase property_reports
    try {
      const supabaseAdmin = createAdminClient();
      let query = supabaseAdmin
        .from("property_reports")
        .select("*, properties(id, title, slug, status, price, advertiser_id)")
        .order("created_at", { ascending: false });

      if (status && status !== ("all" as any)) {
        query = query.eq("status", status);
      }
      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data: cloudReports } = await query;
      if (cloudReports && cloudReports.length > 0) {
        for (const cr of cloudReports) {
          const mapped: any = {
            id: cr.id,
            propertyId: cr.property_id,
            propertyTitle: cr.properties?.title,
            propertySlug: cr.properties?.slug,
            propertyStatus: cr.properties?.status,
            propertyPrice: cr.properties?.price ? Number(cr.properties.price) : undefined,
            advertiserId: cr.properties?.advertiser_id,
            reporterId: cr.reporter_id || undefined,
            reporterName: cr.reporter_name || "مستخدم مجهول",
            reporterPhone: cr.reporter_phone || undefined,
            reasonCategory: cr.reason_category || "other",
            details: cr.details || "",
            status: (cr.status || "pending") as ReportStatus,
            resolutionNotes: cr.resolution_notes || undefined,
            resolvedBy: cr.resolved_by || undefined,
            resolvedAt: cr.resolved_at || undefined,
            createdAt: cr.created_at,
            updatedAt: cr.updated_at || cr.created_at,
          };
          const existing = reportMap.get(cr.id);
          reportMap.set(cr.id, existing ? { ...mapped, ...existing } : mapped);
        }
      }
    } catch {}

    const allProps = dbStore.getAllPropertiesForAdmin();
    const allUsers = dbStore.getAllUsersForAdmin();

    const reasonLabels: Record<string, string> = {
      fake_price: "سعر غير حقيقي أو مضلل",
      sold_unavailable: "عقار مباع أو غير متاح",
      inaccurate_location: "موقع جغرافي غير دقيق",
      fraud_scam: "اشتباه احتيال أو إعلان وهمي",
      duplicate: "إعلان مكرر",
      other: "بلاغ عام / أخرى",
    };

    // Enrich reports with property title and advertiser info
    const enriched = Array.from(reportMap.values())
      .map((r: any) => {
        const prop = allProps.find((p) => p.id === r.propertyId || p.slug === r.propertyId);
        const advId = r.advertiserId || prop?.advertiserId;
        const adv = advId ? allUsers.find((u) => u.id === advId) : null;
        return {
          ...r,
          reason: r.reason || reasonLabels[r.reasonCategory] || r.reasonCategory || "بلاغ عقاري",
          propertyTitle: r.propertyTitle || prop?.title || "عقار محذوف أو غير معروف",
          propertySlug: r.propertySlug || prop?.slug,
          propertyStatus: r.propertyStatus || prop?.status,
          propertyPrice: r.propertyPrice ?? prop?.price,
          advertiserName: r.advertiserName || adv?.companyName || adv?.name || "معلن غير معروف",
          advertiserPhone: adv?.phone,
          advertiserId: advId,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const auditEvents = dbStore.getAuditEvents();

    return NextResponse.json({ reports: enriched, auditEvents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب قائمة البلاغات";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية مدير النظام" }, { status: 403 });
    }

    const body = await req.json();
    const { reportId, status, resolutionNotes } = body;

    if (!reportId || !status) {
      return NextResponse.json({ error: "معرف البلاغ والحالة الجديدة مطلوبان" }, { status: 400 });
    }

    const validStatuses: ReportStatus[] = ["pending", "investigating", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "حالة بلاغ غير صالحة" }, { status: 400 });
    }

    let updated: PropertyReport | null = null;
    try {
      updated = dbStore.resolvePropertyReport(reportId, status, user, resolutionNotes);
    } catch {
      // May be a cloud-only UUID report
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId);
      if (isUuid) {
        const supabaseAdmin = createAdminClient();
        const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
        const nowIso = new Date().toISOString();
        const { data: cloudUpdated } = await supabaseAdmin
          .from("property_reports")
          .update({
            status,
            resolution_notes: resolutionNotes?.trim() || null,
            resolved_by: isUserUuid ? user.id : null,
            resolved_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", reportId)
          .select("*")
          .maybeSingle();

        if (cloudUpdated && !updated) {
          updated = {
            id: cloudUpdated.id,
            propertyId: cloudUpdated.property_id,
            reporterId: cloudUpdated.reporter_id || undefined,
            reporterName: cloudUpdated.reporter_name || "مستخدم مجهول",
            reporterPhone: cloudUpdated.reporter_phone || undefined,
            reasonCategory: cloudUpdated.reason_category || "other",
            details: cloudUpdated.details || "",
            status: cloudUpdated.status as ReportStatus,
            resolutionNotes: cloudUpdated.resolution_notes || undefined,
            resolvedBy: user.id,
            resolvedAt: cloudUpdated.resolved_at || nowIso,
            createdAt: cloudUpdated.created_at,
            updatedAt: cloudUpdated.updated_at || nowIso,
          };
          dbStore.recordAuditEvent(user.id, "RESOLVE_REPORT", "property_report", reportId, {
            newStatus: status,
            resolutionNotes: resolutionNotes?.trim(),
          });
        }

        await supabaseAdmin.from("audit_events").insert({
          user_id: isUserUuid ? user.id : null,
          action: "RESOLVE_REPORT",
          entity_type: "property_report",
          entity_id: reportId,
          details: { newStatus: status, resolutionNotes: resolutionNotes?.trim() },
        });
      }
    } catch (e) {
      console.warn("[Admin Reports PATCH] Supabase sync notice:", e);
    }

    if (!updated) {
      return NextResponse.json({ error: "البلاغ غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report: updated,
      message:
        status === "resolved"
          ? "تم حل البلاغ وإغلاقه بنجاح"
          : status === "dismissed"
          ? "تم رفض البلاغ وحفظه"
          : "تم تحديث حالة البلاغ بنجاح",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء معالجة البلاغ";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
