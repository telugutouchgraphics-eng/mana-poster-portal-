import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { assertCreatorInScope } from "@/lib/server/manager-scope";
import { generateInviteToken, hashInviteToken } from "@/lib/server/invite-token";
import { buildCreatorActivationLink, buildPortalLoginUrl } from "@/lib/server/auth-links";
import { generateManagedPassword } from "@/lib/server/password";
import { FieldValue } from "firebase-admin/firestore";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);
    const creatorRef = creatorSnap.ref;

    const creator = creatorSnap.data()!;
    if (creator.status === "blocked") {
      return NextResponse.json(
        { ok: false, error: "Blocked creator cannot receive login link." },
        { status: 409 }
      );
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const now = Date.now();
    const inviteRef = adminDb.collection("creatorInvites").doc();
    const email = String(creator.email ?? "").toLowerCase();
    const name = String(creator.name ?? "Creator");
    const phone = String(creator.phone ?? "");
    const authUid = String(creator.authUid ?? "").trim();
    const loginLink = buildPortalLoginUrl("creator");
    const setupLink = buildCreatorActivationLink(token);

    await adminDb.runTransaction(async (tx) => {
      tx.set(inviteRef, {
        inviteId: inviteRef.id,
        creatorPublicId,
        email,
        name,
        phone,
        tokenHash,
        status: "pending",
        createdByUid: actor.uid,
        createdByRole: actor.role,
        createdAt: now,
        updatedAt: now,
      });
      tx.set(
        creatorRef,
        {
          status: "pending_invite",
          ...(authUid.length > 0 ? { status: "active" } : {}),
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        adminDb.collection("creatorEmailIndex").doc(email),
        {
          creatorPublicId,
          email,
          status: authUid.length > 0 ? "active" : "pending_invite",
          updatedAt: now,
        },
        { merge: true }
      );
    });

    if (authUid.length > 0) {
      const seedPassword = await generateManagedPassword(adminDb, "creator");
      await adminAuth.updateUser(authUid, { password: seedPassword, disabled: false });
      await adminDb.collection("users").doc(authUid).set(
        {
          loginPassword: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );
      await creatorRef.set(
        {
          loginPassword: FieldValue.delete(),
          updatedAt: now,
        },
        { merge: true }
      );

      const whatsappMessage = [
        `Hi ${name},`,
        `Mana Poster Ai Creator access refreshed.`,
        `Creator ID: ${creatorPublicId}`,
        `Login URL: ${loginLink}`,
        `Login with this email: ${email}`,
        `New system password (copy exactly): ${seedPassword}`,
        `Steps: open login → enter email + password → Send OTP → enter the 6-digit OTP from this email.`,
        `(Optional setup / password change link: ${setupLink})`,
      ].join("\n");

      return NextResponse.json({
        ok: true,
        creatorPublicId,
        loginLink,
        loginEmail: email,
        initialPassword: seedPassword,
        setupLink,
        whatsappMessage,
      });
    }

    const whatsappMessageInvite = [
      `Hi ${name},`,
      `Mana Poster Ai Creator access refreshed.`,
      `Creator ID: ${creatorPublicId}`,
      `Login URL: ${loginLink}`,
      `Login email once account is activated: ${email}`,
      `Complete setup link: ${setupLink}`,
      `Open the setup link first if the creator has not activated login yet.`,
    ].join("\n");

    return NextResponse.json({
      ok: true,
      creatorPublicId,
      loginLink,
      setupLink,
      whatsappMessage: whatsappMessageInvite,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to regenerate link.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

