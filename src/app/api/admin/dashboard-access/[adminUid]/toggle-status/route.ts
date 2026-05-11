import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
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
