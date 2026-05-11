import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadScopedCreatorProfiles } from "@/lib/server/manager-scope";
import {
  buildMonthlyCalendarMetrics,
  buildPerformanceSummary,
  loadDailyPosterMetrics,
  loadRecentPosterPerformanceMetrics,
} from "@/lib/server/performance-metrics";

function currentMonthScope() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin", "manager"]);
    const url = new URL(req.url);
    const scope = currentMonthScope();
    const year = Number(url.searchParams.get("year") ?? scope.year);
    const month = Number(url.searchParams.get("month") ?? scope.month);
    const requestedCreatorId = String(
      url.searchParams.get("creatorPublicId") ?? url.searchParams.get("asCreator") ?? "",
    ).trim();

    let creatorPublicId = "";
    let creatorName = "";
    let creatorEmail = "";

    if (requestedCreatorId && actor.role !== "creator") {
      const scopedProfiles = await loadScopedCreatorProfiles(actor);
      const match = scopedProfiles.find((doc) => {
        const data = doc.data();
        return String(data.creatorPublicId ?? doc.id).trim() === requestedCreatorId;
      });
      if (!match) {
        throw new Error("Creator not found.");
      }
      const data = match.data();
      creatorPublicId = String(data.creatorPublicId ?? match.id).trim();
      creatorName = String(data.name ?? "").trim();
      creatorEmail = String(data.email ?? "").trim();
    } else {
      const userSnap = await adminDb.collection("users").doc(actor.uid).get();
      creatorPublicId = String(userSnap.data()?.creatorPublicId ?? "").trim();
      if (!creatorPublicId) {
        if (actor.role === "admin") {
          return NextResponse.json({
            ok: true,
            requiresAsCreator: true,
            profile: null,
            year,
            month,
            summary: {
              shares: 0,
              downloads: 0,
              activeDays: 0,
              posterCount: 0,
              performancePercent: 0,
            },
            calendar: [],
            recentPosters: [],
            recentSummary: {
              posterCount: 0,
              shares: 0,
              downloads: 0,
              performancePercent: 0,
            },
          });
        }
        throw new Error("Creator profile is not linked.");
      }
      const profileSnap = await adminDb.collection("creatorProfiles").doc(creatorPublicId).get();
      if (!profileSnap.exists) {
        throw new Error("Creator profile not found.");
      }
      const profile = profileSnap.data()!;
      creatorName = String(profile.name ?? userSnap.data()?.name ?? "").trim();
      creatorEmail = String(profile.email ?? userSnap.data()?.email ?? "").trim();
    }

    const [metrics, recentPosters] = await Promise.all([
      loadDailyPosterMetrics([creatorPublicId]),
      loadRecentPosterPerformanceMetrics(creatorPublicId),
    ]);
    const calendar = buildMonthlyCalendarMetrics(metrics, year, month);

    return NextResponse.json({
      ok: true,
      profile: {
        creatorPublicId,
        name: creatorName,
        email: creatorEmail,
      },
      year,
      month,
      summary: buildPerformanceSummary(calendar),
      calendar,
      recentPosters,
      recentSummary: {
        posterCount: recentPosters.length,
        shares: recentPosters.reduce((sum, item) => sum + item.shares, 0),
        downloads: recentPosters.reduce((sum, item) => sum + item.downloads, 0),
        performancePercent:
          recentPosters.length > 0
            ? Number(
                (
                  recentPosters.reduce((sum, item) => sum + item.performancePercent, 0) /
                  recentPosters.length
                ).toFixed(1),
              )
            : 0,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load creator performance.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
