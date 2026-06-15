import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { getLocationInsights } from "@/lib/server/location-insights";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const insights = await getLocationInsights();
    return NextResponse.json({ ok: true, insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load location insights.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
