import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 500 * 1024;

async function loadScopedWebsitePoster(posterId: string, actor: Awaited<ReturnType<typeof requireRole>>) {
  const ref = adminDb.collection("websitePosters").doc(posterId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Website poster not found.");
  }
  const data = snap.data() ?? {};
  const regionId = String(data.regionId ?? "").trim();
  if (!regionId) {
    throw new Error("Legacy website poster is not state-scoped. Create a new state poster.");
  }
  const region = await assertActorCanAccessRegion(actor, regionId);
  return { ref, snap, region };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { posterId } = await params;
    const { ref, region } = await loadScopedWebsitePoster(posterId, actor);
    const contentType = req.headers.get("content-type") ?? "";
    let active = true;
    let sortOrder = 100;
    let category = "";
    let nextImageUrl = "";
    let nextImagePath = "";
    let previousImagePath = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      category = String(formData.get("category") ?? "").trim();
      active = String(formData.get("active") ?? "true").trim() !== "false";
      sortOrder = Number(formData.get("sortOrder") ?? 100);
      previousImagePath = String(formData.get("imagePath") ?? "").trim();
      const image = formData.get("image");

      if (image instanceof File) {
        if (!ALLOWED_TYPES.has(image.type)) {
          return NextResponse.json(
            { ok: false, error: "Only PNG, JPG and WEBP images are allowed." },
            { status: 400 },
          );
        }
        if (image.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { ok: false, error: "Poster image must be 500 KB or smaller." },
            { status: 400 },
          );
        }

        const now = Date.now();
        const ext =
          image.type === "image/jpeg"
            ? "jpg"
            : image.type === "image/webp"
              ? "webp"
              : "png";
        const uploaded = await uploadAdminAsset(
          Buffer.from(await image.arrayBuffer()),
          image.type,
          `landing/posters/${posterId}-${now}.${ext}`,
        );
        nextImageUrl = uploaded.imageUrl;
        nextImagePath = uploaded.filePath;
      }
    } else {
      const body = (await req.json()) as {
        active?: boolean;
        sortOrder?: number;
        category?: string;
      };
      active = typeof body.active === "boolean" ? body.active : true;
      sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100;
      category = typeof body.category === "string" ? body.category.trim() : "";
    }

    await ref.set(
      {
        regionId: region.id,
        regionName: region.name,
        active,
        sortOrder,
        category,
        ...(nextImageUrl ? { imageUrl: nextImageUrl } : {}),
        ...(nextImagePath ? { imagePath: nextImagePath } : {}),
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    if (previousImagePath && nextImagePath && previousImagePath !== nextImagePath) {
      await deleteAdminAsset(previousImagePath);
    }

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.websitePoster.update",
      targetId: posterId,
      targetType: "websitePoster",
      message: "Updated website poster details",
      metadata: { regionId: region.id, regionName: region.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update website poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { posterId } = await params;
    const { ref, snap, region } = await loadScopedWebsitePoster(posterId, actor);
    const imagePath =
      snap.exists && typeof snap.data()?.imagePath === "string"
        ? String(snap.data()?.imagePath)
        : "";
    await deleteAdminAsset(imagePath);
    await ref.delete();
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.websitePoster.delete",
      targetId: posterId,
      targetType: "websitePoster",
      message: "Deleted website poster",
      metadata: { regionId: region.id, regionName: region.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete website poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
