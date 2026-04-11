import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { getVisibleAssignableCategories } from "@/lib/server/categories";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager", "creator"]);
    return NextResponse.json({
      ok: true,
      categories: getVisibleAssignableCategories(new Date(), 3),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
