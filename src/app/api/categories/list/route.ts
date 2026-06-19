import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import {
  getUpcomingWeekdayAssignableCategories,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import { listVisibleManualEventCategories } from "@/lib/server/manual-event-categories";
import { localizeCategoryList } from "@/lib/dashboard-category-localization";
import { politicalPartyCategoriesForRegion } from "@/lib/political-party-categories";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager", "creator"]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const baseCategories = getVisibleAssignableCategories(new Date(), 2, 7, 2, region.id);
    const politicalCategories = politicalPartyCategoriesForRegion(region.id);
    const weekdayCategories = getUpcomingWeekdayAssignableCategories();
    const manualCategories = await listVisibleManualEventCategories(Date.now(), region.id);
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
