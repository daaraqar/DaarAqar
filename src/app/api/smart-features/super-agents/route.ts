import { NextRequest, NextResponse } from "next/server";
import { smartFeaturesStore } from "@/lib/db/smartFeaturesStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const config = smartFeaturesStore.getConfig();
    if (!config.features.superAgentAccreditation) {
      return NextResponse.json(
        { success: false, error: "منظومة الوكلاء المعتمدين معطلة حالياً" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (userId) {
      const agent = smartFeaturesStore.getSuperAgentByUserId(userId);
      return NextResponse.json({ success: true, data: agent });
    }

    const agents = smartFeaturesStore.getSuperAgents();
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error("GET /api/smart-features/super-agents error:", error);
    return NextResponse.json(
      { success: false, error: "فشل جلب بيانات الوكلاء المعتمدين" },
      { status: 500 }
    );
  }
}
