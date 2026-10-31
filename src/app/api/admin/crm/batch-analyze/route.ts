import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { batchGenerate, isGeminiConfigured, embedTexts } from "@/lib/services/geminiTools";
import type { StoredClientRecord } from "@/lib/db/store";

export const maxDuration = 300;

const ANALYZE_PROMPT = `أنت محلل بيانات عقارية مصري. لكل منشور المرفق استخرج JSON فقط بدون شرح:
{
  "type": "client" | "broker",
  "name": "...",
  "phone": "01xxxxxxxxx أو فارغ",
  "requestedCategory": "شقة/فيلا/أرض/محل/...",
  "requestedArea": number|null,
  "requestedPriceRange": "...",
  "priceMin": number|null,
  "priceMax": number|null,
  "transactionType": "sale"|"rent",
  "requestedLocation": "...",
  "requestedProperty": "وصف الطلب",
  "availableListings": "وصف العرض",
  "notes": "ملاحظات قصيرة",
  "confidence": 0.0-1.0
}
الأسعار الرقمية بالجنيه المصري ("ألف" ×1000، "مليون" ×1000000).`;

/**
 * POST /api/admin/crm/batch-analyze  { posts: [{ key, text }] }
 * Batch API: تحليل عدة منشورات دفعة واحدة — لا يستهلك حد RPM.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage") && !hasAdminPermission(user, "support.manage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: "الذكاء الاصطناعي غير مفعل — أضف GEMINI_API_KEY" }, { status: 503 });
    }

    const body = await req.json();
    const posts: Array<{ key?: string; text?: string }> = Array.isArray(body?.posts) ? body.posts : [];
    const valid = posts
      .filter((p) => typeof p.text === "string" && p.text.trim().length >= 15)
      .map((p, i) => ({ key: String(p.key || `post-${i}`), text: p.text!.trim().slice(0, 4000) }));

    if (!valid.length) {
      return NextResponse.json({ error: "أرفق منشورات للتحليل — كل منشور يجب أن يكون 15 حرفاً على الأقل" }, { status: 400 });
    }
    if (valid.length > 50) {
      return NextResponse.json({ error: "الحد الأقصى 50 منشوراً في الدفعة الواحدة" }, { status: 400 });
    }

    const batch = await batchGenerate(valid, ANALYZE_PROMPT, 2048);

    // إنشاء سجلات غير مؤكدة من نتائج التحليل الناجحة
    const saved: StoredClientRecord[] = [];
    const failed: Array<{ key: string; error: string }> = [];
    const crmRecords = dbStore.getClientRecords();

    for (const result of batch) {
      if (result.error || !result.response) {
        failed.push({ key: result.key, error: result.error || "رد فارغ" });
        continue;
      }
      try {
        const parsed = JSON.parse(result.response.replace(/```json\s*|\s*```/g, ""));
        const phone = String(parsed.phone || "").replace(/[\s-]/g, "");
        const dup = phone && crmRecords.find((r) => r.phone === phone);
        const record = dbStore.createClientRecord(
          {
            type: parsed.type === "client" ? "client" : "broker",
            name: String(parsed.name || `منشور دفعة ${result.key}`).slice(0, 120),
            phone: phone || "01000000000",
            requestedCategory: parsed.requestedCategory ? String(parsed.requestedCategory).slice(0, 80) : undefined,
            requestedArea: Number.isFinite(Number(parsed.requestedArea)) && Number(parsed.requestedArea) > 0 ? Number(parsed.requestedArea) : undefined,
            requestedPriceRange: parsed.requestedPriceRange ? String(parsed.requestedPriceRange).slice(0, 120) : undefined,
            priceMin: Number.isFinite(Number(parsed.priceMin)) && Number(parsed.priceMin) > 0 ? Number(parsed.priceMin) : undefined,
            priceMax: Number.isFinite(Number(parsed.priceMax)) && Number(parsed.priceMax) > 0 ? Number(parsed.priceMax) : undefined,
            transactionType: parsed.transactionType === "rent" ? "rent" : "sale",
            requestedLocation: parsed.requestedLocation ? String(parsed.requestedLocation).slice(0, 160) : undefined,
            requestedProperty: parsed.requestedProperty ? String(parsed.requestedProperty).slice(0, 300) : undefined,
            availableListings: parsed.availableListings ? String(parsed.availableListings).slice(0, 500) : undefined,
            notes: [
              `🤖 تحليل دفعة Batch — ${Math.round(Number(parsed.confidence || 0) * 100)}% ثقة`,
              parsed.notes ? String(parsed.notes).slice(0, 200) : "",
              dup ? `⚠️ رقم مكرر مع سجل موجود` : "",
            ]
              .filter(Boolean)
              .join(" • ")
              .slice(0, 1500),
            isVerified: false,
            sourceType: "bot",
            createdBy: `بوت الدفعات (${user.name || "إدارة"})`,
          },
          user
        );
        saved.push(record);
      } catch {
        failed.push({ key: result.key, error: "تعذر قراءة JSON من النموذج" });
      }
    }

    return NextResponse.json({
      success: true,
      total: valid.length,
      saved: saved.length,
      failed: failed.length,
      records: saved,
      errors: failed,
      message: `تم تحليل ${valid.length} منشور دفعة واحدة — ${saved.length} سجل جديد بانتظار التأكيد، ${failed.length} فشل`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في التحليل الدفعي";
    console.error("[crm/batch-analyze]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/admin/crm/batch-analyze — يبني Embeddings لكل السجلات التي لا تحتويها
 * يُستدعى مرة بعد إضافة السجلات ليكون البحث الدلالي جاهزاً.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول كمسؤول للنظام" }, { status: 401 });
    }
    if (!hasAdminPermission(user, "staff.manage")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: "الذكاء الاصطناعي غير مفعل" }, { status: 503 });
    }

    const records = dbStore.getClientRecords();
    const missing = records.filter((r) => !r.embedding?.length);
    if (!missing.length) {
      return NextResponse.json({ success: true, indexed: 0, message: "كل السجلات مفهرسة دلالياً بالفعل" });
    }

    const texts = missing.map((r) =>
      [
        r.type === "client" ? "طلب بحث" : "عرض عقار",
        r.requestedCategory || "",
        r.requestedArea ? `${r.requestedArea} متر` : "",
        r.requestedPriceRange || (r.priceMax ? `${r.priceMax} جنيه` : ""),
        r.transactionType === "rent" ? "إيجار" : "بيع",
        r.requestedLocation || "",
        r.requestedProperty || r.availableListings || "",
      ]
        .filter(Boolean)
        .join(" • ")
    );

    // الدفعات — أقصى 100 استدعاء في المرة للـ embeddings
    let indexed = 0;
    for (let i = 0; i < missing.length; i += 100) {
      const chunk = texts.slice(i, i + 100);
      const vecs = await embedTexts(chunk);
      vecs.forEach((vec, j) => {
        const record = missing[i + j];
        dbStore.updateClientRecord(record.id, { embedding: vec }, user);
        indexed++;
      });
    }

    return NextResponse.json({
      success: true,
      indexed,
      total: records.length,
      message: `تم فهرسة ${indexed} سجل دلالياً — البحث الدلالي جاهز`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في الفهرسة الدلالية";
    console.error("[crm/batch-analyze GET]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
