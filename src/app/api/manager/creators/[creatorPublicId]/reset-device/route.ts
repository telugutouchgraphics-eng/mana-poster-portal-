import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertCreatorInScope } from "@/lib/server/manager-scope";
import { writeAuditLog } from "@/lib/server/audit-log";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["manager", "admin"]);
    const { creatorPublicId } = await params;
    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);

    const authUid = creatorSnap.data()?.authUid as string | undefined;
    if (authUid) {
      await adminDb.collection("users").doc(authUid).set(
        {
          activeDeviceId: null,
          activeDeviceMeta: null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_device_reset",
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: "Creator active device session reset.",
      metadata: {
        authUid: authUid ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
