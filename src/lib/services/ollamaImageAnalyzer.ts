import { normalizeEgyptianPhone, toAsciiDigits } from "@/lib/auth/security";

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

const PROMPT = `أنت خبير قراءة لقطات شاشة منشورات العقارات المصرية (فيسبوك/واتساب) من الصور.
الصورة الأولى = لقطة شاشة المنشور. الصورة الثانية (إن وُجدت) = لقطة شاشة التعليقات.

اقرأ كل النص الظاهر في الصور واستخرج:
1) كل الأشخاص الظاهرين في المنشور أو التعليقات: الاسم كما ظهر، رقم الهاتف إن وجد، الدور، ونص التعليق القصير.
2) هل المنشور طلب عقار أم عرض عقار. استخرج تصنيف العقار ومساحته وسعره وموقعه والوصف وعدد العقارات.
3) عدد التعليقات المكتشفة. أرقام الهاتف المصرية تكون 01[0125]xxxxxxxxx أو +20.
4) confidence بين 0 و1 حسب وضوح الصورة، وmissingFields للحقول المهمة الناقصة.
لا تخمّن أرقام الهواتف أو الأسماء. عند غياب المعلومة استخدم نصاً فارغاً أو null.
حوّل السعر إلى أرقام بالجنيه (ألف ×1000، مليون ×1000000).

أعد JSON فقط بهذا الشكل:
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

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  for (const candidate of [
    cleaned,
    cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1),
  ]) {
    if (!candidate || candidate === cleaned && !candidate.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }
  throw new Error("تعذر قراءة استجابة نموذج Ollama المحلي؛ أعد المحاولة بصورة أوضح.");
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim().slice(0, maxLength);
  return result || undefined;
}

function optionalPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizePhone(value: unknown): string | undefined {
  const normalized = normalizeEgyptianPhone(toAsciiDigits(String(value || "")));
  return /^\+201[0125]\d{8}$/.test(normalized) ? normalized : undefined;
}

function imageData(value: string): string {
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
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

  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b";
  const images = [input.postImage, input.commentsImage]
    .filter((image): image is string => Boolean(image))
    .map(imageData);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: `${PROMPT}\n\nحلل الصور المرفقة وأعد JSON فقط.`, images }],
          format: "json",
          stream: false,
          options: { temperature: 0.1, num_predict: 4096 },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("انتهت مهلة تحليل الصور. تأكد أن Ollama يعمل على جهاز المكتب وأعد المحاولة.");
      }
      throw new Error(
        `تعذر الاتصال بـOllama على ${baseUrl}. شغّل Ollama على جهاز المكتب واضبط OLLAMA_BASE_URL في خادم التطبيق.`
      );
    }

    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      if (response.status === 404) {
        throw new Error(`نموذج ${model} غير موجود في Ollama. نفّذ: ollama pull ${model}`);
      }
      throw new Error(`فشل Ollama [${model}] برمز ${response.status}: ${details}`);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") throw new Error("أعاد Ollama استجابة غير صالحة");
    const message = (payload as { message?: { content?: unknown } }).message;
    if (typeof message?.content !== "string" || !message.content.trim()) {
      throw new Error(`لم يُرجع نموذج ${model} نتيجة. تأكد من تحميل نموذج الرؤية.`);
    }
    const result = extractJson(message.content);

    const people: ExtractedEntry[] = Array.isArray(result.people)
      ? result.people
          .filter((person): person is Record<string, unknown> =>
            Boolean(person && typeof person === "object" && !Array.isArray(person))
          )
          .filter((person) => person.name || person.phone)
          .map((person) => ({
            name: optionalString(person.name, 120) || "مجهول",
            phone: normalizePhone(person.phone),
            role: optionalString(person.role, 40),
            comment: optionalString(person.comment, 200),
          }))
          .slice(0, 30)
      : [];
    const phone = normalizePhone(result.phone) || people.find((person) => person.phone)?.phone;
    const isClient = result.type === "client";
    const priceMin = optionalPositiveNumber(result.priceMin);
    const priceMax = optionalPositiveNumber(result.priceMax);
    const listingsCount = optionalPositiveNumber(result.listingsCount);
    const confidence = Math.min(1, Math.max(0, Number(result.confidence) || 0));
    const reasoning = optionalString(result.reasoning, 400);
    const missingFields = Array.isArray(result.missingFields)
      ? result.missingFields.filter((field): field is string => typeof field === "string").slice(0, 6)
      : [];
    const notes = [
      isClient ? "طلب مستخرج من صورة منشور بواسطة Ollama المحلي" : "عرض مستخرج من صورة منشور بواسطة Ollama المحلي",
      reasoning ? `تحليل البوت: ${reasoning}` : null,
      people.length > 1
        ? `أرقام وأسماء إضافية من التعليقات: ${people.filter((person) => person.phone && person.name !== result.name).map((person) => `${person.name} ${person.phone}`).join("، ").slice(0, 300)}`
        : null,
      `درجة الثقة: ${Math.round(confidence * 100)}%`,
      missingFields.length ? `ناقص: ${missingFields.join("، ").slice(0, 200)}` : null,
    ].filter(Boolean).join(" • ").slice(0, 1500);

    const draft: ImageAnalysis["draft"] = {
      type: isClient ? "client" : "broker",
      name: optionalString(result.name, 120) || people[0]?.name || "منشور صورة",
      phone,
      requestedProperty: optionalString(result.requestedProperty, 300),
      requestedCategory: optionalString(result.requestedCategory, 80),
      requestedArea: optionalPositiveNumber(result.requestedArea),
      requestedPriceRange: optionalString(result.requestedPriceRange, 120),
      priceMin,
      priceMax,
      transactionType: result.transactionType === "rent" ? "rent" : "sale",
      requestedLocation: optionalString(result.requestedLocation, 160),
      availableListings: optionalString(result.availableListings, 1000),
      listingsCount,
      notes,
      isVerified: false,
      createdBy: "بوت Ollama المحلي",
    };

    return {
      intent: result.intent === "طلب" ? "طلب" : "عرض",
      confidence,
      priceMin,
      priceMax,
      transactionType: draft.transactionType,
      reasoning,
      missingFields,
      people,
      commentsFound: optionalPositiveNumber(result.commentsFound),
      propertiesFound: optionalPositiveNumber(result.propertiesFound),
      draft,
    };
  } finally {
    clearTimeout(timeout);
  }
}
