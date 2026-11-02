import test from "node:test";
import assert from "node:assert/strict";
import { isPropertyCreatedByUser, isPropertyOwnedByUser } from "./propertyOwnership";

test("property ownership detection recognizes advertiser, user, and owner IDs", () => {
  assert.equal(isPropertyOwnedByUser({ advertiserId: "user-1" }, "user-1"), true);
  assert.equal(isPropertyOwnedByUser({ advertiser: { id: "user-2" } }, "user-2"), true);
  assert.equal(isPropertyOwnedByUser({ userId: "user-3" }, "user-3"), true);
  assert.equal(isPropertyOwnedByUser({ ownerId: "user-4" }, "user-4"), true);
  assert.equal(isPropertyOwnedByUser({ advertiserId: "user-1" }, "user-2"), false);
  assert.equal(isPropertyOwnedByUser({ advertiserId: "user-1" }, null), false);
});

test("legacy project ownership only matches the creator account ID or exact email", () => {
  const userIds = new Set(["account-1"]);
  assert.equal(
    isPropertyCreatedByUser({ creatorSessionId: "account-1" }, userIds, "user@example.com"),
    true
  );
  assert.equal(
    isPropertyCreatedByUser({ creatorEmail: " USER@example.com " }, userIds, "user@example.com"),
    true
  );
  assert.equal(
    isPropertyCreatedByUser({ creatorEmail: "other@example.com", creatorPhone: "+201000000000" }, userIds, "user@example.com"),
    false
  );
  assert.equal(
    isPropertyCreatedByUser({ creatorPhone: "+201000000000" }, userIds, "user@example.com"),
    false
  );
});
