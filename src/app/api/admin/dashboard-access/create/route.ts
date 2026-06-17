import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { assertManagedRoleAssignmentAllowed, requireRole } from "@/lib/server/auth";
import { buildPortalLoginUrl } from "@/lib/server/auth-links";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertActorCanAssignRegions } from "@/lib/server/region-scope";
import { isAppRole, mergeRoles, normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";
import { generateManagedPassword } from "@/lib/server/password";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
  regionIds: z.array(z.string().trim()).min(1),
});

function makeDashboardAdminLoginId(serial: number) {
  return `dash-mp-${String(serial).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "dashboard_admin_access_create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const assignedRegionIds = await assertActorCanAssignRegions(actor, payload.regionIds);
    const now = Date.now();
    const normalizedEmail = payload.email.toLowerCase();
    const authEmail = buildRoleAuthEmail(normalizedEmail, "admin");
    const seedPassword = await generateManagedPassword(adminDb, "admin");

    let adminUid: string;
    let existingUser = false;

    try {
      const user = await adminAuth.getUserByEmail(authEmail);
      adminUid = user.uid;
      existingUser = true;
    } catch {
      const created = await adminAuth.createUser({
        email: authEmail,
        password: seedPassword,
        displayName: payload.name,
      });
      adminUid = created.uid;
    }

    const userRef = adminDb.collection("users").doc(adminUid);
    const userSnap = await userRef.get();
    const dashboardAdminLoginId = await adminDb.runTransaction(async (tx) => {
      const counterRef = adminDb.collection("system").doc("counters");
      const counterSnap = await tx.get(counterRef);
      const currentSerial = (counterSnap.data()?.dashboardAdminSerial as number) ?? 0;
      const nextSerial = currentSerial + 1;
      const nextLoginId = makeDashboardAdminLoginId(nextSerial);

      tx.set(
        counterRef,
        {
          dashboardAdminSerial: nextSerial,
          updatedAt: now,
        },
        { merge: true },
      );

      tx.set(
        userRef,
        {
          dashboardAdminLoginId: nextLoginId,
          previousDashboardAdminLoginId: userSnap.data()?.dashboardAdminLoginId ?? null,
          updatedAt: now,
        },
        { merge: true },
      );

      return nextLoginId;
    });

    const legacyRole = userSnap.data()?.role;
    const mergedRoles = mergeRoles(
      mergeRoles(
        normalizeRoles(userSnap.data()?.roles),
        typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : [],
      ),
      ["admin"],
    );
    assertManagedRoleAssignmentAllowed(normalizedEmail, mergedRoles, "admin");
    const nextPrimaryRole = pickPrimaryRole(mergedRoles);

    await adminAuth.updateUser(adminUid, {
      email: authEmail,
      password: seedPassword,
      displayName: payload.name,
      disabled: false,
    });
    await adminAuth.setCustomUserClaims(adminUid, {
      role: nextPrimaryRole,
      roles: mergedRoles,
    });

    await userRef.set(
      {
        uid: adminUid,
        role: nextPrimaryRole,
        roles: mergedRoles,
        email: normalizedEmail,
        authEmail,
        name: payload.name,
        phone: payload.phone,
        dashboardAdminLoginId,
        dashboardAdminManaged: true,
        dashboardAdminStatus: "active",
        assignedRegionIds,
        dashboardAdminAssignedByUid: actor.uid,
        dashboardAdminAssignedAt: now,
        loginPassword: seedPassword,
        updatedAt: now,
        createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: existingUser ? "dashboard_admin_access_enabled" : "dashboard_admin_access_created",
      targetType: "dashboard_admin_user",
      targetId: adminUid,
      message: existingUser
        ? "Dashboard admin access granted to existing user."
        : "Dashboard admin account created.",
      metadata: {
        dashboardAdminLoginId,
        email: normalizedEmail,
        phone: payload.phone,
        assignedRegionIds,
      },
    });

    return NextResponse.json({
      ok: true,
      adminUid,
      email: normalizedEmail,
      name: payload.name,
      dashboardAdminLoginId,
      loginLink: buildPortalLoginUrl("admin"),
      initialPassword: seedPassword,
      existingUser,
      assignedRegionIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dashboard admin access create failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
