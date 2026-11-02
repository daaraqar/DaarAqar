import { getCmsPageMetadata } from "@/lib/cms-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getCmsPageMetadata("terms", "الشروط والأحكام");
}

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
