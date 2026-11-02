import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient, createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseDirect } from "@/lib/services/propertyService";
import { dbStore } from "@/lib/db/store";
import { isPropertyCreatedByUser } from "@/lib/utils/propertyOwnership";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول للوصول إلى عقارات لوحة التحكم" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const authHeader = req.headers.get("authorization");
    const authToken = authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

    const isSupabaseJwt = Boolean(authToken && authToken.split(".").length === 3);
    const supabaseUserClient = createSupabaseServerClient(undefined, isSupabaseJwt ? authToken : undefined);
    const supabaseAdmin = createAdminClient();

    let supaUser = null;
    if (isSupabaseJwt) {
      try {
        const { data: { user: foundUser } } = await supabaseUserClient.auth.getUser();
        supaUser = foundUser;
      } catch {
        // Ignored
      }
    }

    // Resolve verified advertiser UUID & matching identifier set
    const matchUserIds = new Set<string>([user.id]);
    if (supaUser?.id) {
      matchUserIds.add(supaUser.id);
    }

    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (isUserUuid) {
      matchUserIds.add(user.id);
    }

    if (user.email) {
      try {
        const { data: dbUser } = await supabaseAdmin.from("profiles").select("id").eq("email", user.email).maybeSingle();
        if (dbUser?.id) {
          matchUserIds.add(dbUser.id);
        }
      } catch {}
    }

    const combinedPropertiesMap = new Map<string, any>();

    // 1. Authoritative Cloud Retrieval via Supabase Admin Client
    if (isSupabaseDirect()) {
      try {
        // Primary query: Fetch all properties to perform flexible, comprehensive matching
        let { data: cloudProperties, error: cloudError } = await supabaseAdmin
          .from("properties")
          .select(`
            *,
            property_images (url, alt, is_main, sort_order)
          `)
          .order("created_at", { ascending: false });

        // Fallback: If unrestricted query fails, try targeted .or() query
        if ((cloudError || !cloudProperties) && isSupabaseDirect()) {
          const orFilterClauses: string[] = [];
          matchUserIds.forEach((id) => {
            orFilterClauses.push(`advertiser_id.eq.${id}`);
            orFilterClauses.push(`user_id.eq.${id}`);
            orFilterClauses.push(`owner_id.eq.${id}`);
          });

          const { data: orRows, error: orErr } = await supabaseAdmin
            .from("properties")
            .select(`
              *,
              property_images (url, alt, is_main, sort_order)
            `)
            .or(orFilterClauses.join(","))
            .order("created_at", { ascending: false });

          if (!orErr && orRows) {
            cloudProperties = orRows;
            cloudError = null;
          }
        }

        // Secondary fallback: RPC if available
        if ((!cloudProperties || cloudProperties.length === 0 || cloudError) && isSupabaseDirect()) {
          for (const uid of Array.from(matchUserIds)) {
            try {
              const { data: rpcRows, error: rpcErr } = await supabaseAdmin.rpc("get_dashboard_properties_for_user", {
                p_user_id: uid,
              });
              if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
                const propertyIds = rpcRows.map((r: any) => r.id);
                const { data: imagesData } = await supabaseAdmin
                  .from("property_images")
                  .select("property_id, url, alt, is_main, sort_order")
                  .in("property_id", propertyIds);

                const imagesMap = new Map<string, any[]>();
                if (imagesData) {
                  imagesData.forEach((img) => {
                    if (!imagesMap.has(img.property_id)) imagesMap.set(img.property_id, []);
                    imagesMap.get(img.property_id)!.push(img);
                  });
                }

                const mappedRpc = rpcRows.map((row: any) => ({
                  ...row,
                  property_images: imagesMap.get(row.id) || [],
                }));

                cloudProperties = [...(cloudProperties || []), ...mappedRpc];
              }
            } catch {}
          }
        }

        if (Array.isArray(cloudProperties)) {
          // Flexible matching function
          const matchesOwner = (row: any): boolean => {
            // Direct ID match
            if (row.advertiser_id && matchUserIds.has(row.advertiser_id)) return true;
            if (row.user_id && matchUserIds.has(row.user_id)) return true;
            if (row.owner_id && matchUserIds.has(row.owner_id)) return true;

            // Legacy rows may lack a foreign-key owner; only their creator account ID/email are safe fallbacks.
            const details = row.project_details || {};
            return isPropertyCreatedByUser(details, matchUserIds, user.email);
          };

          const matchedRows = cloudProperties.filter(matchesOwner);

          for (const row of matchedRows) {
            combinedPropertiesMap.set(row.id, {
              id: row.id,
              slug: row.slug,
              title: row.title,
              description: row.description,
              price: Number(row.price),
              currency: row.currency || "EGP",
              transactionType: row.transaction_type,
              category: row.category,
              areaSqM: Number(row.area_sqm),
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              images: Array.isArray(row.property_images) && row.property_images.length > 0
                ? row.property_images
                    .sort((a: any, b: any) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.sort_order - b.sort_order)
                    .map((img: any) => img.url)
                : [],
              viewsCount: row.views_count || 0,
              inquiriesCount: row.inquiries_count || 0,
              addressDetails: row.address_details || "",
              latitude: Number(row.latitude ?? (row.location?.coordinates ? row.location.coordinates[1] : (row.lat ?? row.exact_lat))),
              longitude: Number(row.longitude ?? (row.location?.coordinates ? row.location.coordinates[0] : (row.lng ?? row.exact_lng))),
              lat: Number(row.latitude ?? (row.location?.coordinates ? row.location.coordinates[1] : (row.lat ?? row.exact_lat))),
              lng: Number(row.longitude ?? (row.location?.coordinates ? row.location.coordinates[0] : (row.lng ?? row.exact_lng))),
              advertiserId: row.advertiser_id || row.user_id,
              userId: row.user_id || row.advertiser_id,
              moderationNotes: row.moderation_notes,
              isProject: Boolean(row.is_project || row.isProject),
            });
          }
        }
      } catch (err) {
        console.warn("Supabase fetch notice in dashboard/properties:", err);
      }
    }

    // 2. Merge local store properties for resilience
    const allLocalProps = dbStore.getAllPropertiesForAdmin().filter(
      (p) =>
        matchUserIds.has(p.advertiserId) ||
        matchUserIds.has((p as any).userId) ||
        matchUserIds.has((p as any).ownerId) ||
        (user.email && (p as any).advertiserEmail?.trim().toLowerCase() === user.email.trim().toLowerCase())
    );

    for (const p of allLocalProps) {
      if (!combinedPropertiesMap.has(p.id)) {
        combinedPropertiesMap.set(p.id, {
          id: p.id,
          slug: p.slug,
          title: p.title,
          description: p.description,
          price: Number(p.price),
          currency: p.currency || "EGP",
          transactionType: p.transactionType,
          category: p.category,
          areaSqM: Number(p.areaSqM),
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          images: Array.isArray(p.images) ? p.images : [],
          viewsCount: p.viewsCount || 0,
          inquiriesCount: p.inquiriesCount || 0,
          addressDetails: p.addressDetails || "",
          moderationNotes: p.moderationNotes,
          isProject: p.isProject,
        });
      }
    }

    const allUserProps = Array.from(combinedPropertiesMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const metrics = {
      total: allUserProps.length,
      published: allUserProps.filter((p) => p.status === "published" || p.status === "active").length,
      sold: allUserProps.filter((p) => p.status === "sold").length,
      pending: allUserProps.filter(
        (p) => p.status === "pending_review" || p.status === "pending" || p.status === "under_review"
      ).length,
      drafts: allUserProps.filter((p) => p.status === "draft").length,
      rejected: allUserProps.filter((p) => p.status === "rejected").length,
    };

    let filteredProps = allUserProps;
    if (statusFilter && statusFilter !== "all") {
      if (statusFilter === "pending" || statusFilter === "pending_review" || statusFilter === "under_review") {
        filteredProps = filteredProps.filter(
          (p) => p.status === "pending" || p.status === "pending_review" || p.status === "under_review"
        );
      } else if (statusFilter === "published" || statusFilter === "active") {
        filteredProps = filteredProps.filter((p) => p.status === "published" || p.status === "active");
      } else {
        filteredProps = filteredProps.filter((p) => p.status === statusFilter);
      }
    }

    return NextResponse.json({
      success: true,
      properties: filteredProps,
      metrics,
      source: "supabase_admin_unified",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب عقارات لوحة التحكم";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
