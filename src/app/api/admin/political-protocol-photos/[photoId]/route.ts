import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { deleteAdminAsset } from "@/lib/server/content-management";

const COLLECTION = "politicalProtocolPhotos";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<unknown> },
) {
  try {
    await requireRole(req, ["admin"]);
    const params = (await context.params) as { photoId?: string };
    const { photoId } = params;
    const id = String(photoId ?? "").trim();
    if (!id) {
      throw new Error("Protocol photo id is required.");
    }
    const ref = adminDb.collection(COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true });
    }
    const data = snap.data() as Record<string, unknown>;
    await deleteAdminAsset(String(data.imagePath ?? ""));
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete protocol photo.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
