import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import { filterKnownAssignedCategories } from "@/lib/server/categories";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import {
  buildCategoryLeaderboards,
  buildCategoryPerformance,
  buildCreatorVisibility,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { buildCompetitionSnapshots, loadCompetitions } from "@/lib/server/competitions";
import { loadScopedCreatorProfiles } from "@/lib/server/manager-scope";
import { listManualEventCategories } from "@/lib/server/manual-event-categories";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

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
    const actor = await requireRole(req, ["admin", "manager"]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const snapshot = await loadPortalAnalyticsSnapshot();
    const competitions = await loadCompetitions();
    const now = Date.now();
    const todayKey = dayKeyInIst(now);
    const banners = await loadAppBanners();
    const announcements = await loadCreatorAnnouncements();
    const scopedCreatorDocs = await loadScopedCreatorProfiles(actor);
    const manualCategoryIds = (await listManualEventCategories(region.id)).map((item) => item.id);
    const scopedCreatorProfiles = scopedCreatorDocs.filter((doc) => {
      const assignedRegionIds = Array.isArray(doc.data().assignedRegionIds)
        ? doc.data().assignedRegionIds.map(String)
        : [];
      return assignedRegionIds.includes(region.id);
    }).map((doc) => {
      const data = doc.data();
      const rawAssignedCategories = Array.isArray(data.assignedCategories)
        ? data.assignedCategories.map(String)
        : [];
      const { assignedCategories } = filterKnownAssignedCategories(
        rawAssignedCategories,
        manualCategoryIds,
      );
      return {
        creatorPublicId: String(data.creatorPublicId ?? doc.id),
        name: String(data.name ?? "-"),
        email: String(data.email ?? ""),
        phone: String(data.phone ?? ""),
        status: String(data.status ?? "pending_invite"),
        assignedCategories,
        assignedRegionIds: Array.isArray(data.assignedRegionIds)
          ? data.assignedRegionIds.map(String)
          : [],
      };
    });
    const creatorIds = new Set(scopedCreatorProfiles.map((item) => item.creatorPublicId));
    const scopedPosters = snapshot.posters.filter(
      (item) => creatorIds.has(item.creatorPublicId) && item.regionId === region.id,
    );
    const activeCompetitions = (await buildCompetitionSnapshots(
      competitions,
      scopedPosters,
      scopedCreatorProfiles,
      now,
      region.id,
    )).slice(0, 4);
    const todayUploads = scopedPosters.filter(
      (item) => dayKeyInIst(item.createdAt) === todayKey,
    ).length;
    const pendingReviews = scopedPosters.filter((item) => item.status === "pending").length;
    const approvedCount = scopedPosters.filter((item) => isApprovedEquivalentStatus(item.status)).length;
    const rejectedCount = scopedPosters.filter((item) => item.status === "rejected").length;
    const totalUploads = scopedPosters.length;

    return NextResponse.json({
      ok: true,
      overview: {
        totalCreators: scopedCreatorProfiles.length,
        activeCreators: scopedCreatorProfiles.filter((item) => item.status === "active").length,
        blockedCreators: scopedCreatorProfiles.filter((item) => item.status === "blocked").length,
        pendingInvites: scopedCreatorProfiles.filter((item) => item.status === "pending_invite").length,
        pendingPosters: pendingReviews,
        approvedPosters: approvedCount,
        rejectedPosters: rejectedCount,
      },
      headline: {
        assignedCreatorsCount: scopedCreatorProfiles.length,
        pendingReviews,
        todayUploads,
        totalUploads,
      },
      performanceSummary: {
        approvedCount,
        rejectedCount,
        approvalRate: totalUploads > 0 ? Number(((approvedCount / totalUploads) * 100).toFixed(1)) : 0,
      },
      uploadsTrend: buildUploadsTrend(scopedPosters.map((item) => item.createdAt)),
      categoryPerformance: buildCategoryPerformance(scopedPosters).slice(0, 10),
      categoryLeaderboards: buildCategoryLeaderboards(
        scopedPosters,
        scopedCreatorProfiles,
      ).slice(0, 8),
      creatorVisibility: buildCreatorVisibility(
        scopedCreatorProfiles,
        scopedPosters,
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
