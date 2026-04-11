import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { generateInviteToken, hashInviteToken } from "@/lib/server/invite-token";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
    const creatorSnap = await creatorRef.get();
    if (!creatorSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Creator not found." },
        { status: 404 }
      );
    }

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        adminDb.collection("creatorEmailIndex").doc(email),
        {
          creatorPublicId,
          email,
          status: "pending_invite",
          updatedAt: now,
        },
        { merge: true }
      );
    });

    const loginLink = `${appUrl}/creator/access?token=${encodeURIComponent(token)}`;
    const whatsappMessage = [
      `Hi ${name},`,
      `Mana Poster Creator access link regenerated.`,
      `Creator ID: ${creatorPublicId}`,
      `Login link: ${loginLink}`,
    ].join("\n");

    return NextResponse.json({
      ok: true,
      creatorPublicId,
      loginLink,
      whatsappMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to regenerate link.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
