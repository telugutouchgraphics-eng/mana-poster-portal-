import { NextRequest, NextResponse } from "next/server";
import { resolveCreatorReadContext } from "@/lib/server/creator-dashboard";
import { loadPortalAnalyticsSnapshot } from "@/lib/server/dashboard-metrics";
import {
  buildCompetitionCategoryLabels,
  buildCompetitionSnapshots,
  filterCreatorCompetitionSnapshots,
  loadCompetitions,
} from "@/lib/server/competitions";

export async function GET(req: NextRequest) {
  try {
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
    const snapshots = filterCreatorCompetitionSnapshots(
      await buildCompetitionSnapshots(
        competitions,
        analytics.posters,
        analytics.creatorProfiles,
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
        categoryLabels: buildCompetitionCategoryLabels(snapshot.competition.categoryIds),
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
