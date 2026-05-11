import { NextRequest, NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { normalizeRoles } from "@/lib/server/role-utils";

const payloadSchema = z.object({
  managerUid: z.string().trim().min(1),
});

async function commitBatchUpdates(
  updates: Array<{
    ref: DocumentReference;
    data: Record<string, unknown>;
  }>,
) {
  for (let index = 0; index < updates.length; index += 450) {
    const batch = adminDb.batch();
    for (const item of updates.slice(index, index + 450)) {
      batch.set(item.ref, item.data, { merge: true });
    }
    await batch.commit();
  }
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

    const [creatorSnap, managerSnap] = await Promise.all([
      adminDb.collection("creatorProfiles").doc(creatorPublicId).get(),
      adminDb.collection("users").doc(payload.managerUid).get(),
    ]);

    if (!creatorSnap.exists) {
      return NextResponse.json({ ok: false, error: "Creator not found." }, { status: 404 });
    }
    if (!managerSnap.exists) {
      return NextResponse.json({ ok: false, error: "Manager not found." }, { status: 404 });
    }

    const manager = managerSnap.data() ?? {};
    const managerRoles = normalizeRoles(manager.roles);
    const hasManagerRole = manager.role === "manager" || managerRoles.includes("manager");
    const managerStatus = String(manager.managerStatus ?? "active");
    if (!hasManagerRole || managerStatus !== "active") {
      return NextResponse.json(
        { ok: false, error: "Select an active manager." },
        { status: 400 },
      );
    }

    const managerEmail = String(manager.email ?? "").trim().toLowerCase();
    const managerName = String(manager.name ?? managerEmail ?? "Manager").trim();
    const creatorData = creatorSnap.data() ?? {};
    const previousManagerUid = String(
      creatorData.managerUid ?? creatorData.assignedByUid ?? "",
    ).trim();

    const transferData = {
      managerUid: payload.managerUid,
      managerEmail,
      managerName,
      assignedByUid: payload.managerUid,
      assignedByRole: "manager",
      transferredByUid: actor.uid,
      transferredByEmail: actor.email ?? "",
      transferredAt: now,
      updatedAt: now,
    };

    const [posterSnap, inviteSnap] = await Promise.all([
      adminDb
        .collection("creatorPosters")
        .where("creatorPublicId", "==", creatorPublicId)
        .get(),
      adminDb
        .collection("creatorInvites")
        .where("creatorPublicId", "==", creatorPublicId)
        .get(),
    ]);

    const updates: Array<{
      ref: DocumentReference;
      data: Record<string, unknown>;
    }> = [
      {
        ref: creatorSnap.ref,
        data: transferData,
      },
    ];

    for (const doc of posterSnap.docs) {
      updates.push({
        ref: doc.ref,
        data: {
          managerUid: payload.managerUid,
          managerEmail,
          managerName,
          updatedAt: now,
        },
      });
    }

    for (const doc of inviteSnap.docs) {
      updates.push({
        ref: doc.ref,
        data: {
          managerUid: payload.managerUid,
          managerEmail,
          updatedAt: now,
        },
      });
    }

    await commitBatchUpdates(updates);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.creator.transfer-manager",
      targetType: "creatorProfile",
      targetId: creatorPublicId,
      message: `Transferred creator ${creatorPublicId} to ${managerName || managerEmail}`,
      metadata: {
        creatorPublicId,
        previousManagerUid,
        managerUid: payload.managerUid,
        managerEmail,
        managerName,
        posterCount: posterSnap.size,
      },
    });

    return NextResponse.json({
      ok: true,
      creatorPublicId,
      manager: {
        uid: payload.managerUid,
        email: managerEmail,
        name: managerName,
      },
      updatedPosters: posterSnap.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creator transfer failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
