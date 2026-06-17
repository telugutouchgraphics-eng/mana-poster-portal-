import { NextRequest, NextResponse } from "next/server";
import { resolveCreatorReadContext } from "@/lib/server/creator-dashboard";
import { loadPortalAnalyticsSnapshot } from "@/lib/server/dashboard-metrics";
import { loadActivePosterPerformanceMetrics } from "@/lib/server/performance-metrics";
import { requireRole } from "@/lib/server/auth";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const creator = await resolveCreatorReadContext(req);
    if (!creator) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
        requiresAsCreator: true,
        profile: null,
        leaderboard: [],
      });
    }
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const [activePosters, analytics] = await Promise.all([
      loadActivePosterPerformanceMetrics(Date.now(), region.id),
      loadPortalAnalyticsSnapshot(),
    ]);

    const creatorNameMap = new Map(
      analytics.creatorProfiles.map((item) => [item.creatorPublicId, item.name]),
    );

    const scoped = activePosters.filter((item) =>
      creator.assignedCategories.includes(item.categoryId),
    );

    const grouped = new Map<string, typeof scoped>();
    for (const poster of scoped) {
      const key = poster.categoryId || "uncategorized";
      const existing = grouped.get(key) ?? [];
      existing.push(poster);
      grouped.set(key, existing);
    }

    const categories = Array.from(grouped.entries())
      .map(([categoryId, posters]) => {
        const sorted = [...posters].sort((a, b) => {
          if (a.rank !== b.rank) {
            return a.rank - b.rank;
          }
          if (b.shares !== a.shares) {
            return b.shares - a.shares;
          }
          return b.performancePercent - a.performancePercent;
        });
        const myEntry =
          sorted.find((item) => item.creatorPublicId === creator.creatorPublicId) ?? null;
        return {
          categoryId,
          categoryLabel: sorted[0]?.categoryLabel || categoryId,
          myEntry,
          rows: sorted.slice(0, 25).map((item) => ({
            rank: item.rank,
            creatorPublicId: item.creatorPublicId,
            creatorName: creatorNameMap.get(item.creatorPublicId) ?? item.creatorPublicId,
            posterId: item.posterId,
            posterTitle: item.posterTitle,
            shares: item.shares,
            downloads: item.downloads,
            performancePercent: item.performancePercent,
          })),
        };
      })
      .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel));

    return NextResponse.json({
      ok: true,
      profile: {
        creatorPublicId: creator.creatorPublicId,
        name: creator.name,
      },
      leaderboard: categories,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load leaderboard.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
