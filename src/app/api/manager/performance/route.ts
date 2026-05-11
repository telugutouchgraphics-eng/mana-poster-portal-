import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadScopedCreatorProfiles } from "@/lib/server/manager-scope";
import {
  buildMonthlyCalendarMetrics,
  buildPerformanceSummary,
  loadDailyPosterMetrics,
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
    const actor = await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const scope = currentMonthScope();
    const year = Number(url.searchParams.get("year") ?? scope.year);
    const month = Number(url.searchParams.get("month") ?? scope.month);
    const requestedCreatorId = String(
      url.searchParams.get("creatorPublicId") ?? "",
    ).trim();

    const scopedProfiles = await loadScopedCreatorProfiles(actor);
    const creators = scopedProfiles
      .map((doc) => {
        const data = doc.data();
        return {
          creatorPublicId: String(data.creatorPublicId ?? doc.id).trim(),
          name: String(data.name ?? "-").trim(),
          email: String(data.email ?? "").trim(),
          status: String(data.status ?? "pending_invite").trim(),
        };
      })
      .filter((item) => item.creatorPublicId.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    const selectedCreatorId =
      requestedCreatorId && creators.some((item) => item.creatorPublicId === requestedCreatorId)
        ? requestedCreatorId
        : "";

    const metrics = selectedCreatorId
      ? await loadDailyPosterMetrics([selectedCreatorId])
      : [];
    const calendar = selectedCreatorId
      ? buildMonthlyCalendarMetrics(metrics, year, month)
      : [];

    return NextResponse.json({
      ok: true,
      creators,
      selectedCreatorId,
      year,
      month,
      summary: buildPerformanceSummary(calendar),
      calendar,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load manager performance.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
