import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import {
  findCrmRecordsByPhones,
  importCrmRecords,
  type CrmImportRow,
} from "@/lib/services/crmRepository";
import { normalizeCrmPhone, parseCrmCsv } from "@/lib/services/crmUtils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 500;

function excelCellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("").trim();
    }
    if ("result" in value && value.result != null) return String(value.result).trim();
  }
  return String(value).trim();
}

async function readWorkbook(file: File): Promise<{ columns: string[]; rows: string[][] }> {
  const extension = file.name.toLowerCase().split(".").pop();
  let values: string[][];

  if (extension === "csv") {
    values = parseCrmCsv(new TextDecoder().decode(await file.arrayBuffer()));
  } else if (extension === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("ملف Excel لا يحتوي على أوراق بيانات");
    if (worksheet.rowCount > MAX_ROWS + 1 || worksheet.columnCount > 40) {
      throw new Error(`الحد الأقصى للملف ${MAX_ROWS} سجل و40 عموداً`);
    }
    values = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      values.push(
        Array.from({ length: row.cellCount }, (_, index) =>
          excelCellText(row.getCell(index + 1).value)
        )
      );
    });
  } else {
    throw new Error("الصيغ المدعومة هي Excel بصيغة .xlsx أو CSV");
  }

  if (values.length < 2) throw new Error("الملف يجب أن يحتوي على صف عناوين وصف بيانات واحد على الأقل");
  if (values.length - 1 > MAX_ROWS) throw new Error(`الحد الأقصى للاستيراد هو ${MAX_ROWS} سجل في المرة الواحدة`);

  const columns = values[0].map((value, index) => value || `عمود ${index + 1}`);
  const rows = values.slice(1).map((cells) =>
    columns.map((_, index) => cells[index] || "")
  );
  return { columns, rows };
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim().slice(0, maxLength);
  return result || undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const ascii = String(value)
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٬,]/g, "")
    .trim();
  const parsed = Number(ascii);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeImportRecord(value: unknown, index: number): { record?: CrmImportRow; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "بيانات الصف غير صالحة" };
  }
  const row = value as Record<string, unknown>;
  const name = optionalText(row.name, 120);
  if (!name || name.length < 2) return { error: "الاسم مطلوب ويجب أن يتكون من حرفين على الأقل" };
  const phone = typeof row.phone === "string" ? row.phone.trim() : "";
  const phoneNormalized = normalizeCrmPhone(phone);
  if (!phoneNormalized) return { error: "رقم الهاتف المصري غير صالح أو غير موجود" };

  const typeValue = String(row.type || "").trim().toLowerCase();
  const type = /broker|سمسار|وسيط/.test(typeValue) ? "broker" : "client";
  const transaction = String(row.transactionType || "").trim().toLowerCase();
  const requestedArea = parseNumber(row.requestedArea);
  const priceMin = parseNumber(row.priceMin);
  const priceMax = parseNumber(row.priceMax);
  const listingsCount = parseNumber(row.listingsCount);

  return {
    record: {
      rowNumber: Number.isInteger(row.rowNumber) && Number(row.rowNumber) > 0 ? Number(row.rowNumber) : index + 2,
      type,
      name,
      phone: phoneNormalized,
      phoneNormalized,
      requestedProperty: optionalText(row.requestedProperty, 1000),
      requestedCategory: optionalText(row.requestedCategory, 100),
      requestedArea,
      requestedPriceRange: optionalText(row.requestedPriceRange, 200),
      priceMin,
      priceMax,
      transactionType: transaction === "rent" || /إيجار|ايجار/.test(transaction) ? "rent" : transaction ? "sale" : undefined,
      requestedLocation: optionalText(row.requestedLocation, 250),
      availableListings: optionalText(row.availableListings, 2000),
      listingsCount,
      notes: optionalText(row.notes, 1500),
      sourceType: "import",
      sourceUrl: optionalText(row.sourceUrl, 2000),
      isVerified: false,
      createdBy: undefined,
    },
  };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    if (!hasAdminPermission(user, "crm.manage")) {
      return NextResponse.json({ error: "غير مصرح، يتطلب صلاحية إدارة السجلات" }, { status: 403 });
    }

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "اختر ملف Excel أو CSV أولاً" }, { status: 400 });
      if (!file.size || file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "حجم الملف يجب ألا يتجاوز 5 ميجابايت" }, { status: 413 });
      }
      const workbook = await readWorkbook(file);
      return NextResponse.json({ ...workbook, fileName: file.name });
    }

    const body = await req.json();
    const rows: unknown[] = Array.isArray(body?.records) ? body.records : [];
    if (!rows.length || rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `عدد السجلات يجب أن يكون من 1 إلى ${MAX_ROWS}` }, { status: 400 });
    }

    const normalized = rows.map((row, index) => normalizeImportRecord(row, index));
    if (body.action === "preview") {
      const valid = normalized.filter((item): item is { record: CrmImportRow } => Boolean(item.record));
      const existing = await findCrmRecordsByPhones(valid.map((item) => item.record.phoneNormalized));
      const existingByPhone = new Map(existing.map((record) => [normalizeCrmPhone(record.phone), record]));
      const seen = new Set<string>();
      const preview = normalized.map((item, index) => {
        if (!item.record) return { rowNumber: index + 2, error: item.error };
        const phone = item.record.phoneNormalized;
        const existingRecord = existingByPhone.get(phone);
        const repeatedInFile = seen.has(phone);
        seen.add(phone);
        return {
          rowNumber: item.record.rowNumber,
          record: item.record,
          duplicateOf: existingRecord?.name || (repeatedInFile ? "مكرر داخل الملف" : undefined),
        };
      });
      return NextResponse.json({
        preview,
        valid: preview.filter((item) => item.record && !item.duplicateOf).length,
        duplicates: preview.filter((item) => item.duplicateOf).length,
        invalid: preview.filter((item) => item.error).length,
      });
    }

    if (body.action !== "commit") return NextResponse.json({ error: "نوع العملية غير معروف" }, { status: 400 });
    const invalid = normalized.find((item) => !item.record);
    if (invalid) return NextResponse.json({ error: invalid.error || "يوجد سجل غير صالح" }, { status: 400 });
    const records = normalized.map((item) => item.record!);
    const result = await importCrmRecords(records, user);
    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      duplicates: result.duplicates,
      message: `تم استيراد ${result.inserted} سجل، وتجاوز ${result.duplicates.length} سجل مكرر`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر قراءة أو استيراد الملف";
    console.error("[admin/crm/import] Failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
