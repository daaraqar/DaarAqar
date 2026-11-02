import { redirect } from "next/navigation";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const query = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") {
        query.set(key, value);
      }
    }
  }

  const queryString = query.toString();
  redirect(`/forgot-password${queryString ? `?${queryString}` : ""}`);
}
