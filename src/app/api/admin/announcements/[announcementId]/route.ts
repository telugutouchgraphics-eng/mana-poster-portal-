import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

async function loadScopedAnnouncement(announcementId: string, actor: Awaited<ReturnType<typeof requireRole>>) {
  const ref = adminDb.collection("creatorAnnouncements").doc(announcementId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Announcement not found.");
  }
  const data = snap.data() ?? {};
  const regionId = String(data.regionId ?? "").trim();
  if (!regionId) {
    throw new Error("Legacy announcement is not state-scoped. Create a new state announcement.");
  }
  const region = await assertActorCanAccessRegion(actor, regionId);
  return { ref, region };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { announcementId } = await params;
    const body = (await req.json()) as { active?: boolean };
    const { ref, region } = await loadScopedAnnouncement(announcementId, actor);
    await ref.set(
      {
        active: typeof body.active === "boolean" ? body.active : true,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.announcement.update",
      targetId: announcementId,
      targetType: "creatorAnnouncement",
      message: "Updated creator announcement status",
      metadata: { regionId: region.id, regionName: region.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update announcement.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { announcementId } = await params;
    const { ref, region } = await loadScopedAnnouncement(announcementId, actor);
    await ref.delete();
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.announcement.delete",
      targetId: announcementId,
      targetType: "creatorAnnouncement",
      message: "Deleted creator announcement",
      metadata: { regionId: region.id, regionName: region.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete announcement.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
