/**
 * Gemini Auth — توحيد طريقة المصادقة
 * -----------------------------------
 * مفتاح المستخدم يبدأ بـ "AQ." (OAuth access token وليس مفتاح API قياسي AIza...).
 * الاستدعاء بـ ?key= يفشل 404 على التوليد رغم أن ListModels يعمل.
 * الحل: استخدم Authorization: Bearer header — يعمل مع كلا النوعين.
 */

export interface GeminiAuth {
  /** query param ?key=xxx للمفاتيح القياسية AIza... */
  keyParam: string;
  /** Authorization header للمفاتيح OAuth (AQ. ...) */
  headers: Record<string, string>;
}

export function getGeminiAuth(): GeminiAuth {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();
  if (!key) throw new Error("مفتاح GEMINI_API_KEY غير مضبوط على الخادم");

  // مفتاح OAuth token (يبدأ بـ AQ. أو ya29.) — يستخدم Bearer header
  if (key.startsWith("AQ.") || key.startsWith("ya29.")) {
    return {
      keyParam: "",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    };
  }

  // مفتاح API قياسي (AIza...) — يستخدم ?key=
  return {
    keyParam: `key=${encodeURIComponent(key)}`,
    headers: { "Content-Type": "application/json" },
  };
}
