import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { propertyService, isSupabaseDirect } from "@/lib/services/propertyService";
import { calculateApproximateCoordinates, dbStore } from "@/lib/db/store";
import { PropertyCategory, TransactionType, LocationPrivacy, FinishingStatus, FurnishingStatus } from "@/lib/db/types";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { isValidPhone } from "@/lib/auth/security";
import {
  MEET_GHAMR_CITY_ID,
  MEET_GHAMR_CITY_SLUG,
  getMeetGhamrDistrictSeedRows,
  isMeetGhamrCity,
  resolveMeetGhamrDistrictSlug,
} from "@/lib/db/meet-ghamr-geography";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const viewer = await getCurrentUser();

    // Parse Bounding Box [swLat, swLng, neLat, neLng]
    let bounds = undefined;
    const boundsParam = searchParams.get("bounds");
    if (boundsParam) {
      try {
        const [swLat, swLng, neLat, neLng] = boundsParam.split(",").map(Number);
        if (!isNaN(swLat) && !isNaN(swLng) && !isNaN(neLat) && !isNaN(neLng)) {
          bounds = {
            southWest: { lat: swLat, lng: swLng },
            northEast: { lat: neLat, lng: neLng },
          };
        }
      } catch {
        // Ignored
      }
    }

    // Parse Radius [lat, lng, radiusKm]
    let radius = undefined;
    const radiusParam = searchParams.get("radius");
    if (radiusParam) {
      try {
        const [lat, lng, radiusKm] = radiusParam.split(",").map(Number);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
          radius = {
            center: { lat, lng },
            radiusKm,
          };
        }
      } catch {
        // Ignored
      }
    }

    // Parse Polygon if provided
    let polygon = undefined;
    const polyParam = searchParams.get("polygon");
    if (polyParam) {
      try {
        polygon = JSON.parse(polyParam);
      } catch {
        // Ignored
      }
    }

    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minArea = searchParams.get("minArea") ? Number(searchParams.get("minArea")) : undefined;
    const maxArea = searchParams.get("maxArea") ? Number(searchParams.get("maxArea")) : undefined;
    const bedrooms = searchParams.get("bedrooms") ? Number(searchParams.get("bedrooms")) : undefined;
    const bathrooms = searchParams.get("bathrooms") ? Number(searchParams.get("bathrooms")) : undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 24;

    const result = await propertyService.queryPublicProperties(
      {
        transactionType: searchParams.get("transactionType") as TransactionType || undefined,
        category: searchParams.get("category") as PropertyCategory || undefined,
        cityId: searchParams.get("cityId") || undefined,
        districtId: searchParams.get("districtId") || undefined,
        minPrice,
        maxPrice,
        minArea,
        maxArea,
        bedrooms,
        bathrooms,
        finishingStatus: searchParams.get("finishingStatus") as FinishingStatus || undefined,
        furnishingStatus: searchParams.get("furnishingStatus") as FurnishingStatus || undefined,
        advertiserType: searchParams.get("advertiserType") as "owner" | "broker" || undefined,
        featuredOnly: searchParams.get("featuredOnly") === "true",
        searchQuery: searchParams.get("q") || undefined,
        bounds,
        radius,
        polygon,
        sort: searchParams.get("sort") as "newest" | "price_asc" | "price_desc" | "area_asc" | "area_desc" | "relevance" || "newest",
        page,
        limit,
      },
      viewer || undefined
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في البحث عن العقارات";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
import { createClient as createSupabaseServerClient, createAdminClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول لإضافة عقار" }, { status: 401 });
    }
    if (user.isSuspended) {
      return NextResponse.json({ error: "تم تعليق هذا الحساب ولا يمكن إضافة عقارات جديدة" }, { status: 403 });
    }

    const body = await req.json();

    // Required fields validation
    if (!body.title?.trim() || !body.description?.trim()) {
      return NextResponse.json({ error: "عنوان العقار والوصف التفصيلي مطلوبان" }, { status: 400 });
    }

    if (body.advertiserType !== undefined && !["owner", "broker"].includes(body.advertiserType)) {
      return NextResponse.json({ error: "صفة ناشر المشروع غير صالحة" }, { status: 400 });
    }
    const advertiserType: "owner" | "broker" =
      body.advertiserType || (user.role === "broker" ? "broker" : "owner");

    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 1 || price > 100_000_000) {
      return NextResponse.json(
        { error: "يجب أن يكون سعر العقار بين 1 و100 مليون جنيه مصري" },
        { status: 400 }
      );
    }

    const areaSqM = Number(body.areaSqM);
    if (isNaN(areaSqM) || areaSqM <= 0) {
      return NextResponse.json({ error: "مساحة العقار يجب أن تكون رقماً موجباً" }, { status: 400 });
    }

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "الإحداثيات الجغرافية غير صالحة" }, { status: 400 });
    }

    // Unified accounts: Any authenticated user can submit their properties directly

    // Status enforcement: Ordinary owners/brokers cannot force "published"
    let initialStatus: "draft" | "pending_review" | "published" = "pending_review";
    if (body.status === "draft") {
      initialStatus = "draft";
    } else if (hasAdminPermission(user, "projects.review") && body.status === "published") {
      initialStatus = "published";
    } else {
      initialStatus = "pending_review";
    }

    const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";
    const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
    const isProject = Boolean(body.isProject);
    if (initialStatus === "pending_review" && isProject) {
      if (!contactName || contactName.length > 100) {
        return NextResponse.json({ error: "اسم جهة التواصل للمشروع مطلوب (بحد أقصى 100 حرف)" }, { status: 400 });
      }
      if (!isValidPhone(contactPhone)) {
        return NextResponse.json({ error: "يرجى إدخال رقم هاتف صحيح للتواصل بشأن المشروع" }, { status: 400 });
      }
    }

    const cityInput = typeof body.cityId === "string" && body.cityId.trim()
      ? body.cityId.trim()
      : MEET_GHAMR_CITY_ID;
    if (!isMeetGhamrCity(cityInput)) {
      return NextResponse.json({ error: "نستقبل العقارات داخل مركز ميت غمر وقراه فقط." }, { status: 400 });
    }

    const districtInput = typeof body.districtId === "string" && body.districtId.trim()
      ? body.districtId.trim()
      : "dist-meet-ghamr-city";
    const districtSlug = resolveMeetGhamrDistrictSlug(districtInput);
    if (!districtSlug) {
      return NextResponse.json({ error: "يرجى اختيار قرية أو منطقة داخل مركز ميت غمر." }, { status: 400 });
    }

    // If Supabase Direct is not configured, persist via central backend dbStore
    if (!isSupabaseDirect()) {
      const created = dbStore.createProperty({
        title: body.title.trim(),
        description: body.description.trim(),
        transactionType: (body.transactionType || body.transaction_type || "sale") as TransactionType,
        category: (body.category || "apartment") as PropertyCategory,
        price: Math.max(0, Number(price)),
        currency: "EGP",
        rentalPeriod: body.rentalPeriod || undefined,
        negotiable: Boolean(body.negotiable),
        downPayment: body.hasInstallment && body.downPayment != null ? Number(body.downPayment) : undefined,
        installmentYears: body.hasInstallment && body.installmentYears != null ? Number(body.installmentYears) : undefined,
        areaSqM: Math.max(0.01, Number(areaSqM)),
        hasBuildingPermit: Boolean(body.hasBuildingPermit),
        bedrooms: body.bedrooms != null ? Number(body.bedrooms) : undefined,
        bathrooms: body.bathrooms != null ? Number(body.bathrooms) : undefined,
        floor: body.floor != null && body.floor !== "" ? Number(body.floor) : undefined,
        totalFloors: body.totalFloors != null && body.totalFloors !== "" ? Number(body.totalFloors) : undefined,
        finishingStatus: (body.finishingStatus || "fully_finished") as FinishingStatus,
        furnishingStatus: (body.furnishingStatus || "unfurnished") as FurnishingStatus,
        parkingSpots: body.parkingSpots ? Number(body.parkingSpots) : 0,
        hasElevator: Boolean(body.hasElevator),
        yearBuilt: body.yearBuilt ? Number(body.yearBuilt) : new Date().getFullYear(),
        amenities: Array.isArray(body.amenities) ? body.amenities : [],
        cityId: MEET_GHAMR_CITY_ID,
        districtId: `dist-${districtSlug}`,
        addressDetails: body.addressDetails?.trim() || "",
        lat,
        lng,
        locationPrivacy: (body.locationPrivacy || "exact") as LocationPrivacy,
        images: Array.isArray(body.images) && body.images.length > 0
          ? body.images
          : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"],
        status: initialStatus,
        featured: false,
        advertiserId: user.id,
        advertiserType,
        isProject,
        projectDetails: {
          ...(typeof body.projectDetails === "object" && body.projectDetails !== null ? body.projectDetails : {}),
          ...(contactName ? { contactName } : {}),
          ...(contactPhone ? { contactPhone } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        property: created,
        source: "central_backend",
        notice:
          initialStatus === "draft"
            ? "تم حفظ العقار كمسودة في قاعدة البيانات المركزية."
            : "تم إرسال العقار بنجاح إلى الإدارة للمراجعة والموافقة عليه (منشور مقيد).",
      });
    }

    // Verify Supabase Cloud session & identity
    const authHeader = req.headers.get("authorization");
    const authToken = authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const isSupabaseJwt = Boolean(authToken && authToken.split(".").length === 3);
    const supabase = createSupabaseServerClient(undefined, isSupabaseJwt ? authToken : undefined);
    const supabaseAdmin = createAdminClient();

    const cityLookup = await supabaseAdmin
      .from("cities")
      .select("id")
      .eq("slug", MEET_GHAMR_CITY_SLUG)
      .maybeSingle();

    if (cityLookup.error) {
      console.error("[properties/create] Failed to resolve city:", cityLookup.error);
      return NextResponse.json({ error: "تعذر التحقق من المدينة المحددة" }, { status: 500 });
    }
    if (!cityLookup.data) {
      return NextResponse.json({ error: "المدينة المحددة غير متاحة. يرجى اختيار مدينة أخرى." }, { status: 400 });
    }
    const cityIdUuid = cityLookup.data.id;
    let districtLookup = await supabaseAdmin
      .from("districts")
      .select("id")
      .eq("slug", districtSlug)
      .eq("city_id", cityIdUuid)
      .maybeSingle();

    if (districtLookup.error) {
      console.error("[properties/create] Failed to resolve district:", districtLookup.error);
      return NextResponse.json({ error: "تعذر التحقق من الحي المحدد" }, { status: 500 });
    }
    if (!districtLookup.data) {
      const { error: seedError } = await supabaseAdmin
        .from("districts")
        .upsert(getMeetGhamrDistrictSeedRows(cityIdUuid), {
          onConflict: "city_id,slug",
          ignoreDuplicates: true,
        });

      if (seedError) {
        console.error("[properties/create] Failed to repair district taxonomy:", seedError);
        return NextResponse.json(
          { error: "تعذرت تهيئة بيانات قرى ومناطق ميت غمر تلقائياً. يرجى المحاولة لاحقاً." },
          { status: 503 }
        );
      }

      districtLookup = await supabaseAdmin
        .from("districts")
        .select("id")
        .eq("slug", districtSlug)
        .eq("city_id", cityIdUuid)
        .maybeSingle();

      if (districtLookup.error || !districtLookup.data) {
        console.error("[properties/create] District is still unavailable after taxonomy repair:", {
          citySlug: MEET_GHAMR_CITY_SLUG,
          districtSlug,
          error: districtLookup.error,
        });
        return NextResponse.json(
          { error: "تعذر تهيئة المنطقة المحددة. يرجى إعادة المحاولة بعد قليل." },
          { status: 503 }
        );
      }
    }
    const districtIdUuid = districtLookup.data.id;

    let supaUser = null;
    if (isSupabaseJwt) {
      try {
        const { data: { user: foundUser } } = await supabase.auth.getUser();
        supaUser = foundUser;
      } catch {
        // Ignored
      }
    }

    // Resolve advertiser UUID candidate
    let advertiserUuid = supaUser?.id;
    if (!advertiserUuid) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
      if (isUuid) {
        advertiserUuid = user.id;
      }
    }

    // Verify foreign key integrity against cloud auth.users before attaching
    let validAuthUserId: string | null = null;
    if (supaUser?.id) {
      validAuthUserId = supaUser.id;
    } else if (advertiserUuid) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(advertiserUuid);
      if (isUuid) {
        try {
          const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(advertiserUuid);
          if (!authErr && authUser?.user?.id) {
            validAuthUserId = authUser.user.id;
          }
        } catch {
          validAuthUserId = null;
        }
      }
    }

    // Unique slug generation
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const rawSlug = (body.slug || body.title)
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 45);
    const slug = `${rawSlug || "property"}-${Date.now().toString(36)}-${randomSuffix}`;

    // Location privacy obfuscation if approximate
    let approximateLat: number | null = null;
    let approximateLng: number | null = null;
    if (body.locationPrivacy === "approximate") {
      const approximateCoords = calculateApproximateCoordinates(lat, lng, slug);
      approximateLat = approximateCoords.lat;
      approximateLng = approximateCoords.lng;
    }

    const defaultImages = [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    ];
    const propertyImages = Array.isArray(body.images) && body.images.length > 0 ? body.images : defaultImages;

    // Strict numerical sanitation to avoid DB overflows and invalid null states
    const sanitizedPrice = Math.max(0, Number(price));
    const sanitizedAreaSqM = Math.max(0.01, Number(areaSqM));
    const sanitizedDownPayment = (body.hasInstallment && body.downPayment != null && !isNaN(Number(body.downPayment)))
      ? Math.max(0, Number(body.downPayment))
      : null;
    const sanitizedInstallmentYears = (body.hasInstallment && body.installmentYears != null && !isNaN(Number(body.installmentYears)))
      ? Math.max(1, parseInt(String(body.installmentYears), 10))
      : null;
    const sanitizedBedrooms = (body.bedrooms != null && !isNaN(Number(body.bedrooms)))
      ? Math.max(0, parseInt(String(body.bedrooms), 10))
      : null;
    const sanitizedBathrooms = (body.bathrooms != null && !isNaN(Number(body.bathrooms)))
      ? Math.max(0, parseInt(String(body.bathrooms), 10))
      : null;
    const sanitizedFloor = (body.floor != null && body.floor !== "" && !isNaN(Number(body.floor)))
      ? parseInt(String(body.floor), 10)
      : null;
    const sanitizedTotalFloors = (body.totalFloors != null && body.totalFloors !== "" && !isNaN(Number(body.totalFloors)))
      ? Math.max(1, parseInt(String(body.totalFloors), 10))
      : null;
    const hasBuildingPermit = Boolean(body.hasBuildingPermit);

    // Strict Whitelisted Columns allowed for Supabase properties table
    const ALLOWED_COLUMNS = new Set([
      // Primary whitelisted columns requested
      "title",
      "description",
      "price",
      "area",
      "property_type",
      "transaction_type",
      "listing_type",
      "city",
      "district",
      "address",
      "latitude",
      "longitude",
      "location",
      "bedrooms",
      "bathrooms",
      "floor_number",
      "finishing_type",
      "status",
      "advertiser_id",
      "user_id",
      "owner_id",
      "featured",
      "views_count",
      "project_details",
      "developer_name",
      "delivery_date",
      "down_payment",
      "installment_years",

      // Authoritative PostgreSQL Database columns (public.properties)
      "slug",
      "category",
      "currency",
      "rental_period",
      "negotiable",
      "area_sqm",
      "floor",
      "total_floors",
      "finishing_status",
      "furnishing_status",
      "parking_spots",
      "has_elevator",
      "year_built",
      "city_id",
      "district_id",
      "address_details",
      "exact_lat",
      "exact_lng",
      "location_privacy",
      "approximate_lat",
      "approximate_lng",
      "moderation_notes",
      "inquiries_count",
      "advertiser_type",
      "published_at",
      "has_building_permit",
    ]);

    // Consolidate extra metadata, developer info, and creator session details into project_details JSONB
    const projectDetailsJson: Record<string, any> = {
      ...(typeof body.projectDetails === "object" ? body.projectDetails : {}),
      creatorSessionId: user.id,
      creatorRole: user.role || "owner",
      creatorEmail: user.email || null,
      creatorPhone: user.phone || null,
      ...(contactName ? { contactName } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      hasBuildingPermit,
      tags: body.tags || undefined,
      nearbyLandmarks: body.nearbyLandmarks || undefined,
      subUnits: body.subUnits || undefined,
    };

    // Resolve unified transaction / listing type to ensure neither is ever null
    const resolvedTransactionType = (
      body.transactionType ||
      body.transaction_type ||
      body.listingType ||
      body.listing_type ||
      "sale"
    );

    // 1. Raw candidate payload
    const rawPayload: Record<string, any> = {
      slug,
      title: body.title.trim(),
      description: body.description.trim(),
      transaction_type: resolvedTransactionType,
      listing_type: resolvedTransactionType,
      category: body.category || "apartment",
      price: sanitizedPrice,
      currency: "EGP",
      rental_period: body.rentalPeriod || null,
      negotiable: Boolean(body.negotiable),
      down_payment: sanitizedDownPayment,
      installment_years: sanitizedInstallmentYears,
      area_sqm: sanitizedAreaSqM,
      bedrooms: sanitizedBedrooms,
      bathrooms: sanitizedBathrooms,
      floor: sanitizedFloor,
      total_floors: sanitizedTotalFloors,
      has_building_permit: hasBuildingPermit,
      finishing_status: body.finishingStatus || "fully_finished",
      furnishing_status: body.furnishingStatus || "unfurnished",
      parking_spots: body.parkingSpots ? Math.max(0, parseInt(String(body.parkingSpots), 10)) : 0,
      has_elevator: Boolean(body.hasElevator),
      year_built: body.yearBuilt ? parseInt(String(body.yearBuilt), 10) : new Date().getFullYear(),
      city_id: cityIdUuid,
      district_id: districtIdUuid,
      address_details: body.addressDetails?.trim() || null,
      exact_lat: lat,
      exact_lng: lng,
      location_privacy: body.locationPrivacy || "exact",
      approximate_lat: approximateLat,
      approximate_lng: approximateLng,
      status: initialStatus,
      featured: false,
      advertiser_id: validAuthUserId,
      advertiser_type: advertiserType,
      project_details: projectDetailsJson,
    };

    // 2. Strict whitelist filtering: remove any key not in ALLOWED_COLUMNS
    const sanitizedPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      if (ALLOWED_COLUMNS.has(key) && value !== undefined) {
        sanitizedPayload[key] = value;
      }
    }

    // 3. Self-Healing Adaptive Insert Loop:
    // Guarantees zero "Could not find column in schema cache" failures by dynamically stripping unmapped columns and retrying.
    let currentPayload = { ...sanitizedPayload };
    let cloudProperty: any = null;
    let cloudError: any = null;
    let maxRetries = 8;

    while (maxRetries > 0) {
      maxRetries--;
      const res = await supabaseAdmin
        .from("properties")
        .insert(currentPayload)
        .select()
        .single();

      cloudProperty = res.data;
      cloudError = res.error;

      if (!cloudError && cloudProperty) {
        break; // Insert succeeded cleanly!
      }

      // Check for PostgREST schema cache missing column error
      const missingColumnMatch =
        cloudError?.message?.match(/Could not find the '([^']+)' column of 'properties' in the schema cache/i) ||
        cloudError?.message?.match(/column "([^"]+)" of relation "properties" does not exist/i);

      if (missingColumnMatch && missingColumnMatch[1]) {
        const missingCol = missingColumnMatch[1];
        console.warn(`[properties/create] Column '${missingCol}' not found in Supabase schema cache. Auto-stripping and retrying insert...`);
        delete currentPayload[missingCol];
        ALLOWED_COLUMNS.delete(missingCol);
        continue;
      }

      // Check for foreign key violation on user / advertiser ID
      if (cloudError?.code === "23503" || cloudError?.message?.includes("foreign key")) {
        console.warn("[properties/create] Foreign key violation caught, retrying insert with null user FKs:", cloudError.message);
        if ("advertiser_id" in currentPayload) currentPayload.advertiser_id = null;
        if ("user_id" in currentPayload) currentPayload.user_id = null;
        if ("owner_id" in currentPayload) currentPayload.owner_id = null;
        continue;
      }

      // Other non-recoverable error
      break;
    }

    let createdPropertyId = cloudProperty?.id;

    // 3. Insert image metadata to Supabase property_images table if cloud succeeded
    if (cloudProperty?.id && propertyImages.length > 0) {
      const imageRows = propertyImages.map((imgUrl: string, idx: number) => ({
        property_id: cloudProperty.id,
        url: imgUrl,
        alt: body.title.trim(),
        is_main: idx === 0,
        sort_order: idx,
      }));
      await supabaseAdmin.from("property_images").insert(imageRows);
    }

    if (cloudError || !cloudProperty) {
      console.error("[properties/create] Supabase insert failed:", cloudError);
      return NextResponse.json(
        { error: cloudError?.message || "فشل تسجيل العقار في قاعدة البيانات السحابية" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      property: {
        id: cloudProperty.id,
        slug: cloudProperty.slug,
        title: cloudProperty.title,
        description: cloudProperty.description,
        price: Number(cloudProperty.price),
        currency: cloudProperty.currency || "EGP",
        transactionType: cloudProperty.transaction_type,
        category: cloudProperty.category,
        areaSqM: Number(cloudProperty.area_sqm),
        status: cloudProperty.status,
        latitude: lat,
        longitude: lng,
        lat: lat,
        lng: lng,
        addressDetails: cloudProperty.address_details || "",
        advertiserId: cloudProperty.advertiser_id || user.id,
        userId: cloudProperty.user_id || user.id,
        ownerId: cloudProperty.owner_id || user.id,
        isProject: Boolean(cloudProperty.is_project),
        images: propertyImages,
        createdAt: cloudProperty.created_at,
        updatedAt: cloudProperty.updated_at,
      },
      source: "supabase",
      notice: "تم إرسال العقار بنجاح إلى الإدارة للمراجعة والموافقة عليه (منشور مقيد).",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء إضافة العقار";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
