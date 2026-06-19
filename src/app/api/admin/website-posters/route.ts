import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { loadWebsitePosters, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const region = await assertActorCanAccessRegion(actor, url.searchParams.get("regionId"));
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? 10) || 10),
    );
    const posters = await loadWebsitePosters(region.id);
    const total = posters.length;
    const start = (page - 1) * pageSize;
    const rows = posters.slice(start, start + pageSize);
    return NextResponse.json({
      ok: true,
      posters: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load website posters.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const category = String(formData.get("category") ?? "").trim();
    const region = await assertActorCanAccessRegion(actor, String(formData.get("regionId") ?? "").trim());
    const active = String(formData.get("active") ?? "true").trim() !== "false";
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const image = formData.get("image");

    if (!category) {
      return NextResponse.json({ ok: false, error: "Poster category is required." }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Poster image is required." }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Poster image must be 500 KB or smaller." }, { status: 400 });
    }

    const now = Date.now();
    const ext = image.type.includes("jpeg") ? "jpg" : image.type.includes("webp") ? "webp" : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `landing/posters/${now}.${ext}`,
    );

    const ref = adminDb.collection("websitePosters").doc();
    await ref.set({
      id: ref.id,
      regionId: region.id,
      regionName: region.name,
      category,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
      active,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.websitePoster.create",
      targetId: ref.id,
      targetType: "websitePoster",
      message: `Created website poster category: ${category}`,
      metadata: { regionId: region.id, regionName: region.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create website poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
