import type { User } from "@/lib/db/types";
import { dbStore } from "@/lib/db/store";
import { createAdminClient } from "@/utils/supabase/server";

export async function applyApprovedPublisherRole(
  advertiserId: string,
  advertiserType: "owner" | "broker",
  actor: User,
  syncCentralProfile: boolean
): Promise<void> {
  if (syncCentralProfile) {
    const { data: profile, error } = await createAdminClient()
      .from("profiles")
      .update({ role: advertiserType, updated_at: new Date().toISOString() })
      .eq("id", advertiserId)
      .select("id")
      .maybeSingle();
    if (error || !profile) {
      throw new Error(`تعذر تحديث صفة المعلن بعد اعتماد المشروع: ${error?.message || "الحساب غير موجود"}`);
    }
  }

  const localAdvertiser = dbStore.findUserById(advertiserId);
  if (localAdvertiser && localAdvertiser.role !== advertiserType) {
    dbStore.changeUserRole(
      advertiserId,
      advertiserType,
      actor,
      "تحديث صفة الحساب بعد اعتماد أول مشروع وفق صفة النشر المختارة"
    );
  }
}
