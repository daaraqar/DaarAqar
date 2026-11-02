import { dbStore } from "../db/store";
import { Inquiry } from "../db/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCentralDbEnabled(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
      !/placeholder|your[-_]/i.test(url) &&
      serviceRoleKey &&
      !/placeholder|your[-_]/i.test(serviceRoleKey)
  );
}

async function getSupabaseServerModule() {
  return await import("@/utils/supabase/server");
}

function enrichLocalInquiry(local: Inquiry): Inquiry {
  if (!local.propertySlug || !local.propertyImage || !local.propertyPrice) {
    const p =
      dbStore.getRawPropertyById(local.propertyId) ||
      dbStore.getPropertyByIdOrSlug(local.propertyId);
    if (p) {
      local.propertySlug = local.propertySlug || p.slug;
      local.propertyPrice = local.propertyPrice || p.price;
      local.propertyImage =
        local.propertyImage ||
        (Array.isArray(p.images) ? p.images[0] : undefined);
    }
  }
  if ((!local.advertiserName || !local.advertiserPhone) && local.advertiserId) {
    const adv = dbStore.findUserById(local.advertiserId);
    if (adv) {
      local.advertiserName =
        local.advertiserName || adv.companyName || adv.name;
      local.advertiserPhone = local.advertiserPhone || adv.phone;
    }
  }
  return local;
}

export async function resolveInquiry(id: string): Promise<Inquiry | null> {
  if (!id || typeof id !== "string" || !id.trim()) {
    return null;
  }

  const cleanId = id.trim();
  const isProd = process.env.NODE_ENV === "production";
  const hasCentralDb = isCentralDbEnabled();
  const isUuid = UUID_REGEX.test(cleanId);

  if (isProd && !hasCentralDb) {
    throw new Error(
      "CENTRAL_DB_UNAVAILABLE: قاعدة البيانات المركزية غير مهيأة في بيئة الإنتاج"
    );
  }

  // 1. Authoritative Central Database Resolution (when configured and ID is UUID)
  if (hasCentralDb && isUuid) {
    const { createAdminClient } = await getSupabaseServerModule();
    const supabaseAdmin = createAdminClient();
    const { data: cloudInq, error: inqErr } = await supabaseAdmin
      .from("inquiries")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();

    if (inqErr) {
      console.error("[resolveInquiry] Supabase inquiry query error:", {
        inquiryId: cleanId,
        code: inqErr.code,
        message: inqErr.message,
      });
      if (isProd) {
        throw new Error(
          `CENTRAL_DB_ERROR: تعذر جلب بيانات المحادثة من قاعدة البيانات المركزية (${inqErr.message})`
        );
      }
    }

    if (cloudInq) {
      let propData: any = null;
      let propImage: string | undefined = undefined;

      if (cloudInq.property_id) {
        const isPropUuid = UUID_REGEX.test(cloudInq.property_id);
        let propQuery = supabaseAdmin
          .from("properties")
          .select("id, title, slug, price, advertiser_id, user_id, owner_id");

        if (isPropUuid) {
          propQuery = propQuery.eq("id", cloudInq.property_id);
        } else {
          propQuery = propQuery.eq("slug", cloudInq.property_id);
        }

        const { data: propRow } = await propQuery.maybeSingle();
        propData = propRow;

        if (isPropUuid) {
          const { data: imgRows } = await supabaseAdmin
            .from("property_images")
            .select("url")
            .eq("property_id", cloudInq.property_id)
            .order("is_main", { ascending: false })
            .limit(1);
          if (imgRows && imgRows.length > 0) {
            propImage = imgRows[0].url;
          }
        }
      }

      if (!propData && !isProd && cloudInq.property_id) {
        propData =
          dbStore.getRawPropertyById(cloudInq.property_id) ||
          dbStore.getPropertyByIdOrSlug(cloudInq.property_id);
        if (
          propData &&
          !propImage &&
          Array.isArray(propData.images) &&
          propData.images.length > 0
        ) {
          propImage = propData.images[0];
        }
      }

      const resolvedAdvertiserId =
        cloudInq.advertiser_id ||
        propData?.advertiser_id ||
        propData?.advertiserId ||
        propData?.user_id ||
        propData?.userId ||
        propData?.owner_id ||
        propData?.ownerId ||
        undefined;

      let advertiserName: string | undefined = undefined;
      let advertiserPhone: string | undefined = undefined;

      if (resolvedAdvertiserId) {
        const isAdvUuid = UUID_REGEX.test(resolvedAdvertiserId);
        if (isAdvUuid) {
          const { data: advProfile } = await supabaseAdmin
            .from("profiles")
            .select("*")
            .eq("id", resolvedAdvertiserId)
            .maybeSingle();
          if (advProfile) {
            advertiserName =
              advProfile.company_name ||
              advProfile.name ||
              advProfile.full_name ||
              undefined;
            advertiserPhone = advProfile.phone || undefined;
          }
        }
        if ((!advertiserName || !advertiserPhone) && !isProd) {
          const localAdv = dbStore.findUserById(resolvedAdvertiserId);
          if (localAdv) {
            advertiserName =
              advertiserName || localAdv.companyName || localAdv.name;
            advertiserPhone = advertiserPhone || localAdv.phone;
          }
        }
      }

      let seekerName = cloudInq.seeker_name;
      let seekerPhone = cloudInq.seeker_phone;
      let seekerEmail = cloudInq.seeker_email;

      if (cloudInq.seeker_id && UUID_REGEX.test(cloudInq.seeker_id) && (!seekerName || !seekerPhone || !seekerEmail)) {
        const { data: seekerProfile } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", cloudInq.seeker_id)
          .maybeSingle();
        if (seekerProfile) {
          seekerName = seekerName || seekerProfile.name || seekerProfile.full_name;
          seekerPhone = seekerPhone || seekerProfile.phone;
          seekerEmail = seekerEmail || seekerProfile.email;
        }
      }

      return {
        id: cloudInq.id,
        propertyId: cloudInq.property_id || "",
        propertyTitle: cloudInq.property_title || propData?.title || "عقار",
        propertySlug: propData?.slug || undefined,
        propertyPrice: propData?.price ? Number(propData.price) : undefined,
        propertyImage:
          propImage ||
          (Array.isArray(propData?.images) ? propData.images[0] : undefined),
        seekerId: cloudInq.seeker_id || "guest",
        seekerName: seekerName || "عميل / زائر",
        seekerPhone: seekerPhone || "",
        seekerEmail: seekerEmail || "",
        advertiserId: resolvedAdvertiserId || "",
        advertiserName,
        advertiserPhone,
        message: cloudInq.message || "",
        preferredContact: cloudInq.preferred_contact || "call",
        status: cloudInq.status || "new",
        lastMessageAt: cloudInq.updated_at || cloudInq.created_at,
        createdAt: cloudInq.created_at,
      };
    }

    if (isProd) {
      return null;
    }
  }

  // 2. Non-production fallback to local dbStore (Strictly disabled in production)
  if (!isProd) {
    const local = dbStore.getInquiryById(cleanId);
    if (local) {
      return enrichLocalInquiry(local);
    }
  }

  return null;
}
