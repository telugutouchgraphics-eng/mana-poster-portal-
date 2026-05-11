import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { makeCreatorPublicId } from "@/lib/server/creator-id";
import { assertManagedRoleAssignmentAllowed, requireRole } from "@/lib/server/auth";
import { buildCreatorActivationLink } from "@/lib/server/auth-links";
import { generateInviteToken, hashInviteToken } from "@/lib/server/invite-token";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateManagedPassword } from "@/lib/server/password";
import { isAppRole, mergeRoles, normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
});

async function findExistingCreatorByEmailOrPhone(email: string, phone: string) {
  const [emailSnap, phoneSnap] = await Promise.all([
    adminDb.collection("creatorProfiles").where("email", "==", email).limit(1).get(),
    adminDb.collection("creatorProfiles").where("phone", "==", phone).limit(1).get(),
  ]);

  const match = emailSnap.docs[0] ?? phoneSnap.docs[0];
  if (!match) {
    return null;
  }

  const data = match.data();
  return {
    creatorPublicId: String(data.creatorPublicId ?? match.id).trim(),
    status: String(data.status ?? "pending_invite").trim(),
    name: String(data.name ?? "").trim(),
    email: String(data.email ?? "").trim().toLowerCase(),
    phone: String(data.phone ?? "").trim(),
  };
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "manager_creator_invite",
      limit: 15,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["manager", "admin"]);
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();
    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const normalizedEmail = payload.email.toLowerCase();
    const authEmail = buildRoleAuthEmail(normalizedEmail, "creator");
    const seedPassword = await generateManagedPassword(adminDb, "creator");
    const loginLink = "https://creator.manaposter.in/login";
    const setupLink = buildCreatorActivationLink(token);
    const existingCreator = await findExistingCreatorByEmailOrPhone(
      normalizedEmail,
      payload.phone,
    );
    if (existingCreator) {
      if (existingCreator.status === "blocked") {
        return NextResponse.json(
          {
            ok: false,
            code: "creator_access_exists_inactive",
            error:
              "Creator access already exists for this email or phone number. Do you want to reactivate it instead?",
            creatorPublicId: existingCreator.creatorPublicId,
            existingStatus: existingCreator.status,
            existingName: existingCreator.name,
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          code: "creator_access_exists",
          error: "Creator access already exists for this email or phone number.",
          creatorPublicId: existingCreator.creatorPublicId,
          existingStatus: existingCreator.status,
          existingName: existingCreator.name,
        },
        { status: 409 },
      );
    }
    let existingAuthUid: string | null = null;
    let existingRoles: ReturnType<typeof normalizeRoles> = [];

    try {
      const existing = await adminAuth.getUserByEmail(authEmail);
      existingAuthUid = existing.uid;
      const existingUserDoc = await adminDb.collection("users").doc(existing.uid).get();
      const legacyRole = existingUserDoc.data()?.role;
      existingRoles = mergeRoles(
        normalizeRoles(existingUserDoc.data()?.roles),
        typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : []
      );
      assertManagedRoleAssignmentAllowed(normalizedEmail, existingRoles, "creator");
    } catch (error) {
      if (error instanceof Error && !error.message.includes("no user record")) {
        throw error;
      }
    }

    const result = await adminDb.runTransaction(async (tx) => {
      const counterRef = adminDb.collection("system").doc("counters");
      const emailIndexRef = adminDb
        .collection("creatorEmailIndex")
        .doc(normalizedEmail);
      const counterSnap = await tx.get(counterRef);
      const emailIndexSnap = await tx.get(emailIndexRef);
      if (emailIndexSnap.exists) {
        throw new Error("Creator access already exists for this email.");
      }
      const currentSerial = (counterSnap.data()?.creatorSerial as number) ?? 0;
      const nextSerial = currentSerial + 1;
      const creatorPublicId = makeCreatorPublicId(nextSerial);

      const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
      tx.set(creatorRef, {
        creatorPublicId,
        name: payload.name,
        email: normalizedEmail,
        phone: payload.phone,
        status: "pending_invite",
        assignedByUid: actor.uid,
        assignedByRole: actor.role,
        managerUid: actor.role === "manager" ? actor.uid : "",
        managerEmail: actor.role === "manager" ? String(actor.email ?? "").toLowerCase() : "",
        createdAt: now,
        updatedAt: now,
      });

      const inviteRef = adminDb.collection("creatorInvites").doc();
      tx.set(inviteRef, {
        inviteId: inviteRef.id,
        creatorPublicId,
        email: normalizedEmail,
        name: payload.name,
        phone: payload.phone,
        tokenHash,
        status: "pending",
        createdByUid: actor.uid,
        createdByRole: actor.role,
        managerUid: actor.role === "manager" ? actor.uid : "",
        managerEmail: actor.role === "manager" ? String(actor.email ?? "").toLowerCase() : "",
        createdAt: now,
        updatedAt: now,
      });

      tx.set(
        counterRef,
        {
          creatorSerial: nextSerial,
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(emailIndexRef, {
        creatorPublicId,
        email: normalizedEmail,
        status: "pending_invite",
        updatedAt: now,
      });

      return {
        creatorPublicId,
        inviteId: inviteRef.id,
      };
    });

    let authUid: string;
    if (existingAuthUid) {
      authUid = existingAuthUid;
      await adminAuth.updateUser(authUid, {
        email: authEmail,
        password: seedPassword,
        displayName: payload.name,
        disabled: false,
      });
    } else {
      const created = await adminAuth.createUser({
        email: authEmail,
        password: seedPassword,
        displayName: payload.name,
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
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection("users").doc(authUid);
      const creatorRef = adminDb.collection("creatorProfiles").doc(result.creatorPublicId);
      const emailIndexRef = adminDb.collection("creatorEmailIndex").doc(normalizedEmail);
      tx.set(
        userRef,
        {
          uid: authUid,
          role: nextPrimaryRole,
          roles: mergedRoles,
          email: normalizedEmail,
          authEmail,
          name: payload.name,
          phone: payload.phone,
          creatorPublicId: result.creatorPublicId,
          activeDeviceId: null,
          activeDeviceMeta: null,
          loginPassword: FieldValue.delete(),
          updatedAt: now,
          createdAt: now,
        },
        { merge: true }
      );
      tx.set(
        creatorRef,
        {
          status: "active",
          authUid,
          authEmail,
          loginPassword: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        emailIndexRef,
        {
          creatorPublicId: result.creatorPublicId,
          email: normalizedEmail,
          authEmail,
          status: "active",
          authUid,
          updatedAt: now,
        },
        { merge: true }
      );
    });

    const whatsappMessage = [
      `Hi ${payload.name},`,
      `Mana Poster Ai Creator access approved.`,
      `Creator ID: ${result.creatorPublicId}`,
      `Login URL: ${loginLink}`,
      `Login with this email: ${normalizedEmail}`,
      `System password (copy exactly): ${seedPassword}`,
      `Steps: open login → enter email + password above → Send OTP → enter the 6-digit OTP from the same email.`,
      `(Optional password change link: ${setupLink})`,
    ].join("\n");

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_invited",
      targetType: "creator_profile",
      targetId: result.creatorPublicId,
      message: "Creator invite generated.",
      metadata: {
        inviteId: result.inviteId,
        email: normalizedEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      creatorPublicId: result.creatorPublicId,
      inviteId: result.inviteId,
      loginEmail: normalizedEmail,
      initialPassword: seedPassword,
      loginLink,
      setupLink,
      whatsappMessage,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate invite.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

