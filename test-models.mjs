// اختبار مباشر: ListModels + استدعاء generateContent بصورة حقيقية على كل موديل
// الاستخدام: $env:GEMINI_API_KEY="..."; node test-models.mjs

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY غير مضبوط");

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const BLACKLIST = ["embedding", "aqa", "tts", "imagen", "veo", "banana", "native-audio", "live", "gemma", "learnlm"];

const res = await fetch(`${ENDPOINT}/models?key=${encodeURIComponent(key)}&pageSize=200`);
if (!res.ok) throw new Error(`ListModels فشل: ${res.status}`);
const data = await res.json();

const models = (data.models || [])
  .filter((m) =>
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent") &&
    !BLACKLIST.some((b) => m.name.toLowerCase().includes(b))
  )
  .map((m) => String(m.name).replace("models/", ""))
  .sort((a, b) => b.localeCompare(a));

console.log("Models found:", models.length);

// صورة PNG حقيقية 1x1 حمراء
const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const results = [];
for (const model of models) {
  try {
    const r = await fetch(`${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: "image/png", data: tinyPng } },
              { text: "ما لون هذه الصورة؟ رد بكلمة واحدة فقط." },
            ],
          },
        ],
      }),
    });
    if (r.ok) {
      const d = await r.json();
      const text = d?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") || "(فارغ)";
      console.log(`✅ ${model}: ${text.slice(0, 40)}`);
      results.push({ model, ok: true });
    } else {
      const errText = await r.text().catch(() => "");
      console.log(`❌ ${model}: ${r.status} — ${errText.slice(0, 120)}`);
      results.push({ model, ok: false, status: r.status });
    }
  } catch (e) {
    console.log(`❌ ${model}: ${e.message}`);
    results.push({ model, ok: false, error: e.message });
  }
}

console.log("\n=== الملخص: الموديلات التي تعمل فعلياً بالصور ===");
results.filter((r) => r.ok).forEach((r) => console.log("  ✅", r.model));
