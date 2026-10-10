import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { getLocationInsights } from "@/lib/server/location-insights";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const requestedRegionId = (url.searchParams.get("regionId") ?? "").trim();
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const actorHasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
    let allowedStateNames: Set<string> | undefined;

    if (requestedRegionId && requestedRegionId !== "all") {
      const match = DASHBOARD_REGIONS.find((r) => r.id === requestedRegionId);
      if (match) {
        allowedStateNames = new Set([match.name.trim().toLowerCase()]);
      }
    } else if (!actorHasAllRegions) {
      allowedStateNames = new Set(
        DASHBOARD_REGIONS
          .filter((region) => allowedRegionIds.includes(region.id))
          .map((region) => region.name.trim().toLowerCase()),
      );
    }

    const insights = await getLocationInsights(allowedStateNames);
    return NextResponse.json({ ok: true, insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load location insights.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
