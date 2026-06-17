import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import { assertActorCanAccessRegion, loadActorAllowedRegionIds } from "@/lib/server/region-scope";
import {
  buildCategoryLeaderboards,
  buildCategoryPerformance,
  buildCreatorVisibility,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

function assignedToRegion(assignedRegionIds: string[], regionId: string) {
  return (
    assignedRegionIds.length === 0 ||
    assignedRegionIds.map((item) => item.trim()).includes(regionId)
  );
}

function assignedToAnyAllowedRegion(assignedRegionIds: string[], allowedRegionIds: string[]) {
  return (
    assignedRegionIds.length === 0 ||
    assignedRegionIds.some((regionId) => allowedRegionIds.includes(regionId))
  );
}

function dayKeyInIst(epochMs: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

function buildUploadsTrend(values: number[]) {
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = dayKeyInIst(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
    const key = dayKeyInIst(date.getTime());
    return {
      day: date.toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }),
      uploads: counts.get(key) ?? 0,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const requestedRegionId = String(req.nextUrl.searchParams.get("regionId") ?? "").trim();
    const showAllRegions = requestedRegionId === "all";
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const region = showAllRegions
      ? null
      : await assertActorCanAccessRegion(actor, requestedRegionId);
    const snapshot = await loadPortalAnalyticsSnapshot();
    const posters = showAllRegions
      ? snapshot.posters.filter((item) => allowedRegionIds.includes(item.regionId))
      : snapshot.posters.filter((item) => item.regionId === region?.id);
    const creators = showAllRegions
      ? snapshot.creatorProfiles.filter((item) =>
          assignedToAnyAllowedRegion(item.assignedRegionIds, allowedRegionIds),
        )
      : snapshot.creatorProfiles.filter((item) =>
          assignedToRegion(item.assignedRegionIds, region?.id ?? ""),
        );
    const managers = showAllRegions
      ? snapshot.managers.filter((item) =>
          assignedToAnyAllowedRegion(item.assignedRegionIds, allowedRegionIds),
        )
      : snapshot.managers.filter((item) =>
          assignedToRegion(item.assignedRegionIds, region?.id ?? ""),
        );
    const now = Date.now();
    const todayKey = dayKeyInIst(now);
    const banners = await loadAppBanners();
    const announcements = await loadCreatorAnnouncements();
    const activeAnnouncements = announcements.filter(
      (item) => item.active && item.startAt <= now && item.endAt >= now,
    );
    const totalEarnings = posters.reduce((sum, item) => sum + item.creatorEarnings, 0);
    const todayUploads = posters.filter(
      (item) => dayKeyInIst(item.createdAt) === todayKey,
    ).length;

    return NextResponse.json({
      ok: true,
      overview: {
        ...snapshot.overview,
        totalManagers: managers.length,
        activeManagers: managers.filter((item) => item.status !== "inactive").length,
        inactiveManagers: managers.filter((item) => item.status === "inactive").length,
        totalCreators: creators.length,
        activeCreators: creators.filter((item) => item.status === "active").length,
        blockedCreators: creators.filter((item) => item.status === "blocked").length,
        pendingInvites: creators.filter((item) => item.status === "pending_invite").length,
        totalPosters: posters.length,
        pendingPosters: posters.filter((item) => item.status === "pending").length,
        approvedPosters: posters.filter((item) => isApprovedEquivalentStatus(item.status)).length,
        rejectedPosters: posters.filter((item) => item.status === "rejected").length,
      },
      headline: {
        totalCreators: creators.length,
        totalManagers: managers.length,
        totalPosters: posters.length,
        todayUploads,
        totalEarnings,
      },
      uploadsTrend: buildUploadsTrend(posters.map((item) => item.createdAt)),
      revenue: {
        gross: posters.reduce((sum, item) => sum + item.grossAmount, 0),
        creator: posters.reduce((sum, item) => sum + item.creatorEarnings, 0),
        platform: posters.reduce((sum, item) => sum + item.platformEarnings, 0),
        paidOut: snapshot.payouts
          .filter(
            (item) =>
              item.status === "paid" &&
              (showAllRegions ||
                creators.some((creator) => creator.creatorPublicId === item.creatorPublicId)),
          )
          .reduce((sum, item) => sum + item.amount, 0),
      },
      categoryPerformance: buildCategoryPerformance(posters).slice(0, 8),
      categoryLeaderboards: buildCategoryLeaderboards(
        posters,
        creators,
      ).slice(0, 6),
      creatorVisibility: buildCreatorVisibility(
        creators,
        posters,
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
