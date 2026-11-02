import fs from "fs";
import path from "path";
import {
  SmartFeaturesConfig,
  ReversePropertyRequest,
  EngineeringInspectionBooking,
  BrokerReview,
  CompoundMasterplan,
  AqarReelsItem,
  InvestorPortfolioItem,
  MarketIndexDistrictTrend,
  UnitDigitalReservation,
  NeighborhoodIntelligence,
  SuperAgentProfile,
  FloorPlanLayout,
  PaymentPlanMilestone,
} from "../types/smartFeatures";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "smart_features_config.json");
const REVERSE_REQUESTS_FILE = path.join(DATA_DIR, "smart_features_requests.json");
const INSPECTIONS_FILE = path.join(DATA_DIR, "smart_features_inspections.json");
const BROKER_REVIEWS_FILE = path.join(DATA_DIR, "smart_features_reviews.json");
const PORTFOLIO_FILE = path.join(DATA_DIR, "smart_features_portfolio.json");
const RESERVATIONS_FILE = path.join(DATA_DIR, "smart_features_reservations.json");
const NEIGHBORHOODS_FILE = path.join(DATA_DIR, "smart_features_neighborhoods.json");

const defaultSmartConfig: SmartFeaturesConfig = {
  version: "2.0.0",
  updatedAt: new Date().toISOString(),
  updatedBy: "system_admin",

  features: {
    // Stage 1: Financial & Valuation Engine
    inflationHedgeCalculator: true,
    resaleOverpriceSimulator: true,
    fairPriceIndexTracker: true,
    comprehensiveRoiYield: true,
    shortTermRentalEstimator: true,

    // Stage 2: Geospatial & Environmental
    commuteTimeIsochrone: true,
    sunWindOrientationSimulator: true,
    neighborhoodPoiHeatmaps: true,
    infrastructureRadar: true,
    neighborhoodComparisonRadar: true,

    // Stage 3: Interactive UX & Engagement
    multiPropertyComparator: true,
    oneClickBrochureWhatsApp: true,
    expatDiasporaHub: true,
    reversePropertyRequests: true,
    silentPriceDropAlerts: true,

    // Stage 4: Trust, Verification & Inspection
    verifiedOwnerBrokerBadges: true,
    priceUndercuttingShield: true,
    engineeringInspectionBooking: true,
    brokerReputationReviews: true,
    maskedContactAntiSpam: true,

    // Stage 5: AI & Immersive Experiences
    aiVirtualStagingStudio: true,
    dynamicFinishingCostEstimator: true,
    aiListingGenerator: true,
    egyptianDialectAiSearch: true,
    legalContractRiskChecklist: true,

    // Stage 6: Enterprise, Portfolios & Big Data
    aqarReelsVideoFeed: true,
    interactiveCompoundMasterplans: true,
    mortgageBankingMatcher: true,
    investorPortfolioTracker: true,
    aqarPulseMarketIndex: true,

    // Benchmark Innovations (Egypt & GCC Leaders: Nawy, Bayut, Property Finder, Sakani, Wasalt)
    truCheckVerifiedListings: true,
    superAgentAccreditation: true,
    dynamicPaymentPlanVisualizer: true,
    communityLivabilityGuide: true,
    instantDigitalReservation: true,
    interactiveFloorPlan2D: true,
  },

  financialParams: {
    goldGram24PriceEgp: 4150,
    annualInflationRatePercent: 26.5,
    bankCertificateAnnualYieldPercent: 23.5,
    realEstateDispositionTaxPercent: 2.5,
    averageAnnualAppreciationRatePercent: 28.0,
  },

  geospatialParams: {
    commuteHubs: [
      {
        id: "hub-new-cairo-90th",
        nameAr: "شارع التسعين الجنوبي (التجمع الخامس)",
        nameEn: "South 90th St, New Cairo",
        lat: 30.0195,
        lng: 31.4368,
        category: "business_hub",
      },
      {
        id: "hub-new-capital-cbd",
        nameAr: "حي المال والأعمال (العاصمة الإدارية)",
        nameEn: "CBD, New Administrative Capital",
        lat: 30.0074,
        lng: 31.7456,
        category: "business_hub",
      },
      {
        id: "hub-smart-village",
        nameAr: "القرية الذكية (طريق إسكندرية الصحراوي)",
        nameEn: "Smart Village, 6th of October",
        lat: 30.0768,
        lng: 31.0205,
        category: "business_hub",
      },
      {
        id: "hub-cairo-airport",
        nameAr: "مطار القاهرة الدولي",
        nameEn: "Cairo International Airport",
        lat: 30.1219,
        lng: 31.4056,
        category: "airport",
      },
      {
        id: "hub-downtown-tahrir",
        nameAr: "وسط البلد (ميدان التحرير)",
        nameEn: "Downtown Tahrir, Cairo",
        lat: 30.0444,
        lng: 31.2357,
        category: "city_center",
      },
    ],
    infrastructureProjects: [
      {
        id: "monorail-east",
        nameAr: "مونوريل شرق النيل (مدينة نصر - العاصمة الإدارية)",
        completionYear: 2026,
        impactRadiusKm: 3.5,
        expectedValueBoostPercent: 25,
        lat: 30.0245,
        lng: 31.512,
      },
      {
        id: "lrt-electric-train",
        nameAr: "القطار الكهربائي الخفيف (LRT)",
        completionYear: 2025,
        impactRadiusKm: 4.0,
        expectedValueBoostPercent: 20,
        lat: 30.155,
        lng: 31.62,
      },
      {
        id: "26-july-expanded",
        nameAr: "توسعات محور 26 يوليو الجديد والقطار السريع",
        completionYear: 2026,
        impactRadiusKm: 5.0,
        expectedValueBoostPercent: 30,
        lat: 30.052,
        lng: 31.07,
      },
    ],
  },

  finishingParams: {
    luxCostPerSqM: 4500,
    superLuxCostPerSqM: 7500,
    ultraLuxCostPerSqM: 12500,
    smartHomeAddonPerSqM: 1800,
    kitchenAndAcAddonPerSqM: 2500,
    estimatedFinishingMonths: 4,
  },

  inspectionParams: {
    baseInspectionFeeEgp: 3500,
    expressDeliveryFeeEgp: 1200,
    certifiedEngineersCount: 18,
    sampleReportUrl: "/reports/sample-inspection.pdf",
  },

  mortgageParams: {
    cbeLowIncomeRatePercent: 3.0,
    cbeMiddleIncomeRatePercent: 8.0,
    commercialMortgageRatePercent: 21.0,
    maxLoanTenureYears: 25,
    maxFinancingRatioPercent: 80,
  },

  benchmarkParams: {
    reservationHoldHours: 48,
    reservationCommitmentEgp: 25000,
    standardMaintenancePercent: 8,
    superAgentMaxResponseMins: 15,
    superAgentMinVerifiedListings: 5,
    aqarPulseNowMaxInstallmentYears: 7,
  },
};

const initialCompoundMasterplans: CompoundMasterplan[] = [
  {
    id: "comp-mit-ghamr-corniche-towers",
    slug: "mit-ghamr-corniche-towers",
    nameAr: "أبراج كورنيش النيل ميت غمر",
    nameEn: "Mit Ghamr Corniche Towers",
    developerNameAr: "شركة الدلتا للتطوير العقاري",
    districtNameAr: "شارع البحر (الكورنيش)، ميت غمر",
    lat: 30.718,
    lng: 31.259,
    totalAreaFeddan: 15,
    deliveryYear: 2026,
    startingPrice: 1950000,
    installmentYearsMax: 5,
    downPaymentPercent: 15,
    coverImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    masterplanMapUrl: "https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "مشروع سكني وتجاري راقٍ يطل مباشرة على كورنيش النيل بميت غمر، يضم وحدات سكنية فاخرة ومحلات تجارية وجراجات ومصاعد حديثة.",
    availableUnitsCount: 18,
    amenities: ["إطلالة مباشرة على النيل", "جراجات تحت الأرض", "مول تجاري ومطاعم", "أمن وحراسة 24/7", "مصاعد بانورامية"],
  },
  {
    id: "comp-daqados-oasis",
    slug: "daqados-oasis",
    nameAr: "مجمع واحة دقادوس السكني",
    nameEn: "Daqados Oasis Complex",
    developerNameAr: "مجموعة الهدى للاستثمار العقاري",
    districtNameAr: "منطقة دقادوس، ميت غمر",
    lat: 30.728,
    lng: 31.265,
    totalAreaFeddan: 25,
    deliveryYear: 2026,
    startingPrice: 1600000,
    installmentYearsMax: 6,
    downPaymentPercent: 10,
    coverImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
    masterplanMapUrl: "https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "مجمع سكني هادئ في قلب منطقة دقادوس بميت غمر بتصميم معماري حديث ومساحات خضراء للأطفال وخدمات متكاملة.",
    availableUnitsCount: 24,
    amenities: ["مساحات خضراء وممشى", "أمن وكاميرات مراقبة", "مسجد وخدمات", "مواقف سيارات خاصة"],
  },
  {
    id: "comp-tafahna-student-hub",
    slug: "tafahna-student-hub",
    nameAr: "أبراج النخبة السكنية تفهنا الأشراف",
    nameEn: "Tafahna Elite Residences",
    developerNameAr: "الأشراف للإنشاء والتعمير",
    districtNameAr: "تفهنا الأشراف، مركز ميت غمر",
    lat: 30.745,
    lng: 31.240,
    totalAreaFeddan: 10,
    deliveryYear: 2025,
    startingPrice: 1250000,
    installmentYearsMax: 4,
    downPaymentPercent: 20,
    coverImage: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    masterplanMapUrl: "https://images.unsplash.com/photo-1524813686514-a57563d77d66?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "مشروع استثماري وسكني متميز بالقرب من مجمع كليات جامعة الأزهر بتفهنا الأشراف مع عائد إيجاري مرتفع وخدمات ممتازة.",
    availableUnitsCount: 30,
    amenities: ["بالقرب من الجامعة", "إنترنت فايبر فائق السرعة", "صيانة دورية", "كاميرات مراقبة"],
  },
];

const initialAqarReels: AqarReelsItem[] = [
  {
    id: "reel-1",
    propertyId: "prop-1",
    title: "شقة لوكس بإطلالة مفتوحة على كورنيش النيل ميت غمر",
    locationAr: "شارع البحر (الكورنيش)، ميت غمر",
    price: 1850000,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-with-living-room-and-kitchen-41480-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    viewsCount: 14200,
    likesCount: 1120,
    advertiserName: "م. طارق الشناوي (مستشار عقاري)",
    advertiserRole: "broker",
    tags: ["كورنيش النيل", "ميت غمر", "تشطيب لوكس"],
  },
  {
    id: "reel-2",
    propertyId: "prop-2",
    title: "بيت عائلي مستقل 3 أدوار للبيع في دقادوس ميت غمر",
    locationAr: "دقادوس، مدينة ميت غمر",
    price: 3400000,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-stylish-luxury-modern-kitchen-and-dining-room-41481-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
    viewsCount: 9800,
    likesCount: 840,
    advertiserName: "د. هاني منصور (المالك مباشرة)",
    advertiserRole: "owner",
    tags: ["دقادوس", "بيت مستقل", "ميت غمر"],
  },
  {
    id: "reel-3",
    propertyId: "prop-3",
    title: "أرض بناء استثمارية بالقرب من جامعة الأزهر تفهنا الأشراف",
    locationAr: "تفهنا الأشراف، مركز ميت غمر",
    price: 2100000,
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-modern-interior-architecture-of-a-room-41483-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
    viewsCount: 21300,
    likesCount: 1750,
    advertiserName: "مروة السعدني (وسيطة عقارية)",
    advertiserRole: "broker",
    tags: ["تفهنا الأشراف", "أرض بناء", "مركز ميت غمر"],
  },
];

const initialReverseRequests: ReversePropertyRequest[] = [];

const initialInspections: EngineeringInspectionBooking[] = [];

const initialBrokerReviews: BrokerReview[] = [
  {
    id: "rev-1",
    brokerId: "broker-1",
    brokerName: "محمد الكيلاني",
    reviewerName: "م. شريف فهمي",
    ratingOverall: 5,
    ratingAccuracy: 5,
    ratingCommunication: 5,
    ratingPunctuality: 4.8,
    comment: "من أفضل الوسطاء الذين تعاملت معهم، دقة تامة في الأسعار والمعاينة كانت مطابقة تماماً للصور على منصة دار العقار.",
    isVerifiedDeal: true,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "rev-2",
    brokerId: "broker-1",
    brokerName: "محمد الكيلاني",
    reviewerName: "د. ريم مصطفى",
    ratingOverall: 4.8,
    ratingAccuracy: 5,
    ratingCommunication: 4.7,
    ratingPunctuality: 5,
    comment: "أمانة ومصداقية وسرعة في استخراج الأوراق الرسمية ومطابقة التراخيص.",
    isVerifiedDeal: true,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

const initialMarketDistrictTrends: MarketIndexDistrictTrend[] = [
  {
    districtId: "new-cairo",
    districtNameAr: "التجمع الخامس (القاهرة الجديدة)",
    avgPricePerSqM: 39500,
    yoyGrowthPercent: 32.4,
    demandScore: 96,
    rentalYieldPercent: 8.9,
    mostDemandedType: "شقق 3 غرف ونصف تشطيب",
  },
  {
    districtId: "sheikh-zayed",
    districtNameAr: "الشيخ زايد (الجيزة)",
    avgPricePerSqM: 42000,
    yoyGrowthPercent: 35.1,
    demandScore: 94,
    rentalYieldPercent: 9.2,
    mostDemandedType: "تاون هاوس وتوين فيلا",
  },
  {
    districtId: "new-capital",
    districtNameAr: "العاصمة الإدارية الجديدة",
    avgPricePerSqM: 33500,
    yoyGrowthPercent: 28.6,
    demandScore: 89,
    rentalYieldPercent: 10.4,
    mostDemandedType: "وحدات إدارية وتجارية وسكني R7",
  },
  {
    districtId: "north-coast",
    districtNameAr: "الساحل الشمالي (رأس الحكمة وسيدي عبد الرحمن)",
    avgPricePerSqM: 68000,
    yoyGrowthPercent: 54.0,
    demandScore: 98,
    rentalYieldPercent: 14.5,
    mostDemandedType: "شاليهات وفيلات شاطئية",
  },
  {
    districtId: "maadi",
    districtNameAr: "المعادي (سرايات ودجلة)",
    avgPricePerSqM: 31000,
    yoyGrowthPercent: 22.0,
    demandScore: 84,
    rentalYieldPercent: 8.1,
    mostDemandedType: "شقق مفروشة لإيجار الأجانب",
  },
];

const initialNeighborhoods: NeighborhoodIntelligence[] = [
  {
    id: "neigh-fifth-settlement",
    slug: "fifth-settlement",
    nameAr: "التجمع الخامس والقاهرة الجديدة",
    nameEn: "Fifth Settlement, New Cairo",
    cityNameAr: "القاهرة الجديدة",
    country: "EG",
    heroImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "المركز المالي والحضري الأرقى في شرق القاهرة، يضم مراكز الشركات العالمية، مقرات البنوك، أرقى الجامعات الدولية، وشبكة طرق متطورة تربطه بالعاصمة الإدارية.",
    avgPricePerSqM: 42500,
    yoyAppreciationPercent: 32.5,
    demandIndex: 96,
    overallLivabilityScore: 94,
    ratings: {
      quietness: 4.8,
      services: 4.9,
      schools: 4.9,
      safety: 4.8,
      transportation: 4.6,
      greenSpaces: 4.7,
    },
    residentReviewsCount: 142,
    topCompounds: ["ميفيدا", "بالم هيلز نيو كايرو", "هايد بارك", "ماونتن فيو آي سيتي"],
    keyLandmarks: ["شارع التسعين الجنوبي", "الجامعة الأمريكية (AUC)", "كايرو فيستيفال سيتي", "المستشفى الجوي"],
    popularUnitTypes: ["شقق فندقية", "دوبلكس", "تاون هاوس", "فيلات مستقلة"],
    reviews: [
      {
        id: "rev-n1",
        residentName: "د. هاني عثمان",
        yearsOfResidency: 5,
        rating: 5,
        comment: "منطقة متكاملة الخدمات والهدوء، قريبة من الجامعة الأمريكية ومحور محمد بن زايد المؤدي للعاصمة.",
        date: "2026-08-14",
      },
      {
        id: "rev-n2",
        residentName: "م. نادية الشريف",
        yearsOfResidency: 3,
        rating: 5,
        comment: "المراكز التجارية والنوادي هنا بمستوى عالمي، والأمان ممتاز جداً للعائلات.",
        date: "2026-09-02",
      },
    ],
  },
  {
    id: "neigh-sheikh-zayed",
    slug: "sheikh-zayed",
    nameAr: "مدينة الشيخ زايد",
    nameEn: "Sheikh Zayed City",
    cityNameAr: "الجيزة",
    country: "EG",
    heroImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "مدينة الحدائق والمجتمعات الراقية غرب القاهرة، تتميز بارتفاع منسوب الخضرة والهدوء، واحتضانها لأفخم وجهات التسوق والمطاعم والمدارس الدولية.",
    avgPricePerSqM: 38000,
    yoyAppreciationPercent: 29.0,
    demandIndex: 94,
    overallLivabilityScore: 95,
    ratings: {
      quietness: 4.9,
      services: 4.8,
      schools: 4.8,
      safety: 4.9,
      transportation: 4.5,
      greenSpaces: 4.9,
    },
    residentReviewsCount: 118,
    topCompounds: ["أبراج زد", "بيفرلي هيلز", "الجريا", "سوديك ويست"],
    keyLandmarks: ["حديقة زد المركزية", "أركان بلازا", "أمريكانا بلازا", "مستشفى زايد التخصصي"],
    popularUnitTypes: ["فيلات مستقلة", "توين هاوس", "شقق فاخرة بحديقة"],
    reviews: [
      {
        id: "rev-n3",
        residentName: "أ. طارق عبد المجيد",
        yearsOfResidency: 6,
        rating: 5,
        comment: "الهواء نقي والمجتمع السكني راقٍ ومتجانس، أركان بلازا وحديقة زد تجعل الخروج داخل المدينة متعة.",
        date: "2026-07-20",
      },
    ],
  },
  {
    id: "neigh-new-capital",
    slug: "new-capital",
    nameAr: "العاصمة الإدارية الجديدة",
    nameEn: "New Administrative Capital",
    cityNameAr: "العاصمة الإدارية",
    country: "EG",
    heroImage: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "المدينة الذكية المستقبلية الأولى في مصر والشرق الأوسط، عاصمة الأعمال والإدارة الحديثة بمحاور نقل ذكية ومساحات خضراء على النهر الأخضر.",
    avgPricePerSqM: 34500,
    yoyAppreciationPercent: 38.0,
    demandIndex: 98,
    overallLivabilityScore: 91,
    ratings: {
      quietness: 4.7,
      services: 4.6,
      schools: 4.7,
      safety: 4.9,
      transportation: 4.8,
      greenSpaces: 4.9,
    },
    residentReviewsCount: 86,
    topCompounds: ["إل بوسكو", "سيليا طلعت مصطفى", "فينشي", "لا كابيتال"],
    keyLandmarks: ["البرج الأيقوني", "حي المال والأعمال (CBD)", "النهر الأخضر", "مدينة الفنون والثقافة"],
    popularUnitTypes: ["شقق سمارت", "دوبلكس سكاي فيلا", "مكاتب إدارية"],
    reviews: [
      {
        id: "rev-n4",
        residentName: "م. إبراهيم الجمال",
        yearsOfResidency: 2,
        rating: 5,
        comment: "المستقبل هنا بلا شك. البنية التحتية فائقة الذكاء ومونوريل العاصمة قرب كل المشاوير.",
        date: "2026-09-18",
      },
    ],
  },
  {
    id: "neigh-maadi",
    slug: "maadi",
    nameAr: "المعادي وسرايات المعادي ودجلة",
    nameEn: "Maadi, Sarayat & Degla",
    cityNameAr: "القاهرة",
    country: "EG",
    heroImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "حي السفارات والأشجار المعمرة والمجتمع الدولي، وجهة الدبلوماسيين ومحبي الهدوء التام والطراز المعماري الكلاسيكي الساحر.",
    avgPricePerSqM: 28500,
    yoyAppreciationPercent: 22.0,
    demandIndex: 88,
    overallLivabilityScore: 92,
    ratings: {
      quietness: 4.7,
      services: 4.8,
      schools: 4.9,
      safety: 4.7,
      transportation: 4.4,
      greenSpaces: 4.8,
    },
    residentReviewsCount: 95,
    topCompounds: ["معادي جاردنز", "دجلة بالمس", "أبراج المعادي فيو"],
    keyLandmarks: ["شارع 9 للمطاعم والكافيهات", "محمية وادي دجلة", "نادي المعادي لليخوت", "المدرسة الأمريكية"],
    popularUnitTypes: ["شقق كلاسيكية واسعة", "بنتهاوس", "فيلات سرايات المعادي"],
    reviews: [
      {
        id: "rev-n5",
        residentName: "أ. رانيا فهمي",
        yearsOfResidency: 8,
        rating: 5,
        comment: "الحي الأكثر حميمية وأشجاراً في القاهرة، شارع 9 متنفس رائع والمجتمع الأجنبي يمنحه طابعاً راقياً.",
        date: "2026-06-11",
      },
    ],
  },
  {
    id: "neigh-riyadh-malqa",
    slug: "riyadh-malqa",
    nameAr: "حي الملقا وحطين (شمال الرياض)",
    nameEn: "Al Malqa & Hittin, North Riyadh",
    cityNameAr: "الرياض",
    country: "SA",
    heroImage: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "أحد أرقى وأسرع أحياء الرياض نمواً وقيمة استثمارية، مجاور لمركز الملك عبد الله المالي (KAFD) وبوليفارد رياض سيتي مع شبكة بنية تحتية حديثة ومطابقة لمعايير رخصة فال.",
    avgPricePerSqM: 195000,
    yoyAppreciationPercent: 36.0,
    demandIndex: 99,
    overallLivabilityScore: 96,
    ratings: {
      quietness: 4.9,
      services: 4.9,
      schools: 4.8,
      safety: 5.0,
      transportation: 4.7,
      greenSpaces: 4.6,
    },
    residentReviewsCount: 74,
    topCompounds: ["كمبوند الملقا رزيدنس", "مجمع حطين فالي", "ديار الملقا"],
    keyLandmarks: ["مركز الملك عبد الله المالي (KAFD)", "بوليفارد سيتي", "طريق الملك سلمان", "طريق أنس بن مالك"],
    popularUnitTypes: ["فيلات مودرن ذكية", "أدوار سكنية فاخرة", "شقق تمليك VIP"],
    reviews: [
      {
        id: "rev-n6",
        residentName: "م. سلمان الدوسري",
        yearsOfResidency: 4,
        rating: 5,
        comment: "أفضل موقع سكني واستثماري في شمال الرياض، 5 دقائق من كافد والخدمات متكاملة 100%.",
        date: "2026-08-01",
      },
    ],
  },
  {
    id: "neigh-dubai-marina",
    slug: "dubai-marina",
    nameAr: "دبي مارينا ووسط المدينة",
    nameEn: "Dubai Marina & Downtown",
    cityNameAr: "دبي",
    country: "AE",
    heroImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
    descriptionAr: "الوجهة السياحية والاستثمارية الأيقونية الأولى عالمياً، إطلالات بحرية آسرة على اليخوت، قرب برج خليفة، وعوائد إيجارية سنوية وقصيرة الأجل.",
    avgPricePerSqM: 295000,
    yoyAppreciationPercent: 28.0,
    demandIndex: 98,
    overallLivabilityScore: 97,
    ratings: {
      quietness: 4.2,
      services: 5.0,
      schools: 4.7,
      safety: 5.0,
      transportation: 5.0,
      greenSpaces: 4.5,
    },
    residentReviewsCount: 160,
    topCompounds: ["إعمار بيتشفرونت", "داماك هايتس", "مارينا جيت"],
    keyLandmarks: ["مارينا ووك", "دبي مول وبرج خليفة", "شاطئ JBR", "محطة ترام دبي"],
    popularUnitTypes: ["شقق فندقية مخدومة", "بنتهاوس على الواجهة البحرية", "استوديوهات استثمارية عالي العائد"],
    reviews: [
      {
        id: "rev-n7",
        residentName: "أ. كريم منصور",
        yearsOfResidency: 3,
        rating: 5,
        comment: "العائد الإيجاري من Airbnb هنا لا يضاهى، ونمط الحياة الفاخر مع المارينا والممشى استثنائي.",
        date: "2026-09-12",
      },
    ],
  },
];

const initialSuperAgents: SuperAgentProfile[] = [
  {
    id: "agent-1",
    userId: "usr-broker-desouky",
    nameAr: "م. أحمد الدسوقي",
    agencyName: "مجموعة الدسوقي للاستشارات العقارية",
    licenseNumber: "FAL-12000452 / سجّل تجاري 41088",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80",
    isSuperAgent: true,
    scorePercent: 99,
    responseTimeMins: 7,
    verifiedListingsCount: 18,
    activeDealsCount: 42,
    phone: "01001234567",
    whatsapp: "201001234567",
    specialtyAreas: ["التجمع الخامس", "العاصمة الإدارية", "القاهرة الجديدة"],
  },
  {
    id: "agent-2",
    userId: "usr-broker-menshawy",
    nameAr: "أ. سارة المنشاوي",
    agencyName: "نبض النخبة للوساطة العقارية",
    licenseNumber: "وساطة معتمدة 89412 - غرفة التطوير العقاري",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    isSuperAgent: true,
    scorePercent: 98,
    responseTimeMins: 11,
    verifiedListingsCount: 14,
    activeDealsCount: 31,
    phone: "01123456789",
    whatsapp: "201123456789",
    specialtyAreas: ["الشيخ زايد", "6 أكتوبر", "أبراج زد"],
  },
  {
    id: "agent-3",
    userId: "usr-broker-qahtani",
    nameAr: "م. فهد القحطاني",
    agencyName: "شركة أوتاد الخليج للوساطة العقارية",
    licenseNumber: "رخصة فال العقارية 11000389",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
    isSuperAgent: true,
    scorePercent: 99,
    responseTimeMins: 6,
    verifiedListingsCount: 22,
    activeDealsCount: 58,
    phone: "0501234567",
    whatsapp: "966501234567",
    specialtyAreas: ["الرياض - الملقا وحطين", "دبي مارينا", "مشاريع وافي"],
  },
];

const initialReservations: UnitDigitalReservation[] = [];

class SmartFeaturesStore {
  private config: SmartFeaturesConfig | null = null;
  private reverseRequests: ReversePropertyRequest[] | null = null;
  private inspections: EngineeringInspectionBooking[] | null = null;
  private brokerReviews: BrokerReview[] | null = null;
  private portfolioItems: InvestorPortfolioItem[] | null = null;
  private reservations: UnitDigitalReservation[] | null = null;
  private neighborhoods: NeighborhoodIntelligence[] | null = null;

  constructor() {
    this.ensureDataDir();
  }

  private isLocalDiskAllowed(): boolean {
    if (process.env.NODE_ENV === "production") {
      return process.env.AQARPULSE_ALLOW_TEST_DISK === "true";
    }
    return true;
  }

  private hasCentralSupabase(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return Boolean(
      url &&
        key &&
        !url.includes("placeholder") &&
        !key.includes("placeholder")
    );
  }

  private async getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!;
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private ensureDataDir() {
    if (!this.isLocalDiskAllowed()) return;
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        console.error("Failed to create data dir for smart features:", err);
      }
    }
  }

  private mergeWithDefaultConfig(parsed: Partial<SmartFeaturesConfig>): SmartFeaturesConfig {
    return {
      ...defaultSmartConfig,
      ...parsed,
      features: {
        ...defaultSmartConfig.features,
        ...(parsed.features || {}),
      },
      financialParams: {
        goldGram24PriceEgp:
          parsed.financialParams?.goldGram24PriceEgp ?? defaultSmartConfig.financialParams.goldGram24PriceEgp,
        annualInflationRatePercent:
          parsed.financialParams?.annualInflationRatePercent ?? defaultSmartConfig.financialParams.annualInflationRatePercent,
        bankCertificateAnnualYieldPercent:
          parsed.financialParams?.bankCertificateAnnualYieldPercent ?? defaultSmartConfig.financialParams.bankCertificateAnnualYieldPercent,
        realEstateDispositionTaxPercent:
          parsed.financialParams?.realEstateDispositionTaxPercent ?? defaultSmartConfig.financialParams.realEstateDispositionTaxPercent,
        averageAnnualAppreciationRatePercent:
          parsed.financialParams?.averageAnnualAppreciationRatePercent ?? defaultSmartConfig.financialParams.averageAnnualAppreciationRatePercent,
      },
      geospatialParams: {
        ...defaultSmartConfig.geospatialParams,
        ...(parsed.geospatialParams || {}),
      },
      finishingParams: {
        ...defaultSmartConfig.finishingParams,
        ...(parsed.finishingParams || {}),
      },
      inspectionParams: {
        ...defaultSmartConfig.inspectionParams,
        ...(parsed.inspectionParams || {}),
      },
      mortgageParams: {
        ...defaultSmartConfig.mortgageParams,
        ...(parsed.mortgageParams || {}),
      },
      benchmarkParams: {
        ...defaultSmartConfig.benchmarkParams,
        ...(parsed.benchmarkParams || {}),
      },
    };
  }

  public getConfig(): SmartFeaturesConfig {
    if (this.config) return this.config;
    if (this.isLocalDiskAllowed() && fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        this.config = this.mergeWithDefaultConfig(parsed);
        return this.config!;
      } catch (e) {
        console.error("Error reading smart features config file:", e);
        // Never overwrite existing file when a read error occurs
        this.config = { ...defaultSmartConfig };
        return this.config;
      }
    }
    this.config = { ...defaultSmartConfig };
    if (this.isLocalDiskAllowed()) {
      this.saveConfig(this.config);
    }
    return this.config;
  }

  public async getConfigAsync(): Promise<SmartFeaturesConfig> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .from("smart_features_config")
        .select("*")
        .eq("id", "global")
        .maybeSingle();

      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل استرجاع إعدادات المنظومة الذكية (${error.message})`);
        }
      } else if (data) {
        this.config = this.mergeWithDefaultConfig({
          version: data.version,
          features: data.features,
          financialParams: data.financial_params,
          geospatialParams: data.geospatial_params,
          finishingParams: data.finishing_params,
          inspectionParams: data.inspection_params,
          mortgageParams: data.mortgage_params,
          benchmarkParams: data.benchmark_params,
          updatedBy: data.updated_by,
          updatedAt: data.updated_at,
        });
        return this.config;
      } else {
        this.config = { ...defaultSmartConfig };
        return this.config;
      }
    }
    return this.getConfig();
  }

  public saveConfig(updated: SmartFeaturesConfig): SmartFeaturesConfig {
    this.config = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    if (this.isLocalDiskAllowed()) {
      this.ensureDataDir();
      try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), "utf-8");
      } catch (err) {
        console.error("Error saving smart features config:", err);
      }
    }
    return this.config;
  }

  public async saveConfigAsync(updated: SmartFeaturesConfig): Promise<SmartFeaturesConfig> {
    const nextConfig: SmartFeaturesConfig = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };

    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { error } = await supabase.from("smart_features_config").upsert(
        {
          id: "global",
          version: nextConfig.version || "2.0.0",
          features: nextConfig.features,
          financial_params: nextConfig.financialParams,
          geospatial_params: nextConfig.geospatialParams,
          finishing_params: nextConfig.finishingParams,
          inspection_params: nextConfig.inspectionParams,
          mortgage_params: nextConfig.mortgageParams,
          benchmark_params: nextConfig.benchmarkParams,
          updated_by: nextConfig.updatedBy || "system_admin",
          updated_at: nextConfig.updatedAt,
        },
        { onConflict: "id" }
      );
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ إعدادات المنظومة الذكية (${error.message})`);
      }
      this.config = nextConfig;
      return nextConfig;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحفظ الإعدادات");
    }

    return this.saveConfig(nextConfig);
  }

  public getCompoundMasterplans(): CompoundMasterplan[] {
    return initialCompoundMasterplans;
  }

  public getAqarReels(): AqarReelsItem[] {
    return initialAqarReels;
  }

  public getMarketIndexTrends(): MarketIndexDistrictTrend[] {
    return initialMarketDistrictTrends;
  }

  public getReverseRequests(): ReversePropertyRequest[] {
    if (this.reverseRequests) return this.reverseRequests;
    if (this.isLocalDiskAllowed() && fs.existsSync(REVERSE_REQUESTS_FILE)) {
      try {
        this.reverseRequests = JSON.parse(fs.readFileSync(REVERSE_REQUESTS_FILE, "utf-8"));
        return this.reverseRequests!;
      } catch (e) {
        console.error(e);
        this.reverseRequests = [];
        return this.reverseRequests;
      }
    }
    this.reverseRequests = [...initialReverseRequests];
    if (this.isLocalDiskAllowed()) {
      this.saveReverseRequests(this.reverseRequests);
    }
    return this.reverseRequests;
  }

  public async getReverseRequestsAsync(cityId?: string): Promise<ReversePropertyRequest[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      let query = supabase
        .from("reverse_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (cityId) {
        query = query.eq("city_id", cityId);
      }
      const { data, error } = await query;
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل جلب الطلبات العقارية العكسية (${error.message})`);
        }
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          userId: row.user_id || "",
          userName: row.user_name,
          userPhone: row.user_phone,
          title: row.title,
          cityId: row.city_id,
          districtId: row.district_id || "",
          districtNameAr: row.district_name_ar,
          category: row.category,
          transactionType: row.transaction_type,
          minBudget: Number(row.min_budget),
          maxBudget: Number(row.max_budget),
          minArea: Number(row.min_area || 100),
          maxArea: row.max_area ? Number(row.max_area) : undefined,
          bedrooms: row.bedrooms ? Number(row.bedrooms) : undefined,
          notes: row.notes || "",
          urgency: row.urgency || "flexible",
          status: row.status || "open",
          offersCount: Number(row.offers_count || 0),
          createdAt: row.created_at,
        }));
      }
    }
    const list = this.getReverseRequests();
    return cityId ? list.filter((r) => r.cityId === cityId) : list;
  }

  public saveReverseRequests(items: ReversePropertyRequest[]) {
    this.reverseRequests = items;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(REVERSE_REQUESTS_FILE, JSON.stringify(items, null, 2), "utf-8");
  }

  public addReverseRequest(req: Omit<ReversePropertyRequest, "id" | "createdAt" | "offersCount" | "status">): ReversePropertyRequest {
    const list = this.getReverseRequests();
    const created: ReversePropertyRequest = {
      ...req,
      id: `req-${Date.now()}`,
      status: "open",
      offersCount: 0,
      createdAt: new Date().toISOString(),
    };
    list.unshift(created);
    this.saveReverseRequests(list);
    return created;
  }

  public async addReverseRequestAsync(
    req: Omit<ReversePropertyRequest, "id" | "createdAt" | "offersCount" | "status">
  ): Promise<ReversePropertyRequest> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const created: ReversePropertyRequest = {
        ...req,
        id: `req-${Date.now()}`,
        status: "open",
        offersCount: 0,
        createdAt: new Date().toISOString(),
      };
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.userId || "");
      const { error } = await supabase.from("reverse_requests").insert({
        id: created.id,
        user_id: isUuid ? created.userId : null,
        user_name: created.userName,
        user_phone: created.userPhone,
        title: created.title,
        city_id: created.cityId,
        district_id: created.districtId || null,
        district_name_ar: created.districtNameAr,
        category: created.category,
        transaction_type: created.transactionType,
        min_budget: created.minBudget,
        max_budget: created.maxBudget,
        min_area: created.minArea,
        max_area: created.maxArea ?? null,
        bedrooms: created.bedrooms ?? null,
        notes: created.notes || "",
        urgency: created.urgency || "flexible",
        status: created.status,
        offers_count: 0,
        created_at: created.createdAt,
      });
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ الطلب العقاري العكسي (${error.message})`);
      }
      return created;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحفظ الطلب");
    }

    return this.addReverseRequest(req);
  }

  public getInspections(): EngineeringInspectionBooking[] {
    if (this.inspections) return this.inspections;
    if (this.isLocalDiskAllowed() && fs.existsSync(INSPECTIONS_FILE)) {
      try {
        this.inspections = JSON.parse(fs.readFileSync(INSPECTIONS_FILE, "utf-8"));
        return this.inspections!;
      } catch (e) {
        console.error(e);
        this.inspections = [];
        return this.inspections;
      }
    }
    this.inspections = [...initialInspections];
    if (this.isLocalDiskAllowed()) {
      this.saveInspections(this.inspections);
    }
    return this.inspections;
  }

  public async getInspectionsAsync(): Promise<EngineeringInspectionBooking[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .from("inspection_bookings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل جلب حجوزات الفحص الهندسي (${error.message})`);
        }
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          propertyId: row.property_id,
          propertyTitle: row.property_title,
          propertyAddress: row.property_address,
          requesterName: row.requester_name,
          requesterPhone: row.requester_phone,
          requesterEmail: row.requester_email || "",
          preferredDate: row.preferred_date,
          inspectionType: row.inspection_type,
          status: row.status,
          assignedEngineerName: row.assigned_engineer_name || undefined,
          scoreOverall: row.score_overall ?? undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
        }));
      }
    }
    return this.getInspections();
  }

  public saveInspections(items: EngineeringInspectionBooking[]) {
    this.inspections = items;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(INSPECTIONS_FILE, JSON.stringify(items, null, 2), "utf-8");
  }

  public bookInspection(booking: Omit<EngineeringInspectionBooking, "id" | "createdAt" | "status">): EngineeringInspectionBooking {
    const list = this.getInspections();
    const created: EngineeringInspectionBooking = {
      ...booking,
      id: `insp-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    list.unshift(created);
    this.saveInspections(list);
    return created;
  }

  public async bookInspectionAsync(
    booking: Omit<EngineeringInspectionBooking, "id" | "createdAt" | "status">
  ): Promise<EngineeringInspectionBooking> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const created: EngineeringInspectionBooking = {
        ...booking,
        id: `insp-${Date.now()}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("inspection_bookings").insert({
        id: created.id,
        property_id: created.propertyId,
        property_title: created.propertyTitle,
        property_address: created.propertyAddress,
        requester_name: created.requesterName,
        requester_phone: created.requesterPhone,
        requester_email: created.requesterEmail || "",
        preferred_date: created.preferredDate,
        inspection_type: created.inspectionType,
        status: created.status,
        assigned_engineer_name: created.assignedEngineerName || null,
        score_overall: created.scoreOverall ?? null,
        notes: created.notes || null,
        created_at: created.createdAt,
      });
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ حجز الفحص الهندسي (${error.message})`);
      }
      return created;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحجز الفحص الهندسي");
    }

    return this.bookInspection(booking);
  }

  public getBrokerReviews(brokerId?: string): BrokerReview[] {
    if (!this.brokerReviews) {
      if (this.isLocalDiskAllowed() && fs.existsSync(BROKER_REVIEWS_FILE)) {
        try {
          this.brokerReviews = JSON.parse(fs.readFileSync(BROKER_REVIEWS_FILE, "utf-8"));
        } catch (e) {
          console.error(e);
          this.brokerReviews = [];
        }
      } else {
        this.brokerReviews = process.env.NODE_ENV === "production" ? [] : [...initialBrokerReviews];
        if (this.isLocalDiskAllowed()) {
          this.saveBrokerReviews(this.brokerReviews);
        }
      }
    }
    if (brokerId) {
      return this.brokerReviews!.filter((r) => r.brokerId === brokerId);
    }
    return this.brokerReviews!;
  }

  public async getBrokerReviewsAsync(brokerId?: string): Promise<BrokerReview[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      let query = supabase
        .from("broker_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (brokerId) {
        query = query.eq("broker_id", brokerId);
      }
      const { data, error } = await query;
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل جلب تقييمات الوسطاء (${error.message})`);
        }
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          brokerId: row.broker_id,
          brokerName: row.broker_name,
          reviewerName: row.reviewer_name,
          ratingOverall: Number(row.rating_overall),
          ratingAccuracy: Number(row.rating_accuracy),
          ratingCommunication: Number(row.rating_communication),
          ratingPunctuality: Number(row.rating_punctuality),
          comment: row.comment,
          isVerifiedDeal: Boolean(row.is_verified_deal),
          createdAt: row.created_at,
        }));
      }
    }
    return this.getBrokerReviews(brokerId);
  }

  public saveBrokerReviews(reviews: BrokerReview[]) {
    this.brokerReviews = reviews;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(BROKER_REVIEWS_FILE, JSON.stringify(reviews, null, 2), "utf-8");
  }

  public addBrokerReview(review: Omit<BrokerReview, "id" | "createdAt">): BrokerReview {
    const list = this.getBrokerReviews();
    const created: BrokerReview = {
      ...review,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    list.unshift(created);
    this.saveBrokerReviews(list);
    return created;
  }

  public async addBrokerReviewAsync(review: Omit<BrokerReview, "id" | "createdAt">): Promise<BrokerReview> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const created: BrokerReview = {
        ...review,
        id: `rev-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("broker_reviews").insert({
        id: created.id,
        broker_id: created.brokerId,
        broker_name: created.brokerName,
        reviewer_name: created.reviewerName,
        rating_overall: created.ratingOverall,
        rating_accuracy: created.ratingAccuracy,
        rating_communication: created.ratingCommunication,
        rating_punctuality: created.ratingPunctuality,
        comment: created.comment,
        is_verified_deal: Boolean(created.isVerifiedDeal),
        created_at: created.createdAt,
      });
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ تقييم الوسيط (${error.message})`);
      }
      return created;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحفظ التقييم");
    }

    return this.addBrokerReview(review);
  }

  public getPortfolioItems(userId: string): InvestorPortfolioItem[] {
    if (!this.portfolioItems) {
      if (this.isLocalDiskAllowed() && fs.existsSync(PORTFOLIO_FILE)) {
        try {
          this.portfolioItems = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, "utf-8"));
        } catch (e) {
          this.portfolioItems = [];
        }
      } else {
        this.portfolioItems =
          process.env.NODE_ENV === "production"
            ? []
            : [
                {
                  id: "port-1",
                  userId: userId || "usr-investor-1",
                  propertyTitle: "شقة استثمارية 165م كمبوند هايد بارك",
                  purchasePrice: 4200000,
                  currentMarketEstimate: 6850000,
                  purchaseDate: "2023-03-15",
                  rentalIncomeMonthly: 32000,
                  tenantName: "شركة مقاولات أجنبية",
                  occupancyStatus: "rented",
                },
                {
                  id: "port-2",
                  userId: userId || "usr-investor-1",
                  propertyTitle: "عيادة طبية 60م مول إداري بالتسعين الشمالي",
                  purchasePrice: 3100000,
                  currentMarketEstimate: 4700000,
                  purchaseDate: "2024-01-10",
                  rentalIncomeMonthly: 0,
                  nextInstallmentDueDate: "2026-11-01",
                  nextInstallmentAmount: 145000,
                  installmentsRemainingCount: 6,
                  occupancyStatus: "under_finishing",
                },
              ];
        if (this.isLocalDiskAllowed()) {
          this.savePortfolioItems(this.portfolioItems);
        }
      }
    }
    return this.portfolioItems!.filter((i) => i.userId === userId || !userId);
  }

  public async getPortfolioItemsAsync(userId: string): Promise<InvestorPortfolioItem[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .from("investor_portfolios")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل جلب المحفظة الاستثمارية (${error.message})`);
        }
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          propertyTitle: row.property_title,
          purchasePrice: Number(row.purchase_price),
          currentMarketEstimate: Number(row.current_market_estimate),
          purchaseDate: row.purchase_date,
          rentalIncomeMonthly: Number(row.rental_income_monthly || 0),
          tenantName: row.tenant_name || undefined,
          nextInstallmentDueDate: row.next_installment_due_date || undefined,
          nextInstallmentAmount: row.next_installment_amount ? Number(row.next_installment_amount) : undefined,
          installmentsRemainingCount: row.installments_remaining_count ?? undefined,
          occupancyStatus: row.occupancy_status || "rented",
        }));
      }
    }
    return this.getPortfolioItems(userId);
  }

  public savePortfolioItems(items: InvestorPortfolioItem[]) {
    this.portfolioItems = items;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(items, null, 2), "utf-8");
  }

  public addPortfolioItem(item: Omit<InvestorPortfolioItem, "id">): InvestorPortfolioItem {
    const list = this.getPortfolioItems(item.userId);
    const created: InvestorPortfolioItem = {
      ...item,
      id: `port-${Date.now()}`,
    };
    list.unshift(created);
    this.savePortfolioItems(list);
    return created;
  }

  public async addPortfolioItemAsync(item: Omit<InvestorPortfolioItem, "id">): Promise<InvestorPortfolioItem> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const created: InvestorPortfolioItem = {
        ...item,
        id: `port-${Date.now()}`,
      };
      const { error } = await supabase.from("investor_portfolios").insert({
        id: created.id,
        user_id: created.userId,
        property_title: created.propertyTitle,
        purchase_price: created.purchasePrice,
        current_market_estimate: created.currentMarketEstimate,
        purchase_date: created.purchaseDate,
        rental_income_monthly: created.rentalIncomeMonthly,
        tenant_name: created.tenantName || null,
        next_installment_due_date: created.nextInstallmentDueDate || null,
        next_installment_amount: created.nextInstallmentAmount ?? null,
        installments_remaining_count: created.installmentsRemainingCount ?? null,
        occupancy_status: created.occupancyStatus,
      });
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ العقار في المحفظة الاستثمارية (${error.message})`);
      }
      return created;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحفظ المحفظة");
    }

    return this.addPortfolioItem(item);
  }

  // 1. Digital Reservations Engine (Wasalt & Sakani)
  public getReservations(userId?: string): UnitDigitalReservation[] {
    if (!this.reservations) {
      if (this.isLocalDiskAllowed() && fs.existsSync(RESERVATIONS_FILE)) {
        try {
          this.reservations = JSON.parse(fs.readFileSync(RESERVATIONS_FILE, "utf-8"));
        } catch (e) {
          console.error(e);
          this.reservations = [];
        }
      } else {
        this.reservations = [...initialReservations];
        if (this.isLocalDiskAllowed()) {
          this.saveReservations(this.reservations);
        }
      }
    }
    if (userId) {
      return this.reservations!.filter((r) => r.userId === userId);
    }
    return this.reservations!;
  }

  public async getReservationsAsync(userId?: string): Promise<UnitDigitalReservation[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      let query = supabase
        .from("reservations")
        .select("*")
        .order("created_at", { ascending: false });
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { data, error } = await query;
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل استرجاع الحجوزات (${error.message})`);
        }
      } else if (data) {
        return data.map((row: any) => ({
          id: row.id,
          reservationCode: row.reservation_code,
          propertyId: row.property_id,
          propertyTitle: row.property_title,
          propertyPrice: Number(row.property_price),
          userId: row.user_id || undefined,
          buyerName: row.buyer_name,
          buyerPhone: row.buyer_phone,
          buyerNationalId: row.buyer_national_id || "",
          frozenPriceEgp: Number(row.frozen_price_egp),
          reservationFeeEgp: Number(row.reservation_fee_egp),
          expiresAt: row.expires_at,
          status: row.status,
          notes: row.notes || undefined,
          createdAt: row.created_at,
        }));
      }
    }
    return this.getReservations(userId);
  }

  public saveReservations(list: UnitDigitalReservation[]) {
    this.reservations = list;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(list, null, 2), "utf-8");
  }

  public createReservation(
    data: Omit<UnitDigitalReservation, "id" | "reservationCode" | "createdAt" | "status" | "expiresAt">
  ): UnitDigitalReservation {
    const list = this.getReservations();
    const config = this.getConfig();
    const holdHours = config.benchmarkParams?.reservationHoldHours || 48;
    const code = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();

    const created: UnitDigitalReservation = {
      ...data,
      id: `res-${Date.now()}`,
      reservationCode: code,
      expiresAt,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    list.unshift(created);
    this.saveReservations(list);
    return created;
  }

  public async createReservationAsync(
    data: Omit<UnitDigitalReservation, "id" | "reservationCode" | "createdAt" | "status" | "expiresAt">
  ): Promise<UnitDigitalReservation> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const config = await this.getConfigAsync();
      const holdHours = config.benchmarkParams?.reservationHoldHours || 48;
      const code = `RES-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const expiresAt = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();
      const created: UnitDigitalReservation = {
        ...data,
        id: `res-${Date.now()}`,
        reservationCode: code,
        expiresAt,
        status: "active",
        createdAt: new Date().toISOString(),
      };
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(created.userId || "");
      const { error } = await supabase.from("reservations").insert({
        id: created.id,
        reservation_code: created.reservationCode,
        property_id: created.propertyId,
        property_title: created.propertyTitle,
        property_price: created.propertyPrice,
        user_id: isUuid ? created.userId : null,
        buyer_name: created.buyerName,
        buyer_phone: created.buyerPhone,
        buyer_national_id: created.buyerNationalId || "",
        frozen_price_egp: created.frozenPriceEgp,
        reservation_fee_egp: created.reservationFeeEgp,
        expires_at: created.expiresAt,
        status: created.status,
        notes: created.notes || null,
        created_at: created.createdAt,
      });
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ الحجز الرقمي (${error.message})`);
      }
      return created;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لإصدار الحجز");
    }

    return this.createReservation(data);
  }

  public getReservationByCode(code: string): UnitDigitalReservation | null {
    const list = this.getReservations();
    return list.find((r) => r.reservationCode === code) || null;
  }

  public async getReservationByCodeAsync(code: string): Promise<UnitDigitalReservation | null> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .eq("reservation_code", code)
        .maybeSingle();
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل البحث عن الحجز (${error.message})`);
        }
      } else if (data) {
        return {
          id: data.id,
          reservationCode: data.reservation_code,
          propertyId: data.property_id,
          propertyTitle: data.property_title,
          propertyPrice: Number(data.property_price),
          userId: data.user_id || undefined,
          buyerName: data.buyer_name,
          buyerPhone: data.buyer_phone,
          buyerNationalId: data.buyer_national_id || "",
          frozenPriceEgp: Number(data.frozen_price_egp),
          reservationFeeEgp: Number(data.reservation_fee_egp),
          expiresAt: data.expires_at,
          status: data.status,
          notes: data.notes || undefined,
          createdAt: data.created_at,
        };
      } else {
        return null;
      }
    }
    return this.getReservationByCode(code);
  }

  // 2. Neighborhood Intelligence & Resident Livability (Aqarmap & Bayut)
  public getNeighborhoods(): NeighborhoodIntelligence[] {
    if (!this.neighborhoods) {
      if (this.isLocalDiskAllowed() && fs.existsSync(NEIGHBORHOODS_FILE)) {
        try {
          this.neighborhoods = JSON.parse(fs.readFileSync(NEIGHBORHOODS_FILE, "utf-8"));
        } catch (e) {
          console.error(e);
          this.neighborhoods = [...initialNeighborhoods];
        }
      } else {
        this.neighborhoods = [...initialNeighborhoods];
        if (this.isLocalDiskAllowed()) {
          this.saveNeighborhoods(this.neighborhoods);
        }
      }
    }
    return this.neighborhoods!;
  }

  public async getNeighborhoodsAsync(): Promise<NeighborhoodIntelligence[]> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase
        .from("neighborhood_guides")
        .select("*");
      if (error) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(`CENTRAL_DB_ERROR: فشل استرجاع بيانات الأحياء (${error.message})`);
        }
      } else if (data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          slug: row.slug,
          nameAr: row.name_ar,
          nameEn: row.name_en,
          cityNameAr: row.city_name_ar,
          country: row.country,
          heroImage: row.hero_image,
          descriptionAr: row.description_ar,
          avgPricePerSqM: Number(row.avg_price_per_sqm),
          yoyAppreciationPercent: Number(row.yoy_appreciation_percent),
          demandIndex: Number(row.demand_index),
          overallLivabilityScore: Number(row.overall_livability_score),
          ratings: row.ratings,
          residentReviewsCount: Number(row.resident_reviews_count),
          topCompounds: row.top_compounds || [],
          keyLandmarks: row.key_landmarks || [],
          popularUnitTypes: row.popular_unit_types || [],
          reviews: row.reviews || [],
        }));
      }
    }
    return this.getNeighborhoods();
  }

  public saveNeighborhoods(list: NeighborhoodIntelligence[]) {
    this.neighborhoods = list;
    if (!this.isLocalDiskAllowed()) return;
    this.ensureDataDir();
    fs.writeFileSync(NEIGHBORHOODS_FILE, JSON.stringify(list, null, 2), "utf-8");
  }

  public getNeighborhoodBySlug(slug: string): NeighborhoodIntelligence | null {
    const list = this.getNeighborhoods();
    return list.find((n) => n.slug === slug) || null;
  }

  public async getNeighborhoodBySlugAsync(slug: string): Promise<NeighborhoodIntelligence | null> {
    if (this.hasCentralSupabase()) {
      const list = await this.getNeighborhoodsAsync();
      return list.find((n) => n.slug === slug) || null;
    }
    return this.getNeighborhoodBySlug(slug);
  }

  public addNeighborhoodReview(
    slug: string,
    review: { residentName: string; yearsOfResidency: number; rating: number; comment: string }
  ): boolean {
    const list = this.getNeighborhoods();
    const target = list.find((n) => n.slug === slug);
    if (!target) return false;
    target.reviews.unshift({
      id: `rev-${Date.now()}`,
      ...review,
      date: new Date().toISOString().split("T")[0],
    });
    target.residentReviewsCount += 1;
    this.saveNeighborhoods(list);
    return true;
  }

  public async addNeighborhoodReviewAsync(
    slug: string,
    review: { residentName: string; yearsOfResidency: number; rating: number; comment: string }
  ): Promise<boolean> {
    if (this.hasCentralSupabase()) {
      const supabase = await this.getSupabaseClient();
      const target = await this.getNeighborhoodBySlugAsync(slug);
      if (!target) return false;

      const nextReviews = [
        {
          id: `rev-${Date.now()}`,
          ...review,
          date: new Date().toISOString().split("T")[0],
        },
        ...(target.reviews || []),
      ];
      const nextCount = (target.residentReviewsCount || 0) + 1;

      const { error } = await supabase.from("neighborhood_guides").upsert(
        {
          id: target.id,
          slug: target.slug,
          name_ar: target.nameAr,
          name_en: target.nameEn,
          city_name_ar: target.cityNameAr,
          country: target.country,
          hero_image: target.heroImage,
          description_ar: target.descriptionAr,
          avg_price_per_sqm: target.avgPricePerSqM,
          yoy_appreciation_percent: target.yoyAppreciationPercent,
          demand_index: target.demandIndex,
          overall_livability_score: target.overallLivabilityScore,
          ratings: target.ratings,
          resident_reviews_count: nextCount,
          top_compounds: target.topCompounds,
          key_landmarks: target.keyLandmarks,
          popular_unit_types: target.popularUnitTypes,
          reviews: nextReviews,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      );
      if (error) {
        throw new Error(`CENTRAL_DB_ERROR: فشل حفظ تقييم الحي (${error.message})`);
      }
      return true;
    }

    if (process.env.NODE_ENV === "production" && !this.isLocalDiskAllowed()) {
      throw new Error("CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير متاحة لحفظ تقييم الحي");
    }

    return this.addNeighborhoodReview(slug, review);
  }

  // 3. SuperAgent Profiles (Property Finder & Bayut)
  public getSuperAgents(): SuperAgentProfile[] {
    return initialSuperAgents;
  }

  public getSuperAgentByUserId(userId: string): SuperAgentProfile | null {
    return initialSuperAgents.find((a) => a.userId === userId) || initialSuperAgents[0];
  }

  // 4. Interactive 2D Floor Plan Layout (Bayut)
  public getFloorPlan(propertyId: string, grossArea = 180): FloorPlanLayout {
    const netArea = Math.round(grossArea * 0.82); // 82% Net efficiency
    return {
      propertyId,
      grossAreaSqM: grossArea,
      netAreaSqM: netArea,
      efficiencyRatioPercent: 82,
      rooms: [
        { nameAr: "غرفة النوم الرئيسية (ماستر)", dimensions: "4.8م × 4.2م", areaSqM: 20.2, orientation: "بحري صريح" },
        { nameAr: "غرفة نوم ثانية", dimensions: "4.0م × 3.6م", areaSqM: 14.4, orientation: "بحري شرقي" },
        { nameAr: "غرفة نوم ثالثة / مكتب", dimensions: "3.8م × 3.4م", areaSqM: 12.9, orientation: "شرقي" },
        { nameAr: "صالون واستقبال مفتوح (3 قطع)", dimensions: "8.5م × 5.2م", areaSqM: 44.2, orientation: "بحري واسع" },
        { nameAr: "مطبخ أمريكي مودرن", dimensions: "3.6م × 3.2م", areaSqM: 11.5, orientation: "تهوية خاصة" },
        { nameAr: "حمام ماستر رئيسي", dimensions: "2.8م × 2.2م", areaSqM: 6.2, orientation: "داخلي" },
        { nameAr: "حمام ضيوف", dimensions: "2.0م × 1.8م", areaSqM: 3.6, orientation: "داخلي" },
        { nameAr: "تراس رئيسي بإطلالة بانورامية", dimensions: "4.5م × 1.8م", areaSqM: 8.1, orientation: "بحري غربي" },
      ],
    };
  }

  // 5. Dynamic Payment Plan Timeline Generator (Nawy & Nawy Now)
  public generatePaymentSchedule(price: number, downPaymentPercent = 10, years = 7) {
    const config = this.getConfig();
    const maintPercent = config.benchmarkParams?.standardMaintenancePercent || 8;
    const downAmount = Math.round((price * downPaymentPercent) / 100);
    const contractPercent = 5;
    const contractAmount = Math.round((price * contractPercent) / 100);
    const deliveryPercent = 10;
    const deliveryAmount = Math.round((price * deliveryPercent) / 100);
    const maintenanceAmount = Math.round((price * maintPercent) / 100);

    const remainingForInstallments = price - (downAmount + contractAmount + deliveryAmount);
    const totalQuarters = years * 4;
    const quarterlyAmount = Math.round(remainingForInstallments / totalQuarters);
    const monthlyEquivalent = Math.round(quarterlyAmount / 3);

    // Cash discount estimate (e.g. 28% off total price for full cash upfront)
    const cashDiscountPercent = 28;
    const cashPrice = Math.round(price * (1 - cashDiscountPercent / 100));

    const milestones: PaymentPlanMilestone[] = [
      {
        stageNameAr: "مقدم الحجز (جدية الحجز)",
        percent: downPaymentPercent,
        amountEgp: downAmount,
        timingAr: "فور التعاقد المبدئي",
        notes: "دفعة أولى لتأكيد حجز الوحدة وتجميد سعرها.",
      },
      {
        stageNameAr: "دفعة التعاقد الرسمية",
        percent: contractPercent,
        amountEgp: contractAmount,
        timingAr: "بعد 3 أشهر من الحجز",
        notes: "توقيع العقود الابتدائية الرسمية والملكية.",
      },
      {
        stageNameAr: `أقساط متساوية (${totalQuarters} قسط ربع سنوي)`,
        percent: 100 - (downPaymentPercent + contractPercent + deliveryPercent),
        amountEgp: remainingForInstallments,
        timingAr: `كل 3 أشهر على مدار ${years} سنوات (${quarterlyAmount.toLocaleString("ar-EG")} ج.م / ربع سنوي)`,
        notes: `ما يعادل شهرياً: ${monthlyEquivalent.toLocaleString("ar-EG")} ج.م بدون فوائد بنكية.`,
      },
      {
        stageNameAr: "دفعة الاستلام والمفتاح",
        percent: deliveryPercent,
        amountEgp: deliveryAmount,
        timingAr: "عند استلام الوحدة والمطابقة",
        notes: "استلام الوحدة بعد فحص الجودة الإنشائية.",
      },
      {
        stageNameAr: "وديعة الصيانة الدورية",
        percent: maintPercent,
        amountEgp: maintenanceAmount,
        timingAr: "قبل الاستلام بـ 6 أشهر",
        notes: "صندوق استثماري دائم لضمان صيانة المرافق واللاندسكيب.",
      },
    ];

    return {
      milestones,
      downAmount,
      contractAmount,
      deliveryAmount,
      maintenanceAmount,
      quarterlyAmount,
      monthlyEquivalent,
      totalInstallmentPrice: price,
      cashPrice,
      cashDiscountPercent,
      years,
      totalQuarters,
    };
  }
}

export const smartFeaturesStore = new SmartFeaturesStore();
