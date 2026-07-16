import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  deleteEditorFont,
  EDITOR_FONTS,
  normalizeEditorFontName,
  normalizeFontLanguage,
  normalizeFontSortOrder,
} from "@/lib/server/editor-fonts";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fontId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { fontId } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (typeof body.family === "string") {
      update.family = normalizeEditorFontName(body.family, "Font");
    }
    if (typeof body.displayName === "string") {
      update.displayName = normalizeEditorFontName(body.displayName, "Font");
    }
    if (typeof body.language === "string") {
      update.language = normalizeFontLanguage(body.language);
    }
    if (typeof body.active === "boolean") update.active = body.active;
    if (body.sortOrder !== undefined) {
      update.sortOrder = normalizeFontSortOrder(body.sortOrder);
    }
    await adminDb.collection(EDITOR_FONTS).doc(fontId).update(update);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "update",
      targetType: "editor_font",
      targetId: fontId,
      message: "Updated editor font.",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to update font.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fontId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { fontId } = await params;
    await deleteEditorFont(fontId);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "delete",
      targetType: "editor_font",
      targetId: fontId,
      message: "Deleted editor font.",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to delete font.",
      },
      { status: 400 },
    );
  }
}
