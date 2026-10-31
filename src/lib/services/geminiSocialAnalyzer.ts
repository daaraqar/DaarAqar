/**
 * Google Gemini AI Service — Social Post Analyzer
 * ------------------------------------------------
 * يحلل منشورات التواصل الاجتماعي (نص منسوخ و/أو لقطة شاشة) ويستخرج
 * بيانات العقار المهيكلة لإنشاء سجل في صفحة العروض والطلبات (CRM).
 *
 * المدخل: نص المنشور + التعليقات + رابط المصدر (اختياري: صورة base64)
 * المخرج: ClientRecord structured JSON + درجة ثقة + سبب التصنيف
 *
 * يتطلب GEMINI_API_KEY في متغيرات البيئة (server-side only).
 */

/** النماذج بالترتيب — أول من ينجح يُستخدم (أحدث أولاً، القديم fallback)
 * مُحدّث أكتوبر 2026 — أسماء النماذج مُتحقق منها فعلياً من مفتاح GEMINI_API_KEY */
import { getTextModels, blacklistModel } from "./geminiModelRegistry";
import { getGeminiAuth } from "./geminiAuth";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiAnalyzedLead {
  /** client = طلب بحث، broker/owner عرض — نُبسّطها لنظام CRM الحالي */
  type: "client" | "broker";
  name: string;
  phone?: string;
  requestedProperty?: string;
  requestedCategory?: string;
  requestedArea?: number;
  requestedPriceRange?: string;
  /** السعر الرقمي الأدنى بالجنيه — للفلترة اللاحقة */
  priceMin?: number;
  /** السعر الرقمي الأقصى بالجنيه — للفلترة اللاحقة */
  priceMax?: number;
  /** نوع الصفقة: sale (بيع) أو rent (إيجار) */
  transactionType?: "sale" | "rent";
  requestedLocation?: string;
  availableListings?: string;
  listingsCount?: number;
  notes?: string;
  /** نص المنشور الخام كما هو (للمراجعة) */
  rawPostText?: string;
  /** روابط محتملة لأرقام أخرى وردت في التعليقات */
  extraPhones?: string[];
  /** اتجاه المنشور */
  intent: "عرض" | "طلب";
  /** 0-1 مدى ثقة النموذج في الاستخراج */
  confidence: number;
  /** ملاحظة تحليلية قصيرة: لماذا صنّفه هكذا */
  reasoning?: string;
  /** ماذا ينقص ليكمل السجل (مثلاً رقم الهاتف) */
  missingFields?: string[];
}

export interface GeminiAnalyzeInput {
  postUrl?: string;
  postText: string;
  commentsText?: string;
  /** صورة base64 (data:image/...;base64,....) اختيارية — لقطة شاشة المنشور */
  imageBase64?: string;
  imageMimeType?: string;
}

const SYSTEM_PROMPT = `أنت مساعد خبير في تحليل منشورات العقارات المصرية من وسائل التواصل الاجتماعي (فيسبوك/إنستغرام).
مهمتك: استخراج بيانات العقار من نص المنشور وتعليقاته (ووصف الصورة إن وجدت) وإرجاع JSON فقط بدون أي شرح.

قواعد صارمة:
1. حدد النوع: إن كان المنشور "يطلب" عقاراً (مطلوب/أبحث/عايز أشتري/أكر) → type="client" و intent="طلب".
   إن كان "يعرض" عقاراً للبيع أو الإيجار (للبيع/للإيجار/متاح/فرصة) → type="broker" و intent="عرض".
2. استخرج اسم صاحب المنشور إن وُجد، وإلا استخدم "منشور فيسبوك".
3. رقم الهاتف المصري: 01[0125]xxxxxxxxx أو +20 — إن لم يوجد في المنشور ابحث في التعليقات وضع الرئيسي في phone وأي رقم آخر في extraPhones.
4. السعر: النص كما ورد (مثلاً "850 ألف" أو "1.2 مليون" أو "3500 شهرياً") في requestedPriceRange.
   وحوّل السعر لرقمين بالجنيه المصري:
   - priceMin: أقل سعر بالجنيه (مثلاً "850 ألف" → 850000).
   - priceMax: أقصى سعر بالجنيه (إذا كان نطاق مثل "800-950 ألف" → 950000، وإلا نفس priceMin).
   - كلمات مثل "ألف" = ×1000، "مليون" = ×1000000، "مليار" = ×1000000000.
   - إذا كان الإيجار شهرياً اجعل السعر هو الإيجار الشهري بالجنيه.
5. transactionType: "sale" إن كان المنشور للبيع، "rent" إن كان للإيجار. إن لم يتضح اجعله "sale".
6. التصنيف: اختر واحدة بالضبط من هذه القائمة في requestedCategory (استخدم أقرب كلمة إذا لم تطابق حرفياً):
   شقة / فيلا / دوبلكس / بنتهاوس / رووف / استوديو / تاون هاوس / توين هاوس / شاليه / أرض / محل / مكتب / عيادة / مخزن / مصنع / عمارة / قطعة أرض / أخرى
7. المساحة رقم فقط بالمتر في requestedArea.
8. الموقع: القرية/الشارع/الحي في requestedLocation (نطاقنا: مركز ميت غمر والدقهلية).
9. اجمع وصف العقار الكامل في availableListings للعروض أو requestedProperty للطلبات.
10. confidence بين 0 و 1 حسب وضوح البيانات. اذكر في reasoning سبب التصنيف باختصار.
11. missingFields: اذكر الحقول المهمة الناقصة (مثل "phone" أو "price").

أعد فقط JSON بهذا الشكل بدون markdown:
{
  "type": "client" | "broker",
  "intent": "عرض" | "طلب",
  "name": "...",
  "phone": "...", 
  "extraPhones": ["..."],
  "requestedProperty": "...",
  "requestedCategory": "...",
  "requestedArea": number | null,
  "requestedPriceRange": "...",
  "priceMin": number | null,
  "priceMax": number | null,
  "transactionType": "sale" | "rent",
  "requestedLocation": "...",
  "availableListings": "...",
  "listingsCount": number | null,
  "notes": "...",
  "rawPostText": "أول 500 حرف من النص الخام",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "missingFields": ["..."]
}`;

/** Extract JSON from a model response that may wrap it in markdown fences. */
function extractJson(text: string): any {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: find first { ... last }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("تعذر قراءة استجابة الذكاء الاصطناعي");
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim());
}

async function callGeminiModel(model: string, apiKey: string, parts: any[]): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);

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
            temperature: 0.2, // دقة عالية وإبداع منخفض للاستخراج المنظم
            // النماذج الجديدة (3.x) تفكّر داخلياً — نزيد السقف لاستيعاب التفكير + الرد
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
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
    const candidate = data?.candidates?.[0];
    const text: string | undefined = candidate?.content?.parts
      ?.map((p: any) => p.text)
      .filter(Boolean)
      .join("");
    if (!text) {
      throw new Error(`Gemini [${model}]: استجابة فارغة`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeSocialPostWithGemini(input: GeminiAnalyzeInput): Promise<GeminiAnalyzedLead> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");
  }

  const parts: any[] = [
    {
      text:
        `${SYSTEM_PROMPT}\n\n=== نص المنشور ===\n${input.postText.slice(0, 6000)}\n\n` +
        (input.commentsText ? `=== التعليقات ===\n${input.commentsText.slice(0, 4000)}\n\n` : "") +
        (input.postUrl ? `=== رابط المصدر ===\n${input.postUrl}\n\n` : "") +
        `حلل المحتوى أعلاه وأعد JSON فقط.`,
    },
  ];

  if (input.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: input.imageMimeType || "image/jpeg",
        data: input.imageBase64.replace(/^data:[^;]+;base64,/, ""),
      },
    });
  }

  // Fallback chain: جرّب النماذج المكتشفة ديناميكياً من المفتاح نفسه
  let lastError: Error | null = null;
  const models = await getTextModels();
  for (const model of models) {
    try {
      const text = await callGeminiModel(model, apiKey, parts);
      const parsed = extractJson(text);

      // Normalize & validate — never trust the model blindly
      const area = Number(parsed.requestedArea);
      const listings = Number(parsed.listingsCount);
      const phoneRaw = String(parsed.phone || "").replace(/[\s-]/g, "");

      return {
        type: parsed.type === "client" ? "client" : "broker",
        intent: parsed.intent === "طلب" ? "طلب" : "عرض",
        name: String(parsed.name || "منشور فيسبوك").slice(0, 120),
        phone: /^(\+?2)?01[0125][0-9]{8}$/.test(phoneRaw) ? phoneRaw : undefined,
        extraPhones: Array.isArray(parsed.extraPhones)
          ? parsed.extraPhones.map((p: any) => String(p).replace(/[\s-]/g, "")).filter(Boolean).slice(0, 5)
          : [],
        requestedProperty: parsed.requestedProperty ? String(parsed.requestedProperty).slice(0, 300) : undefined,
        requestedCategory: parsed.requestedCategory ? String(parsed.requestedCategory).slice(0, 80) : undefined,
        requestedArea: Number.isFinite(area) && area > 0 ? area : undefined,
        requestedPriceRange: parsed.requestedPriceRange ? String(parsed.requestedPriceRange).slice(0, 120) : undefined,
        priceMin: Number.isFinite(Number(parsed.priceMin)) && Number(parsed.priceMin) > 0 ? Number(parsed.priceMin) : undefined,
        priceMax: Number.isFinite(Number(parsed.priceMax)) && Number(parsed.priceMax) > 0 ? Number(parsed.priceMax) : undefined,
        transactionType: parsed.transactionType === "rent" ? "rent" : "sale",
        requestedLocation: parsed.requestedLocation ? String(parsed.requestedLocation).slice(0, 160) : undefined,
        availableListings: parsed.availableListings ? String(parsed.availableListings).slice(0, 1000) : undefined,
        listingsCount: Number.isFinite(listings) && listings > 0 ? listings : undefined,
        notes: parsed.notes ? String(parsed.notes).slice(0, 800) : undefined,
        rawPostText: parsed.rawPostText ? String(parsed.rawPostText).slice(0, 500) : undefined,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        reasoning: parsed.reasoning ? String(parsed.reasoning).slice(0, 400) : undefined,
        missingFields: Array.isArray(parsed.missingFields) ? parsed.missingFields.map(String).slice(0, 6) : [],
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // 404/400 → النموذج غير متاح لهذا المفتاح، جرّب التالي
      // Abort/timeout → لا تكرر، الخدمة كلها بطيئة
      if (lastError.name === "AbortError") break;
      continue;
    }
  }

  throw lastError || new Error("فشل تحليل المنشور بالذكاء الاصطناعي");
}
