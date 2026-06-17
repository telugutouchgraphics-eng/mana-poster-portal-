import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import type { DocumentReference } from "firebase-admin/firestore";
import { assertCreatorInScope } from "@/lib/server/manager-scope";

const payloadSchema = z.object({
  action: z.enum(["queue", "hold", "mark_paid"]),
  amount: z.coerce.number().positive().max(1000000).optional(),
  note: z.string().trim().max(200).optional(),
});

interface OpenPayoutRecord {
  id: string;
  ref: DocumentReference;
  status?: string;
  amount?: number;
  note?: string;
  createdAt?: number;
  ledgerCreatedAt?: number;
}

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

    const profileRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);

    await adminDb.runTransaction(async (tx) => {
      const profileSnap = await tx.get(profileRef);
      if (!profileSnap.exists) {
        throw new Error("Creator not found.");
      }
      const profile = profileSnap.data() as Record<string, unknown>;
      const payoutQuery = adminDb
        .collection("creatorPayouts")
        .where("creatorPublicId", "==", creatorPublicId);
      const payoutSnap = await tx.get(payoutQuery);
      const openPayouts: OpenPayoutRecord[] = payoutSnap.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            ref: doc.ref,
            status: String(data.status ?? ""),
            amount: Number(data.amount ?? 0),
            note: String(data.note ?? ""),
            createdAt: Number(data.createdAt ?? 0),
            ledgerCreatedAt: Number(data.ledgerCreatedAt ?? 0),
          };
        })
        .filter((item) => String(item.status ?? "") !== "paid")
        .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
      const latestOpenPayout = openPayouts[0];

      if (payload.action === "queue") {
        if (!payload.amount || payload.amount <= 0) {
          throw new Error("Enter payout amount.");
        }
        const payoutRef = adminDb.collection("creatorPayouts").doc();
        tx.set(payoutRef, {
          id: payoutRef.id,
          creatorPublicId,
          creatorName: String(profile.name ?? ""),
          amount: payload.amount,
          note: payload.note ?? "",
          status: "approved_for_payout",
          createdAt: now,
          updatedAt: now,
          createdByUid: actor.uid,
          createdByRole: actor.role,
          settledAt: 0,
          ledgerCreatedAt: 0,
        });
        return;
      }

      if (!latestOpenPayout) {
        throw new Error("Open payout request not found.");
      }

      if (payload.action === "hold") {
        tx.set(
          latestOpenPayout.ref,
          {
            status: "on_hold",
            note: payload.note ?? String(latestOpenPayout.note ?? ""),
            updatedAt: now,
            heldAt: now,
            heldByUid: actor.uid,
          },
          { merge: true },
        );
        return;
      }

      if (payload.action === "mark_paid") {
        tx.set(
          latestOpenPayout.ref,
          {
            status: "paid",
            note: payload.note ?? String(latestOpenPayout.note ?? ""),
            updatedAt: now,
            settledAt: now,
            settledByUid: actor.uid,
            ledgerCreatedAt: Number(latestOpenPayout.ledgerCreatedAt ?? 0) || now,
          },
          { merge: true },
        );

        if (!Number(latestOpenPayout.ledgerCreatedAt ?? 0)) {
          const ledgerRef = adminDb.collection("creatorEarningLedger").doc();
          tx.set(ledgerRef, {
            id: ledgerRef.id,
            type: "payout",
            source: "admin_manual_payout",
            posterId: "",
            creatorPublicId,
            categoryId: "",
            categoryLabel: "",
            grossAmount: 0,
            creatorAmount: -Number(latestOpenPayout.amount ?? 0),
            platformAmount: 0,
            note: payload.note ?? String(latestOpenPayout.note ?? ""),
            createdAt: now,
            createdByUid: actor.uid,
            createdByRole: actor.role,
            payoutId: latestOpenPayout.id,
          });
        }
      }
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: `creator_payout_${payload.action}`,
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: `Creator payout action completed: ${payload.action}.`,
      metadata: {
        amount: payload.amount ?? 0,
        note: payload.note ?? "",
        action: payload.action,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark payout.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
