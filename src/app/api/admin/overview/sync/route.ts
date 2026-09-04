import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const res = await fetch(new URL("/api/admin/overview?regionId=all&forceRefresh=true", req.url), {
      headers: {
        authorization: req.headers.get("authorization") ?? "",
      },
    });
    const data = await res.json();
    return NextResponse.json({ ok: true, message: "Analytics synced successfully", data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
