import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";

const PUBLIC_PAGE_SLUGS = new Set(["about", "contact", "terms", "privacy"]);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  if (!PUBLIC_PAGE_SLUGS.has(params.slug)) {
    return NextResponse.json({ error: "الصفحة غير موجودة" }, { status: 404 });
  }

  try {
    const page = await dbStore.getCmsPageAsync(params.slug);
    if (!page || !page.isPublished) {
      return NextResponse.json({ error: "الصفحة غير منشورة" }, { status: 404 });
    }

    return NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "تعذر تحميل محتوى الصفحة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
