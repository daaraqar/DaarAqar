import { NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reels = smartFeaturesStore.getAqarReels();
    return NextResponse.json({ success: true, reels });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
