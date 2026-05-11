import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  LANDING_PAGE_DOC_ID,
  LANDING_PAGE_COLLECTION,
  loadLandingPageRecord,
  saveLandingPageRecord,
} from "@/lib/server/landing-page-management";
import type { LandingPageRecord } from "@/lib/types/landing-page";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const landingPage = await loadLandingPageRecord();
    return NextResponse.json({ ok: true, landingPage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load landing page config.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as Partial<LandingPageRecord>;
    const landingPage = await saveLandingPageRecord(body, actor);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.landingPage.update",
      targetId: LANDING_PAGE_DOC_ID,
      targetType: LANDING_PAGE_COLLECTION,
      message: "Updated landing page management configuration",
    });

    return NextResponse.json({ ok: true, landingPage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save landing page config.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
