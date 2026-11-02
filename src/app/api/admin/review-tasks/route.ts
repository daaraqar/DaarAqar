import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  hasAdminPermission,
  hasUnrestrictedAdminAccess,
} from "@/lib/auth/admin-permissions";
import type { User } from "@/lib/db/types";
import { createAdminClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasCentralCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !/placeholder|your[-_]/i.test(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      !/placeholder|your[-_]/i.test(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function unavailableResponse() {
  return NextResponse.json(
    { error: "يلزم إعداد Supabase المركزي وتطبيق ترحيل admin_review_workflow لتفعيل توزيع المراجعات." },
    { status: 503 }
  );
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "projects.review")) {
      return NextResponse.json({ error: "لا تملك صلاحية مراجعة الإعلانات" }, { status: 403 });
    }
    if (!hasCentralCredentials()) return unavailableResponse();

    const supabase = createAdminClient();
    const { data: properties, error: propertyError } = await supabase
      .from("properties")
      .select("id, title, status, price, created_at")
      .in("status", ["pending", "pending_review", "under_review"])
      .order("created_at", { ascending: true })
      .limit(200);
    if (propertyError) {
      console.error("[admin/review-tasks] Failed to load pending properties:", propertyError);
      return unavailableResponse();
    }

    const propertyIds = (properties || []).map((property) => property.id);
    const { data: tasks, error: taskError } = propertyIds.length
      ? await supabase
          .from("admin_review_tasks")
          .select("id, property_id, assigned_to, assigned_by, status, version, created_at, updated_at, completed_at")
          .in("property_id", propertyIds)
      : { data: [], error: null };
    if (taskError) {
      console.error("[admin/review-tasks] Failed to load review tasks:", taskError);
      return unavailableResponse();
    }

    const { data: events, error: eventError } = await supabase
      .from("admin_review_task_events")
      .select("id, property_id, actor_id, action, previous_status, next_status, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (eventError) {
      console.error("[admin/review-tasks] Failed to load task activity:", eventError);
      return unavailableResponse();
    }

    const activityPropertyIds = Array.from(new Set([
      ...propertyIds,
      ...(events || []).map((event) => event.property_id),
    ]));
    const [profilesResult, activityPropertiesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, name, role, email, admin_role, admin_permissions, is_staff, is_suspended, created_at, phone")
        .eq("role", "admin")
        .limit(1000),
      activityPropertyIds.length
        ? supabase.from("properties").select("id, title").in("id", activityPropertyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesResult.error) {
      console.error("[admin/review-tasks] Failed to load reviewer profiles:", profilesResult.error);
      return NextResponse.json({ error: "تعذر تحميل بيانات فريق المراجعة." }, { status: 503 });
    }
    if (activityPropertiesResult.error) {
      console.error("[admin/review-tasks] Failed to load activity property titles:", activityPropertiesResult.error);
      return NextResponse.json({ error: "تعذر تحميل سجل مراجعة الإعلانات." }, { status: 503 });
    }

    const reviewerNames = new Map(
      (profilesResult.data || []).map((profile) => [profile.id, profile.name || profile.email || "موظف"])
    );
    const propertyTitles = new Map(
      (activityPropertiesResult.data || []).map((property) => [property.id, property.title])
    );
    const reviewers = (profilesResult.data || [])
      .filter((profile) => !profile.is_suspended)
      .map((profile) => ({
        id: profile.id,
        name: profile.name || profile.email || "موظف",
        user: {
          id: profile.id,
          name: profile.name || profile.email || "موظف",
          email: profile.email || undefined,
          phone: profile.phone || "",
          role: "admin" as const,
          isVerified: false,
          isSuspended: false,
          isStaff: Boolean(profile.is_staff),
          adminRole: profile.admin_role || (
            profile.role === "admin" &&
            !profile.is_staff &&
            !Array.isArray(profile.admin_permissions)
              ? "superadmin"
              : "moderator"
          ),
          adminPermissions: Array.isArray(profile.admin_permissions)
            ? profile.admin_permissions
            : [],
          createdAt: profile.created_at,
        } satisfies User,
      }))
      .filter((profile) => hasAdminPermission(profile.user, "projects.review"))
      .map(({ id, name }) => ({ id, name }));

    const taskByProperty = new Map((tasks || []).map((task) => [task.property_id, task]));
    const eventsByProperty = new Map<
      string,
      Array<NonNullable<typeof events>[number] & { actorName: string }>
    >();
    for (const event of events || []) {
      const propertyEvents = eventsByProperty.get(event.property_id) || [];
      propertyEvents.push({
        ...event,
        actorName: event.actor_id ? reviewerNames.get(event.actor_id) || "موظف" : "النظام",
      });
      eventsByProperty.set(event.property_id, propertyEvents);
    }

    return NextResponse.json({
      currentUserId: user.id,
      canManageAssignments: hasUnrestrictedAdminAccess(user),
      reviewers: hasUnrestrictedAdminAccess(user) ? reviewers : [],
      recentActivity: (events || []).map((event) => ({
        ...event,
        propertyTitle: propertyTitles.get(event.property_id) || "إعلان محذوف",
        actorName: event.actor_id ? reviewerNames.get(event.actor_id) || "موظف" : "النظام",
      })),
      tasks: (properties || []).map((property) => {
        const task = taskByProperty.get(property.id);
        return {
          ...property,
          task: task || null,
          assigneeName: task?.assigned_to ? reviewerNames.get(task.assigned_to) || "موظف" : null,
          activity: eventsByProperty.get(property.id) || [],
        };
      }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذر تحميل مهام مراجعة الإعلانات.";
    console.error("[admin/review-tasks] GET failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "projects.review")) {
      return NextResponse.json({ error: "لا تملك صلاحية مراجعة الإعلانات" }, { status: 403 });
    }
    if (!hasCentralCredentials()) return unavailableResponse();

    const body = await request.json();
    const propertyId = typeof body.propertyId === "string" ? body.propertyId : "";
    const action = body.action;
    const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId : null;
    const status = typeof body.status === "string" ? body.status : null;
    const expectedVersion = body.expectedVersion;

    if (!UUID_PATTERN.test(propertyId)) {
      return NextResponse.json({ error: "معرف الإعلان غير صالح." }, { status: 400 });
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      return NextResponse.json({ error: "إصدار المهمة غير صالح؛ حدّث القائمة وحاول مجدداً." }, { status: 400 });
    }
    if (!["assign", "claim", "release", "status"].includes(action)) {
      return NextResponse.json({ error: "إجراء المهمة غير صالح." }, { status: 400 });
    }
    if (action === "assign" && !hasUnrestrictedAdminAccess(user)) {
      return NextResponse.json({ error: "إسناد المهام لموظفين آخرين يتطلب صلاحية المدير الأعلى." }, { status: 403 });
    }
    if (action === "assign" && (!assigneeId || !UUID_PATTERN.test(assigneeId))) {
      return NextResponse.json({ error: "اختر موظفاً صالحاً لإسناد المهمة." }, { status: 400 });
    }
    if (action === "status" && status !== "in_progress" && status !== "blocked") {
      return NextResponse.json({ error: "حالة المهمة غير صالحة." }, { status: 400 });
    }
    if (assigneeId && action === "assign") {
      const supabase = createAdminClient();
      const { data: target, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, admin_role, admin_permissions, is_staff, is_suspended, created_at")
        .eq("id", assigneeId)
        .maybeSingle();
      if (error) {
        console.error("[admin/review-tasks] Failed to validate assignee:", error);
        return NextResponse.json({ error: "تعذر التحقق من الموظف المختار." }, { status: 503 });
      }
      if (!target || target.role !== "admin" || target.is_suspended) {
        return NextResponse.json({ error: "الموظف المختار غير متاح لإسناد مهام المراجعة." }, { status: 400 });
      }
      const targetUser: User = {
        id: target.id,
        name: target.name || target.email || "موظف",
        email: target.email || undefined,
        phone: target.phone || "",
        role: "admin",
        isVerified: false,
        isSuspended: false,
        isStaff: Boolean(target.is_staff),
        adminRole: target.admin_role || (
          target.role === "admin" &&
          !target.is_staff &&
          !Array.isArray(target.admin_permissions)
            ? "superadmin"
            : "moderator"
        ),
        adminPermissions: Array.isArray(target.admin_permissions) ? target.admin_permissions : [],
        createdAt: target.created_at,
      };
      if (!hasAdminPermission(targetUser, "projects.review")) {
        return NextResponse.json({ error: "الموظف المختار لا يملك صلاحية مراجعة الإعلانات." }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("admin_update_review_task", {
      p_property_id: propertyId,
      p_actor_id: user.id,
      p_action: action,
      p_assignee_id: action === "assign" ? assigneeId : null,
      p_status: status,
      p_expected_version: expectedVersion,
      p_force: hasUnrestrictedAdminAccess(user),
    });
    if (error) {
      console.error("[admin/review-tasks] RPC failed:", error);
      return unavailableResponse();
    }
    if (!data?.success) {
      const code = data?.code;
      const responseStatus = code === "property_not_found" ? 404 : code === "invalid_assignee" ? 400 : 409;
      const messages: Record<string, string> = {
        property_not_found: "الإعلان غير موجود.",
        property_not_pending: "لم يعد الإعلان بانتظار المراجعة.",
        stale_version: "حدّثت جهة أخرى هذه المهمة. تم تحميل أحدث حالة؛ راجعها قبل المتابعة.",
        already_assigned: "استلم موظف آخر هذه المهمة بالفعل.",
        assigned_to_other: "هذه المهمة مسندة لموظف آخر.",
        not_assigned_to_actor: "لا يمكنك تعديل مهمة مسندة لموظف آخر.",
        invalid_assignee: "الموظف المختار لم يعد متاحاً لمهام المراجعة.",
        invalid_status: "حالة المهمة غير صالحة.",
      };
      return NextResponse.json(
        { error: messages[code] || "تعذر تنفيذ الإجراء؛ حدّث القائمة وحاول مجدداً.", code },
        { status: responseStatus }
      );
    }

    return NextResponse.json({ success: true, task: data.task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذر تحديث مهمة المراجعة.";
    console.error("[admin/review-tasks] POST failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
