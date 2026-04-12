import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { makeCreatorPublicId } from "@/lib/server/creator-id";
import { requireRole } from "@/lib/server/auth";
import { generateInviteToken, hashInviteToken } from "@/lib/server/invite-token";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
});

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
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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

    const loginLink = `${appUrl}/creator/access?token=${encodeURIComponent(token)}`;
    const whatsappMessage = [
      `Hi ${payload.name},`,
      `Mana Poster Creator access approved.`,
      `Creator ID: ${result.creatorPublicId}`,
      `Login link: ${loginLink}`,
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
      loginLink,
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
