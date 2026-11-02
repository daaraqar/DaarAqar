import { dbStore, type StoredClientRecord } from "@/lib/db/store";
import type { User } from "@/lib/db/types";
import { normalizeCrmPhone } from "./crmUtils";
import { createAdminClient } from "@/utils/supabase/server";

type CrmInput = Omit<StoredClientRecord, "id" | "createdAt" | "updatedAt">;

export class CrmDuplicateError extends Error {
  constructor(readonly duplicate: { id: string; name: string; phone: string }) {
    super(`هذا الرقم مسجل بالفعل باسم ${duplicate.name}`);
    this.name = "CrmDuplicateError";
  }
}

interface CrmRow {
  id: string;
  legacy_id: string | null;
  type: StoredClientRecord["type"];
  name: string;
  phone: string;
  phone_normalized: string;
  requested_property: string | null;
  requested_category: string | null;
  requested_area: number | null;
  requested_price_range: string | null;
  price_min: number | null;
  price_max: number | null;
  transaction_type: StoredClientRecord["transactionType"] | null;
  requested_location: string | null;
  available_listings: string | null;
  listings_count: number | null;
  notes: string | null;
  source_type: StoredClientRecord["sourceType"] | null;
  source_url: string | null;
  embedding: number[] | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function isCentralCrmConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Boolean(url && serviceKey && !/placeholder|your[-_]/i.test(`${url} ${serviceKey}`));
}

function getCentralClient() {
  if (!isCentralCrmConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRM يحتاج إعداد NEXT_PUBLIC_SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY لاستخدام قاعدة بيانات مشتركة"
      );
    }
    return null;
  }
  return createAdminClient();
}

function toCrmRecord(row: CrmRow): StoredClientRecord {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    phone: row.phone,
    requestedProperty: row.requested_property || undefined,
    requestedCategory: row.requested_category || undefined,
    requestedArea: row.requested_area == null ? undefined : Number(row.requested_area),
    requestedPriceRange: row.requested_price_range || undefined,
    priceMin: row.price_min == null ? undefined : Number(row.price_min),
    priceMax: row.price_max == null ? undefined : Number(row.price_max),
    transactionType: row.transaction_type || undefined,
    requestedLocation: row.requested_location || undefined,
    availableListings: row.available_listings || undefined,
    listingsCount: row.listings_count == null ? undefined : Number(row.listings_count),
    notes: row.notes || undefined,
    sourceType: row.source_type || undefined,
    sourceUrl: row.source_url || undefined,
    embedding: Array.isArray(row.embedding) ? row.embedding : undefined,
    isVerified: row.is_verified,
    verifiedBy: row.verified_by || undefined,
    verifiedAt: row.verified_at || undefined,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCrmRow(record: StoredClientRecord, legacyId?: string) {
  return {
    ...(legacyId ? { legacy_id: legacyId } : {}),
    type: record.type,
    name: record.name,
    phone: record.phone,
    phone_normalized: normalizeCrmPhone(record.phone),
    requested_property: record.requestedProperty || null,
    requested_category: record.requestedCategory || null,
    requested_area: record.requestedArea ?? null,
    requested_price_range: record.requestedPriceRange || null,
    price_min: record.priceMin ?? null,
    price_max: record.priceMax ?? null,
    transaction_type: record.transactionType || null,
    requested_location: record.requestedLocation || null,
    available_listings: record.availableListings || null,
    listings_count: record.listingsCount ?? null,
    notes: record.notes || null,
    source_type: record.sourceType || "manual",
    source_url: record.sourceUrl || null,
    embedding: record.embedding || null,
    is_verified: Boolean(record.isVerified),
    verified_by: record.verifiedBy || null,
    verified_at: record.verifiedAt || null,
    created_by: record.createdBy || null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

function toInsertRow(input: CrmInput, user: User) {
  const now = new Date().toISOString();
  const record: StoredClientRecord = {
    ...input,
    id: "",
    createdBy: user.name || user.email || "الإدارة",
    createdAt: now,
    updatedAt: now,
  };
  return toCrmRow(record);
}

function throwDatabaseError(action: string, error: { message: string; code?: string }): never {
  const migration = "20261102153902_crm_shared_records_import.sql";
  if (error.code === "42P01" || error.code === "PGRST205") {
    throw new Error(`جدول CRM المركزي غير موجود. طبّق ترحيل قاعدة البيانات ${migration} ثم أعد المحاولة.`);
  }
  throw new Error(`تعذر ${action} سجلات CRM من قاعدة البيانات المركزية: ${error.message}`);
}

async function migrateLegacyRecordsIfEmpty(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase.from("crm_records").select("id").limit(1);
  if (error) throwDatabaseError("تحميل", error);
  if (data?.length) return;

  const legacyRecords = dbStore.getClientRecords().filter((record) => normalizeCrmPhone(record.phone));
  if (!legacyRecords.length) return;
  const { error: migrationError } = await supabase
    .from("crm_records")
    .upsert(legacyRecords.map((record) => toCrmRow(record, record.id)), {
      onConflict: "legacy_id",
      ignoreDuplicates: true,
    });
  if (migrationError) throwDatabaseError("نقل السجلات القديمة", migrationError);
}

export async function getCrmRecords(): Promise<StoredClientRecord[]> {
  const supabase = getCentralClient();
  if (!supabase) return dbStore.getClientRecords();
  await migrateLegacyRecordsIfEmpty(supabase);

  const { data, error } = await supabase.from("crm_records").select("*").order("created_at", { ascending: false });
  if (error) throwDatabaseError("تحميل", error);
  return ((data || []) as CrmRow[]).map(toCrmRecord);
}

export async function findCrmRecordsByPhones(phones: string[]) {
  const normalizedPhones = Array.from(new Set(phones.map(normalizeCrmPhone).filter(Boolean)));
  if (!normalizedPhones.length) return [] as StoredClientRecord[];

  const supabase = getCentralClient();
  if (!supabase) {
    const phoneSet = new Set(normalizedPhones);
    return dbStore.getClientRecords().filter((record) => phoneSet.has(normalizeCrmPhone(record.phone)));
  }

  await migrateLegacyRecordsIfEmpty(supabase);
  const { data, error } = await supabase
    .from("crm_records")
    .select("*")
    .in("phone_normalized", normalizedPhones);
  if (error) throwDatabaseError("البحث عن التكرارات", error);
  return ((data || []) as CrmRow[]).map(toCrmRecord);
}

export async function createCrmRecord(input: CrmInput, user: User): Promise<StoredClientRecord> {
  const normalizedPhone = normalizeCrmPhone(input.phone);
  if (!normalizedPhone) throw new Error("رقم هاتف مصري غير صالح");

  const supabase = getCentralClient();
  if (!supabase) {
    return dbStore.createClientRecord({ ...input, phone: normalizedPhone }, user);
  }

  if (input.sourceType === "bot" || input.sourceType === "link") {
    const record = {
      ...input,
      phone: normalizedPhone,
      phoneNormalized: normalizedPhone,
      createdBy: user.name || user.email || "الإدارة",
    };
    const { data, error } = await supabase.rpc("crm_create_ai_record", { p_record: record });
    if (error) throwDatabaseError("حفظ سجل البوت", error);
    const result = data as {
      record?: CrmRow;
      duplicate?: { id: string; name: string; phone: string };
    };
    if (result.duplicate) throw new CrmDuplicateError(result.duplicate);
    if (!result.record) throw new Error("استجابة حفظ سجل البوت غير مكتملة");
    return toCrmRecord(result.record);
  }

  const { data, error } = await supabase
    .from("crm_records")
    .insert({ ...toInsertRow({ ...input, phone: normalizedPhone }, user), phone_normalized: normalizedPhone })
    .select("*")
    .single();
  if (error) throwDatabaseError("حفظ", error);
  return toCrmRecord(data as CrmRow);
}

const CRM_UPDATE_COLUMNS: Record<string, string> = {
  type: "type",
  name: "name",
  phone: "phone",
  requestedProperty: "requested_property",
  requestedCategory: "requested_category",
  requestedArea: "requested_area",
  requestedPriceRange: "requested_price_range",
  priceMin: "price_min",
  priceMax: "price_max",
  transactionType: "transaction_type",
  requestedLocation: "requested_location",
  availableListings: "available_listings",
  listingsCount: "listings_count",
  notes: "notes",
  sourceType: "source_type",
  sourceUrl: "source_url",
  embedding: "embedding",
  isVerified: "is_verified",
  verifiedBy: "verified_by",
  verifiedAt: "verified_at",
};

export async function updateCrmRecord(
  id: string,
  updates: Partial<StoredClientRecord>,
  user: User
): Promise<StoredClientRecord> {
  const supabase = getCentralClient();
  if (!supabase) return dbStore.updateClientRecord(id, updates, user);

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(updates)) {
    const column = CRM_UPDATE_COLUMNS[key];
    if (column) row[column] = value ?? null;
  }
  if (updates.phone !== undefined) {
    const normalized = normalizeCrmPhone(updates.phone);
    if (!normalized) throw new Error("رقم هاتف مصري غير صالح");
    row.phone = normalized;
    row.phone_normalized = normalized;
  }

  const { data, error } = await supabase.from("crm_records").update(row).eq("id", id).select("*").single();
  if (error) throwDatabaseError("تحديث", error);
  return toCrmRecord(data as CrmRow);
}

export async function deleteCrmRecord(id: string, user: User): Promise<void> {
  const supabase = getCentralClient();
  if (!supabase) {
    dbStore.deleteClientRecord(id, user);
    return;
  }

  const { data, error } = await supabase.from("crm_records").delete().eq("id", id).select("id");
  if (error) throwDatabaseError("حذف", error);
  if (!data?.length) throw new Error("السجل غير موجود");
}

export interface CrmImportRow extends CrmInput {
  rowNumber: number;
  phoneNormalized: string;
}

export async function importCrmRecords(records: CrmImportRow[], user: User) {
  const supabase = getCentralClient();
  if (!supabase) {
    const existing = dbStore.getClientRecords();
    const seen = new Set(existing.map((record) => normalizeCrmPhone(record.phone)));
    let inserted = 0;
    const duplicates: Array<{ rowNumber: number; name: string; phone: string }> = [];
    for (const record of records) {
      if (seen.has(record.phoneNormalized)) {
        duplicates.push({ rowNumber: record.rowNumber, name: record.name, phone: record.phone });
        continue;
      }
      dbStore.createClientRecord({ ...record, sourceType: "import", isVerified: false }, user);
      seen.add(record.phoneNormalized);
      inserted += 1;
    }
    return { inserted, duplicates };
  }

  const payload = records.map((record) => ({
    ...record,
    createdBy: user.name || user.email || "الإدارة",
  }));
  const { data, error } = await supabase.rpc("crm_import_records", { p_records: payload });
  if (error) throwDatabaseError("استيراد", error);
  return data as { inserted: number; duplicates: Array<Record<string, unknown>> };
}
