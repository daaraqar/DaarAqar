import { getCmsPageMetadata } from "@/lib/cms-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getCmsPageMetadata("about", "عن المنصة");
}

export default function AboutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
