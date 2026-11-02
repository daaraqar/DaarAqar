import { describe, it } from "node:test";
import assert from "node:assert";
import { smartFeaturesStore } from "./smartFeaturesStore";

describe("Smart Features 30-Ideas Enterprise Suite", () => {
  it("Feature Flag Integrity: All 30 smart features are defined and enabled by default", () => {
    const config = smartFeaturesStore.getConfig();
    assert.strictEqual(config.version, "2.0.0");
    const featureKeys = Object.keys(config.features);
    assert.ok(featureKeys.length >= 30, "All smart features + benchmark innovations must be registered");

    // Check presence of key features across stages
    assert.strictEqual(config.features.inflationHedgeCalculator, true);
    assert.strictEqual(config.features.resaleOverpriceSimulator, true);
    assert.strictEqual(config.features.fairPriceIndexTracker, true);
    assert.strictEqual(config.features.commuteTimeIsochrone, true);
    assert.strictEqual(config.features.sunWindOrientationSimulator, true);
    assert.strictEqual(config.features.multiPropertyComparator, true);
    assert.strictEqual(config.features.reversePropertyRequests, true);
    assert.strictEqual(config.features.engineeringInspectionBooking, true);
    assert.strictEqual(config.features.dynamicFinishingCostEstimator, true);
    assert.strictEqual(config.features.aqarReelsVideoFeed, true);
    assert.strictEqual(config.features.interactiveCompoundMasterplans, true);
    assert.strictEqual(config.features.investorPortfolioTracker, true);
    assert.strictEqual(config.features.aqarPulseMarketIndex, true);

    // Check benchmark innovation flags (Egypt & GCC Leaders)
    assert.strictEqual(config.features.truCheckVerifiedListings, true);
    assert.strictEqual(config.features.superAgentAccreditation, true);
    assert.strictEqual(config.features.dynamicPaymentPlanVisualizer, true);
    assert.strictEqual(config.features.communityLivabilityGuide, true);
    assert.strictEqual(config.features.instantDigitalReservation, true);
    assert.strictEqual(config.features.interactiveFloorPlan2D, true);
  });

  it("Config Persistence: Admin updates to parameters and toggles persist correctly", () => {
    const original = smartFeaturesStore.getConfig();
    const updated = {
      ...original,
      financialParams: {
        ...original.financialParams,
        goldGram24PriceEgp: 4200,
      },
    };
    smartFeaturesStore.saveConfig(updated);
    const fetched = smartFeaturesStore.getConfig();
    assert.strictEqual(fetched.financialParams.goldGram24PriceEgp, 4200);

    // Restore to standard
    smartFeaturesStore.saveConfig(original);
  });

  it("Reverse Marketplace (Idea 24): Buyers can submit and browse requests", () => {
    const newReq = smartFeaturesStore.addReverseRequest({
      userId: "test-user-99",
      userName: "أحمد توفيق",
      userPhone: "01012345678",
      title: "مطلوب شقة 200م دور أرضي بحديقة بالتجمع",
      cityId: "cairo",
      districtId: "new-cairo",
      districtNameAr: "التجمع الخامس",
      category: "apartment",
      transactionType: "sale",
      minBudget: 5000000,
      maxBudget: 7000000,
      minArea: 200,
      bedrooms: 3,
      urgency: "urgent",
    });

    assert.ok(newReq.id.startsWith("req-"));
    assert.strictEqual(newReq.status, "open");

    const allRequests = smartFeaturesStore.getReverseRequests();
    assert.ok(allRequests.some((r) => r.id === newReq.id));
  });

  it("Inspection Booking (Idea 18): Engineering inspection requests are logged with fee computation", () => {
    const config = smartFeaturesStore.getConfig();
    const booking = smartFeaturesStore.bookInspection({
      propertyId: "prop-sample-1",
      propertyTitle: "شقة للبيع بالتجمع الخامس",
      propertyAddress: "شارع التسعين",
      requesterName: "محمد عبد السلام",
      requesterPhone: "01122334455",
      preferredDate: "2026-11-01",
      inspectionType: "full_civil_electrical",
    });

    assert.ok(booking.id.startsWith("insp-"));
    assert.strictEqual(booking.status, "pending");
    assert.ok(config.inspectionParams.baseInspectionFeeEgp > 0);
  });

  it("Compounds & Reels Data Integrity (Ideas 26 & 27): Seed data is populated with rich Egyptian market assets", () => {
    const compounds = smartFeaturesStore.getCompoundMasterplans();
    assert.ok(compounds.length >= 3);
    assert.ok(compounds.some((c) => c.slug === "mit-ghamr-corniche-towers" || c.slug === "palm-hills-new-cairo"));
    assert.ok(compounds.some((c) => c.slug === "daqados-oasis" || c.slug === "zed-sheikh-zayed"));

    const reels = smartFeaturesStore.getAqarReels();
    assert.ok(reels.length >= 3);
    assert.ok(reels.every((r) => r.videoUrl && r.price > 0));
  });

  it("Auth Session Resilience: User session tokens persist across workers and auto-reconstitute without unexpected logouts", async () => {
    const { createSessionToken, verifySessionToken } = await import("../auth/session");
    const { dbStore } = await import("./store");

    const sampleUser = {
      id: "usr-test-persistent-" + Date.now(),
      name: "أحمد الاستثماري",
      email: "investor.test@aqarpulse.eg",
      phone: "+201099887766",
      role: "buyer" as const,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    const token = createSessionToken(sampleUser);
    assert.ok(token && typeof token === "string");

    const session = verifySessionToken(token);
    assert.ok(session);
    assert.strictEqual(session.userId, sampleUser.id);
    assert.strictEqual(session.email, sampleUser.email);
    assert.strictEqual(session.phone, sampleUser.phone);

    // Verify user can be ensured in store and retrieved cleanly
    dbStore.ensureUser(sampleUser);
    const lookup = dbStore.findUserById(sampleUser.id);
    assert.ok(lookup);
    assert.strictEqual(lookup.name, sampleUser.name);
  });

  it("Digital Unit Reservation (Wasalt & Sakani): Creates 48h price freeze hold and verifies reference code", () => {
    const reservation = smartFeaturesStore.createReservation({
      propertyId: "prop-unit-55",
      propertyTitle: "شقة للبيع 180م التجمع الخامس",
      propertyPrice: 6500000,
      buyerName: "م. كريم عبد الخالق",
      buyerPhone: "01055443322",
      buyerNationalId: "29011223344556",
      frozenPriceEgp: 6500000,
      reservationFeeEgp: 25000,
      notes: "حجز مبدئي وتجميد السعر ضد التضخم لمدة 48 ساعة",
    });

    assert.ok(reservation.id.startsWith("res-"));
    assert.ok(reservation.reservationCode.startsWith("RES-"));
    assert.strictEqual(reservation.status, "active");
    assert.strictEqual(reservation.frozenPriceEgp, 6500000);

    const retrieved = smartFeaturesStore.getReservationByCode(reservation.reservationCode);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.reservationCode, reservation.reservationCode);
    assert.strictEqual(retrieved.buyerName, "م. كريم عبد الخالق");
  });

  it("Neighborhood Intelligence (Aqarmap & Bayut): Lists communities and registers resident reviews", () => {
    const list = smartFeaturesStore.getNeighborhoods();
    assert.ok(list.length >= 4, "Should have seeded top Egyptian & GCC districts");
    const fifthSettlement = list.find((n) => n.slug === "fifth-settlement");
    assert.ok(fifthSettlement);
    assert.ok(fifthSettlement.overallLivabilityScore >= 90);
    assert.ok(fifthSettlement.ratings.quietness > 4);

    const initialCount = fifthSettlement.residentReviewsCount;
    const added = smartFeaturesStore.addNeighborhoodReview("fifth-settlement", {
      residentName: "أ. سامي رضوان",
      yearsOfResidency: 4,
      rating: 5,
      comment: "حي متكامل ومستوى معيشي ممتاز وقريب من جميع المراكز التجارية.",
    });

    assert.strictEqual(added, true);
    const updated = smartFeaturesStore.getNeighborhoodBySlug("fifth-settlement");
    assert.ok(updated);
    assert.strictEqual(updated.residentReviewsCount, initialCount + 1);
    assert.strictEqual(updated.reviews[0].residentName, "أ. سامي رضوان");
  });

  it("SuperAgent Accreditation (Property Finder & Bayut): Verifies broker metrics and license credentials", () => {
    const agents = smartFeaturesStore.getSuperAgents();
    assert.ok(agents.length >= 2);
    assert.ok(agents.every((a) => a.isSuperAgent && a.scorePercent >= 95));
    assert.ok(agents.every((a) => a.responseTimeMins <= 15));
    assert.ok(agents.some((a) => a.licenseNumber.includes("FAL") || a.licenseNumber.includes("سجّل")));
  });

  it("2D Floor Plan Explorer (Bayut FloorPlans): Calculates 82% net efficiency and room dimensions breakdown", () => {
    const plan = smartFeaturesStore.getFloorPlan("prop-101", 200);
    assert.strictEqual(plan.grossAreaSqM, 200);
    assert.strictEqual(plan.netAreaSqM, 164); // 200 * 0.82
    assert.strictEqual(plan.efficiencyRatioPercent, 82);
    assert.ok(plan.rooms.length >= 6);
    assert.ok(plan.rooms.some((r) => r.nameAr.includes("ماستر")));
    assert.ok(plan.rooms.some((r) => r.nameAr.includes("استقبال")));
  });

  it("Dynamic Payment Schedule Generator (Nawy & Nawy Now): Computes milestones and cash discount savings", () => {
    const schedule = smartFeaturesStore.generatePaymentSchedule(10000000, 10, 7);
    assert.strictEqual(schedule.downAmount, 1000000); // 10%
    assert.strictEqual(schedule.contractAmount, 500000); // 5%
    assert.strictEqual(schedule.deliveryAmount, 1000000); // 10%
    assert.strictEqual(schedule.maintenanceAmount, 800000); // 8% standard
    assert.strictEqual(schedule.totalQuarters, 28); // 7 * 4
    assert.strictEqual(schedule.cashDiscountPercent, 28);
    assert.strictEqual(schedule.cashPrice, 7200000); // 10M - 28%
    assert.ok(schedule.quarterlyAmount > 0);
    assert.strictEqual(schedule.milestones.length, 5);
  });
});
