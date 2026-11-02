import { NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await smartFeaturesStore.getConfigAsync();
    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
