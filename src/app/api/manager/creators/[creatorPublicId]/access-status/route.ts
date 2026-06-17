import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  isAppRole,
  mergeRoles,
  normalizeRoles,
  pickPrimaryRole,
  removeRole,
} from "@/lib/server/role-utils";
import { AppRole } from "@/lib/types/roles";
import { writeAuditLog } from "@/lib/server/audit-log";
import { assertCreatorInScope } from "@/lib/server/manager-scope";
import { assertActorCanAssignRegions } from "@/lib/server/region-scope";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

const requestSchema = z.object({
  status: z.enum(["active", "blocked"]),
  regionIds: z.array(z.string().trim().min(1)).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const payload = requestSchema.parse(await req.json());
    const assignedRegionIds =
      payload.regionIds && payload.regionIds.length > 0
        ? await assertActorCanAssignRegions(actor, payload.regionIds)
        : null;
    const now = Date.now();

    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);
    const creatorRef = creatorSnap.ref;

    const creatorData = creatorSnap.data()!;
    const authUid = String(creatorData.authUid ?? "").trim();

    if (authUid) {
      const userRef = adminDb.collection("users").doc(authUid);
      const userSnap = await userRef.get();
      const userData = userSnap.data();
      const legacyRole = userData?.role;
      const currentRoles = mergeRoles(
        normalizeRoles(userData?.roles),
        typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : []
      );
      const updatedRoles =
        payload.status === "active"
          ? mergeRoles(currentRoles, ["creator"])
          : removeRole(currentRoles, "creator");
      const safeRoles: AppRole[] =
        updatedRoles.length > 0 ? updatedRoles : ["user"];
      const primaryRole = pickPrimaryRole(safeRoles);

      await userRef.set(
        {
          role: primaryRole,
          roles: safeRoles,
          ...(assignedRegionIds ? { assignedRegionIds } : {}),
          updatedAt: now,
          ...(payload.status === "blocked"
            ? {
                activeDeviceId: null,
                activeDeviceMeta: null,
              }
            : {}),
        },
        { merge: true }
      );
      await adminAuth.setCustomUserClaims(authUid, {
        role: primaryRole,
        roles: safeRoles,
      });
      await adminAuth.revokeRefreshTokens(authUid);
    }

    await creatorRef.set(
      {
        status: payload.status,
        ...(assignedRegionIds ? { assignedRegionIds } : {}),
        updatedAt: now,
      },
      { merge: true }
    );
    const email = String(creatorData.email ?? "").trim().toLowerCase();
    if (email) {
      await adminDb
        .collection("creatorEmailIndex")
        .doc(email)
        .set(
          {
            status: payload.status,
            updatedAt: now,
          },
          { merge: true }
        );
    }

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_access_status_changed",
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: `Creator access changed to ${payload.status}.`,
      metadata: {
        status: payload.status,
        assignedRegionIds: assignedRegionIds ?? undefined,
      },
    });

    return NextResponse.json({ ok: true, status: payload.status, assignedRegionIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update creator access.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
