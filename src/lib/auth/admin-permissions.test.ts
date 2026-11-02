import assert from "node:assert/strict";
import { test } from "node:test";
import type { User } from "@/lib/db/types";
import {
  canAccessAdminSection,
  canGrantAdminPermissions,
  getPublishingCategory,
  hasAdminPermission,
} from "./admin-permissions";

const staff: User = {
  id: "staff-1",
  name: "موظف",
  email: "staff@example.com",
  phone: "",
  role: "admin",
  isVerified: true,
  isStaff: true,
  adminRole: "moderator",
  adminPermissions: ["projects.review", "staff.manage"],
  createdAt: new Date(0).toISOString(),
};

test("admin permissions enforce explicit staff grants and prevent privilege escalation", () => {
  assert.equal(hasAdminPermission(staff, "projects.review"), true);
  assert.equal(hasAdminPermission(staff, "cms.edit"), false);
  assert.equal(hasAdminPermission(staff, "ratings.manage"), false);
  assert.equal(canGrantAdminPermissions(staff, ["projects.review"]), true);
  assert.equal(canGrantAdminPermissions(staff, ["cms.edit"]), false);
  assert.equal(canGrantAdminPermissions(staff, ["ratings.manage"]), false);
  assert.equal(
    hasAdminPermission({ ...staff, adminPermissions: ["ratings.manage"] }, "ratings.manage"),
    true
  );
  assert.equal(canAccessAdminSection(staff, "projects"), true);
  assert.equal(canAccessAdminSection(staff, "messages"), false);
  assert.equal(canAccessAdminSection(staff, "cms"), false);
});

test("explicit employee grants remain limited even when isStaff is missing or false", () => {
  const employee = {
    ...staff,
    isStaff: false,
    adminRole: undefined,
    adminPermissions: ["cms.edit"],
  };
  assert.equal(hasAdminPermission(employee, "cms.edit"), true);
  assert.equal(hasAdminPermission(employee, "projects.review"), false);
  assert.equal(canAccessAdminSection(employee, "cms"), true);
  assert.equal(canAccessAdminSection(employee, "staff"), false);
  assert.equal(
    canAccessAdminSection({ ...employee, adminPermissions: ["projects.delete"] }, "projects"),
    true
  );
  assert.equal(
    hasAdminPermission({ ...staff, adminPermissions: [] }, "cms.edit"),
    false
  );
});

test("unrestricted administrators retain full access and can delegate permissions", () => {
  const root: User = {
    ...staff,
    email: "mkelwayzy@gmail.com",
    adminPermissions: [],
  };
  assert.equal(hasAdminPermission(root, "cms.edit"), true);
  assert.equal(canGrantAdminPermissions(root, ["cms.edit", "projects.delete"]), true);
  assert.equal(canAccessAdminSection(root, "staff"), true);
});

test("crm section is gated by the dedicated crm.manage permission", () => {
  assert.equal(canAccessAdminSection(staff, "crm"), false);
  assert.equal(
    canAccessAdminSection({ ...staff, adminPermissions: ["crm.manage"] }, "crm"),
    true
  );
  assert.equal(hasAdminPermission(staff, "crm.manage"), false);
  assert.equal(
    hasAdminPermission({ ...staff, adminPermissions: ["crm.manage"] }, "crm.manage"),
    true
  );
});

test("publishing classification changes only after an approved listing exists", () => {
  assert.equal(getPublishingCategory(0), "visitor");
  assert.equal(getPublishingCategory(1), "publisher");
});
