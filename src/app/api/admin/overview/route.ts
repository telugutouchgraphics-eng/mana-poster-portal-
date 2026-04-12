import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import {
  buildCategoryLeaderboards,
  buildCategoryPerformance,
  buildCreatorVisibility,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const snapshot = await loadPortalAnalyticsSnapshot();
    const now = Date.now();
    const banners = await loadAppBanners();
    const announcements = await loadCreatorAnnouncements();
    const activeAnnouncements = announcements.filter(
      (item) => item.active && item.startAt <= now && item.endAt >= now,
    );

    return NextResponse.json({
      ok: true,
      overview: snapshot.overview,
      revenue: {
        gross: snapshot.posters.reduce((sum, item) => sum + item.grossAmount, 0),
        creator: snapshot.posters.reduce((sum, item) => sum + item.creatorEarnings, 0),
        platform: snapshot.posters.reduce((sum, item) => sum + item.platformEarnings, 0),
        paidOut: snapshot.payouts
          .filter((item) => item.status === "paid")
          .reduce((sum, item) => sum + item.amount, 0),
      },
      categoryPerformance: buildCategoryPerformance(snapshot.posters).slice(0, 8),
      categoryLeaderboards: buildCategoryLeaderboards(
        snapshot.posters,
        snapshot.creatorProfiles,
      ).slice(0, 6),
      creatorVisibility: buildCreatorVisibility(
        snapshot.creatorProfiles,
        snapshot.posters,
      ).slice(0, 6),
      content: {
        totalBanners: banners.length,
        activeBanners: banners.filter((item) => item.active).length,
        totalAnnouncements: announcements.length,
        activeAnnouncements: activeAnnouncements.length,
      },
      liveBanners: banners.slice(0, 4),
      liveAnnouncements: activeAnnouncements.slice(0, 4),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load admin overview.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
