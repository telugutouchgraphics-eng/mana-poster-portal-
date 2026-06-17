import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { getLocationInsights } from "@/lib/server/location-insights";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const actorHasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
    const allowedStateNames = actorHasAllRegions
      ? undefined
      : new Set(
          DASHBOARD_REGIONS
            .filter((region) => allowedRegionIds.includes(region.id))
            .map((region) => region.name.trim().toLowerCase()),
        );
    const insights = await getLocationInsights(allowedStateNames);
    return NextResponse.json({ ok: true, insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load location insights.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
