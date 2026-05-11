import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadWebsitePosters } from "@/lib/server/content-management";
import {
  LANDING_PAGE_COLLECTION,
  LANDING_PAGE_DOC_ID,
  loadLandingPageRecord,
  saveLandingPageRecord,
} from "@/lib/server/landing-page-management";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { LandingPageRecord } from "@/lib/types/landing-page";

export async function GET() {
  try {
    const [landingPage, posters] = await Promise.all([
      loadLandingPageRecord(),
      loadWebsitePosters(),
    ]);
    return NextResponse.json({ ok: true, landingPage, posters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load content.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as Partial<LandingPageRecord>;
    const landingPage = await saveLandingPageRecord(body, actor);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "content.update",
      targetId: LANDING_PAGE_DOC_ID,
      targetType: LANDING_PAGE_COLLECTION,
      message: "Updated landing page content through /api/content",
    });

    return NextResponse.json({ ok: true, landingPage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save content.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
