import { createClient as createBrowserSupabase } from "./client";

export const PROPERTY_IMAGES_BUCKET = "property-images";

/**
 * Uploads a property image to Supabase Storage.
 * Stores file inside a scoped folder: `{userId}/{propertyId}/{filename}`
 */
export async function uploadPropertyImage({
  file,
  propertyId,
  userId,
}: {
  file: File;
  propertyId: string;
  userId: string;
}): Promise<{ path: string; publicUrl: string; error: string | null }> {
  try {
    const supabase = createBrowserSupabase();
    
    // Clean filename and create unique timestamped key
    const fileExt = file.name.split(".").pop() || "jpg";
    const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${userId}/${propertyId}/${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return { path: "", publicUrl: "", error: uploadError.message };
    }

    const { data } = supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .getPublicUrl(filePath);

    return {
      path: filePath,
      publicUrl: data.publicUrl,
      error: null,
    };
  } catch (err: unknown) {
    return {
      path: "",
      publicUrl: "",
      error: err instanceof Error ? err.message : "Unknown error during image upload",
    };
  }
}

/**
 * Deletes a property image from Supabase Storage by its stored path
 */
export async function deletePropertyImage(filePath: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.storage
      .from(PROPERTY_IMAGES_BUCKET)
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error during image deletion",
    };
  }
}

/**
 * Retrieves the public URL for a given storage path
 */
export function getPropertyImageUrl(filePath: string): string {
  if (!filePath) return "/images/placeholder-property.jpg";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const supabase = createBrowserSupabase();
  const { data } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
