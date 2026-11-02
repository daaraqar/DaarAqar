export interface SmartFeaturesConfig {
  version: string;
  updatedAt: string;
  updatedBy: string;

  // Master toggles for the 30 Smart Features
  features: {
    // Stage 1: Financial & Valuation Engine
    inflationHedgeCalculator: boolean;      // Idea 6
    resaleOverpriceSimulator: boolean;     // Idea 7
    fairPriceIndexTracker: boolean;        // Idea 8
    comprehensiveRoiYield: boolean;        // Idea 9
    shortTermRentalEstimator: boolean;     // Idea 10

    // Stage 2: Geospatial & Environmental
    commuteTimeIsochrone: boolean;         // Idea 1
    sunWindOrientationSimulator: boolean;  // Idea 2
    neighborhoodPoiHeatmaps: boolean;      // Idea 3
    infrastructureRadar: boolean;          // Idea 4
    neighborhoodComparisonRadar: boolean;  // Idea 5

    // Stage 3: Interactive UX & Engagement
    multiPropertyComparator: boolean;      // Idea 21
    oneClickBrochureWhatsApp: boolean;     // Idea 22
    expatDiasporaHub: boolean;             // Idea 23
    reversePropertyRequests: boolean;      // Idea 24
    silentPriceDropAlerts: boolean;        // Idea 25

    // Stage 4: Trust, Verification & Inspection
    verifiedOwnerBrokerBadges: boolean;    // Idea 16
    priceUndercuttingShield: boolean;      // Idea 17
    engineeringInspectionBooking: boolean; // Idea 18
    brokerReputationReviews: boolean;      // Idea 19
    maskedContactAntiSpam: boolean;        // Idea 20

    // Stage 5: AI & Immersive Experiences
    aiVirtualStagingStudio: boolean;       // Idea 11
    dynamicFinishingCostEstimator: boolean;// Idea 12
    aiListingGenerator: boolean;           // Idea 13
    egyptianDialectAiSearch: boolean;      // Idea 14
    legalContractRiskChecklist: boolean;   // Idea 15

    // Stage 6: Enterprise, Portfolios & Big Data
    aqarReelsVideoFeed: boolean;           // Idea 26
    interactiveCompoundMasterplans: boolean;// Idea 27
    mortgageBankingMatcher: boolean;       // Idea 28
    investorPortfolioTracker: boolean;     // Idea 29
    aqarPulseMarketIndex: boolean;         // Idea 30

    // Benchmark Innovations (Egypt & GCC Leaders: Nawy, Bayut, Property Finder, Sakani, Wasalt)
    truCheckVerifiedListings: boolean;     // TruCheck™ Verified Listings (Property Finder & Bayut)
    superAgentAccreditation: boolean;      // SuperAgent™ Broker Accreditation (Property Finder)
    dynamicPaymentPlanVisualizer: boolean; // Nawy-Style Payment Schedule Timeline & AqarPulse Now
    communityLivabilityGuide: boolean;     // Aqarmap & Bayut Neighborhood Intelligence & Resident Ratings
    instantDigitalReservation: boolean;    // Wasalt & Sakani Instant 48h Unit Reservation & Price Freeze
    interactiveFloorPlan2D: boolean;       // Bayut 2D Architectural Floor Plan & Net Area Explorer
  };

  // Customizable Parameters for Financial & Valuation Engine
  financialParams: {
    goldGram24PriceEgp: number;
    annualInflationRatePercent: number;
    bankCertificateAnnualYieldPercent: number;
    realEstateDispositionTaxPercent: number; // 2.5% in Egypt
    averageAnnualAppreciationRatePercent: number;
  };

  // Customizable Parameters for Geospatial & Environmental
  geospatialParams: {
    commuteHubs: {
      id: string;
      nameAr: string;
      nameEn: string;
      lat: number;
      lng: number;
      category: "business_hub" | "airport" | "university" | "city_center";
    }[];
    infrastructureProjects: {
      id: string;
      nameAr: string;
      completionYear: number;
      impactRadiusKm: number;
      expectedValueBoostPercent: number;
      lat: number;
      lng: number;
    }[];
  };

  // Customizable Parameters for Finishing Costs (EGP / m²)
  finishingParams: {
    luxCostPerSqM: number;
    superLuxCostPerSqM: number;
    ultraLuxCostPerSqM: number;
    smartHomeAddonPerSqM: number;
    kitchenAndAcAddonPerSqM: number;
    estimatedFinishingMonths: number;
  };

  // Inspection Booking Settings
  inspectionParams: {
    baseInspectionFeeEgp: number;
    expressDeliveryFeeEgp: number;
    certifiedEngineersCount: number;
    sampleReportUrl?: string;
  };

  // Mortgage & Financing Parameters
  mortgageParams: {
    cbeLowIncomeRatePercent: number;       // 3% CBE Initiative
    cbeMiddleIncomeRatePercent: number;    // 8% CBE Initiative
    commercialMortgageRatePercent: number; // ~20-22% Market rate
    maxLoanTenureYears: number;            // Up to 30 years
    maxFinancingRatioPercent: number;      // 80%
  };

  // Market Benchmark & GCC Innovation Parameters
  benchmarkParams: {
    reservationHoldHours: number;          // Default 48 hours
    reservationCommitmentEgp: number;      // Default 25,000 EGP
    standardMaintenancePercent: number;    // Default 8%
    superAgentMaxResponseMins: number;     // Default 15 mins
    superAgentMinVerifiedListings: number; // Default 5
    aqarPulseNowMaxInstallmentYears: number;// Default 7 years
  };
}

// Data models for interactive feature modules

export interface ReversePropertyRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  title: string;
  cityId: string;
  districtId: string;
  districtNameAr: string;
  category: string;
  transactionType: "sale" | "rent";
  minBudget: number;
  maxBudget: number;
  minArea: number;
  maxArea?: number;
  bedrooms?: number;
  notes?: string;
  urgency: "urgent" | "within_month" | "flexible";
  status: "open" | "fulfilled" | "cancelled";
  offersCount: number;
  createdAt: string;
}

export interface EngineeringInspectionBooking {
  id: string;
  propertyId: string;
  propertyTitle: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail?: string;
  propertyAddress: string;
  preferredDate: string;
  inspectionType: "full_civil_electrical" | "finishing_only" | "structural_assessment";
  status: "pending" | "scheduled" | "inspecting" | "report_ready" | "cancelled";
  assignedEngineerName?: string;
  reportPdfUrl?: string;
  scoreOverall?: number; // 0 to 100
  notes?: string;
  createdAt: string;
}

export interface BrokerReview {
  id: string;
  brokerId: string;
  brokerName: string;
  reviewerName: string;
  ratingOverall: number; // 1 to 5
  ratingAccuracy: number;
  ratingCommunication: number;
  ratingPunctuality: number;
  comment: string;
  isVerifiedDeal: boolean;
  createdAt: string;
}

export interface CompoundMasterplan {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  developerNameAr: string;
  districtNameAr: string;
  lat: number;
  lng: number;
  totalAreaFeddan: number;
  deliveryYear: number;
  startingPrice: number;
  installmentYearsMax: number;
  downPaymentPercent: number;
  coverImage: string;
  masterplanMapUrl: string;
  descriptionAr: string;
  availableUnitsCount: number;
  amenities: string[];
}

export interface AqarReelsItem {
  id: string;
  propertyId: string;
  title: string;
  locationAr: string;
  price: number;
  videoUrl: string;
  thumbnailUrl: string;
  viewsCount: number;
  likesCount: number;
  advertiserName: string;
  advertiserRole: string;
  tags: string[];
}

export interface InvestorPortfolioItem {
  id: string;
  userId: string;
  propertyTitle: string;
  purchasePrice: number;
  currentMarketEstimate: number;
  purchaseDate: string;
  rentalIncomeMonthly: number;
  tenantName?: string;
  nextInstallmentDueDate?: string;
  nextInstallmentAmount?: number;
  installmentsRemainingCount?: number;
  occupancyStatus: "rented" | "vacant" | "under_finishing" | "for_resale";
}

export interface MarketIndexDistrictTrend {
  districtId: string;
  districtNameAr: string;
  avgPricePerSqM: number;
  yoyGrowthPercent: number;
  demandScore: number; // 1-100
  rentalYieldPercent: number;
  mostDemandedType: string;
}

// 1. Digital Reservation Token (Wasalt & Sakani)
export interface UnitDigitalReservation {
  id: string;
  reservationCode: string; // e.g. "RES-2026-9481"
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  userId?: string;
  buyerName: string;
  buyerPhone: string;
  buyerNationalId?: string;
  frozenPriceEgp: number;
  reservationFeeEgp: number;
  expiresAt: string;
  status: "active" | "completed" | "expired" | "cancelled";
  createdAt: string;
  notes?: string;
}

// 2. Neighborhood Livability & Community Intelligence (Aqarmap & Bayut)
export interface NeighborhoodIntelligence {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  cityNameAr: string;
  country: "EG" | "SA" | "AE";
  heroImage: string;
  descriptionAr: string;
  avgPricePerSqM: number;
  yoyAppreciationPercent: number;
  demandIndex: number; // 1-100
  overallLivabilityScore: number; // 1-100
  ratings: {
    quietness: number;     // 1-5
    services: number;      // 1-5
    schools: number;       // 1-5
    safety: number;        // 1-5
    transportation: number;// 1-5
    greenSpaces: number;   // 1-5
  };
  residentReviewsCount: number;
  topCompounds: string[];
  keyLandmarks: string[];
  popularUnitTypes: string[];
  reviews: {
    id: string;
    residentName: string;
    yearsOfResidency: number;
    rating: number;
    comment: string;
    date: string;
  }[];
}

// 3. SuperAgent™ Accreditation Profile (Property Finder & Bayut)
export interface SuperAgentProfile {
  id: string;
  userId: string;
  nameAr: string;
  agencyName?: string;
  licenseNumber: string; // Egyptian broker license or Saudi Fal license
  avatarUrl: string;
  isSuperAgent: boolean;
  scorePercent: number;
  responseTimeMins: number;
  verifiedListingsCount: number;
  activeDealsCount: number;
  phone: string;
  whatsapp: string;
  specialtyAreas: string[];
}

// 4. 2D Architectural Floor Plan & Room Dimensions (Bayut FloorPlans)
export interface FloorPlanLayout {
  propertyId: string;
  grossAreaSqM: number;
  netAreaSqM: number;
  efficiencyRatioPercent: number; // e.g. 82%
  rooms: {
    nameAr: string;
    dimensions: string; // e.g. "4.5m × 4.0m"
    areaSqM: number;
    orientation: string;
  }[];
}

// 5. Payment Plan Milestone Timeline (Nawy & Nawy Now)
export interface PaymentPlanMilestone {
  stageNameAr: string;
  percent: number;
  amountEgp: number;
  timingAr: string;
  notes?: string;
}
