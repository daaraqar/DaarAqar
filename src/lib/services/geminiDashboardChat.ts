/**
 * Google Gemini AI Service — Dashboard Assistant (Admin Chat Bot)
 * ---------------------------------------------------------------
 * بوت محادثة يعيش داخل لوحة التحكم: يقرأ بيانات المنصة الحقيقية
 * (عقارات، مستخدمون، استفسارات، إشعارات، سجلات CRM، إحصائيات)
 * ويجيب أسئلة الإدارة بالعربية بناءً على هذه البيانات فعلياً.
 */

/** النماذج بالترتيب — أحدث أولاً ثم القديم fallback (مُحدّث أكتوبر 2026) */
import { getTextModels, blacklistModel } from "./geminiModelRegistry";
import { getGeminiAuth } from "./geminiAuth";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

export function isGeminiConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());
}

/** نافذة ذاكرة المحادثة المرسلة للنموذج (آخر N أدوار) */
const MEMORY_TURNS = 12;

async function callGeminiModel(model: string, apiKey: string, parts: any[]): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const auth = getGeminiAuth();
    const res = await fetch(
      auth.keyParam
        ? `${GEMINI_ENDPOINT}/${model}:generateContent?${auth.keyParam}`
        : `${GEMINI_ENDPOINT}/${model}:generateContent`,
      {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096,
            // أوقف "التفكير الداخلي" — رد فوري بدون تأجيل (نموذج 3.x)
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // 404/400 = الموديل غير قابل للاستدعاء على المفتاح — احذفه من القائمة فوراً
      if (res.status === 404 || res.status === 400) blacklistModel(model);
      throw new Error(`Gemini [${model}] خطأ ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("");
    if (!text) throw new Error(`Gemini [${model}]: استجابة فارغة`);
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatWithGemini(
  systemPrompt: string,
  dashboardContext: string,
  history: ChatTurn[],
  userMessage: string
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!apiKey) throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");

  const trimmedHistory = history.slice(-MEMORY_TURNS);

  const parts: any[] = [
    {
      text:
        `${systemPrompt}\n\n` +
        `=== بيانات لوحة التحكم الحية (مصدر الحقيقة الوحيد — لا تخترع أرقاماً خارجها) ===\n` +
        `${dashboardContext}\n\n` +
        `=== سجل المحادثة ===\n` +
        trimmedHistory.map((t) => `${t.role === "user" ? "الإدارة" : "البوت"}: ${t.text}`).join("\n") +
        `\n\n=== رسالة الإدارة الجديدة ===\n${userMessage}`,
    },
  ];

  let lastError: Error | null = null;
  const models = await getTextModels();
  for (const model of models) {
    try {
      return await callGeminiModel(model, apiKey, parts);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") break;
      continue;
    }
  }
  throw lastError || new Error("فشل الاتصال بالذكاء الاصطناعي");
}
