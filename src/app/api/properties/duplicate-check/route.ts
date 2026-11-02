import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = dbStore.checkPotentialDuplicates(body);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ أثناء فحص تكرار الإعلان";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
