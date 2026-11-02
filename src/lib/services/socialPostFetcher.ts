/**
 * Social Post Fetcher — استخراج محتوى منشور من رابط
 * ---------------------------------------------------
 * عند وضع رابط منشور (فيسبوك/إنستغرام/إلخ) نحاول جلب الصفحة server-side
 * واستخراج النص من وسوم Open Graph / meta description / JSON-LD.
 * صفحات فيسبوك كثيراً ما تحجب الروبوتات — نتجاهل الفشل بصمت
 * ويبقى المستخدم قادراً على لصق النص يدوياً كالوضع الحالي.
 */

export interface FetchedPostContent {
  /** عنوان المنشور / الصفحة */
  title?: string;
  /** وصف المنشور المستخرج */
  description?: string;
  /** النص الكامل المستخرج (og:description + body text مختصر) */
  text: string;
  /** صورة المنشور إن وجدت (og:image) */
  imageUrl?: string;
  /** هل نجح الاستخراج فعلاً أم رجعنا فارغاً */
  ok: boolean;
  /** سبب الفشل إن حدث (للعرض في الواجهة) */
  reason?: string;
}

/** بوت متصفح عادي — بعض المواقع ترفض بدون User-Agent معقول */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function metaContent(html: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return decodeEntities(m[1]).trim();
  }
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** استخراج نص قابل للعرض من HTML خام (بدون سكربت/ستايل) */
function extractBodyText(html: string, maxLen: number): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const text = decodeEntities(
    withoutScripts
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\r]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  return text.slice(0, maxLen);
}

/**
 * جلب محتوى منشور من رابط — يُستدعى server-side فقط.
 * لا يرمي استثناءات أبداً؛ يرجع { ok: false, reason } عند الفشل
 * كي لا يتوقف التحليل إذا كانت الصفحة محمية (فيسبوك غالباً كذلك).
 */
export async function fetchSocialPost(url: string): Promise<FetchedPostContent> {
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { text: "", ok: false, reason: "الرابط غير صالح (يجب أن يبدأ بـ http أو https)" };
    }
  } catch {
    return { text: "", ok: false, reason: "الرابط غير صالح" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.9",
      },
      // منع اتباع روابط relocator فيسبوك الداخلية من فتح موارد عشوائية
      cache: "no-store",
    });

    if (!res.ok) {
      return { text: "", ok: false, reason: `الصفحة رفضت الطلب (كود ${res.status}) — انسخ النص يدوياً` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return { text: "", ok: false, reason: "الرابط لا يُشير لصفحة ويب — انسخ النص يدوياً" };
    }

    const html = (await res.text()).slice(0, 500_000); // سقف 500KB

    const title = metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const description =
      metaContent(html, [
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ]) || "";
    const imageUrl = metaContent(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);

    const bodyText = extractBodyText(html, 6000);
    const text = [description, bodyText].filter(Boolean).join("\n\n").trim();

    const looksReal = text.length >= 40;
    return {
      title,
      description,
      text,
      imageUrl,
      ok: looksReal,
      reason: looksReal
        ? undefined
        : "تعذر استخراج نص المنشور من الرابط (غالباً حماية تسجيل دخول فيسبوك) — الصق النص يدوياً",
    };
  } catch (err: unknown) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      text: "",
      ok: false,
      reason: aborted ? "استغرق جلب الرابط وقتاً طويلاً — الصق النص يدوياً" : "تعذر الوصول للرابط — الصق النص يدوياً",
    };
  } finally {
    clearTimeout(timeout);
  }
}
