import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAdminPermission } from "@/lib/auth/admin-permissions";
import { embedText, cosineSimilarity, isGeminiConfigured } from "@/lib/services/geminiTools";
import type { StoredClientRecord } from "@/lib/db/store";

export const maxDuration = 60;

/** النص الدلالي المُمثل للسجل — يجمع كل الحقول المهمة */
function recordText(r: StoredClientRecord): string {
  return [
    r.type === "client" ? "طلب بحث" : "عرض عقار",
    r.requestedCategory || "",
    r.requestedArea ? `${r.requestedArea} متر` : "",
    r.requestedPriceRange || (r.priceMax ? `${r.priceMax} جنيه` : ""),
    r.transactionType === "rent" ? "إيجار" : r.transactionType === "sale" ? "بيع" : "",
    r.requestedLocation || "",
    r.requestedProperty || r.availableListings || "",
    r.notes || "",
  ]
    .filter(Boolean)
    .join(" • ");
}

/** GET /api/admin/crm/semantic-search?q=...&limit=10 — بحث دلالي معنوي في سجلات CRM */
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 10, 30);
    if (query.length < 2) {
      return NextResponse.json({ error: "اكتب استعلاماً للبحث الدلالي (حرفان على الأقل)" }, { status: 400 });
    }

    const records = dbStore.getClientRecords();
    if (!records.length) {
      return NextResponse.json({ results: [], message: "لا توجد سجلات بعد" });
    }

    // متجه الاستعلام
    const queryVec = await embedText(query);

    // متجهات السجلات — نستخدم المخزن إن وجد وإلا نحسب ويخزن للمرة القادمة
    const scored: Array<{ record: StoredClientRecord; score: number }> = [];
    for (const r of records) {
      try {
        const vec = r.embedding?.length ? r.embedding : await embedText(recordText(r));
        scored.push({ record: r, score: cosineSimilarity(queryVec, vec) });
      } catch {
        continue; // سجل واحد فاشل لا يوقف البحث
      }
    }

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ record, score }) => ({ ...record, semanticScore: Math.round(score * 100) / 100 }))
      .filter((r) => r.semanticScore >= 0.35); // أقل من كذا = غير مرتبط فعلاً

    return NextResponse.json({ results, count: results.length, query });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في البحث الدلالي";
    console.error("[crm/semantic-search]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
