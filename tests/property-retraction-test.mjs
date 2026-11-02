import assert from "node:assert/strict";
import { dbStore } from "../.tests_dist/db/store.js";

console.log("--- Testing Retraction and Re-submission Lifecycle ---");

// 1. Create owner
const owner = dbStore.createUser({
  name: "مالك تجريبي للتراجع",
  phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
  role: "owner",
  isVerified: true,
  createdAt: new Date().toISOString(),
});

// 2. Submit property for review
const prop = dbStore.createProperty({
  advertiserId: owner.id,
  advertiserType: "owner",
  title: "شقة للبيع تجريبية",
  description: "وصف تفصيلي كامل للعقار",
  transactionType: "sale",
  category: "apartment",
  price: 850000,
  areaSqM: 120,
  currency: "EGP",
  negotiable: true,
  amenities: [],
  featured: false,
  status: "pending_review",
});

const adminUser = {
  id: "admin-super-id",
  name: "مشرف المنصة",
  phone: "01000000000",
  role: "admin",
  isVerified: true,
  createdAt: new Date().toISOString(),
};

assert.equal(prop.status, "pending_review", "Status should be pending_review");
console.log("✓ Property created and submitted to restricted registry (pending_review)");

// 3. Owner retracts submission while in review
const retracted = dbStore.updatePropertyStatus(prop.id, "draft", owner);
assert.equal(retracted?.status, "draft", "Status must become draft after retraction");
console.log("✓ Owner successfully retracted property back to draft");

// 4. Owner resubmits for review
const resubmitted = dbStore.updatePropertyStatus(prop.id, "pending_review", owner);
assert.equal(resubmitted?.status, "pending_review", "Status must return to pending_review");
console.log("✓ Owner resubmitted property for review");

// 5. Admin rejects property with note
const rejected = dbStore.updatePropertyStatus(
  prop.id,
  "rejected",
  adminUser,
  "يرجى توضيح الدور السكني بدقة وتعديل السعر"
);
assert.equal(rejected?.status, "rejected", "Status must be rejected");
assert.equal(rejected?.moderationNotes, "يرجى توضيح الدور السكني بدقة وتعديل السعر");
console.log("✓ Admin rejected property with moderation note");

// 6. Owner retracts rejected property to draft to modify
const retractedFromReject = dbStore.updatePropertyStatus(prop.id, "draft", owner);
assert.equal(retractedFromReject?.status, "draft", "Owner can retract rejected property to draft");
console.log("✓ Owner retracted rejected property back to draft");

// 7. Owner updates details and resubmits to pending_review
const updatedProp = dbStore.updateProperty(
  prop.id,
  {
    title: "شقة للبيع - الدور الثالث بميت غمر",
    price: 900000,
  },
  owner
);
const resubmittedFinal = dbStore.updatePropertyStatus(prop.id, "pending_review", owner);
assert.equal(resubmittedFinal?.price, 900000);
assert.equal(resubmittedFinal?.status, "pending_review");
console.log("✓ Owner updated property details and resubmitted to pending_review");

// 8. Admin approves property -> exits restricted registry to published band
const approved = dbStore.updatePropertyStatus(prop.id, "published", adminUser);
assert.equal(approved?.status, "published");
console.log("✓ Admin approved property -> published band active");

console.log("--- All retraction and moderation lifecycle assertions passed successfully! ---");
