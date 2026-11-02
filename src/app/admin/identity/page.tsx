import { redirect } from "next/navigation";

export default function AdminIdentityPage() {
  redirect("/admin?tab=cms");
}

