import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

const payloadSchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  note: z.string().trim().max(200).optional(),
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

    const profileRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
    const payoutRef = adminDb.collection("creatorPayouts").doc();
    const ledgerRef = adminDb.collection("creatorEarningLedger").doc();

    await adminDb.runTransaction(async (tx) => {
      const profileSnap = await tx.get(profileRef);
      if (!profileSnap.exists) {
        throw new Error("Creator not found.");
      }
      const profile = profileSnap.data() as Record<string, unknown>;

      tx.set(payoutRef, {
        id: payoutRef.id,
        creatorPublicId,
        creatorName: String(profile.name ?? ""),
        amount: payload.amount,
        note: payload.note ?? "",
        status: "paid",
        createdAt: now,
        createdByUid: actor.uid,
        createdByRole: actor.role,
      });

      tx.set(ledgerRef, {
        id: ledgerRef.id,
        type: "payout",
        source: "admin_manual_payout",
        posterId: "",
        creatorPublicId,
        categoryId: "",
        categoryLabel: "",
        grossAmount: 0,
        creatorAmount: -payload.amount,
        platformAmount: 0,
        note: payload.note ?? "",
        createdAt: now,
        createdByUid: actor.uid,
        createdByRole: actor.role,
      });
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_payout_marked",
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: "Manual creator payout marked as paid.",
      metadata: {
        amount: payload.amount,
        note: payload.note ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark payout.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
