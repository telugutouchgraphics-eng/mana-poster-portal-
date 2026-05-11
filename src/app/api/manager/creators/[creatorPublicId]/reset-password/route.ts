import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { assertManagedRoleAssignmentAllowed, requireRole } from "@/lib/server/auth";
import { assertCreatorInScope } from "@/lib/server/manager-scope";
import { buildPortalLoginUrl } from "@/lib/server/auth-links";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";
import { generateManagedPassword } from "@/lib/server/password";
import { isAppRole, mergeRoles, normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);
    const creatorRef = creatorSnap.ref;

    const creator = creatorSnap.data();
    const now = Date.now();
    const normalizedEmail = String(creator?.email ?? "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json(
        { ok: false, error: "Creator email missing on profile." },
        { status: 400 },
      );
    }
    const resolvedAuthEmail =
      String(creator?.authEmail ?? "").trim().toLowerCase() ||
      buildRoleAuthEmail(normalizedEmail, "creator");
    const name = String(creator?.name ?? "Creator").trim();
    const phone = String(creator?.phone ?? "").trim();
    const seedPassword = await generateManagedPassword(adminDb, "creator");

    let authUid = String(creator?.authUid ?? "").trim();

    if (!authUid) {
      let existingAuthUid: string | null = null;
      let existingRoles: ReturnType<typeof normalizeRoles> = [];

      try {
        const existing = await adminAuth.getUserByEmail(resolvedAuthEmail);
        existingAuthUid = existing.uid;
        const existingUserDoc = await adminDb.collection("users").doc(existing.uid).get();
        const legacyRole = existingUserDoc.data()?.role;
        existingRoles = mergeRoles(
          normalizeRoles(existingUserDoc.data()?.roles),
          typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : [],
        );
        assertManagedRoleAssignmentAllowed(normalizedEmail, existingRoles, "creator");
      } catch (error) {
        if (error instanceof Error && !error.message.includes("no user record")) {
          throw error;
        }
      }

      if (existingAuthUid) {
        authUid = existingAuthUid;
        await adminAuth.updateUser(authUid, {
          email: resolvedAuthEmail,
          password: seedPassword,
          displayName: name,
          disabled: false,
        });
      } else {
        const created = await adminAuth.createUser({
          email: resolvedAuthEmail,
          password: seedPassword,
          displayName: name,
          disabled: false,
        });
        authUid = created.uid;
      }

      const mergedRoles = mergeRoles(existingRoles, ["creator"]);
      const nextPrimaryRole = pickPrimaryRole(mergedRoles);
      await adminAuth.setCustomUserClaims(authUid, {
        role: nextPrimaryRole,
        roles: mergedRoles,
      });

      const profileCreatedAt =
        typeof creator?.createdAt === "number" ? creator.createdAt : now;

      await adminDb.runTransaction(async (tx) => {
        const userRef = adminDb.collection("users").doc(authUid);
        const emailIndexRef = adminDb.collection("creatorEmailIndex").doc(normalizedEmail);

        tx.set(
          userRef,
          {
            uid: authUid,
            role: nextPrimaryRole,
            roles: mergedRoles,
            email: normalizedEmail,
            authEmail: resolvedAuthEmail,
            name,
            phone,
            creatorPublicId,
            activeDeviceId: null,
            activeDeviceMeta: null,
            loginPassword: FieldValue.delete(),
            updatedAt: now,
            createdAt: profileCreatedAt,
          },
          { merge: true },
        );

        tx.set(
          creatorRef,
          {
            status: "active",
            authUid,
            authEmail: resolvedAuthEmail,
            loginPassword: FieldValue.delete(),
            updatedAt: now,
            lastPasswordResetByUid: actor.uid,
            lastPasswordResetByRole: actor.role,
          },
          { merge: true },
        );

        tx.set(
          emailIndexRef,
          {
            creatorPublicId,
            email: normalizedEmail,
            authEmail: resolvedAuthEmail,
            status: "active",
            authUid,
            updatedAt: now,
          },
          { merge: true },
        );
      });
    } else {
      await adminAuth.updateUser(authUid, {
        password: seedPassword,
        email: resolvedAuthEmail,
        disabled: false,
      });
      await adminDb.collection("users").doc(authUid).set(
        {
          loginPassword: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true },
      );
      await creatorRef.set(
        {
          loginPassword: FieldValue.delete(),
          status: "active",
          updatedAt: now,
          authEmail: resolvedAuthEmail,
          lastPasswordResetByUid: actor.uid,
          lastPasswordResetByRole: actor.role,
        },
        { merge: true },
      );
    }

    return NextResponse.json({
      ok: true,
      loginEmail: normalizedEmail,
      initialPassword: seedPassword,
      loginLink: buildPortalLoginUrl("creator"),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset creator password.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
