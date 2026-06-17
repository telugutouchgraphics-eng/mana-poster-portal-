import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertCreatorInScope } from "@/lib/server/manager-scope";
import { assertActorCanAssignRegions } from "@/lib/server/region-scope";
import { writeAuditLog } from "@/lib/server/audit-log";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

const requestSchema = z.object({
  regionIds: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const payload = requestSchema.parse(await req.json());
    const assignedRegionIds = await assertActorCanAssignRegions(actor, payload.regionIds);
    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);
    const creatorData = creatorSnap.data() ?? {};
    const authUid = String(creatorData.authUid ?? "").trim();
    const now = Date.now();

    await creatorSnap.ref.set(
      {
        assignedRegionIds,
        updatedAt: now,
      },
      { merge: true },
    );
    if (authUid) {
      await adminDb.collection("users").doc(authUid).set(
        {
          assignedRegionIds,
          updatedAt: now,
        },
        { merge: true },
      );
    }

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_regions_updated",
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: "Creator assigned regions updated.",
      metadata: { assignedRegionIds },
    });

    return NextResponse.json({ ok: true, assignedRegionIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Region assignment failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
