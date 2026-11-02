import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/utils/supabase/server";
import {
  fetchAllRows,
  getRatingGroupKey,
  mapRatingsConfig,
  UUID_PATTERN,
} from "@/lib/ratings/reputation";

export const dynamic = "force-dynamic";

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function appendAudit(
  client: ReturnType<typeof createAdminClient>,
  userId: string,
  action: string,
  entityId: string,
  details: Record<string, unknown>
) {
  return client.from("audit_events").insert({
    user_id: UUID_PATTERN.test(userId) ? userId : null,
    action,
    entity_type: "ratings",
    entity_id: entityId,
    details,
  });
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const client = createAdminClient();
    const { data: configRow, error: configError } = await client
      .from("ratings_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (configError) throw new Error(`تعذر تحميل إعدادات التقييمات: ${configError.message}`);
    const config = mapRatingsConfig(configRow);
    const { searchParams } = new URL(req.url);
    const cityId = searchParams.get("cityId");
    const districtId = searchParams.get("districtId");
    const category = searchParams.get("category");
    const requiresDistrict = config.rankingScope === "district_category";
    const requiresCity = config.rankingScope === "city_category";

    if (
      (requiresDistrict && (!districtId || !category)) ||
      (requiresCity && (!cityId || !category))
    ) {
      return NextResponse.json({
        success: true,
        config,
        requiresFilters: true,
        sellers: [],
        projects: [],
        eligibleReviews: [],
        reviews: [],
      });
    }

    let sellerQuery = client
      .from("seller_reviews")
      .select("id,seller_id,seller_name,reviewer_name,rating,comment,created_at,properties!inner(city_id,district_id,category,status,title,slug)")
      .eq("status", "published")
      .eq("properties.status", "published");
    if (requiresDistrict && districtId && category) {
      sellerQuery = sellerQuery.eq("properties.district_id", districtId).eq("properties.category", category);
    } else if (requiresCity && cityId && category) {
      sellerQuery = sellerQuery.eq("properties.city_id", cityId).eq("properties.category", category);
    }
    const sellerReviewRows = config.sellerRatingsEnabled
      ? await fetchAllRows((start, end) => sellerQuery.range(start, end))
      : [];

    const sellerGroups = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        cityId: string | null;
        districtId: string | null;
        category: string | null;
        ratings: number[];
        updatedAt: string;
      }
    >();
    for (const row of sellerReviewRows as Array<Record<string, any>>) {
      const property = relation(row.properties);
      const sellerId = String(row.seller_id || "");
      if (!property || !sellerId) continue;
      const key = getRatingGroupKey(
        sellerId,
        property.city_id ?? null,
        property.district_id ?? null,
        property.category ?? null,
        config.rankingScope
      );
      const existingGroup = sellerGroups.get(key);
      if (existingGroup) {
        existingGroup.ratings.push(Number(row.rating));
        if (String(row.created_at || "") > existingGroup.updatedAt) {
          existingGroup.updatedAt = String(row.created_at);
        }
      } else {
        sellerGroups.set(key, {
          sellerId,
          sellerName: String(row.seller_name || "بائع"),
          cityId: property.city_id ?? null,
          districtId: property.district_id ?? null,
          category: property.category ?? null,
          ratings: [Number(row.rating)],
          updatedAt: String(row.created_at || ""),
        });
      }
    }

    const reviews = (sellerReviewRows as Array<Record<string, any>>)
      .map((row) => {
        const property = relation(row.properties);
        return property
          ? {
              id: String(row.id),
              sellerId: String(row.seller_id),
              sellerName: String(row.seller_name || "بائع"),
              reviewerName: String(row.reviewer_name || "عميل"),
              rating: Number(row.rating),
              comment: String(row.comment || ""),
              createdAt: String(row.created_at || ""),
              propertyTitle: String(property.title || "عقار"),
              propertySlug: String(property.slug || ""),
            }
          : null;
      })
      .filter((review): review is NonNullable<typeof review> => review !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30);

    let sellers = Array.from(sellerGroups.values())
      .map((group) => ({
        id: group.sellerId,
        name: group.sellerName,
        ratingAverage:
          group.ratings.reduce((sum, rating) => sum + rating, 0) / group.ratings.length,
        reviewCount: group.ratings.length,
        cityId: group.cityId,
        districtId: group.districtId,
        category: group.category,
        updatedAt: group.updatedAt,
      }))
      .filter(
        (seller) =>
          seller.reviewCount >= config.sellerMinReviews &&
          seller.ratingAverage >= config.sellerMinRating
      );

    sellers.sort(
      (a, b) =>
        b.ratingAverage - a.ratingAverage ||
        b.reviewCount - a.reviewCount ||
        a.name.localeCompare(b.name, "ar")
    );

    const projects: Array<Record<string, unknown>> = [];
    const cutoff = new Date(Date.now() - config.projectWindowDays * 24 * 60 * 60 * 1000).toISOString();
    let favoritesQuery = client
      .from("favorites")
      .select("user_id,property_id,properties!inner(id,title,slug,city_id,district_id,category,status,is_project)")
      .gte("created_at", cutoff)
      .eq("properties.status", "published")
      .eq("properties.is_project", true);
    if (requiresDistrict && districtId && category) {
      favoritesQuery = favoritesQuery
        .eq("properties.district_id", districtId)
        .eq("properties.category", category);
    } else if (requiresCity && cityId && category) {
      favoritesQuery = favoritesQuery
        .eq("properties.city_id", cityId)
        .eq("properties.category", category);
    }
    const favoriteRows = await fetchAllRows((start, end) => favoritesQuery.range(start, end));
    const projectGroups = new Map<
      string,
      { property: Record<string, any>; userIds: Set<string> }
    >();
    for (const row of favoriteRows as Array<Record<string, any>>) {
      const property = relation(row.properties);
      const propertyId = String(row.property_id || property?.id || "");
      const userId = String(row.user_id || "");
      if (!property || !propertyId || !userId) continue;
      const group = projectGroups.get(propertyId) ?? { property, userIds: new Set<string>() };
      group.userIds.add(userId);
      projectGroups.set(propertyId, group);
    }

    for (const [id, group] of Array.from(projectGroups.entries())) {
      if (group.userIds.size >= config.projectMinFavorites) {
        projects.push({
          id,
          title: String(group.property.title || "مشروع عقاري"),
          slug: String(group.property.slug || id),
          favoritesCount: group.userIds.size,
          cityId: group.property.city_id ?? null,
          districtId: group.property.district_id ?? null,
          category: group.property.category ?? null,
        });
      }
    }

    projects.sort(
      (a, b) =>
        Number(b.favoritesCount) - Number(a.favoritesCount) ||
        String(a.title).localeCompare(String(b.title), "ar")
    );

    let eligibleReviews: Array<Record<string, unknown>> = [];
    if (user && UUID_PATTERN.test(user.id) && config.sellerRatingsEnabled) {
      const { data: inquiries, error: inquiryError } = await client
        .from("inquiries")
        .select("id,property_id,advertiser_id,status,properties!inner(title,slug,advertiser_id)")
        .eq("seeker_id", user.id)
        .neq("status", "spam")
        .order("created_at", { ascending: false })
        .limit(100);
      if (inquiryError) throw new Error(`تعذر تحميل المحادثات المؤهلة للتقييم: ${inquiryError.message}`);
      const inquiryRows = (inquiries ?? []) as Array<Record<string, any>>;
      const candidates = inquiryRows
        .map((inquiry) => {
          const property = relation(inquiry.properties);
          const sellerId = String(property?.advertiser_id || "");
          return { inquiry, property, sellerId };
        })
        .filter(
          (candidate) =>
            candidate.property &&
            candidate.sellerId &&
            UUID_PATTERN.test(candidate.sellerId) &&
            candidate.sellerId !== user.id
        );
      const inquiryIds = candidates.map((candidate) => String(candidate.inquiry.id));
      const sellerIds = Array.from(new Set(candidates.map((candidate) => candidate.sellerId)));
      if (inquiryIds.length > 0) {
        const [{ data: messages, error: messagesError }, existingReviews] =
          await Promise.all([
            client
              .from("inquiry_messages")
              .select("inquiry_id,sender_id")
              .in("inquiry_id", inquiryIds)
              .in("sender_id", sellerIds)
              .eq("is_admin_note", false),
            fetchAllRows((start, end) =>
              client
                .from("seller_reviews")
                .select("inquiry_id,seller_id")
                .eq("reviewer_id", user.id)
                .range(start, end)
            ),
          ]);
        if (messagesError) throw new Error(`تعذر التحقق من رد البائع: ${messagesError.message}`);
        const repliedInquiryIds = new Set((messages ?? []).map((message) => message.inquiry_id));
        const reviewedInquiryIds = new Set(existingReviews.map((review) => review.inquiry_id));
        const reviewedSellerIds = new Set(existingReviews.map((review) => review.seller_id));
        const eligibleSellerIds = new Set<string>();
        eligibleReviews = candidates
          .filter(
            ({ inquiry, sellerId }) =>
              repliedInquiryIds.has(inquiry.id) &&
              !reviewedInquiryIds.has(inquiry.id) &&
              !reviewedSellerIds.has(sellerId)
          )
          .filter(({ sellerId }) => {
            if (eligibleSellerIds.has(sellerId)) return false;
            eligibleSellerIds.add(sellerId);
            return true;
          })
          .map(({ inquiry, property, sellerId }) => ({
            inquiryId: inquiry.id,
            sellerId,
            sellerName: sellerId === user.id ? user.name : undefined,
            propertyTitle: String(property.title || "العقار"),
            propertySlug: String(property.slug || inquiry.property_id),
          }));
        if (eligibleReviews.length > 0) {
          const { data: profiles, error: profileError } = await client
            .from("profiles")
            .select("id,name")
            .in("id", sellerIds);
          if (profileError) throw new Error(`تعذر تحميل أسماء البائعين: ${profileError.message}`);
          const sellerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.name]));
          eligibleReviews = eligibleReviews.map((review) => ({
            ...review,
            sellerName: sellerNames.get(String(review.sellerId)) || "البائع",
          }));
        }
      }
    }

    return NextResponse.json({
      success: true,
      config,
      requiresFilters: false,
      sellers: sellers.slice(0, 50),
      projects: projects.slice(0, 50),
      eligibleReviews,
      reviews,
    });
  } catch (error) {
    console.error("[ratings] Failed to load ratings:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر تحميل التقييمات" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "سجّل الدخول لإضافة تقييم" }, { status: 401 });
    }
    if (!UUID_PATTERN.test(user.id)) {
      return NextResponse.json({ success: false, error: "تعذر ربط الحساب بقاعدة البيانات" }, { status: 403 });
    }

    const body = await req.json();
    const inquiryId = typeof body.inquiryId === "string" ? body.inquiryId : "";
    const rating = Number(body.rating);
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    if (
      !UUID_PATTERN.test(inquiryId) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      comment.length < 3 ||
      comment.length > 1200
    ) {
      return NextResponse.json({ success: false, error: "بيانات التقييم غير صالحة" }, { status: 400 });
    }

    const client = createAdminClient();
    const { data: configRow, error: configError } = await client
      .from("ratings_config")
      .select("seller_ratings_enabled")
      .limit(1)
      .maybeSingle();
    if (configError) throw new Error(`تعذر تحميل إعدادات التقييم: ${configError.message}`);
    if (!configRow?.seller_ratings_enabled) {
      return NextResponse.json({ success: false, error: "التقييمات متوقفة مؤقتًا" }, { status: 403 });
    }

    const { data: inquiry, error: inquiryError } = await client
      .from("inquiries")
      .select("id,property_id,seeker_id,advertiser_id,status,properties!inner(title,advertiser_id)")
      .eq("id", inquiryId)
      .maybeSingle();
    if (inquiryError) throw new Error(`تعذر التحقق من المحادثة: ${inquiryError.message}`);
    const property = relation(inquiry?.properties);
    const sellerId = String(property?.advertiser_id || "");
    if (
      !inquiry ||
      inquiry.seeker_id !== user.id ||
      inquiry.status === "spam" ||
      !property ||
      !UUID_PATTERN.test(sellerId)
    ) {
      return NextResponse.json({ success: false, error: "لا توجد محادثة مؤهلة لهذا التقييم" }, { status: 403 });
    }
    if (sellerId === user.id) {
      return NextResponse.json({ success: false, error: "لا يمكن تقييم حسابك" }, { status: 403 });
    }

    const { data: sellerResponse, error: responseError } = await client
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("sender_id", sellerId)
      .eq("is_admin_note", false)
      .limit(1)
      .maybeSingle();
    if (responseError) throw new Error(`تعذر التحقق من رد البائع: ${responseError.message}`);
    if (!sellerResponse) {
      return NextResponse.json(
        { success: false, error: "يمكنك التقييم بعد أن يرد البائع عبر محادثة المنصة" },
        { status: 403 }
      );
    }

    const [{ data: sellerProfile, error: sellerError }, { data: reviewerProfile, error: reviewerError }] =
      await Promise.all([
        client.from("profiles").select("name").eq("id", sellerId).maybeSingle(),
        client.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      ]);
    if (sellerError || reviewerError) {
      throw new Error(`تعذر التحقق من أسماء أطراف التقييم: ${sellerError?.message || reviewerError?.message}`);
    }

    const { data: review, error: insertError } = await client
      .from("seller_reviews")
      .insert({
        inquiry_id: inquiryId,
        property_id: inquiry.property_id,
        seller_id: sellerId,
        reviewer_id: user.id,
        seller_name: sellerProfile?.name || "البائع",
        reviewer_name: reviewerProfile?.name || user.name || "عميل",
        rating,
        comment,
        verified_communication: true,
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { success: false, error: "سبق لك تقييم هذا البائع" },
          { status: 409 }
        );
      }
      throw new Error(`تعذر حفظ التقييم: ${insertError.message}`);
    }

    const auditResult = await appendAudit(client, user.id, "SELLER_REVIEW_CREATED", String(review.id), {
      sellerId,
      propertyId: inquiry.property_id,
      rating,
    });
    if (auditResult.error) {
      console.error("[ratings] Could not record review audit event:", auditResult.error.message);
    }
    return NextResponse.json({ success: true, message: "تم إرسال تقييمك بنجاح" }, { status: 201 });
  } catch (error) {
    console.error("[ratings] Failed to submit seller review:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "تعذر حفظ التقييم" },
      { status: 500 }
    );
  }
}
