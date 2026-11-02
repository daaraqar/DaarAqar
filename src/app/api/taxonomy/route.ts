import { NextResponse } from "next/server";
import { dbStore } from "@/lib/db/store";
import {
  filterMeetGhamrDistricts,
  MEET_GHAMR_CITY,
} from "@/lib/db/meet-ghamr-geography";

export async function GET() {
  try {
    const cities = [MEET_GHAMR_CITY];
    const districts = filterMeetGhamrDistricts(dbStore.getDistricts());

    return NextResponse.json({ cities, districts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "خطأ في جلب بيانات المناطق";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
