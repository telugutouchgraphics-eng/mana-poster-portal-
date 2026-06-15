import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { listCommunityReports } from "@/lib/server/community-reports";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const reports = await listCommunityReports({
      status: url.searchParams.get("status"),
      q: url.searchParams.get("q"),
    });
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load reports.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
