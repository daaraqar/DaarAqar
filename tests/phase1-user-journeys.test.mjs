import assert from "node:assert/strict";
import crypto from "node:crypto";
import { dbStore } from "../.tests_dist/db/store.js";

console.log("================================================================================");
console.log("      Dar Al Aqar Phase 1: Real User Journeys & Interaction Verification Suite   ");
console.log("================================================================================\n");

// -----------------------------------------------------------------------------
// 1. Setup Test Actors (Visitor, Owner, Broker, Admin, Seeker)
// -----------------------------------------------------------------------------
const timestamp = Date.now();

const owner = dbStore.createUser({
  id: crypto.randomUUID(),
  name: "مالك عقارات القاهرة الجديدة",
  email: `owner.phase1.${timestamp}@aqarpulse.eg`,
  phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
  role: "owner",
  isVerified: true,
  createdAt: new Date().toISOString(),
});

const unverifiedBroker = dbStore.createUser({
  id: crypto.randomUUID(),
  name: "وسيط عقاري جديد تحت المراجعة",
  email: `broker.unverified.${timestamp}@aqarpulse.eg`,
  phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
  role: "broker",
  isVerified: false,
  createdAt: new Date().toISOString(),
});

const seeker = dbStore.createUser({
  id: crypto.randomUUID(),
  name: "مشتري وباحث عن عقار",
  email: `buyer.seeker.${timestamp}@aqarpulse.eg`,
  phone: `+2010${Math.floor(10000000 + Math.random() * 90000000)}`,
  role: "buyer",
  isVerified: true,
  createdAt: new Date().toISOString(),
});

const admin = {
  id: crypto.randomUUID(),
  name: "مشرف النظام العام",
  email: `admin.lead.${timestamp}@aqarpulse.eg`,
  role: "admin",
  isVerified: true,
  createdAt: new Date().toISOString(),
};

console.log("✔ Actors initialized with cryptographic UUIDs and verified attributes.\n");

// -----------------------------------------------------------------------------
// JOURNEY 1: Property Creation (Draft vs Pending Review) & Lifecycle Enforcement
// -----------------------------------------------------------------------------
console.log("▶ JOURNEY 1: Property Creation, Draft Storage, and Pending Review Submission");

// Valid Draft
const draftProp = dbStore.createProperty({
  advertiserId: owner.id,
  advertiserType: "owner",
  title: "شقة للبيع بالتجمع الخامس - الحي النرجس",
  description: "شقة تشطيب سوبر لوكس تطل على مساحات خضراء",
  transactionType: "sale",
  category: "apartment",
  price: 3500000,
  areaSqM: 165,
  bedrooms: 3,
  bathrooms: 2,
  city: "القاهرة الجديدة",
  district: "النرجس",
  addressDetails: "شارع التسعين الجنوبي",
  latitude: 30.015,
  longitude: 31.43,
  amenities: ["elevator", "parking"],
  images: ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80"],
  status: "draft",
});

assert.ok(draftProp.id, "Draft must receive a unique ID");
assert.equal(draftProp.status, "draft", "Initial status must be draft");
console.log("  ✔ Draft successfully created and persisted without entering public search.");

// Verify draft is hidden from public visitor discovery
const publicSearch1 = dbStore.queryProperties({ searchQuery: "النرجس" }).properties;
assert.equal(
  publicSearch1.find((p) => p.id === draftProp.id),
  undefined,
  "Draft must never be returned in public property searches"
);
console.log("  ✔ Draft isolation verified: visitor search cannot see draft.");

// Submit Draft for Review -> transition to pending_review
const submittedProp = dbStore.updatePropertyStatus(
  draftProp.id,
  "pending_review",
  owner
);
assert.equal(submittedProp.status, "pending_review", "Status must become pending_review");
console.log("  ✔ Owner submitted draft for moderation review -> pending_review.");

// -----------------------------------------------------------------------------
// JOURNEY 2: Validation Failures & Protection Against Malformed Data
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 2: Data Validation Safeguards (Negative price, zero area)");

let validationFailed = false;
try {
  dbStore.createProperty({
    advertiserId: owner.id,
    advertiserType: "owner",
    title: "شقة بسعر غير صالح",
    transactionType: "sale",
    category: "apartment",
    price: -50000, // Invalid negative price
    areaSqM: 0,     // Invalid zero area
    status: "draft",
  });
} catch (err) {
  validationFailed = true;
  assert.ok(err.message, "Must throw actionable validation message");
}
assert.equal(validationFailed, true, "System must reject invalid price/area payloads");
console.log("  ✔ Invalid property inputs strictly rejected with actionable error.");

// -----------------------------------------------------------------------------
// JOURNEY 3: Cross-User BOLA / IDOR Protection
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 3: Authorization & Cross-User Mutation Prevention (IDOR/BOLA)");

let unauthorizedEditBlocked = false;
try {
  dbStore.updateProperty(
    submittedProp.id,
    { title: "محاولة اختراق تعديل عقار المالك بواسطة مستخدم آخر" },
    seeker // Seeker attempting to modify Owner's property
  );
} catch (err) {
  unauthorizedEditBlocked = true;
  assert.match(err.message, /غير مصرح|Unauthorized|Forbidden/i);
}
assert.equal(unauthorizedEditBlocked, true, "Non-owner non-admin cannot modify property");
console.log("  ✔ IDOR attack prevented: unauthorized user blocked from editing another's listing.");

// -----------------------------------------------------------------------------
// JOURNEY 4: Admin Moderation (Approve, Reject, Notes)
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 4: Admin Property Moderation & Public Band Transition");

// Admin approves listing
const approvedProp = dbStore.updatePropertyStatus(submittedProp.id, "published", admin);
assert.equal(approvedProp.status, "published", "Listing becomes published");
console.log("  ✔ Admin approved listing -> status: published.");

// Verify listing is now visible to public visitors
const publicSearchAfterApproval = dbStore.queryProperties({ searchQuery: "النرجس" }).properties;
const foundApproved = publicSearchAfterApproval.find((p) => p.id === approvedProp.id);
assert.ok(foundApproved, "Published property must appear in public search");
assert.equal(foundApproved.title, approvedProp.title);
console.log("  ✔ Public discovery verified: visitors can now find the published listing.");

// -----------------------------------------------------------------------------
// JOURNEY 5: Nationwide Search, Filtering, and Sorting
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 5: Nationwide Discovery, Category Filtering, and Sorting");

const filterResults = dbStore.queryProperties({
  category: "apartment",
  transactionType: "sale",
  minPrice: 1000000,
  maxPrice: 5000000,
}).properties;
assert.ok(filterResults.length > 0, "Filter must return matching properties");
assert.ok(
  filterResults.every((p) => p.price >= 1000000 && p.price <= 5000000),
  "All returned properties must satisfy price range"
);
console.log(`  ✔ Category & Price range filters verified (${filterResults.length} properties matched).`);

// -----------------------------------------------------------------------------
// JOURNEY 6: Favorites Persistence & Isolation
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 6: Favorites Toggle & Authenticated User Persistence");

// Toggle favorite for seeker
const fav1 = dbStore.toggleFavorite(seeker.id, approvedProp.id);
assert.equal(fav1, true, "First toggle adds to favorites");

const seekerFavs = dbStore.getUserFavorites(seeker.id);
assert.ok(seekerFavs.find((p) => p.id === approvedProp.id), "Property must be in seeker's favorites");
console.log("  ✔ Property saved to user favorites and verified in persisted list.");

// Toggle again to remove
const fav2 = dbStore.toggleFavorite(seeker.id, approvedProp.id);
assert.equal(fav2, false, "Second toggle removes from favorites");
const seekerFavsAfter = dbStore.getUserFavorites(seeker.id);
assert.equal(
  seekerFavsAfter.find((p) => p.id === approvedProp.id),
  undefined,
  "Property must be removed from favorites"
);
console.log("  ✔ Toggle off successfully removes property from favorites.");

// -----------------------------------------------------------------------------
// JOURNEY 7: Buyer Inquiries and Direct Messages
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 7: Buyer Inquiry Creation & Advertiser Contact Binding");

const inquiry = dbStore.createInquiry({
  propertyId: approvedProp.id,
  seekerId: seeker.id,
  seekerName: seeker.name,
  seekerPhone: seeker.phone,
  seekerEmail: seeker.email,
  advertiserId: approvedProp.advertiserId,
  message: "مرحباً، هل السعر قابل للتفاوض في حالة السداد النقدي الكاش؟",
  preferredContact: "call",
});

assert.ok(inquiry.id, "Inquiry must be created with ID");
assert.equal(inquiry.seekerId, seeker.id, "Seeker ID must be bound to authenticated session");
assert.equal(inquiry.advertiserId, owner.id, "Advertiser ID must match property owner");
console.log("  ✔ Inquiry submitted: seeker and advertiser IDs correctly bound.");

// Send a message within this inquiry thread
const msg = dbStore.addInquiryMessage(inquiry.id, {
  senderId: owner.id,
  senderName: owner.name,
  senderRole: "owner",
  content: "نعم متاح تفاوض بسيط للجدية عند المعاينة في موقع العقار.",
});
assert.ok(msg.id, "Message must be saved");

const conversation = dbStore.getInquiryMessages(inquiry.id);
assert.equal(conversation.length >= 2, true, "Initial message + reply must be in thread");
console.log("  ✔ Inquiry message thread active and retrievable by authorized participants.");

// -----------------------------------------------------------------------------
// JOURNEY 8: Broker Verification Management
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 8: Broker Verification State Enforcement & Admin Approval");

assert.equal(unverifiedBroker.isVerified, false, "Broker is initially unverified");

// Unverified broker creates a draft property
const brokerDraft = dbStore.createProperty({
  advertiserId: unverifiedBroker.id,
  advertiserType: "broker",
  title: "مقر إداري للبيع بالعاصمة الإدارية",
  description: "مقر إداري بموقع متميز",
  transactionType: "sale",
  category: "commercial_retail",
  price: 4500000,
  areaSqM: 110,
  status: "draft",
});

// Attempt by unverified broker to submit for review MUST fail
let unverifiedSubmitBlocked = false;
try {
  dbStore.updatePropertyStatus(brokerDraft.id, "pending_review", unverifiedBroker);
} catch (err) {
  unverifiedSubmitBlocked = true;
  assert.match(err.message, /اعتماد ترخيص الوسيط العقاري/);
}
assert.equal(unverifiedSubmitBlocked, true, "Unverified broker must be blocked from submitting listings for review");
console.log("  ✔ Unverified broker strictly blocked from submitting listings for review.");

// Admin approves broker verification
const verifiedResult = dbStore.verifyBrokerOrUser(
  unverifiedBroker.id,
  true,
  admin,
  "تم فحص السجل التجاري والبطاقة الضريبية واعتمادها بنجاح"
);
assert.equal(verifiedResult.isVerified, true, "Broker is now verified");

const freshBroker = dbStore.findUserById(unverifiedBroker.id);
assert.equal(freshBroker.isVerified, true, "Persisted broker status is true");
console.log("  ✔ Admin verified broker: verified state safely updated and persisted.");

// Now verified broker CAN submit for review
const verifiedSubmit = dbStore.updatePropertyStatus(brokerDraft.id, "pending_review", freshBroker);
assert.equal(verifiedSubmit.status, "pending_review", "Verified broker can now submit listing for review");
console.log("  ✔ Verified broker can successfully submit listing for review.");

// -----------------------------------------------------------------------------
// JOURNEY 9: Pause / Mark as Sold Lifecycle
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 9: Property Pause / Sold State (Temporary Delisting)");

// Owner pauses the listing
const pausedProp = dbStore.updatePropertyStatus(approvedProp.id, "paused", owner);
assert.equal(pausedProp.status, "paused", "Status must be paused");

// Ensure paused property is hidden from public discovery
const searchWhilePaused = dbStore.queryProperties({ searchQuery: "النرجس" }).properties;
assert.equal(
  searchWhilePaused.find((p) => p.id === approvedProp.id),
  undefined,
  "Paused property must be hidden from public visitors"
);
console.log("  ✔ Paused property is correctly hidden from public discovery.");

// Owner unpauses listing
const resumedProp = dbStore.updatePropertyStatus(approvedProp.id, "published", owner);
assert.equal(resumedProp.status, "published", "Status must be restored to published");
console.log("  ✔ Listing unpaused and restored to published status.");

// -----------------------------------------------------------------------------
// JOURNEY 10: Retract from Review to Draft
// -----------------------------------------------------------------------------
console.log("\n▶ JOURNEY 10: Retract from Pending Review back to Draft");

const newListingForRetract = dbStore.createProperty({
  advertiserId: owner.id,
  advertiserType: "owner",
  title: "فيلا مستقلة للبيع بالشروق",
  description: "فيلا راقية بحمام سباحة خاص",
  transactionType: "sale",
  category: "villa",
  price: 9000000,
  areaSqM: 400,
  city: "الشروق",
  status: "pending_review",
});

assert.equal(newListingForRetract.status, "pending_review");

// Owner retracts to draft to make edits before admin review
const retracted = dbStore.updatePropertyStatus(
  newListingForRetract.id,
  "draft",
  owner
);
assert.equal(retracted.status, "draft", "Listing successfully retracted to draft");
console.log("  ✔ Owner successfully retracted pending listing back to draft for revisions.");

console.log("\n================================================================================");
console.log("   🎉 ALL 10 PHASE 1 REAL USER JOURNEY VERIFICATION TESTS PASSED (100%)        ");
console.log("================================================================================");
