import test from "node:test";
import assert from "node:assert/strict";
import {
  haversineDistanceMeters,
  isPointInBoundingBox,
  isPointInPolygon,
  calculateApproximateCoordinates,
} from "./store";

test("haversineDistanceMeters calculates accurate distance between Cairo points", () => {
  // New Cairo (30.0263, 31.4913) to Maadi (29.9602, 31.2568)
  const dist = haversineDistanceMeters(30.0263, 31.4913, 29.9602, 31.2568);
  // Expected distance is approximately 23.8 km (23000m to 25000m)
  assert.ok(dist > 22000 && dist < 26000, `Distance should be ~24km, got ${dist}`);
});

test("isPointInBoundingBox accurately filters points inside/outside", () => {
  const sw = { lat: 30.0, lng: 31.0 };
  const ne = { lat: 30.1, lng: 31.5 };

  const insidePoint = { lat: 30.05, lng: 31.25 };
  const outsidePoint = { lat: 30.25, lng: 31.25 };

  assert.equal(isPointInBoundingBox(insidePoint, sw, ne), true);
  assert.equal(isPointInBoundingBox(outsidePoint, sw, ne), false);
});

test("isPointInPolygon tests polygon intersection via ray-casting", () => {
  const trianglePolygon = [
    { lat: 30.0, lng: 31.0 },
    { lat: 30.5, lng: 31.0 },
    { lat: 30.25, lng: 31.5 },
  ];

  const inside = { lat: 30.2, lng: 31.1 };
  const outside = { lat: 30.7, lng: 31.2 };

  assert.equal(isPointInPolygon(inside, trianglePolygon), true);
  assert.equal(isPointInPolygon(outside, trianglePolygon), false);
});

test("calculateApproximateCoordinates creates a consistent offset without mutating raw point", () => {
  const exactLat = 30.0245;
  const exactLng = 31.4880;
  const id = "prop-test-01";

  const approx = calculateApproximateCoordinates(exactLat, exactLng, id);

  assert.notEqual(approx.lat, exactLat);
  assert.notEqual(approx.lng, exactLng);

  // The approximate position stays within the configured 50m radius.
  const offsetDistance = haversineDistanceMeters(exactLat, exactLng, approx.lat, approx.lng);
  assert.ok(
    offsetDistance >= 25 && offsetDistance <= 50,
    `Offset distance should be 25m-50m, got ${offsetDistance}`
  );
});
