import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertPosterInScope } from "@/lib/server/manager-scope";
import { splitRevenue } from "@/lib/server/earnings";
import { writeAuditLog } from "@/lib/server/audit-log";

const payloadSchema = z.object({
  amount: z.coerce.number().positive().max(100000),
  note: z.string().trim().max(200).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { posterId } = await params;
    const payload = payloadSchema.parse(await req.json());
    const now = Date.now();

    const posterRef = adminDb.collection("creatorPosters").doc(posterId);
    const ledgerRef = adminDb.collection("creatorEarningLedger").doc();

    const result = await adminDb.runTransaction(async (tx) => {
      const posterSnap = await tx.get(posterRef);
      if (!posterSnap.exists) {
        throw new Error("Poster not found.");
      }
      const poster = posterSnap.data() as Record<string, unknown>;
      await assertPosterInScope(actor, poster);
      if (String(poster.status ?? "") !== "approved") {
        throw new Error("Only approved posters can record earnings.");
      }

      const creatorPublicId = String(poster.creatorPublicId ?? "").trim();
      if (!creatorPublicId) {
        throw new Error("Creator ID missing on poster.");
      }

      const split = splitRevenue(payload.amount);
      const nextSaleCount = Number(poster.saleCount ?? 0) + 1;
      const nextGross = Number(poster.grossAmount ?? 0) + split.grossAmount;
      const nextCreator = Number(poster.creatorEarnings ?? 0) + split.creatorAmount;
      const nextPlatform = Number(poster.platformEarnings ?? 0) + split.platformAmount;

      tx.set(
        posterRef,
        {
          saleCount: nextSaleCount,
          grossAmount: nextGross,
          creatorEarnings: nextCreator,
          platformEarnings: nextPlatform,
          lastSaleAt: now,
          updatedAt: now,
        },
        { merge: true },
      );

      tx.set(ledgerRef, {
        id: ledgerRef.id,
        type: "sale",
        source: "manual_manager_entry",
        posterId,
        creatorPublicId,
        categoryId: String(poster.categoryId ?? ""),
        categoryLabel: String(poster.categoryLabel ?? ""),
        grossAmount: split.grossAmount,
        creatorAmount: split.creatorAmount,
        platformAmount: split.platformAmount,
        note: payload.note ?? "",
        createdAt: now,
        createdByUid: actor.uid,
        createdByRole: actor.role,
      });

      return split;
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "poster_sale_recorded",
      targetType: "creator_poster",
      targetId: posterId,
      message: "Manual sale recorded for approved poster.",
      metadata: {
        grossAmount: result.grossAmount,
        creatorAmount: result.creatorAmount,
        platformAmount: result.platformAmount,
        note: payload.note ?? "",
      },
    });

    return NextResponse.json({
      ok: true,
      split: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record sale.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
