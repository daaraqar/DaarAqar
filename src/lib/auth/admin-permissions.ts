import type { User } from "@/lib/db/types";

export const ADMIN_PERMISSION_IDS = [
  "projects.review",
  "projects.delete",
  "messages.read",
  "cms.edit",
  "support.manage",
  "ratings.manage",
  "staff.manage",
  "crm.manage",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSION_IDS)[number];
export type AdminSection = "projects" | "messages" | "cms" | "support" | "ratings" | "staff" | "crm";

const ADMIN_SECTION_PERMISSIONS: Record<AdminSection, readonly AdminPermission[]> = {
  projects: ["projects.review", "projects.delete"],
  messages: ["messages.read"],
  cms: ["cms.edit"],
  support: ["support.manage"],
  ratings: ["ratings.manage"],
  staff: ["staff.manage"],
  crm: ["crm.manage"],
};

const ROOT_ADMIN_EMAIL = "mkelwayzy@gmail.com";

export function hasUnrestrictedAdminAccess(user: User | null | undefined): boolean {
  if (!user || user.role !== "admin") return false;
  const hasExplicitStaffConfiguration = Boolean(
    user.isStaff || user.adminRole || Array.isArray(user.adminPermissions)
  );
  return (
    user.email?.trim().toLowerCase() === ROOT_ADMIN_EMAIL ||
    user.adminRole === "superadmin" ||
    Boolean(user.adminPermissions?.includes("all")) ||
    (!hasExplicitStaffConfiguration && !user.isStaff)
  );
}

export function hasAdminPermission(
  user: User | null | undefined,
  permission: AdminPermission
): boolean {
  if (!user || user.role !== "admin") return false;
  return hasUnrestrictedAdminAccess(user) || Boolean(user.adminPermissions?.includes(permission));
}

export function canAccessAdminSection(user: User | null | undefined, section: AdminSection): boolean {
  if (hasUnrestrictedAdminAccess(user)) return true;
  return ADMIN_SECTION_PERMISSIONS[section].some((permission) => hasAdminPermission(user, permission));
}

export function canGrantAdminPermissions(
  actor: User,
  permissions: readonly string[]
): boolean {
  if (hasUnrestrictedAdminAccess(actor)) return true;
  return permissions.every(
    (permission) =>
      ADMIN_PERMISSION_IDS.includes(permission as AdminPermission) &&
      hasAdminPermission(actor, permission as AdminPermission)
  );
}

export function getPublishingCategory(publishedCount: number): "visitor" | "publisher" {
  return publishedCount > 0 ? "publisher" : "visitor";
}
