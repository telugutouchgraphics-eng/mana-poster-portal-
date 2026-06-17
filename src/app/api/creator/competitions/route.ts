import { NextRequest, NextResponse } from "next/server";
import { resolveCreatorReadContext } from "@/lib/server/creator-dashboard";
import { loadPortalAnalyticsSnapshot } from "@/lib/server/dashboard-metrics";
import {
  buildCompetitionCategoryLabels,
  buildCompetitionSnapshots,
  filterCreatorCompetitionSnapshots,
  loadCompetitions,
} from "@/lib/server/competitions";
import { localizeCategoryLabel } from "@/lib/dashboard-category-localization";
import { requireRole } from "@/lib/server/auth";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const creator = await resolveCreatorReadContext(req);
    if (!creator) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
        requiresAsCreator: true,
        profile: null,
        competitions: [],
      });
    }
    const [competitions, analytics] = await Promise.all([
      loadCompetitions(),
      loadPortalAnalyticsSnapshot(),
    ]);
    const posters = analytics.posters.filter((item) => item.regionId === region.id);
    const snapshots = filterCreatorCompetitionSnapshots(
      await buildCompetitionSnapshots(
        competitions,
        posters,
        analytics.creatorProfiles,
        Date.now(),
        region.id,
      ),
      creator.assignedCategories,
    );

    return NextResponse.json({
      ok: true,
      profile: {
        creatorPublicId: creator.creatorPublicId,
        name: creator.name,
      },
      competitions: snapshots.map((snapshot) => ({
        ...snapshot,
        categoryLabels: buildCompetitionCategoryLabels(snapshot.competition.categoryIds).map(
          (label, index) =>
            localizeCategoryLabel(
              { id: snapshot.competition.categoryIds[index] ?? "", label },
              region,
            ),
        ),
        myEntry:
          snapshot.leaderboard.find(
            (item) => item.creatorPublicId === creator.creatorPublicId,
          ) ?? null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load competitions.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
