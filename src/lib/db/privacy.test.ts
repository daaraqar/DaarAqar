import test from "node:test";
import assert from "node:assert/strict";
import { calculateApproximateCoordinates, dbStore } from "./store";
import { Property, User } from "./types";

test("Privacy Redaction: Public caller never receives raw coordinates for approximate listings", () => {
  const dummyProp: Property = {
    id: "test-prop-approx-01",
    slug: "test-prop-slug",
    title: "Test Villa",
    description: "Description",
    transactionType: "sale",
    category: "villa",
    price: 15000000,
    currency: "EGP",
    negotiable: false,
    areaSqM: 350,
    amenities: [],
    images: ["https://example.com/photo.jpg"],
    cityId: "city-cairo",
    districtId: "dist-new-cairo",
    addressDetails: "Secret Exact Address",
    lat: 30.012345,
    lng: 31.456789,
    locationPrivacy: "approximate",
    approximateLat: 30.015000,
    approximateLng: 31.459000,
    status: "published",
    featured: false,
    viewsCount: 1,
    inquiriesCount: 0,
    advertiserId: "usr-owner-01",
    advertiserType: "owner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const users: User[] = [
    {
      id: "usr-owner-01",
      name: "Owner One",
      email: "owner@example.com",
      phone: "+201000000000",
      role: "owner",
      isVerified: true,
      whatsappEnabled: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // 1. Guest viewer (public call)
  const publicView = dbStore.toPublicProperty(dummyProp, users, undefined);
  assert.equal(publicView.isApproximateLocation, true);
  assert.equal(publicView.privacyRadiusMeters, 50);
  const expectedApproximateCoords = calculateApproximateCoordinates(dummyProp.lat, dummyProp.lng, dummyProp.id);
  assert.equal(publicView.lat, expectedApproximateCoords.lat);
  assert.equal(publicView.lng, expectedApproximateCoords.lng);
  assert.notEqual(publicView.lat, 30.012345, "Exact latitude must not be exposed");

  // 2. Owner viewing own listing
  const ownerUser = users[0];
  const ownerView = dbStore.toPublicProperty(dummyProp, users, ownerUser);
  assert.equal(ownerView.lat, 30.012345, "Owner is authorized to see exact coordinates");

  // 3. Admin viewing listing
  const adminUser: User = { ...ownerUser, id: "admin-id", role: "admin" };
  const adminView = dbStore.toPublicProperty(dummyProp, users, adminUser);
  assert.equal(adminView.lat, 30.012345, "Admin is authorized to see exact coordinates");
});
