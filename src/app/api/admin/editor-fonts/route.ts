import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  listEditorFonts,
  normalizeFontLanguage,
  normalizeFontSortOrder,
  uploadEditorFont,
} from "@/lib/server/editor-fonts";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    return NextResponse.json({ ok: true, fonts: await listEditorFonts(true) });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load fonts.",
      },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Choose a TTF or OTF font file.");
    const font = await uploadEditorFont({
      family: String(form.get("family") ?? ""),
      displayName: String(form.get("displayName") ?? ""),
      language: normalizeFontLanguage(form.get("language")),
      sortOrder: normalizeFontSortOrder(form.get("sortOrder")),
      file,
    });
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "upload",
      targetType: "editor_font",
      targetId: font.id,
      message: `Uploaded editor font ${font.displayName}.`,
      metadata: { family: font.family, language: font.language, sha256: font.sha256 },
    });
    return NextResponse.json({ ok: true, font });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to save font.",
      },
      { status: 400 },
    );
  }
}
