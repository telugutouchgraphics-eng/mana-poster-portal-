import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { assertCreatorInScope } from "@/lib/server/manager-scope";

const payloadSchema = z.object({
  status: z.enum(["approved", "changes_requested", "rejected"]),
  reviewComment: z.string().trim().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ creatorPublicId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { creatorPublicId } = await params;
    const payload = payloadSchema.parse(await req.json());
    const now = Date.now();
    await assertCreatorInScope(actor, creatorPublicId);

    const ref = adminDb.collection("creatorPayoutProfiles").doc(creatorPublicId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Payout profile not found.");
    }

    await ref.set(
      {
        status: payload.status,
        reviewComment: payload.reviewComment ?? "",
        reviewedAt: now,
        reviewedByUid: actor.uid,
        reviewedByEmail: String(actor.email ?? "").toLowerCase(),
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_payout_profile_reviewed",
      targetType: "creator_payout_profile",
      targetId: creatorPublicId,
      message: `Creator payout profile marked ${payload.status}.`,
      metadata: {
        status: payload.status,
        reviewComment: payload.reviewComment ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to review payout profile.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
