import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import {
  buildCategoryLeaderboards,
  buildCategoryPerformance,
  buildCreatorVisibility,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { buildCompetitionSnapshots, loadCompetitions } from "@/lib/server/competitions";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const snapshot = await loadPortalAnalyticsSnapshot();
    const competitions = await loadCompetitions();
    const now = Date.now();
    const banners = await loadAppBanners();
    const announcements = await loadCreatorAnnouncements();
    const activeCompetitions = buildCompetitionSnapshots(
      competitions,
      snapshot.posters,
      snapshot.creatorProfiles,
    ).slice(0, 4);

    return NextResponse.json({
      ok: true,
      overview: {
        totalCreators: snapshot.overview.totalCreators,
        activeCreators: snapshot.overview.activeCreators,
        blockedCreators: snapshot.overview.blockedCreators,
        pendingInvites: snapshot.overview.pendingInvites,
        pendingPosters: snapshot.overview.pendingPosters,
        approvedPosters: snapshot.overview.approvedPosters,
        rejectedPosters: snapshot.overview.rejectedPosters,
      },
      categoryPerformance: buildCategoryPerformance(snapshot.posters).slice(0, 10),
      categoryLeaderboards: buildCategoryLeaderboards(
        snapshot.posters,
        snapshot.creatorProfiles,
      ).slice(0, 8),
      creatorVisibility: buildCreatorVisibility(
        snapshot.creatorProfiles,
        snapshot.posters,
      ).slice(0, 6),
      activeCompetitions,
      content: {
        activeBanners: banners.filter((item) => item.active).length,
        activeAnnouncements: announcements.filter(
          (item) => item.active && item.startAt <= now && item.endAt >= now,
        ).length,
      },
      liveBanners: banners.filter((item) => item.active).slice(0, 4),
      liveAnnouncements: announcements
        .filter((item) => item.active && item.startAt <= now && item.endAt >= now)
        .slice(0, 4),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load manager overview.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
