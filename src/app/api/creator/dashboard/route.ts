import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES } from "@/lib/server/categories";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { requireRole } from "@/lib/server/auth";
import { loadCreatorAnnouncements } from "@/lib/server/content-management";
import {
  buildCategoryPerformance,
  buildCreatorCompetition,
  buildCreatorEarningsSummary,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { buildCompetitionSnapshots, loadCompetitions } from "@/lib/server/competitions";

function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const actorUserSnap = await adminDb.collection("users").doc(actor.uid).get();
    const actorCreatorId = String(actorUserSnap.data()?.creatorPublicId ?? "").trim();
    if (actor.role === "admin" && actorCreatorId.length === 0) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
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
      });
    }

    const creator = await requireCreatorAccessContext(req);
    const now = Date.now();
    const today = dayKey(now);
    const analytics = await loadPortalAnalyticsSnapshot();
    const competitions = await loadCompetitions();
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
        categoryLabel: String(doc.data().categoryLabel ?? ""),
        imageUrl: String(doc.data().imageUrl ?? ""),
        status: String(doc.data().status ?? "pending"),
        reviewComment: String(doc.data().reviewComment ?? ""),
        createdAt: Number(doc.data().createdAt ?? 0),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    const todayUploads = posters.filter((item) => dayKey(item.createdAt) === today).length;
    const approvedCount = posters.filter((item) => item.status === "approved").length;
    const rejectedCount = posters.filter((item) => item.status === "rejected").length;
    const pendingCount = posters.filter((item) => item.status === "pending").length;

    const categoryMap = Object.fromEntries(
      CREATOR_ASSIGNABLE_CATEGORIES.map((item) => [item.id, item.label])
    );

    const assignedCategories = creator.assignedCategories.map((categoryId) => ({
      id: categoryId,
      label: categoryMap[categoryId] ?? categoryId,
    }));
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
    const activeCompetitions = buildCompetitionSnapshots(
      competitions,
      analytics.posters,
      analytics.creatorProfiles,
    )
      .map((snapshot) => {
        const mine = snapshot.leaders.find(
          (leader) => leader.creatorPublicId === creator.creatorPublicId,
        );
        return {
          id: snapshot.competition.id,
          title: snapshot.competition.title,
          description: snapshot.competition.description,
          rewardNote: snapshot.competition.rewardNote,
          status: snapshot.competition.status,
          creatorCount: snapshot.creatorCount,
          myRank: mine?.rank ?? null,
          myApprovedCount: mine?.approvedCount ?? 0,
          myUploads: mine?.totalUploads ?? 0,
          leaders: snapshot.leaders.slice(0, 5),
        };
      })
      .filter((item) => item.status === "active" || item.status === "draft")
      .slice(0, 4);

    return NextResponse.json({
      ok: true,
      profile: {
        creatorPublicId: creator.creatorPublicId,
        name: creator.name,
        email: creator.email,
      },
      assignedCategories,
      stats: {
        totalUploads: posters.length,
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
      announcements,
      transactions,
      posters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creator dashboard.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
