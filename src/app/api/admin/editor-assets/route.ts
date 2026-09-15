import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  createEditorAssetCategory,
  createEditorTextAsset,
  ensureHomeAssetCategories,
  listEditorAssetCatalog,
  normalizeSortOrder,
  uploadEditorAsset,
} from "@/lib/server/editor-assets";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    await ensureHomeAssetCategories();
    return NextResponse.json({ ok: true, ...(await listEditorAssetCatalog(true)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load assets." }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const form = await req.formData();
    const kind = String(form.get("kind") ?? "asset");
    if (kind === "category") {
      const category = await createEditorAssetCategory({
        name: String(form.get("name") ?? ""),
        sortOrder: normalizeSortOrder(form.get("sortOrder")),
      });
      await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "create", targetType: "editor_asset_category", targetId: category.id, message: `Created asset category ${category.name}.` });
      return NextResponse.json({ ok: true, category });
    }
    if (kind === "text") {
      const asset = await createEditorTextAsset({
        categoryId: String(form.get("categoryId") ?? "").trim(),
        name: String(form.get("name") ?? ""),
        value: String(form.get("value") ?? ""),
        sortOrder: normalizeSortOrder(form.get("sortOrder")),
      });
      await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "create", targetType: "editor_asset", targetId: asset.id, message: `Created editor symbol ${asset.name}.`, metadata: { categoryId: asset.categoryId } });
      return NextResponse.json({ ok: true, asset });
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose an asset file.");
    const asset = await uploadEditorAsset({
      categoryId: String(form.get("categoryId") ?? "").trim(),
      name: String(form.get("name") ?? ""),
      sortOrder: normalizeSortOrder(form.get("sortOrder")),
      file,
    });
    await writeAuditLog({ actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: "upload", targetType: "editor_asset", targetId: asset.id, message: `Uploaded editor asset ${asset.name}.`, metadata: { categoryId: asset.categoryId, sha256: asset.sha256 } });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to save asset." }, { status: 400 });
  }
}
