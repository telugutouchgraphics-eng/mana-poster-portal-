import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertActorCanAssignRegions } from "@/lib/server/region-scope";
import { isPermanentDashboardAdminEmail } from "@/lib/server/permanent-admins";
import type { AppRole } from "@/lib/types/roles";
import {
  isAppRole,
  mergeRoles,
  normalizeRoles,
  pickPrimaryRole,
  removeRole,
} from "@/lib/server/role-utils";

const requestSchema = z.object({
  dashboardAdminStatus: z.enum(["active", "inactive"]),
});

const regionRequestSchema = z.object({
  regionIds: z.array(z.string().trim()).min(1),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ adminUid: string }> },
) {
  try {
    await enforceRateLimit(req, {
      key: "dashboard_admin_access_toggle",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const { adminUid } = await context.params;
    const payload = requestSchema.parse(await req.json());

    if (adminUid === actor.uid) {
      return NextResponse.json(
        { ok: false, error: "Your own dashboard admin access cannot be deactivated here." },
        { status: 409 },
      );
    }

    const userRef = adminDb.collection("users").doc(adminUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "Dashboard admin user not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    const legacyRole = userData?.role;
    const existingRoles = mergeRoles(
      normalizeRoles(userData?.roles),
      typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : [],
    );
    const nextRoles =
      payload.dashboardAdminStatus === "active"
        ? mergeRoles(existingRoles, ["admin"])
        : removeRole(existingRoles, "admin");
    const safeRoles: AppRole[] = nextRoles.length > 0 ? nextRoles : ["user"];
    const nextPrimaryRole = pickPrimaryRole(safeRoles);
    const now = Date.now();

    await adminAuth.setCustomUserClaims(adminUid, {
      role: nextPrimaryRole,
      roles: safeRoles,
    });
    await adminAuth.revokeRefreshTokens(adminUid);

    await userRef.set(
      {
        uid: adminUid,
        role: nextPrimaryRole,
        roles: safeRoles,
        dashboardAdminManaged: true,
        dashboardAdminStatus: payload.dashboardAdminStatus,
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action:
        payload.dashboardAdminStatus === "active"
          ? "dashboard_admin_access_activated"
          : "dashboard_admin_access_deactivated",
      targetType: "dashboard_admin_user",
      targetId: adminUid,
      message:
        payload.dashboardAdminStatus === "active"
          ? "Dashboard admin access activated."
          : "Dashboard admin access deactivated.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update dashboard admin access.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ adminUid: string }> },
) {
  try {
    await enforceRateLimit(req, {
      key: "dashboard_admin_regions_update",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const { adminUid } = await context.params;
    const payload = regionRequestSchema.parse(await req.json());
    const assignedRegionIds = await assertActorCanAssignRegions(actor, payload.regionIds);

    const userRef = adminDb.collection("users").doc(adminUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "Dashboard admin user not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    if (isPermanentDashboardAdminEmail(userData?.email ?? userData?.authEmail)) {
      return NextResponse.json(
        { ok: false, error: "Permanent admin states cannot be changed." },
        { status: 409 },
      );
    }

    const now = Date.now();
    await userRef.set(
      {
        assignedRegionIds,
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "dashboard_admin_regions_updated",
      targetType: "dashboard_admin_user",
      targetId: adminUid,
      message: "Dashboard admin state access updated.",
      metadata: { assignedRegionIds },
    });

    return NextResponse.json({ ok: true, assignedRegionIds });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update dashboard admin states.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ adminUid: string }> },
) {
  try {
    await enforceRateLimit(req, {
      key: "dashboard_admin_access_delete",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const { adminUid } = await context.params;

    if (adminUid === actor.uid) {
      return NextResponse.json(
        { ok: false, error: "Your own dashboard admin access cannot be deleted here." },
        { status: 409 },
      );
    }

    const userRef = adminDb.collection("users").doc(adminUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ ok: false, error: "Dashboard admin user not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    const legacyRole = userData?.role;
    const existingRoles = mergeRoles(
      normalizeRoles(userData?.roles),
      typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : [],
    );
    if (!existingRoles.includes("admin")) {
      return NextResponse.json({ ok: false, error: "Dashboard admin access not found." }, { status: 404 });
    }

    const allUsers = await adminDb.collection("users").get();
    const activeAdminCount = allUsers.docs.filter((doc) => {
      const data = doc.data();
      const roles = mergeRoles(
        normalizeRoles(data.roles),
        typeof data.role === "string" && isAppRole(data.role) ? [data.role] : [],
      );
      const status = String(data.dashboardAdminStatus ?? "active");
      return roles.includes("admin") && status === "active";
    }).length;
    const deletingActiveAdmin = String(userData?.dashboardAdminStatus ?? "active") === "active";
    if (deletingActiveAdmin && activeAdminCount <= 1) {
      return NextResponse.json(
        { ok: false, error: "At least one active dashboard admin must remain." },
        { status: 409 },
      );
    }

    const nextRoles = removeRole(existingRoles, "admin");
    const safeRoles: AppRole[] = nextRoles.length > 0 ? nextRoles : ["user"];
    const nextPrimaryRole = pickPrimaryRole(safeRoles);
    const now = Date.now();

    await adminAuth.setCustomUserClaims(adminUid, {
      role: nextPrimaryRole,
      roles: safeRoles,
    });
    await adminAuth.revokeRefreshTokens(adminUid);

    await userRef.set(
      {
        uid: adminUid,
        role: nextPrimaryRole,
        roles: safeRoles,
        dashboardAdminManaged: true,
        dashboardAdminStatus: "deleted",
        dashboardAdminDeletedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "dashboard_admin_access_deleted",
      targetType: "dashboard_admin_user",
      targetId: adminUid,
      message: "Dashboard admin access deleted.",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete dashboard admin access.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
