import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { normalizeRoles, pickPrimaryRole, removeRole } from "@/lib/server/role-utils";
import {
  assertActorCanAssignRegions,
  assertRecordOverlapsActorRegions,
} from "@/lib/server/region-scope";

interface Params {
  params: Promise<{ managerUid: string }>;
}

async function assertManagerTargetInActorScope(
  actor: Awaited<ReturnType<typeof requireRole>>,
  data: Record<string, unknown>,
) {
  await assertRecordOverlapsActorRegions(actor, data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { managerUid } = await params;
    const body = (await req.json()) as { regionIds?: string[] };
    const assignedRegionIds = await assertActorCanAssignRegions(actor, body.regionIds ?? []);
    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !hasManagerRole(userSnap.data() as Record<string, unknown> | undefined)) {
      return NextResponse.json({ ok: false, error: "Manager not found." }, { status: 404 });
    }
    await assertManagerTargetInActorScope(actor, userSnap.data() as Record<string, unknown>);
    await userRef.set(
      {
        assignedRegionIds,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "manager_regions_updated",
      targetType: "manager_user",
      targetId: managerUid,
      message: "Manager assigned regions updated.",
      metadata: { assignedRegionIds },
    });
    return NextResponse.json({ ok: true, assignedRegionIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update manager regions.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

function hasManagerRole(data: Record<string, unknown> | undefined): boolean {
  if (!data) {
    return false;
  }
  if (data.role === "manager") {
    return true;
  }
  return normalizeRoles(data.roles).includes("manager");
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { managerUid } = await params;
    const now = Date.now();

    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !hasManagerRole(userSnap.data() as Record<string, unknown> | undefined)) {
      return NextResponse.json({ ok: false, error: "Manager not found." }, { status: 404 });
    }
    await assertManagerTargetInActorScope(actor, userSnap.data() as Record<string, unknown>);

    const [creatorByManagerSnap, creatorByAssignedSnap] = await Promise.all([
      adminDb.collection("creatorProfiles").where("managerUid", "==", managerUid).limit(1).get(),
      adminDb.collection("creatorProfiles").where("assignedByUid", "==", managerUid).limit(1).get(),
    ]);
    if (!creatorByManagerSnap.empty || !creatorByAssignedSnap.empty) {
      return NextResponse.json(
        {
          ok: false,
          error: "This manager has assigned creators. Transfer creators before deleting.",
        },
        { status: 400 },
      );
    }

    const userData = userSnap.data() as Record<string, unknown>;
    const existingRoles = normalizeRoles(userData.roles);
    const nextRoles = removeRole(existingRoles, "manager");
    const nextPrimaryRole = pickPrimaryRole(nextRoles);

    await adminAuth.updateUser(managerUid, { disabled: true });
    await adminAuth.setCustomUserClaims(managerUid, {
      role: nextPrimaryRole,
      roles: nextRoles,
    });
    await userRef.set(
      {
        role: nextPrimaryRole,
        roles: nextRoles,
        managerStatus: "deleted",
        deletedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "manager_deleted",
      targetType: "manager_user",
      targetId: managerUid,
      message: "Manager access deleted.",
      metadata: {
        managerUid,
        managerEmail: String(userData.email ?? ""),
        managerPublicId: String(userData.managerPublicId ?? ""),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete manager.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
