import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { loadAppBanners, uploadAdminAsset } from "@/lib/server/content-management";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const banners = await loadAppBanners();
    return NextResponse.json({ ok: true, banners });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load banners.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
    const ctaTarget = String(formData.get("ctaTarget") ?? "").trim();
    const placement = String(formData.get("placement") ?? "home_category_banner").trim();
    const targetState = String(formData.get("targetState") ?? "").trim();
    const targetDistrict = String(formData.get("targetDistrict") ?? "").trim();
    const targetCity = String(formData.get("targetCity") ?? "").trim();
    const active = String(formData.get("active") ?? "true").trim() !== "false";
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const image = formData.get("image");

    if (!title) {
      return NextResponse.json({ ok: false, error: "Banner title is required." }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Banner image is required." }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be 500 KB or smaller." }, { status: 400 });
    }

    const now = Date.now();
    const ext = image.type.includes("jpeg") ? "jpg" : image.type.includes("webp") ? "webp" : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `portal_assets/app_banners/${now}.${ext}`,
    );

    const ref = adminDb.collection("appBanners").doc();
    await ref.set({
      id: ref.id,
      title,
      subtitle,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
      ctaLabel,
      ctaTarget,
      placement,
      targetState,
      targetDistrict,
      targetCity,
      active,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.create",
      targetId: ref.id,
      targetType: "appBanner",
      message: `Created app banner: ${title}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
