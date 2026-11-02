import { getCmsPageMetadata } from "@/lib/cms-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getCmsPageMetadata("contact", "تواصل معنا");
}

export default function ContactLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
