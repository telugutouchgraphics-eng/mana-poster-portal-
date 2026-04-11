import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { hashInviteToken } from "@/lib/server/invite-token";
import {
  isAppRole,
  mergeRoles,
  normalizeRoles,
  pickPrimaryRole,
} from "@/lib/server/role-utils";

const requestSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();
    const tokenHash = hashInviteToken(payload.token);

    const inviteQuery = await adminDb
      .collection("creatorInvites")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();

    if (inviteQuery.empty) {
      return NextResponse.json(
        { ok: false, error: "Invalid access link." },
        { status: 400 }
      );
    }

    const inviteDoc = inviteQuery.docs[0]!;
    const invite = inviteDoc.data();
    if (invite.status !== "pending") {
      return NextResponse.json(
        { ok: false, error: "This access link is already used." },
        { status: 409 }
      );
    }

    const email = invite.email as string;
    const name = invite.name as string;
    const creatorPublicId = invite.creatorPublicId as string;

    let authUserUid: string;
    let existingRoles: ReturnType<typeof normalizeRoles> = [];
    let nextPrimaryRole: "admin" | "manager" | "creator" | "user" = "creator";
    try {
      const existing = await adminAuth.getUserByEmail(email);
      authUserUid = existing.uid;
      const existingUserDoc = await adminDb.collection("users").doc(authUserUid).get();
      const legacyRole = existingUserDoc.data()?.role;
      existingRoles = mergeRoles(
        normalizeRoles(existingUserDoc.data()?.roles),
        typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : []
      );
      const hasAdminRole =
        existingRoles.includes("admin") || existingUserDoc.data()?.role === "admin";
      if (hasAdminRole) {
        return NextResponse.json(
          {
            ok: false,
            error: "This email is already bound to admin account and cannot be used as creator.",
          },
          { status: 409 }
        );
      }
      const merged = mergeRoles(existingRoles, ["creator"]);
      nextPrimaryRole = pickPrimaryRole(merged);
      await adminAuth.updateUser(authUserUid, {
        password: payload.password,
        displayName: name,
      });
    } catch {
      const created = await adminAuth.createUser({
        email,
        password: payload.password,
        displayName: name,
      });
      authUserUid = created.uid;
      existingRoles = [];
      nextPrimaryRole = "creator";
    }

    const mergedRoles = mergeRoles(existingRoles, ["creator"]);
    await adminAuth.setCustomUserClaims(authUserUid, {
      role: nextPrimaryRole,
      roles: mergedRoles,
    });
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection("users").doc(authUserUid);
      const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
      const emailIndexRef = adminDb.collection("creatorEmailIndex").doc(email);

      tx.set(
        userRef,
        {
          uid: authUserUid,
          role: nextPrimaryRole,
          roles: mergedRoles,
          email,
          name,
          phone: invite.phone,
          creatorPublicId,
          activeDeviceId: null,
          activeDeviceMeta: null,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      tx.set(
        creatorRef,
        {
          status: "active",
          authUid: authUserUid,
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        emailIndexRef,
        {
          creatorPublicId,
          email,
          status: "active",
          authUid: authUserUid,
          updatedAt: now,
        },
        { merge: true }
      );

      tx.set(
        inviteDoc.ref,
        {
          status: "claimed",
          claimedAt: now,
          claimedByUid: authUserUid,
          updatedAt: now,
        },
        { merge: true }
      );
    });

    return NextResponse.json({
      ok: true,
      email,
      creatorPublicId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
