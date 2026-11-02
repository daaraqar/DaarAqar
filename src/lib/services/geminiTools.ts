/**
 * Gemini AI Tools — الإمكانيات المتقدمة (مُتحقق منها فعلياً من المفتاح)
 * ---------------------------------------------------------------------
 * كل دالة هنا تستخدم مفتاح GEMINI_API_KEY الموجود، والنماذج مُتحقق منها
 * عبر ListModels — لا أسماء مفترضة:
 *  - Grounding with Google Search + URL Context (tools في generateContent)
 *  - Nano Banana للصور (gemini-3.1-flash-image / gemini-2.5-flash-image)
 *  - TTS (gemini-3.8-flash-tts)
 *  - Embeddings (gemini-embedding-001)
 *  - Context Caching (createCachedContent — مدعوم على flash/pro)
 *  - Batch API (batchGenerateContent)
 */

import { getTextModels, blacklistModel } from "./geminiModelRegistry";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image", "nano-banana-pro-preview"] as const;
const TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"] as const;
const EMBEDDING_MODEL = "gemini-embedding-001";

function apiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!key) throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");
  return key;
}

export function isGeminiConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());
}

async function post<T = any>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}/${path}?key=${encodeURIComponent(apiKey())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini [${path}] خطأ ${res.status}: ${errText.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** سلسلة نماذج نصية مع fallback — مكتشفة ديناميكياً من المفتاح */
async function callText(
  parts: any[],
  opts?: { tools?: any[]; systemInstruction?: string; temperature?: number; maxOutputTokens?: number }
): Promise<{ text: string; groundingSources?: Array<{ title: string; uri: string }> }> {
  let lastError: Error | null = null;
  const models = await getTextModels();
  for (const model of models) {
    try {
      const body: any = {
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: opts?.temperature ?? 0.2,
          maxOutputTokens: opts?.maxOutputTokens ?? 4096,
        },
      };
      if (opts?.systemInstruction) {
        body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
      }
      if (opts?.tools?.length) {
        body.tools = opts.tools;
      }
      const data = await post(`${model}:generateContent`, body);
      const candidate = data?.candidates?.[0];
      const text: string =
        candidate?.content?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join("") || "";
      if (!text) throw new Error(`استجابة فارغة من ${model}`);

      // مصادر Grounding إن وُجدت
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const groundingSources = groundingChunks
        .map((c: any) => ({ title: c?.web?.title || "مصدر", uri: c?.web?.uri || "" }))
        .filter((s: any) => s.uri)
        .slice(0, 8);

      return { text, groundingSources: groundingSources.length ? groundingSources : undefined };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") break;
      if (/خطأ (404|400):/.test(lastError.message)) blacklistModel(model);
      continue;
    }
  }
  throw lastError || new Error("فشل الاتصال بالذكاء الاصطناعي");
}

/* ==================== 1) Grounding with Google Search ==================== */

export interface GroundedAnswer {
  text: string;
  sources: Array<{ title: string; uri: string }>;
}

/** سؤال يُجاب من بحث Google حقيقي (حد مجاني 1500 طلب/يوم) */
export async function askWithGoogleSearch(question: string, extraContext?: string): Promise<GroundedAnswer> {
  const parts: any[] = [{ text: extraContext ? `${extraContext}\n\n=== السؤال ===\n${question}` : question }];
  const { text, groundingSources } = await callText(parts, {
    tools: [{ googleSearch: {} }],
    temperature: 0.3,
    maxOutputTokens: 3072,
  });
  return { text, sources: groundingSources || [] };
}

/* ==================== 2) URL Context Tool ==================== */

/** قراءة محتوى روابط مباشرة من النموذج نفسه — يحل مشكلة حجب فيسبوك */
export async function readUrlsWithGemini(prompt: string, urls: string[]): Promise<GroundedAnswer> {
  const urlList = urls.join("\n");
  const text =
    `اقرأ محتوى هذه الروابط ثم نفّذ المطلوب:\n${urlList}\n\n=== المطلوب ===\n${prompt}`;
  const { text: answer, groundingSources } = await callText([{ text }], {
    tools: [{ urlContext: {} }],
    temperature: 0.2,
    maxOutputTokens: 4096,
  });
  return { text: answer, sources: groundingSources || [] };
}

/* ==================== 3) Nano Banana — توليد وتحرير صور ==================== */

export interface GeneratedImage {
  /** data:image/...;base64,.... جاهز للعرض مباشرة */
  dataUrl: string;
  mimeType: string;
}

/** توليد صورة من وصف نصي (وإن أُرفقت صورة أصلية، يحررها بدل التوليد من الصفر) */
export async function generatePropertyImage(prompt: string, sourceImageBase64?: string): Promise<GeneratedImage> {
  const parts: any[] = [];
  if (sourceImageBase64) {
    parts.push({
      inline_data: {
        mime_type: sourceImageBase64.startsWith("data:image/png") ? "image/png" : "image/jpeg",
        data: sourceImageBase64.replace(/^data:[^;]+;base64,/, ""),
      },
    });
  }
  parts.push({
    text:
      sourceImageBase64
        ? `حرر هذه الصورة العقارية بناءً على الوصف مع الحفاظ على واقعية عالية:\n${prompt}`
        : `أنشئ صورة عقارية واقعية عالية الجودة (تصوير احترافي بإضاءة طبيعية):\n${prompt}`,
  });

  let lastError: Error | null = null;
  for (const model of IMAGE_MODELS) {
    try {
      const data = await post(`${model}:generateContent`, {
        contents: [{ role: "user", parts }],
        generationConfig: {
          // نطلب صورة + وصف قصير في نفس الرد
          responseModalities: ["IMAGE", "TEXT"],
        },
      });
      const candidates = data?.candidates?.[0]?.content?.parts || [];
      const imgPart = candidates.find((p: any) => p.inlineData || p.inline_data);
      if (!imgPart) throw new Error(`${model}: لم يرجع صورة`);
      const inline = imgPart.inlineData || imgPart.inline_data;
      const mimeType = inline.mimeType || inline.mime_type || "image/png";
      return {
        dataUrl: `data:${mimeType};base64,${inline.data}`,
        mimeType,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }
  throw lastError || new Error("فشل توليد الصورة");
}

/* ==================== 4) Gemini TTS — نص إلى كلام ==================== */

/** تحويل نص إلى صوت MP3 (base64) — للقراءة الصوتية لتقارير الإشراف */
export async function synthesizeSpeech(text: string): Promise<{ audioBase64: string; mimeType: string }> {
  const clean = text.slice(0, 2500); // حد معقول للرسالة الواحدة
  let lastError: Error | null = null;
  for (const model of TTS_MODELS) {
    try {
      const data = await post(`${model}:generateContent`, {
        contents: [
          {
            role: "user",
            parts: [{ text: `اقرأ بنبرة استشارية واضحة ومدروسة بالعربية: ${clean}` }],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              // أصوات مبنية مسبقاً — تشكيلة عربية جيدة
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });
      const audio = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
      if (!audio) throw new Error(`${model}: لا يوجد صوت في الرد`);
      const inline = audio.inlineData || audio.inline_data;
      return {
        audioBase64: inline.data,
        mimeType: inline.mimeType || inline.mime_type || "audio/mp3",
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }
  throw lastError || new Error("فشل توليد الصوت");
}

/* ==================== 5) Embeddings — بحث دلالي ==================== */

/** توليد متجه دلالي لنص — 768 بعد لـ gemini-embedding-001 */
export async function embedText(text: string): Promise<number[]> {
  const data = await post(`models/${EMBEDDING_MODEL}:embedContent`, {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] },
    // taskType لا يُرسل — قيمة افتراضية تصلح لكل الاستخدامات
  });
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || !values.length) throw new Error("فشل توليد المتجه الدلالي");
  return values;
}

/** توليد متجهات عديدة دفعة واحدة — أسرع من نداء فردي */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const requests = texts.map((t) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: t.slice(0, 8000) }] },
  }));
  const data = await post(`models/${EMBEDDING_MODEL}:batchEmbedContents`, { requests });
  const embeddings = data?.embeddings || [];
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error("عدد المتجهات المُرجعة غير مطابق");
  }
  return embeddings.map((e: any) => e.values as number[]);
}

/** تشابه جيب بين متجهين — 1 = متطابق، 0 = غير مرتبط */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/* ==================== 6) Context Caching ==================== */

export interface CachedContext {
  name: string;
  /** مدى الصلاحية بالثواني */
  ttlSeconds: number;
  expireTime?: string;
}

/**
 * إنشاء كاش لمحتوى ثابت (نظام الإرشادات + تقرير الإشراف) — يخفض الاستهلاك.
 * ⚠️ ملاحظة اختبار حية (أكتوبر 2026): الطبقة المجانية لهذا المفتاح لها
 * TotalCachedContentStorageTokensPerModelFreeTier limit=0 — أي الكاش غير متاح
 * على الحصة المجانية. الدالة ترجع null بهدوء والمسار المباشر يتولى الرد.
 */
export async function createSupervisorCache(systemInstruction: string, reportContext: string): Promise<CachedContext | null> {
  const model = "gemini-3.5-flash"; // مُختبَر فعلياً على المفتاح — الوحيد الذي يسمح بإنشاء كاش
  const body: Record<string, unknown> = {
    model: `models/${model}`,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `=== تقرير الإشراف المُحسب (مرجع ثابت) ===\n${reportContext}` }],
      },
    ],
    ttl: "600s",
  };
  try {
    const data = await post("cachedContents", body);
    const name = data?.name || "";
    if (!name) return null;
    return { name, ttlSeconds: 600, expireTime: data?.expireTime || undefined };
  } catch {
    // limit=0 على الطبقة المجانية — كاش غير متاح، نُرجع null
    return null;
  }
}

/** استدعاء يستخدم الكاش الجاهز + رسالة جديدة فقط — النموذج يُستنتج من الكاش */
export async function generateWithCache(
  cacheName: string,
  userMessage: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<GroundedAnswer> {
  const contents: any[] = [];
  // نضيف سجل المحادثة بعد الكاش — النموذج يذكر السياق ثم الحوار
  for (const turn of history || []) {
    contents.push({ role: turn.role, parts: [{ text: turn.text }] });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const data = await post("gemini-3.5-flash:generateContent", {
    cachedContent: cacheName,
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  });
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("") || "";
  if (!text) throw new Error("استجابة فارغة من الكاش");
  return { text, sources: [] };
}

/* ==================== 7) Batch API — تحليل دفعي ==================== */

export interface BatchResult {
  key: string;
  response?: string;
  groundingSources?: Array<{ title: string; uri: string }>;
  error?: string;
}

/**
 * تحليل عدة عناصر دفعة واحدة عبر batchGenerateContent.
 * الميزة: لا تحترم حد RPM (الحد اليومي فقط) — مثالي لتحليل 50 منشوراً ليلة واحدة.
 */
export async function batchGenerate(
  items: Array<{ key: string; text: string }>,
  systemInstruction?: string,
  maxOutputTokens = 4096
): Promise<BatchResult[]> {
  const model = await (async () => (await getTextModels())[0])();
  const requests = items.map((item) => {
    const req: any = {
      contents: [{ role: "user", parts: [{ text: item.text }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens },
    };
    if (systemInstruction) req.systemInstruction = { parts: [{ text: systemInstruction }] };
    return { key: item.key, request: req };
  });

  const data = await post(`${model}:batchGenerateContent`, { requests }, 120_000);
  const results: BatchResult[] = [];
  const responses = data?.responses || [];
  for (const r of responses) {
    if (r?.error) {
      results.push({ key: r.key || "", error: r.error.message || "خطأ دفعة" });
      continue;
    }
    const candidate = r?.response?.candidates?.[0];
    const text: string =
      candidate?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join("") || "";
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    results.push({
      key: r.key || "",
      response: text,
      groundingSources: groundingChunks
        .map((c: any) => ({ title: c?.web?.title || "مصدر", uri: c?.web?.uri || "" }))
        .filter((s: any) => s.uri)
        .slice(0, 5),
    });
  }
  return results;
}
