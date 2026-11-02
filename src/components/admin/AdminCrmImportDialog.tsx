"use client";

import { useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";

const FIELD_OPTIONS = [
  { key: "type", label: "نوع السجل" },
  { key: "name", label: "الاسم", required: true },
  { key: "phone", label: "رقم الهاتف", required: true },
  { key: "requestedProperty", label: "العقار المطلوب" },
  { key: "requestedCategory", label: "التصنيف" },
  { key: "requestedArea", label: "المساحة" },
  { key: "requestedPriceRange", label: "الميزانية / السعر" },
  { key: "transactionType", label: "نوع الصفقة" },
  { key: "requestedLocation", label: "المنطقة" },
  { key: "availableListings", label: "العروض المتاحة" },
  { key: "listingsCount", label: "عدد العروض" },
  { key: "notes", label: "ملاحظات" },
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  type: ["type", "recordtype", "kind", "نوع", "النوع", "نوعالسجل", "عميلامسمسار"],
  name: ["name", "fullname", "customer", "client", "broker", "الاسم", "اسمالعميل", "اسم", "اسمالسمسار"],
  phone: ["phone", "mobile", "telephone", "whatsapp", "رقم", "الهاتف", "رقمالهاتف", "موبايل", "تليفون", "واتساب"],
  requestedProperty: ["property", "request", "description", "العقار", "العقارالمطلوب", "الطلب", "الوصف"],
  requestedCategory: ["category", "propertytype", "التصنيف", "نوعالعقار"],
  requestedArea: ["area", "size", "sqm", "المساحة", "المساحه"],
  requestedPriceRange: ["price", "budget", "range", "السعر", "الميزانية", "الميزانيه"],
  transactionType: ["transaction", "transactiontype", "بيع", "ايجار", "إيجار", "نوعالصفقة", "نوعالصفقه"],
  requestedLocation: ["location", "area", "district", "الموقع", "المنطقة", "المنطقه"],
  availableListings: ["listings", "offers", "available", "العروض", "العروضالمتاحة", "العروضالمتاحه"],
  listingsCount: ["listingscount", "offerscount", "عددالعروض"],
  notes: ["notes", "comments", "ملاحظات", "تعليقات"],
};

interface PreviewRow {
  rowNumber: number;
  record?: Record<string, unknown>;
  error?: string;
  duplicateOf?: string;
}

interface Props {
  onClose: () => void;
  onImported: (message: string) => void;
}

function normalizedHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_\-./\\:()]+/g, "").trim();
}

export default function AdminCrmImportDialog({ onClose, onImported }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const readyCount = useMemo(
    () => preview.filter((row) => row.record && !row.duplicateOf).length,
    [preview]
  );
  const duplicateCount = preview.filter((row) => row.duplicateOf).length;
  const invalidCount = preview.filter((row) => row.error).length;

  const autoMap = (headers: string[]) => {
    const used = new Set<string>();
    const next: Record<string, string> = {};
    for (const field of FIELD_OPTIONS) {
      const aliases = HEADER_ALIASES[field.key];
      const match = headers.findIndex((header, index) => {
        const normalized = normalizedHeader(header);
        return !used.has(String(index)) && aliases.some((alias) => normalized === normalizedHeader(alias));
      });
      if (match >= 0) {
        next[field.key] = String(match);
        used.add(String(match));
      } else {
        next[field.key] = "";
      }
    }
    setMapping(next);
  };

  const readFile = async (selected: File | undefined) => {
    if (!selected) return;
    setError("");
    setPreview([]);
    if (!/\.(xlsx|csv)$/i.test(selected.name)) {
      setError("الصيغ المدعومة هي Excel بصيغة .xlsx أو CSV");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("حجم الملف يجب ألا يتجاوز 5 ميجابايت");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      const response = await apiFetch("/api/admin/crm/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر قراءة الملف");
      setFile(selected);
      setColumns(data.columns || []);
      setRows(data.rows || []);
      autoMap(data.columns || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر قراءة الملف");
    } finally {
      setBusy(false);
    }
  };

  const mappedRecords = () =>
    rows.map((row, index) => {
      const result: Record<string, unknown> = { rowNumber: index + 2 };
      for (const field of FIELD_OPTIONS) {
        const selectedColumn = mapping[field.key];
        if (selectedColumn !== undefined && selectedColumn !== "") {
          result[field.key] = row[Number(selectedColumn)] || "";
        }
      }
      return result;
    });

  const buildPreview = async () => {
    if (!mapping.name || !mapping.phone) {
      setError("حدد عمود الاسم وعمود رقم الهاتف قبل معاينة الاستيراد");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", records: mappedRecords() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذرت معاينة السجلات");
      setPreview(data.preview || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذرت معاينة السجلات");
    } finally {
      setBusy(false);
    }
  };

  const commitImport = async () => {
    const records = preview
      .filter((row) => row.record && !row.duplicateOf)
      .map((row) => row.record);
    if (!records.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", records }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فشل استيراد السجلات");
      onImported(data.message || `تم استيراد ${data.inserted} سجل`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل استيراد السجلات");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-5" dir="rtl">
      <button className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-label="إغلاق" />
      <section className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-100 p-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">استيراد سجلات من Excel أو CSV</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">مطابقة الأعمدة، مراجعة الأرقام والتكرارات، ثم تأكيد الحفظ</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(event) => readFile(event.target.files?.[0])}
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-emerald-700" />
              <div>
                <p className="text-xs font-black text-slate-800">{file?.name || "اختر ملف البيانات"}</p>
                <p className="text-[10px] text-slate-500">حتى 500 سجل و5 ميجابايت — يبدأ الملف بصف عناوين</p>
              </div>
            </div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:opacity-50"
            >
              اختيار ملف
            </button>
          </div>

          {columns.length > 0 && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {FIELD_OPTIONS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-[10px] font-black text-slate-600">
                      {field.label}{"required" in field && field.required ? " *" : ""}
                    </span>
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(event) => {
                        setMapping((current) => ({ ...current, [field.key]: event.target.value }));
                        setPreview([]);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700"
                    >
                      <option value="">غير محدد</option>
                      {columns.map((column, index) => (
                        <option key={`${column}-${index}`} value={String(index)}>{column}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <button
                onClick={buildPreview}
                disabled={busy}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "جارٍ تجهيز المعاينة..." : `معاينة ${rows.length} سجل`}
              </button>
            </div>
          )}

          {busy && (
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> جارٍ معالجة الملف بأمان...
            </div>
          )}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {preview.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">جاهز: {readyCount}</span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">مكرر: {duplicateCount}</span>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-800">غير صالح: {invalidCount}</span>
              </div>
              <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[640px] text-right text-[11px]">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2.5">صف</th>
                      <th className="p-2.5">الاسم</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">النوع</th>
                      <th className="p-2.5">نتيجة المراجعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber} className="border-t border-slate-100">
                        <td className="p-2.5 text-slate-400">{row.rowNumber}</td>
                        <td className="p-2.5 font-bold text-slate-800">{String(row.record?.name || "—")}</td>
                        <td className="p-2.5" dir="ltr">{String(row.record?.phone || "—")}</td>
                        <td className="p-2.5">{row.record?.type === "broker" ? "سمسار" : row.record ? "عميل" : "—"}</td>
                        <td className="p-2.5">
                          {row.error ? (
                            <span className="text-rose-700">{row.error}</span>
                          ) : row.duplicateOf ? (
                            <span className="text-amber-700">مكرر: {row.duplicateOf}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> جاهز</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 100 && <p className="p-2 text-center text-[10px] text-slate-500">تُعرض أول 100 نتيجة فقط، وجميع الصفوف ستُراجع عند الاستيراد.</p>}
              </div>
              <button
                onClick={commitImport}
                disabled={busy || readyCount === 0}
                className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                تأكيد استيراد {readyCount} سجل
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
