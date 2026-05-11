import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { assertManagedRoleAssignmentAllowed, requireRole } from "@/lib/server/auth";
import { buildPortalLoginUrl, generatePortalPasswordResetLink } from "@/lib/server/auth-links";
import { makeManagerPublicId } from "@/lib/server/manager-id";
import {
  isAppRole,
  mergeRoles,
  normalizeRoles,
  pickPrimaryRole,
} from "@/lib/server/role-utils";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateManagedPassword } from "@/lib/server/password";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "admin_manager_create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();
    const normalizedEmail = payload.email.toLowerCase();
    const authEmail = buildRoleAuthEmail(normalizedEmail, "manager");
    const seedPassword = await generateManagedPassword(adminDb, "manager");

    let managerUid: string;
    try {
      const existing = await adminAuth.getUserByEmail(authEmail);
      managerUid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email: authEmail,
        password: seedPassword,
        displayName: payload.name,
      });
      managerUid = created.uid;
    }

    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    const legacyRole = userSnap.data()?.role;
    const existingRoles = mergeRoles(
      normalizeRoles(userSnap.data()?.roles),
      typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : []
    );
    assertManagedRoleAssignmentAllowed(normalizedEmail, existingRoles, "manager");
    const mergedRoles = mergeRoles(existingRoles, ["manager"]);
    const nextPrimaryRole = pickPrimaryRole(mergedRoles);

    await adminAuth.updateUser(managerUid, {
      password: seedPassword,
      displayName: payload.name,
      disabled: false,
      email: authEmail,
    });
    await adminAuth.setCustomUserClaims(managerUid, {
      role: nextPrimaryRole,
      roles: mergedRoles,
    });

    const managerPublicId = await adminDb.runTransaction(async (tx) => {
      const freshSnap = await tx.get(userRef);
      const existingPublicId = freshSnap.data()?.managerPublicId as string | undefined;
      if (existingPublicId && existingPublicId.trim().length > 0) {
        tx.set(
          userRef,
          {
            uid: managerUid,
            role: nextPrimaryRole,
            roles: mergedRoles,
            managerStatus: "active",
            email: normalizedEmail,
            authEmail,
            name: payload.name,
            phone: payload.phone,
            updatedAt: now,
            createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
            managerAssignedByUid: actor.uid,
            loginPassword: FieldValue.delete(),
          },
          { merge: true }
        );
        return existingPublicId;
      }

      const counterRef = adminDb.collection("system").doc("counters");
      const counterSnap = await tx.get(counterRef);
      const currentSerial = (counterSnap.data()?.managerSerial as number) ?? 0;
      const nextSerial = currentSerial + 1;
      const nextPublicId = makeManagerPublicId(nextSerial);

      tx.set(
        counterRef,
        {
          managerSerial: nextSerial,
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        userRef,
        {
          uid: managerUid,
          managerPublicId: nextPublicId,
          role: nextPrimaryRole,
          roles: mergedRoles,
          managerStatus: "active",
          email: normalizedEmail,
          authEmail,
          name: payload.name,
          phone: payload.phone,
          updatedAt: now,
          createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
          managerAssignedByUid: actor.uid,
          loginPassword: FieldValue.delete(),
        },
        { merge: true }
      );
      return nextPublicId;
    });
    const recoveryResetLink = await generatePortalPasswordResetLink(authEmail, "manager");

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "manager_created",
      targetType: "manager_user",
      targetId: managerUid,
      message: "Manager account created or updated.",
      metadata: {
        managerPublicId,
        email: normalizedEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      managerUid,
      managerPublicId,
      loginLink: buildPortalLoginUrl("manager"),
      initialPassword: seedPassword,
      recoveryResetLink,
      setupLink: recoveryResetLink,
      email: normalizedEmail,
      name: payload.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manager create failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
