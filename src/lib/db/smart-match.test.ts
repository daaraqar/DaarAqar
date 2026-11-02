import test from "node:test";
import assert from "node:assert/strict";
import { dbStore } from "./store";

test("Smart Match Engine scores properties accurately and enforces hard constraints", () => {
  // Ensure a matching published property fixture exists
  const testProp = dbStore.createProperty({
    title: "شقة للبيع بالتجمع الخامس - اختبار المطابقة",
    description: "شقة فاخرة مطابقة للمواصفات",
    transactionType: "sale",
    category: "apartment",
    districtId: "dist-new-cairo",
    cityId: "city-cairo",
    price: 8000000,
    areaSqm: 200,
    bedrooms: 3,
    bathrooms: 2,
    exactLat: 30.01,
    exactLng: 31.45,
    locationPrivacy: "exact",
    advertiserId: "usr-test-smart-owner",
    advertiserType: "owner",
  } as any);

  // Approve so it is published and matched
  dbStore.updatePropertyStatus(testProp.id, "published", { id: "admin-system", role: "admin" } as any);

  // Query matches for sale apartments in New Cairo with budget 10M
  const matches = dbStore.findSmartMatchesForCriteria({
    transactionType: "sale",
    category: "apartment",
    preferredDistrictId: "dist-new-cairo",
    maxBudget: 10000000,
    minArea: 180,
    requiredBedrooms: 3,
  });

  assert.ok(matches.length > 0, "Should find matching properties");

  // Top match should have high score
  const topMatch = matches[0];
  assert.ok(topMatch.score >= 70, `Top match score should be >= 70, got ${topMatch.score}`);
  assert.ok(topMatch.matchedCriteria.length > 0, "Should have explainable matched criteria");

  // Verify explanation includes budget and location
  const criteriaText = topMatch.matchedCriteria.join(" ");
  assert.ok(criteriaText.includes("الميزانية") || criteriaText.includes("المنطقة"));
});

test("Smart Match Engine rejects properties violating hard constraints", () => {
  // Rental search should never return sale properties
  const matches = dbStore.findSmartMatchesForCriteria({
    transactionType: "rent",
    maxBudget: 100000,
  });

  for (const m of matches) {
    assert.equal(m.property.transactionType, "rent", "All returned matches must be rent");
  }
});
