import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseDirect, mapRowToPublicProperty } from "@/lib/services/propertyService";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getSupabaseUserId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
) {
  if (UUID_PATTERN.test(user.id)) return user.id;
  if (!user.email) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();
  if (error) throw new Error(`تعذر التحقق من الحساب: ${error.message}`);
  return data?.id ?? null;
}

async function getSupabasePropertyId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  propertyId: string
) {
  if (UUID_PATTERN.test(propertyId)) return propertyId;

  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", propertyId)
    .maybeSingle();
  if (error) throw new Error(`تعذر العثور على العقار: ${error.message}`);
  return data?.id ?? null;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "سجّل الدخول لعرض المفضلة" }, { status: 401 });
    }

    const requestedPropertyId = new URL(req.url).searchParams.get("propertyId");
    if (isSupabaseDirect()) {
      const supabase = createSupabaseServerClient();
      const userUuid = await getSupabaseUserId(supabase, user);
      if (!userUuid) {
        return NextResponse.json({ error: "تعذر ربط الحساب بقاعدة البيانات" }, { status: 403 });
      }

      if (requestedPropertyId) {
        const propertyUuid = await getSupabasePropertyId(supabase, requestedPropertyId);
        if (!propertyUuid) {
          return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
        }
        const { data, error } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", userUuid)
          .eq("property_id", propertyUuid)
          .maybeSingle();
        if (error) throw new Error(`تعذر التحقق من المفضلة: ${error.message}`);
        return NextResponse.json({ success: true, isFavorited: Boolean(data) });
      }

      const { data: favRows, error } = await supabase
        .from("favorites")
        .select(`
          property_id,
          created_at,
          properties (
            *,
            property_images (url, alt, is_main, sort_order)
          )
        `)
        .eq("user_id", userUuid)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`تعذر تحميل المفضلة: ${error.message}`);

      const favorites = (favRows ?? []).flatMap((favorite) => {
        const properties = Array.isArray(favorite.properties)
          ? favorite.properties
          : [favorite.properties];
        return properties.flatMap((property) => {
          if (!property || !["active", "published"].includes(property.status)) return [];
          return [mapRowToPublicProperty(property, user)];
        });
      });
      return NextResponse.json({ success: true, favorites, source: "supabase" });
    }

    if (requestedPropertyId) {
      if (!dbStore.getRawPropertyById(requestedPropertyId)) {
        return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        isFavorited: dbStore.isPropertyFavorited(user.id, requestedPropertyId),
      });
    }
    const favorites = dbStore.getUserFavorites(user.id);
    return NextResponse.json({ success: true, favorites, source: "local" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء جلب المفضلة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول لإضافة العقار إلى المفضلة" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "بيانات الطلب غير صالحة" }, { status: 400 });
    }
    const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
    if (!propertyId || propertyId.length > 200) {
      return NextResponse.json({ error: "معرف العقار مطلوب" }, { status: 400 });
    }
    if (typeof body.isFavorited !== "undefined" && typeof body.isFavorited !== "boolean") {
      return NextResponse.json({ error: "حالة المفضلة غير صالحة" }, { status: 400 });
    }

    if (isSupabaseDirect()) {
      const supabase = createSupabaseServerClient();
      const userUuid = await getSupabaseUserId(supabase, user);
      if (!userUuid) {
        return NextResponse.json({ error: "تعذر ربط الحساب بقاعدة البيانات" }, { status: 403 });
      }
      const propertyUuid = await getSupabasePropertyId(supabase, propertyId);
      if (!propertyUuid) {
        return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
      }

      const { data: existing, error: readError } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", userUuid)
        .eq("property_id", propertyUuid)
        .maybeSingle();
      if (readError) throw new Error(`تعذر التحقق من المفضلة: ${readError.message}`);

      const isFavorited =
        typeof body.isFavorited === "boolean" ? body.isFavorited : !existing;
      if (isFavorited && !existing) {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: userUuid, property_id: propertyUuid });
        if (error && error.code !== "23505") {
          throw new Error(`تعذر إضافة العقار للمفضلة: ${error.message}`);
        }
      } else if (!isFavorited && existing) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userUuid)
          .eq("property_id", propertyUuid);
        if (error) throw new Error(`تعذر إزالة العقار من المفضلة: ${error.message}`);
      }

      return NextResponse.json({ success: true, isFavorited, source: "supabase" });
    }

    if (!dbStore.getRawPropertyById(propertyId)) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }
    const currentlyFavorited = dbStore.isPropertyFavorited(user.id, propertyId);
    const isFavorited =
      typeof body.isFavorited === "boolean" ? body.isFavorited : !currentlyFavorited;
    if (isFavorited !== currentlyFavorited) dbStore.toggleFavorite(user.id, propertyId);
    return NextResponse.json({ success: true, isFavorited, source: "local" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في تعديل المفضلة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
