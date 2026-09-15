import { NextRequest, NextResponse } from "next/server";
import { editorAdminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { EDITOR_ASSET_CATEGORIES, EDITOR_ASSETS, normalizeEditorAssetName, normalizeSortOrder } from "@/lib/server/editor-assets";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { categoryId } = await params;
    const body = await req.json() as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof body.name === "string") update.name = normalizeEditorAssetName(body.name, "Category");
    if (typeof body.active === "boolean") update.active = body.active;
    if (body.sortOrder !== undefined) update.sortOrder = normalizeSortOrder(body.sortOrder);
    await editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc(categoryId).update(update);
    await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "update", targetType: "editor_asset_category", targetId: categoryId, message: "Updated asset category." });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update category." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    await requireRole(req, ["admin"]);
    const { categoryId } = await params;
    const assets = await editorAdminDb.collection(EDITOR_ASSETS).where("categoryId", "==", categoryId).limit(1).get();
    if (!assets.empty) throw new Error("Remove this category's assets first.");
    await editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc(categoryId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to delete category." }, { status: 400 });
  }
}
