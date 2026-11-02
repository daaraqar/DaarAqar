import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "../db/store";

describe("Property Moderation Lifecycle: Submission -> Restricted Registry -> Approval -> Published Band", () => {
  it("enforces the exact sequence required by administration and advertisers", () => {
    // 1. Authenticated Owner or Broker
    const owner = {
      id: "owner-lifecycle-test-1",
      email: "ahmed.owner@aqarpulse.eg",
      name: "أحمد المالك",
      role: "owner" as const,
      phone: "+201011112222",
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    const admin = {
      id: "admin-lifecycle-test-1",
      email: "admin@aqarpulse.eg",
      name: "مدير المنصة",
      role: "admin" as const,
      phone: "+201099998888",
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    // 2. Add Property with full details submitted for review
    const newProperty = dbStore.createProperty({
      advertiserId: owner.id,
      advertiserType: "owner",
      title: "شقة للبيع وسط مدينة ميت غمر - اختبار دورة المشاريع المقيدة",
      description: "شقة سكنية متكاملة المرافق تشطيب سوبر لوكس بموقع استراتيجي في ميت غمر.",
      transactionType: "sale",
      category: "apartment",
      price: 1450000,
      areaSqM: 145,
      bedrooms: 3,
      bathrooms: 2,
      finishingStatus: "ultra_lux",
      furnishingStatus: "unfurnished",
      cityId: "city-dakahlia",
      districtId: "dist-meet-ghamr-city",
      addressDetails: "شارع بورسعيد، ميت غمر، الدقهلية",
      lat: 30.7194,
      lng: 31.258,
      locationPrivacy: "exact",
      images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"],
      currency: "EGP",
      negotiable: true,
      amenities: [],
      featured: false,
      status: "pending_review",
    });

    assert.ok(newProperty, "Property must be successfully created");
    assert.equal(newProperty.status, "pending_review", "Initial status must be pending_review");
    assert.equal(newProperty.advertiserId, owner.id);

    // 3. Property is recorded in Owner/Broker dashboard under 'بند قيد المراجعة'
    const ownerProperties = dbStore.getPropertiesByAdvertiser(owner.id);
    const pendingInOwnerDashboard = ownerProperties.filter((p) => p.status === "pending_review");
    assert.ok(
      pendingInOwnerDashboard.some((p) => p.id === newProperty.id),
      "Property must be listed under 'بند قيد المراجعة' in owner dashboard"
    );

    // 4. Property is received by administration in 'سجل المشاريع المقيدة' (pending_review)
    const adminAllProps = dbStore.getAllPropertiesForAdmin();
    const restrictedProjectsInAdmin = adminAllProps.filter((p) => p.status === "pending_review");
    assert.ok(
      restrictedProjectsInAdmin.some((p) => p.id === newProperty.id),
      "Property must be present in Admin 'سجل المشاريع المقيدة'"
    );

    // 5. Admin inspects and approves the listing
    const approvedProperty = dbStore.updatePropertyStatus(
      newProperty.id,
      "published",
      admin,
      "تمت مراجعة البيانات واعتماد النشر بنجاح"
    );
    assert.ok(approvedProperty, "Property status must be successfully updated by admin");
    assert.equal(approvedProperty.status, "published");

    // 6. Property exits 'سجل المشاريع المقيدة' in Administration page
    const adminPropsAfter = dbStore.getAllPropertiesForAdmin();
    const restrictedAfterApproval = adminPropsAfter.filter((p) => p.status === "pending_review");
    assert.ok(
      !restrictedAfterApproval.some((p) => p.id === newProperty.id),
      "Approved project MUST exit 'سجل المشاريع المقيدة' in Admin view"
    );

    // 7. Property shifts to 'بند عقارات منشورة' in Owner/Broker dashboard
    const ownerPropsAfterApproval = dbStore.getPropertiesByAdvertiser(owner.id);
    const publishedInOwnerDashboard = ownerPropsAfterApproval.filter((p) => p.status === "published");
    assert.ok(
      publishedInOwnerDashboard.some((p) => p.id === newProperty.id),
      "Approved project MUST shift to 'بند عقارات منشورة' in owner dashboard"
    );

    // Cleanup
    dbStore.deleteProperty(newProperty.id, admin);
  });
});
