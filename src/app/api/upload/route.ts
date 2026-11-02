import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { dbStore } from "@/lib/db/store";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { checkRateLimit } from "@/lib/auth/security";
import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseDirect } from "@/lib/services/propertyService";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function validateImageMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false;
  // JPEG: 0xFF 0xD8 0xFF
  if (declaredType === "image/jpeg" || declaredType === "image/jpg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  // PNG: 0x89 0x50 0x4E 0x47
  if (declaredType === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  // WebP: RIFF .... WEBP
  if (declaredType === "image/webp") {
    return (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    );
  }
  // AVIF: contains ftyp
  if (declaredType === "image/avif") {
    const headerStr = buffer.subarray(4, 12).toString("ascii");
    return headerStr.includes("ftyp");
  }
  return false;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول لرفع الصور" },
        { status: 401 }
      );
    }
    if (user.isSuspended) {
      return NextResponse.json(
        { error: "تم تعليق هذا الحساب ولا يمكن رفع وسائط جديدة" },
        { status: 403 }
      );
    }

    // Rate limiting: 20 image uploads per minute per authenticated user
    const rateStatus = checkRateLimit(`upload_${user.id}`, 20, 60 * 1000);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `تم تجاوز الحد الأقصى المسموح به لرفع الصور (20 صورة/دقيقة). يرجى الانتظار ${rateStatus.retryAfterSeconds} ثانية.`,
        },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = (formData.get("propertyId") as string) || "draft";
    const isAvatar = propertyId === "avatar";

    // Strict resource ownership & existence check:
    // Only 'draft', 'new', and 'avatar' bypass property existence checks.
    // Any other propertyId MUST exist in the authoritative database and belong to the user.
    if (propertyId && propertyId !== "draft" && propertyId !== "new" && !isAvatar) {
      let propAdvertiserId: string | null = null;
      let propertyFound = false;

      const isProd = process.env.NODE_ENV === "production";
      const useCloud = isSupabaseDirect();

      // 1. Check Central Supabase first when configured
      if (useCloud) {
        const isPropUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
        try {
          const supabase = createSupabaseServerClient();
          let q = supabase.from("properties").select("id, advertiser_id");
          if (isPropUuid) {
            q = q.eq("id", propertyId);
          } else {
            q = q.eq("slug", propertyId);
          }
          const { data: cloudProp } = await q.maybeSingle();
          if (cloudProp) {
            propertyFound = true;
            propAdvertiserId = cloudProp.advertiser_id;
          }
        } catch {}
      }

      // 2. Fallback to local store ONLY in non-production environments
      if (!propertyFound && !isProd) {
        const localProp = dbStore.getRawPropertyById(propertyId);
        if (localProp) {
          propertyFound = true;
          propAdvertiserId = localProp.advertiserId;
        }
      }

      // Reject uploads linked to nonexistent properties
      if (!propertyFound) {
        return NextResponse.json(
          { error: "العقار المحدد غير موجود. لا يمكن رفع صور لعقار غير مسجل." },
          { status: 404 }
        );
      }

      // Check ownership
      let isOwner = propAdvertiserId === user.id;
      if (!isOwner && user.email && propAdvertiserId) {
        try {
          const supabase = createSupabaseServerClient();
          const { data: advUser } = await supabase.from("profiles").select("id").eq("email", user.email).single();
          if (advUser && advUser.id === propAdvertiserId) {
            isOwner = true;
          }
        } catch {}
      }

      if (!isOwner && !hasAdminPermission(user, "projects.review")) {
        return NextResponse.json(
          { error: "غير مصرح لك بإرفاق صور لعقار لا تملكه (BOLA/IDOR Violation)" },
          { status: 403 }
        );
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: "لم يتم اختيار أي ملف للرفع" },
        { status: 400 }
      );
    }

    // 1. Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "نوع الملف غير مدعوم. الأنواع المسموحة فقط: JPG, PNG, WEBP, AVIF" },
        { status: 400 }
      );
    }

    // 2. Validate File Size (Max 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "حجم الصورة يتجاوز الحد الأقصى المسموح به (10 ميجابايت)" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Deep Magic Bytes inspection (Prevent spoofed mime-types)
    if (!validateImageMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: "محتوى الملف لا يطابق نوع الصورة المصرح به. يرجى رفع ملف صورة سليم." },
        { status: 400 }
      );
    }

    // 4. Generate sanitized path scoped to authenticated user and target bucket
    const targetBucket = isAvatar ? "avatars" : "property-images";
    const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "image/webp" ? "webp" : "jpg");
    const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const storagePath = isAvatar ? `${user.id}/${cleanFileName}` : `${user.id}/${propertyId}/${cleanFileName}`;

    // 5. Upload to Supabase Storage bucket ('property-images' or 'avatars')
    try {
      const supabase = createSupabaseServerClient();
      const { error: uploadError } = await supabase.storage
        .from(targetBucket)
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: isAvatar,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from(targetBucket)
          .getPublicUrl(storagePath);

        // 6. If linked to an existing UUID property (and not avatar), insert into property_images table
        const isPropUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
        if (isPropUuid && !isAvatar) {
          const { error: dbInsertError } = await supabase.from("property_images").insert({
            property_id: propertyId,
            url: publicUrlData.publicUrl,
            alt: file.name,
            is_main: false,
            sort_order: 1,
          });

          // Rollback: if database insertion fails, delete uploaded storage object immediately
          if (dbInsertError) {
            console.error("[Upload] Database insert failed, rolling back storage upload:", dbInsertError);
            await supabase.storage.from(targetBucket).remove([storagePath]);
            return NextResponse.json(
              { error: `فشل تسجيل بيانات الصورة في قاعدة البيانات: ${dbInsertError.message}` },
              { status: 500 }
            );
          }
        }

        return NextResponse.json({
          success: true,
          url: publicUrlData.publicUrl,
          path: storagePath,
          filename: file.name,
          source: "supabase_storage",
          bucket: targetBucket,
        });
      } else {
        console.warn("[Upload] Supabase Storage upload error:", uploadError.message);
        if (process.env.NODE_ENV === "production" || isSupabaseDirect()) {
          return NextResponse.json(
            { error: `فشل رفع الصورة إلى خدمة التخزين السحابي: ${uploadError.message}` },
            { status: 500 }
          );
        }
      }
    } catch (cloudErr) {
      console.warn("[Upload] Supabase Storage exception:", cloudErr);
      if (process.env.NODE_ENV === "production" || isSupabaseDirect()) {
        return NextResponse.json(
          { error: "حدث خطأ أثناء الاتصال بخدمة التخزين السحابي" },
          { status: 500 }
        );
      }
    }

    // Explicit Non-Production / Offline Fallback: Store securely in local public uploads directory
    const fs = await import("fs/promises");
    const path = await import("path");
    const subFolder = isAvatar ? "avatars" : "properties";
    const uploadDir = path.join(process.cwd(), "public", "uploads", subFolder, user.id);
    await fs.mkdir(uploadDir, { recursive: true });
    const localFilePath = path.join(uploadDir, cleanFileName);
    await fs.writeFile(localFilePath, buffer);

    const localPublicUrl = `/uploads/${subFolder}/${user.id}/${cleanFileName}`;
    return NextResponse.json({
      success: true,
      url: localPublicUrl,
      path: `local/${user.id}/${cleanFileName}`,
      filename: file.name,
      source: "local_storage",
      bucket: targetBucket,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء معالجة الصورة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    const bucket = searchParams.get("bucket") || "property-images";

    if (!path) {
      return NextResponse.json({ error: "مسار الصورة مطلوب" }, { status: 400 });
    }

    // Strict ownership verification: path MUST start with user.id
    if (!path.startsWith(`${user.id}/`) && !path.startsWith(`local/${user.id}/`)) {
      return NextResponse.json(
        { error: "غير مصرح لك بحذف ملفات لا تملكها" },
        { status: 403 }
      );
    }

    if (path.startsWith("local/")) {
      try {
        const fs = await import("fs/promises");
        const pathModule = await import("path");
        const relativeFilePath = path.replace(/^local\//, "");
        const localFilePath = pathModule.join(process.cwd(), "public", "uploads", "properties", relativeFilePath);
        await fs.unlink(localFilePath);
      } catch (e) {
        // Ignored
      }
      return NextResponse.json({ success: true, message: "تم حذف الصورة بنجاح" });
    }

    try {
      const supabase = createSupabaseServerClient();
      await Promise.allSettled([
        supabase.storage.from(bucket).remove([path]),
        supabase.storage.from("property-images").remove([path]),
        supabase.storage.from("avatars").remove([path]),
      ]);
    } catch (e) {
      // Ignored
    }

    return NextResponse.json({ success: true, message: "تم حذف الصورة بنجاح" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في حذف الصورة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
