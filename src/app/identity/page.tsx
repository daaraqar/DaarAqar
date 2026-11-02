import { redirect } from "next/navigation";

export default function IdentityPage() {
  redirect("/admin?tab=cms");
}

