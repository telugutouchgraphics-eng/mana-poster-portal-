import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { writeAuditLog } from "@/lib/server/audit-log";
import { CREATOR_BANK_AGREEMENT_VERSION } from "@/lib/legal/creator-bank-agreement";

export async function GET(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const profileSnap = await adminDb
      .collection("creatorProfiles")
      .doc(creator.creatorPublicId)
      .get();
    const data = profileSnap.data() as Record<string, unknown> | undefined;
    const acceptedVersion = String(data?.loginAgreementVersion ?? "");
    const acceptedAt = Number(data?.loginAgreementAcceptedAt ?? 0);

    return NextResponse.json({
      ok: true,
      accepted: acceptedVersion === CREATOR_BANK_AGREEMENT_VERSION && acceptedAt > 0,
      acceptedAt,
      version: CREATOR_BANK_AGREEMENT_VERSION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load agreement status.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const now = Date.now();

    await adminDb
      .collection("creatorProfiles")
      .doc(creator.creatorPublicId)
      .set(
        {
          loginAgreementAcceptedAt: now,
          loginAgreementVersion: CREATOR_BANK_AGREEMENT_VERSION,
          updatedAt: now,
        },
        { merge: true },
      );

    await writeAuditLog({
      actorUid: creator.uid,
      actorRole: "creator",
      actorEmail: creator.email,
      action: "creator_login_agreement_accepted",
      targetType: "creator_profile",
      targetId: creator.creatorPublicId,
      message: "Creator accepted login declaration.",
      metadata: {
        version: CREATOR_BANK_AGREEMENT_VERSION,
      },
    });

    return NextResponse.json({ ok: true, acceptedAt: now, version: CREATOR_BANK_AGREEMENT_VERSION });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept agreement.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
