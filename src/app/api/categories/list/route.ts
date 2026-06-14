import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import {
  getUpcomingWeekdayAssignableCategories,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import { listVisibleManualEventCategories } from "@/lib/server/manual-event-categories";
import { getDashboardRegion } from "@/lib/dashboard-regions";
import { localizeCategoryList } from "@/lib/dashboard-category-localization";
import { politicalPartyCategoriesForRegion } from "@/lib/political-party-categories";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager", "creator"]);
    const region = getDashboardRegion(req.nextUrl.searchParams.get("regionId"));
    const baseCategories = getVisibleAssignableCategories(new Date(), 2, 7, 2);
    const politicalCategories = politicalPartyCategoriesForRegion(region.id);
    const weekdayCategories = getUpcomingWeekdayAssignableCategories();
    const manualCategories = await listVisibleManualEventCategories();
    const seen = new Set<string>();
    const categories = [...baseCategories, ...politicalCategories, ...weekdayCategories, ...manualCategories].filter((item) => {
      if (seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
    return NextResponse.json({
      ok: true,
      categories: localizeCategoryList(categories, region),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
