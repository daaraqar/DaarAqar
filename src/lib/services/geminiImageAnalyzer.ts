/**
 * Gemini Image Analyzer — محلل الصور فقط
 * ----------------------------------------
 * تأخذ صورة المنشور (+ صورة التعليقات اختيارياً) وتستخرج منها:
 *  - الأشخاص: كل اسم ظاهر مع رقم هاتف إن وُجد + دوره (صاحب المنشور/معلق)
 *  - العقار: تصنيف، مساحة، سعر (رقمي + نصي)، موقع، نوع الصفقة
 *  - عدد التعليقات المكتشفة
 * وترجع مسودة سجل CRM جاهزة للحفظ كغير مؤكد.
 *
 * الحل الجذري لخطأ 404: القائمة الديناميكية من ListModels —
 * نجيب الموديلات المتاحة فعلياً على المفتاح ونرتبها بالأحدث أولاً،
 * فلا فشل أبداً بسبب اسم موديل مكتوب يدوياً غير موجود.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

/** ترتيب التفضيل اليدوي — يُستخدم فقط لترتيب نتائج ListModels وليس للاستدعاء مباشرة */
const MODEL_PREFERENCE = [
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-flash",
];

/** كاش للموديلات المتاحة — لا نستعلم من ListModels في كل طلب */
let cachedModels: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30 * 60_000; // 30 دقيقة

async function fetchAvailableModels(): Promise<string[]> {
  if (cachedModels && Date.now() - cacheTime < CACHE_TTL_MS) return cachedModels;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}/models?key=${encodeURIComponent(apiKey())}&pageSize=100`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ListModels فشل: ${res.status}`);
    const data = await res.json();
    const models: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          // يدعم التوليد النصي (وبالتالي الصور أيضاً)
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent") &&
          // نستبعد موديلات التضمين/الصوت/الفيديو المخصصة
          !/embedding|aqa|tts|image|veo|imagen|banana|native-audio|live/i.test(m.name)
      )
      .map((m: any) => String(m.name).replace("models/", ""))
      // الأحدث أولاً (أسماء فيها أرقام أعلى = أحدث غالباً)
      .sort((a: string, b: string) => {
        const prefA = MODEL_PREFERENCE.findIndex((p) => a.startsWith(p));
        const prefB = MODEL_PREFERENCE.findIndex((p) => b.startsWith(p));
        if (prefA !== -1 && prefB !== -1) return prefA - prefB;
        if (prefA !== -1) return -1;
        if (prefB !== -1) return 1;
        return b.localeCompare(a);
      });

    if (!models.length) throw new Error("لا توجد موديلات متاحة على هذا المفتاح");
    cachedModels = models;
    cacheTime = Date.now();
    return models;
  } finally {
    clearTimeout(timeout);
  }
}

export interface ExtractedEntry {
  name: string;
  phone?: string;
  role?: string;
  comment?: string;
}

export interface ImageAnalysis {
  intent: string;
  confidence: number;
  priceMin?: number;
  priceMax?: number;
  transactionType?: "sale" | "rent";
  reasoning?: string;
  missingFields?: string[];
  people: ExtractedEntry[];
  commentsFound?: number;
  propertiesFound?: number;
  draft?: {
    type: "client" | "broker";
    name: string;
    phone?: string;
    requestedProperty?: string;
    requestedCategory?: string;
    requestedArea?: number;
    requestedPriceRange?: string;
    priceMin?: number;
    priceMax?: number;
    transactionType?: "sale" | "rent";
    requestedLocation?: string;
    availableListings?: string;
    listingsCount?: number;
    notes?: string;
    isVerified: boolean;
    createdBy: string;
  };
}

function apiKey(): string {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!key) throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");
  return key;
}

const PROMPT = `أنت خبير قراءة لقطات شاشة منشورات العقارات المصرية (فيسبوك/واتساب) من الصور.
الصورة الأولى = لقطة شاشة المنشور. الصورة الثانية (إن وُجدت) = لقطة شاشة التعليقات.

مهمتك: اقرأ كل النص الظاهر في الصور واستخرج:

1) الأشخاص (أهم شيء):
   - كل شخص ظاهر في المنشور أو التعليقات: صاحب المنشور + كل معلق.
   - لكل شخص: الاسم كما ظهر بالحرف، ورقم هاتفه إن ورد (مصري 01[0125]xxxxxxxxx أو +20)، ودوره
     ("صاحب المنشور" أو "معلق" أو "سمسار" أو "مالك")، ونص تعليقه القصير إن وُجد.
   - رقم الهاتف يظهر غالباً في نهاية المنشور ("للتواصل 01012345678") أو في تعليق.

2) العقار:
   - نوع الصفقة: sale (للبيع) أو rent (للإيجار).
   - التصنيف: شقة / فيلا / دوبلكس / أرض / محل / مكتب / عيادة / استوديو / شاليه / تاون هاوس / عمارة / أخرى.
   - المساحة رقم بالمتر، السعر النصي كما ورد + السعر الرقمي بالجنيه ("ألف" ×1000، "مليون" ×1000000).
   - الموقع: القرية/الحي/الشارع، وصف العقار الكامل.
   - عدد العقارات المعروضة في المنشور (قد يحتوي أكثر من عقار).

3) عدد التعليقات المكتشفة في صورة التعليقات.

4) confidence بين 0 و 1 حسب وضوح الصورة. missingFields: الحقول الناقصة المهمة.

أعد JSON فقط بدون markdown بهذا الشكل:
{
  "type": "client"|"broker",
  "intent": "عرض"|"طلب",
  "name": "اسم صاحب المنشور",
  "phone": "رقم صاحب المنشور أو فارغ",
  "people": [{"name":"...","phone":"...","role":"...","comment":"..."}],
  "requestedCategory": "...",
  "requestedArea": number|null,
  "requestedPriceRange": "...",
  "priceMin": number|null,
  "priceMax": number|null,
  "transactionType": "sale"|"rent",
  "requestedLocation": "...",
  "requestedProperty": "وصف الطلب",
  "availableListings": "وصف العرض",
  "listingsCount": number|null,
  "commentsFound": number,
  "propertiesFound": number,
  "confidence": 0.0,
  "reasoning": "...",
  "missingFields": ["..."]
}`;

function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("تعذر قراءة استجابة الذكاء الاصطناعي");
  }
}

function toInlinePart(base64: string, mime?: string) {
  return {
    inline_data: {
      mime_type: mime || (base64.startsWith("data:image/png") ? "image/png" : "image/jpeg"),
      data: base64.replace(/^data:[^;]+;base64,/, ""),
    },
  };
}

export async function analyzeImagesOnly(input: {
  postImage?: string;
  postImageMimeType?: string;
  commentsImage?: string;
  commentsImageMimeType?: string;
}): Promise<ImageAnalysis> {
  if (!input.postImage && !input.commentsImage) {
    throw new Error("لا توجد صور للتحليل");
  }

  const parts: any[] = [{ text: PROMPT }];
  if (input.postImage) parts.push(toInlinePart(input.postImage, input.postImageMimeType));
  if (input.commentsImage) parts.push(toInlinePart(input.commentsImage, input.commentsImageMimeType));
  parts.push({ text: "حلل الصور المرفقة وأعد JSON فقط." });

  let lastError: Error | null = null;
  let models: string[];
  try {
    models = await fetchAvailableModels();
  } catch (err) {
    // لو فشل ListModels نستخدم fallback ثابت مضمون الوجود على أي مفتاح Gemini
    models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    try {
      const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(apiKey())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini [${model}] خطأ ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const text: string | undefined = candidate?.content?.parts
        ?.map((p: any) => p.text)
        .filter(Boolean)
        .join("");
      if (!text) throw new Error(`Gemini [${model}]: استجابة فارغة`);

      const p = extractJson(text);

      // تطبيع — لا نثق بالنموذج أعمى
      const people: ExtractedEntry[] = Array.isArray(p.people)
        ? p.people
          .filter((x: any) => x && (x.name || x.phone))
          .map((x: any) => ({
            name: String(x.name || "مجهول").slice(0, 120),
            phone: /^(\+?2)?01[0125][0-9]{8}$/.test(String(x.phone || "").replace(/[\s-]/g, ""))
              ? String(x.phone).replace(/[\s-]/g, "")
              : undefined,
            role: x.role ? String(x.role).slice(0, 40) : undefined,
            comment: x.comment ? String(x.comment).slice(0, 200) : undefined,
          }))
          .slice(0, 30)
        : [];

      const phoneRaw = String(p.phone || people.find((x) => x.phone)?.phone || "").replace(/[\s-]/g, "");
      const mainPhone = /^(\+?2)?01[0125][0-9]{8}$/.test(phoneRaw) ? phoneRaw : undefined;

      const area = Number(p.requestedArea);
      const priceMin = Number(p.priceMin);
      const priceMax = Number(p.priceMax);
      const listings = Number(p.listingsCount);

      const isClient = p.type === "client";
      const notesParts = [
        isClient ? "🤖 طلب مستخرج من صورة منشور" : "🤖 عرض مستخرج من صورة منشور",
        p.reasoning ? `تحليل البوت: ${p.reasoning}` : null,
        people.length > 1 ? `أرقام وأسماء إضافية من التعليقات: ${people.filter((x) => x.phone && x.name !== p.name).map((x) => `${x.name} ${x.phone}`).join("، ").slice(0, 300)}` : null,
        `درجة الثقة: ${Math.round(Number(p.confidence || 0) * 100)}%`,
        Array.isArray(p.missingFields) && p.missingFields.length ? `ناقص: ${p.missingFields.join("، ").slice(0, 200)}` : null,
      ].filter(Boolean);

      const draft = {
        type: isClient ? ("client" as const) : ("broker" as const),
        name: String(p.name || people[0]?.name || "منشور صورة").slice(0, 120),
        phone: mainPhone || "01000000000",
        requestedProperty: p.requestedProperty ? String(p.requestedProperty).slice(0, 300) : undefined,
        requestedCategory: p.requestedCategory ? String(p.requestedCategory).slice(0, 80) : undefined,
        requestedArea: Number.isFinite(area) && area > 0 ? area : undefined,
        requestedPriceRange: p.requestedPriceRange ? String(p.requestedPriceRange).slice(0, 120) : undefined,
        priceMin: Number.isFinite(priceMin) && priceMin > 0 ? priceMin : undefined,
        priceMax: Number.isFinite(priceMax) && priceMax > 0 ? priceMax : undefined,
        transactionType: p.transactionType === "rent" ? ("rent" as const) : ("sale" as const),
        requestedLocation: p.requestedLocation ? String(p.requestedLocation).slice(0, 160) : undefined,
        availableListings: p.availableListings ? String(p.availableListings).slice(0, 1000) : undefined,
        listingsCount: Number.isFinite(listings) && listings > 0 ? listings : undefined,
        notes: notesParts.join(" • ").slice(0, 1500),
        isVerified: false,
        createdBy: "بوت تحليل الصور",
      };

      return {
        intent: p.intent === "طلب" ? "طلب" : "عرض",
        confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0)),
        priceMin: draft.priceMin,
        priceMax: draft.priceMax,
        transactionType: draft.transactionType,
        reasoning: p.reasoning ? String(p.reasoning).slice(0, 400) : undefined,
        missingFields: Array.isArray(p.missingFields) ? p.missingFields.map(String).slice(0, 6) : [],
        people,
        commentsFound: Number.isFinite(Number(p.commentsFound)) ? Number(p.commentsFound) : undefined,
        propertiesFound: Number.isFinite(Number(p.propertiesFound)) ? Number(p.propertiesFound) : undefined,
        draft,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError") break;
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("فشل تحليل الصور بالذكاء الاصطناعي");
}
