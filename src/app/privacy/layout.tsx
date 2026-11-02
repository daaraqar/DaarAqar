import { getCmsPageMetadata } from "@/lib/cms-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return getCmsPageMetadata("privacy", "سياسة الخصوصية");
}

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
