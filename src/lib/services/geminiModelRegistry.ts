/**
 * Gemini Model Registry — اكتشاف النماذج ديناميكياً من المفتاح نفسه
 * ------------------------------------------------------------------
 * الحل الجذري لخطأ 404: بدل كتابة أسماء موديلات يدوياً (وتفشل عند تغيرها
 * أو ظهور موديلات تجريبية مثل antigravity)، نسأل Gemini نفسه عن الموديلات
 * المتاحة فعلياً على هذا المفتاح (ListModels) ونرشّح ونرتب ونجمد 30 دقيقة.
 *
 * ميزات إضافية:
 * - موديل يرجع 404/400 عند الاستدعاء يُحذف من القائمة فوراً (blacklist)
 *   فلا يُعاد تجربته أبداً.
 * - fallback ثابت مضمون الوجود لو فشل ListModels نفسه.
 */

import { getGeminiAuth } from "./geminiAuth";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

/** ترتيب التفضيل — يُستخدم لترتيب نتائج ListModels فقط */
const MODEL_PREFERENCE = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-flash",
];

/** fallback مضمون الوجود على أي مفتاح Gemini لو فشل ListModels */
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

/** أسماء مستبعدة دائماً — موديلات تجريبية/غير نصية */
const EXCLUDE_PATTERN = /embedding|aqa|tts|image|veo|imagen|banana|native-audio|live|antigravity|learnlm|robotics/i;

let cachedModels: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30 * 60_000; // 30 دقيقة

export function geminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!key) throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");
  return key;
}

async function fetchAndRankModels(): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const auth = getGeminiAuth();
    const url = auth.keyParam
      ? `${GEMINI_ENDPOINT}/models?${auth.keyParam}&pageSize=100`
      : `${GEMINI_ENDPOINT}/models?pageSize=100`;
    const res = await fetch(url, { headers: auth.headers, signal: controller.signal });
    if (!res.ok) throw new Error(`ListModels فشل: ${res.status}`);
    const data = await res.json();

    const models: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent") &&
          // الاسم لازم يبدأ بـ gemini — يستبعد antigravity وأي تجريبي آخر
          /^gemini/i.test(String(m.name)) &&
          !EXCLUDE_PATTERN.test(String(m.name))
      )
      .map((m: any) => String(m.name).replace("models/", ""))
      .sort((a: string, b: string) => {
        const prefA = MODEL_PREFERENCE.findIndex((p) => a.startsWith(p));
        const prefB = MODEL_PREFERENCE.findIndex((p) => b.startsWith(p));
        if (prefA !== -1 && prefB !== -1) return prefA - prefB;
        if (prefA !== -1) return -1;
        if (prefB !== -1) return 1;
        return b.localeCompare(a);
      });

    if (!models.length) throw new Error("لا توجد موديلات نصية متاحة على هذا المفتاح");
    return models;
  } finally {
    clearTimeout(timeout);
  }
}

/** قائمة النماذج الجاهزة للاستدعاء — مُخزنة مؤقتاً 30 دقيقة */
export async function getTextModels(): Promise<string[]> {
  if (cachedModels && Date.now() - cacheTime < CACHE_TTL_MS) return cachedModels;
  try {
    cachedModels = await fetchAndRankModels();
    cacheTime = Date.now();
    return cachedModels;
  } catch {
    // ListModels فشل — fallback ثابت مضمون
    return [...FALLBACK_MODELS];
  }
}

/** حذف موديل فاشل من الكاش — يُستدعى عند 404/400 */
export function blacklistModel(model: string): void {
  if (cachedModels) {
    cachedModels = cachedModels.filter((m) => m !== model);
  }
}

/** إبطال الكاش — يُستدعى عند تغيّر المفتاح أو إعادة تشغيل الخدمة */
export function invalidateModelCache(): void {
  cachedModels = null;
  cacheTime = 0;
}
