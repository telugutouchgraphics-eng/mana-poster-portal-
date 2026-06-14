import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  getUpcomingWeekdayAssignableCategories,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import { resolveCreatorReadContext } from "@/lib/server/creator-dashboard";
import { listManualEventCategories } from "@/lib/server/manual-event-categories";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import {
  isApprovedEquivalentStatus,
  isVisiblePosterStatus,
} from "@/lib/server/poster-status";
import {
  buildCategoryPerformance,
  buildCreatorCompetition,
  buildCreatorEarningsSummary,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { buildCompetitionSnapshots, loadCompetitions } from "@/lib/server/competitions";
import { buildCreatorUploadWindow, getIstDayKey } from "@/lib/server/ist-schedule";
import { getDashboardRegion } from "@/lib/dashboard-regions";
import { localizeCategoryLabel } from "@/lib/dashboard-category-localization";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DASHBOARD_RETENTION_MS = 24 * 60 * 60 * 1000;

function isCreatorDashboardPosterVisible(item: { createdAt: number; status: string }, now: number): boolean {
  if (!isVisiblePosterStatus(item.status)) {
    return false;
  }
  return item.createdAt <= 0 || item.createdAt + DASHBOARD_RETENTION_MS > now;
}

export async function GET(req: NextRequest) {
  try {
    const creator = await resolveCreatorReadContext(req);
    if (!creator) {
      return NextResponse.json(
        {
          ok: true,
          previewOnly: true,
          requiresAsCreator: true,
          profile: null,
          assignedCategories: [],
          stats: {
            totalUploads: 0,
            todayUploads: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
            todayEarnings: 0,
            monthEarnings: 0,
            totalEarnings: 0,
          },
          earnings: {
            today: 0,
            thisMonth: 0,
            total: 0,
            paidOut: 0,
            pendingBalance: 0,
            platformToday: 0,
            platformThisMonth: 0,
            platformTotal: 0,
            sharePercent: 80,
          },
          categoryPerformance: [],
          competition: [],
          transactions: [],
          posters: [],
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }
    const now = Date.now();
    const region = getDashboardRegion(req.nextUrl.searchParams.get("regionId"));
    const today = dayKey(now);
    const uploadWindow = buildCreatorUploadWindow(now);
    const todayUploadDayKey = getIstDayKey(now);
    const analytics = await loadPortalAnalyticsSnapshot();
    const competitions = await loadCompetitions();
    const banners = await loadAppBanners();
    const announcements = (await loadCreatorAnnouncements())
      .filter((item) => item.active)
      .filter((item) => item.startAt <= now && item.endAt >= now)
      .filter((item) =>
        item.audience === "all" ||
        item.audience === "creator" ||
        item.audience === "manager_creator",
      )
      .slice(0, 6);

    const posterSnap = await adminDb
      .collection("creatorPosters")
      .where("creatorPublicId", "==", creator.creatorPublicId)
      .get();

    const posters = posterSnap.docs
      .map((doc) => ({
        id: doc.id,
        title: String(doc.data().title ?? "Untitled"),
        categoryId: String(doc.data().categoryId ?? ""),
        categoryLabel: localizeCategoryLabel(
          {
            id: String(doc.data().categoryId ?? ""),
            label: String(doc.data().categoryLabel ?? ""),
          },
          region,
        ),
        mediaType: String(doc.data().mediaType ?? "image"),
        imageUrl: String(doc.data().imageUrl ?? ""),
        videoUrl: String(doc.data().videoUrl ?? ""),
        status: String(doc.data().status ?? "pending"),
        reviewComment: String(doc.data().reviewComment ?? ""),
        personalizationConfig: doc.data().personalizationConfig ?? null,
        createdAt: Number(doc.data().createdAt ?? 0),
        uploadDayKey: String(doc.data().uploadDayKey ?? ""),
        requestedPublishAt: Number(doc.data().requestedPublishAt ?? 0),
        publishAt: Number(doc.data().publishAt ?? 0),
        performanceWindowEndAt: Number(doc.data().performanceWindowEndAt ?? 0),
        dashboardHiddenAt: Number(doc.data().dashboardHiddenAt ?? 0),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    const visiblePosters = posters.filter(
      (item) => Number(item.dashboardHiddenAt ?? 0) <= 0 && isCreatorDashboardPosterVisible(item, now),
    );

    const todayUploadsByCategory = Object.values(
      visiblePosters
        .filter((item) => item.uploadDayKey === todayUploadDayKey)
        .reduce<Record<string, (typeof posters)[number]>>((acc, item) => {
          const current = acc[item.categoryId];
          if (!current || item.createdAt > current.createdAt) {
            acc[item.categoryId] = item;
          }
          return acc;
        }, {}),
    );

    const todayUploads = visiblePosters.filter((item) => dayKey(item.createdAt) === today).length;
    const approvedCount = visiblePosters.filter((item) => isApprovedEquivalentStatus(item.status)).length;
    const rejectedCount = visiblePosters.filter((item) => item.status === "rejected").length;
    const pendingCount = visiblePosters.filter((item) => item.status === "pending").length;

    const manualCategories = await listManualEventCategories();
    const weekdayCategories = getUpcomingWeekdayAssignableCategories(new Date(now));
    const visibleCategoryMeta = new Map(
      [...getVisibleAssignableCategories(new Date(now), 2, 7, 2), ...weekdayCategories].map(
        (item) => [
          item.id,
          {
            isDynamic: Boolean(item.isDynamic),
            eventDateLabel: item.eventDateLabel ?? "",
            eventStartAt: Number(item.eventStartAt ?? 0),
          },
        ],
      ),
    );
    const categoryMap = Object.fromEntries(
      [...CREATOR_ASSIGNABLE_CATEGORIES, ...manualCategories.map((item) => ({ id: item.id, label: item.label }))].map(
        (item) => [item.id, item.label],
      ),
    );

    const assignedCategories = creator.assignedCategories.map((categoryId) => {
      const meta = visibleCategoryMeta.get(categoryId);
      return {
        id: categoryId,
        label: localizeCategoryLabel(
          { id: categoryId, label: categoryMap[categoryId] ?? categoryId },
          region,
        ),
        isDynamic: categoryId.startsWith("weekday_") || Boolean(meta?.isDynamic),
        eventDateLabel: meta?.eventDateLabel ?? "",
        eventStartAt: meta?.eventStartAt ?? 0,
      };
    });
    const earnings = buildCreatorEarningsSummary(
      creator.creatorPublicId,
      analytics.posters,
      analytics.payouts,
      now,
    );
    const categoryPerformance = buildCategoryPerformance(
      analytics.posters.filter((item) => item.creatorPublicId === creator.creatorPublicId),
    );
    const competition = buildCreatorCompetition(
      creator.creatorPublicId,
      creator.assignedCategories,
      analytics.posters.filter((item) =>
        creator.assignedCategories.includes(item.categoryId),
      ),
      analytics.creatorProfiles,
    );
    const transactions = analytics.ledger
      .filter((item) => item.creatorPublicId === creator.creatorPublicId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12);
    const activeCompetitions = (await buildCompetitionSnapshots(
      competitions,
      analytics.posters,
      analytics.creatorProfiles,
    ))
      .map((snapshot) => {
        const mine = snapshot.leaderboard.find(
          (leader) => leader.creatorPublicId === creator.creatorPublicId,
        );
        return {
          id: snapshot.competition.id,
          title: snapshot.competition.title,
          description: snapshot.competition.description,
          rewardNote: snapshot.competition.rewardNote,
          status: snapshot.phase,
          creatorCount: snapshot.creatorCount,
          myRank: mine?.rank ?? null,
          myApprovedCount: mine?.approvedCount ?? 0,
          myUploads: mine?.totalUploads ?? 0,
          leaders: snapshot.leaderboard.slice(0, 5),
        };
      })
      .filter((item) => item.status !== "completed")
      .slice(0, 4);

    return NextResponse.json(
      {
        ok: true,
        profile: {
          creatorPublicId: creator.creatorPublicId,
          name: creator.name,
          email: creator.email,
        },
        assignedCategories,
        uploadWindow,
        todayUploadsByCategory,
        stats: {
          totalUploads: visiblePosters.length,
          todayUploads,
          approvedCount,
          rejectedCount,
          pendingCount,
          todayEarnings: earnings.today,
          monthEarnings: earnings.thisMonth,
          totalEarnings: earnings.total,
        },
        earnings,
        categoryPerformance,
        competition,
        activeCompetitions,
        liveBanners: banners
          .filter((item) => item.active)
          .filter((item) => item.placement === "creator_overview_banner")
          .slice(0, 5),
        announcements,
        transactions,
        posters: visiblePosters,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creator dashboard.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
