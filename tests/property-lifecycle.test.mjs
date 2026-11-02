import assert from "node:assert/strict";
import { dbStore } from "../.tests_dist/db/store.js";

console.log("=== Running Complete Property Lifecycle & Governance Rules Test Suite ===");

// 1. Setup Users
const ownerUser = dbStore.createUser({
  name: "طارق صاحب العقار",
  phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
  role: "owner",
  isVerified: true,
  createdAt: new Date().toISOString(),
});

const adminUser = {
  id: "admin-super-auditor",
  name: "المشرف العام للإدارة",
  phone: "01000000001",
  role: "admin",
  isVerified: true,
  createdAt: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// Rule 1: Owner submits property -> enters pending_review (restricted registry)
// --------------------------------------------------------------------------
const prop1 = dbStore.createProperty({
  advertiserId: ownerUser.id,
  advertiserType: "owner",
  title: "شقة للبيع بشارع بورسعيد - ميت غمر",
  description: "شقة تشطيب فاخر كاملة المرافق والخدمات",
  transactionType: "sale",
  category: "apartment",
  price: 1200000,
  areaSqM: 130,
  currency: "EGP",
  negotiable: true,
  amenities: [],
  featured: false,
  status: "pending_review",
});

assert.equal(prop1.status, "pending_review", "Initial state must be pending_review");
console.log("✓ Rule 1 Passed: Property successfully entered pending_review in restricted registry");

// --------------------------------------------------------------------------
// Rule 2: Owner CAN delete property while under review
// ("يحق للمالك أو الوسيط حذف المشروع وهوا قيد المراجعة")
// --------------------------------------------------------------------------
const deleteWhilePendingResult = dbStore.deleteProperty(prop1.id, ownerUser);
assert.equal(deleteWhilePendingResult, true, "Owner must be allowed to delete property while pending_review");
const checkDeleted = dbStore.getRawPropertyById(prop1.id);
assert.equal(checkDeleted, null, "Property must be completely removed");
console.log("✓ Rule 2 Passed: Owner successfully deleted property while under review");

// --------------------------------------------------------------------------
// Rule 3: Submit new property and Admin Approves -> becomes published
// --------------------------------------------------------------------------
const prop2 = dbStore.createProperty({
  advertiserId: ownerUser.id,
  advertiserType: "owner",
  title: "محل تجاري للبيع بالسوق التجاري بميت غمر",
  description: "محل تجاري واجهة عريضة موقع حيوي",
  transactionType: "sale",
  category: "commercial_retail",
  price: 2500000,
  areaSqM: 85,
  currency: "EGP",
  negotiable: false,
  amenities: [],
  featured: false,
  status: "pending_review",
});

const approvedProp = dbStore.updatePropertyStatus(prop2.id, "published", adminUser);
assert.equal(approvedProp.status, "published", "Admin approval sets status to published");
console.log("✓ Rule 3 Passed: Admin approved property -> published band active");

// --------------------------------------------------------------------------
// Rule 4: Owner CANNOT delete property once published
// ("إذا قُبل المشروع لا يحق له حذفه")
// --------------------------------------------------------------------------
let ownerDeleteBlocked = false;
try {
  dbStore.deleteProperty(prop2.id, ownerUser);
} catch (err) {
  ownerDeleteBlocked = true;
  assert.match(
    err.message,
    /لا يمكن للمعلن حذف العقار بعد اعتماده ونشره من قبل الإدارة/,
    "Error message must clearly explain deletion restriction"
  );
}
assert.equal(ownerDeleteBlocked, true, "Owner MUST be strictly prevented from deleting published property");
console.log("✓ Rule 4 Passed: Owner was strictly blocked from deleting published property");

// --------------------------------------------------------------------------
// Rule 5: Owner can Pause / Mark as Sold instead of deleting (تم البيع / إيقاف العرض)
// --------------------------------------------------------------------------
const pausedProp = dbStore.updatePropertyStatus(prop2.id, "paused", ownerUser);
assert.equal(pausedProp.status, "paused", "Owner can pause published listing");
console.log("✓ Rule 5 Passed: Owner paused property (Marked as Sold / Paused)");

// Unpause back to published
const unpausedProp = dbStore.updatePropertyStatus(prop2.id, "published", ownerUser);
assert.equal(unpausedProp.status, "published", "Owner can unpause back to published");
console.log("✓ Rule 5b Passed: Owner unpaused property back to published");

// --------------------------------------------------------------------------
// Rule 6: Owner sends Official Deletion Request to Admin via official channel
// --------------------------------------------------------------------------
const deletionRequest = dbStore.createOfficialNotice({
  propertyId: prop2.id,
  propertyTitle: prop2.title,
  recipientId: "admin",
  recipientRole: "admin",
  senderId: ownerUser.id,
  senderName: ownerUser.name,
  senderRole: "owner",
  type: "deletion_request",
  title: "طلب حذف عقار منشور",
  message: "تم بيع العقار خارج المنصة ويرجى حذفه من قبل الإدارة",
});

assert.ok(deletionRequest.id, "Notice ID generated");
assert.equal(deletionRequest.type, "deletion_request");
const adminNotices = dbStore.getOfficialNoticesForAdmin();
assert.ok(adminNotices.some((n) => n.id === deletionRequest.id), "Admin must receive deletion request");
console.log("✓ Rule 6 Passed: Owner sent official deletion request to Admin");

// --------------------------------------------------------------------------
// Rule 7: Admin sends Official Modification Request to Owner via official channel
// ("طلب من المالك أو الوسيط تعديله بقناة تواصل رسمية إلي حسابه")
// --------------------------------------------------------------------------
const editRequest = dbStore.createOfficialNotice({
  propertyId: prop2.id,
  propertyTitle: prop2.title,
  recipientId: ownerUser.id,
  recipientRole: "owner",
  senderId: adminUser.id,
  senderName: adminUser.name,
  senderRole: "admin",
  type: "edit_request",
  title: "توجيه إداري: تعديل السعر",
  message: "يرجى تعديل السعر وإضافة صور أوضح للمدخل",
});

assert.ok(editRequest.id);
const ownerNotices = dbStore.getOfficialNoticesForUser(ownerUser.id);
assert.ok(ownerNotices.some((n) => n.id === editRequest.id), "Owner must receive official edit request");
console.log("✓ Rule 7 Passed: Admin sent official modification request to Owner");

// --------------------------------------------------------------------------
// Rule 8: Admin CAN delete published property at any time
// ("يحق للإدارة حذف المنشور")
// --------------------------------------------------------------------------
const adminDeleteResult = dbStore.deleteProperty(prop2.id, adminUser);
assert.equal(adminDeleteResult, true, "Admin must be permitted to delete published listing");
const checkAdminDeleted = dbStore.getRawPropertyById(prop2.id);
assert.equal(checkAdminDeleted, null, "Property must be deleted by admin");
console.log("✓ Rule 8 Passed: Admin successfully deleted published property");

console.log("=== All 8 Core Architectural & Governance Rules Passed 100% ===");
