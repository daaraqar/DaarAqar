import type { Metadata } from "next";
import { dbStore } from "./db/store";

export async function getCmsPageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  let page;
  try {
    page = await dbStore.getCmsPageAsync(slug);
  } catch (error) {
    console.error(`[CMS] Failed to load metadata for "${slug}":`, error);
    return { title: fallbackTitle };
  }
  const publishedPage = page?.isPublished ? page : null;
  return {
    title: publishedPage?.metaTitle || publishedPage?.titleAr || fallbackTitle,
    description: publishedPage?.metaDescription || publishedPage?.contentAr.slice(0, 320),
  };
}
