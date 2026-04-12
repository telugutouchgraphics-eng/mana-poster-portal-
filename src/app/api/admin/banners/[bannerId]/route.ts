import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { bannerId } = await params;
    const body = (await req.json()) as { active?: boolean; sortOrder?: number };
    await adminDb.collection("appBanners").doc(bannerId).set(
      {
        active: typeof body.active === "boolean" ? body.active : true,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.update",
      targetId: bannerId,
      targetType: "appBanner",
      message: "Updated app banner status/order",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { bannerId } = await params;
    await adminDb.collection("appBanners").doc(bannerId).delete();
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.delete",
      targetId: bannerId,
      targetType: "appBanner",
      message: "Deleted app banner",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
