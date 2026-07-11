import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteEditorAsset, EDITOR_ASSETS, normalizeEditorAssetName, normalizeSortOrder } from "@/lib/server/editor-assets";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { assetId } = await params;
    const body = await req.json() as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof body.name === "string") update.name = normalizeEditorAssetName(body.name, "Asset");
    if (typeof body.active === "boolean") update.active = body.active;
    if (body.sortOrder !== undefined) update.sortOrder = normalizeSortOrder(body.sortOrder);
    await adminDb.collection(EDITOR_ASSETS).doc(assetId).update(update);
    await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "update", targetType: "editor_asset", targetId: assetId, message: "Updated editor asset." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update asset." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { assetId } = await params;
    await deleteEditorAsset(assetId);
    await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "delete", targetType: "editor_asset", targetId: assetId, message: "Deleted editor asset." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to delete asset." }, { status: 400 });
  }
}
