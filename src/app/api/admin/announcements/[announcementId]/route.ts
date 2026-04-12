import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { announcementId } = await params;
    const body = (await req.json()) as { active?: boolean };
    await adminDb.collection("creatorAnnouncements").doc(announcementId).set(
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
    await adminDb.collection("creatorAnnouncements").doc(announcementId).delete();
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.announcement.delete",
      targetId: announcementId,
      targetType: "creatorAnnouncement",
      message: "Deleted creator announcement",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete announcement.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
