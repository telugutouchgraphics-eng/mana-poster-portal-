import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { assertManagedRoleAssignmentAllowed, requireRole } from "@/lib/server/auth";
import { buildPortalLoginUrl, generatePortalPasswordResetLink } from "@/lib/server/auth-links";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateManagedPassword } from "@/lib/server/password";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
});

function makeAdminLoginId(serial: number) {
  return `admin-mp-${String(serial).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "admin_access_create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();
    const normalizedEmail = payload.email.toLowerCase();
    const authEmail = buildRoleAuthEmail(normalizedEmail, "landing");
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
    const adminLoginId = await adminDb.runTransaction(async (tx) => {
      const counterRef = adminDb.collection("system").doc("counters");
      const counterSnap = await tx.get(counterRef);
      const currentSerial = (counterSnap.data()?.adminSerial as number) ?? 0;
      const nextSerial = currentSerial + 1;
      const nextLoginId = makeAdminLoginId(nextSerial);

      tx.set(
        counterRef,
        {
          adminSerial: nextSerial,
          updatedAt: now,
        },
        { merge: true },
      );

      tx.set(
        userRef,
        {
          adminLoginId: nextLoginId,
          previousAdminLoginId: userSnap.data()?.adminLoginId ?? null,
          updatedAt: now,
        },
        { merge: true },
      );

      return nextLoginId;
    });

    assertManagedRoleAssignmentAllowed(normalizedEmail, [], "admin");

    await adminAuth.updateUser(adminUid, {
      email: authEmail,
      displayName: payload.name,
    });
    await adminAuth.setCustomUserClaims(adminUid, {
      landingAdmin: true,
    });

    await userRef.set(
      {
        uid: adminUid,
        role: "user",
        roles: [],
        email: normalizedEmail,
        authEmail,
        name: payload.name,
        phone: payload.phone,
        adminLoginId,
        adminManaged: true,
        adminStatus: "active",
        adminAssignedByUid: actor.uid,
        adminAssignedAt: now,
        loginPassword: FieldValue.delete(),
        updatedAt: now,
        createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
      },
      { merge: true },
    );
    const setupLink = await generatePortalPasswordResetLink(authEmail, "landing");

    await adminDb.collection("websiteConfig").doc("websiteAdminAccess").set(
      {
        primaryEmail: normalizedEmail,
        allowedEmails: [normalizedEmail],
        authEmail,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email ?? null,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: existingUser ? "admin_access_enabled" : "admin_access_created",
      targetType: "admin_user",
      targetId: adminUid,
      message: existingUser ? "Admin access granted to existing user." : "Admin account created.",
      metadata: {
        adminLoginId,
        email: normalizedEmail,
        phone: payload.phone,
      },
    });

    return NextResponse.json({
      ok: true,
      adminUid,
      email: normalizedEmail,
      name: payload.name,
      adminLoginId,
      loginLink: buildPortalLoginUrl("landing"),
      setupLink,
      existingUser,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin access create failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
