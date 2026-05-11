import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { validateLandingAssetInput } from "@/lib/server/landing-page-management";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 500 * 1024;
const SECTION_STORAGE_MAP: Record<string, string> = {
  navbar_branding: "landing/branding/navbar",
  footer_branding: "landing/branding/footer",
  hero_preview_images: "landing/hero",
  hero_promo_banners: "landing/banners",
  app_preview_screenshots: "landing/screenshots",
  categories: "landing/categories",
  testimonials: "landing/testimonials",
  final_cta_preview_images: "landing/final-cta",
};

function sanitizePathSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-");
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const { section, itemId } = validateLandingAssetInput(formData);
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Image file is required." },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json(
        { ok: false, error: "Only PNG, JPG and WEBP images are allowed." },
        { status: 400 },
      );
    }
    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Image must be 500 KB or smaller." },
        { status: 400 },
      );
    }

    const safeSection = sanitizePathSegment(section);
    const safeItemId = sanitizePathSegment(itemId);
    const folder = SECTION_STORAGE_MAP[safeSection];
    if (!folder) {
      return NextResponse.json(
        { ok: false, error: "Unsupported landing asset section." },
        { status: 400 },
      );
    }
    const ext =
      image.type === "image/jpeg"
        ? "jpg"
        : image.type === "image/webp"
          ? "webp"
          : "png";
    const now = Date.now();
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type,
      `${folder}/${safeItemId}-${now}.${ext}`,
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.landingPage.asset.upload",
      targetId: safeItemId,
      targetType: `landingPage.${safeSection}`,
      message: `Uploaded landing page asset for ${safeSection}/${safeItemId}`,
    });

    return NextResponse.json({
      ok: true,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload landing asset.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as { imagePath?: string; section?: string; itemId?: string };
    const imagePath = typeof body.imagePath === "string" ? body.imagePath.trim() : "";
    if (!imagePath) {
      return NextResponse.json(
        { ok: false, error: "Storage image path is required." },
        { status: 400 },
      );
    }

    await deleteAdminAsset(imagePath);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.landingPage.asset.delete",
      targetId: body.itemId || imagePath,
      targetType: body.section ? `landingPage.${body.section}` : "landingPage.asset",
      message: `Deleted landing page asset ${imagePath}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete landing asset.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
