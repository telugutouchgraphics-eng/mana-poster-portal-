import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

function sanitizeDownloadFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "user-upload";
}

function extensionFromContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  if (normalized.includes("gif")) return ".gif";
  return ".jpg";
}

function quotedFileName(fileName: string): string {
  return fileName.replace(/["\\]/g, "");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { uploadId } = await params;
    const uploadSnap = await adminDb
      .collection("userPosterUploads")
      .doc(uploadId)
      .get();

    if (!uploadSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Upload not found." },
        { status: 404 },
      );
    }

    const data = uploadSnap.data() as Record<string, unknown>;
    const regionId = String(data.regionId ?? "").trim();
    await assertActorCanAccessRegion(actor, regionId);

    const imagePath = String(data.imagePath ?? "").trim();
    if (!imagePath) {
      return NextResponse.json(
        { ok: false, error: "No user image is available for this upload." },
        { status: 404 },
      );
    }

    const file = adminStorage.bucket().file(imagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "Upload image file not found." },
        { status: 404 },
      );
    }

    const [buffer, metadata] = await Promise.all([
      file.download().then((parts) => parts[0]),
      file.getMetadata().then((parts) => parts[0]),
    ]);
    const contentType =
      String(metadata.contentType ?? "").trim() || "image/jpeg";
    const extension = extensionFromContentType(contentType);
    const fileName = `${sanitizeDownloadFileName(
      `mana-poster-user-upload-${uploadId}`,
    )}${extension}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": contentType,
        "content-length": String(buffer.length),
        "content-disposition": `attachment; filename="${quotedFileName(
          fileName,
        )}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to download upload.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
