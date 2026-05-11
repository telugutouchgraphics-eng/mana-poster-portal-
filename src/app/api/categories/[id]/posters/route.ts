import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadWebsitePosters, uploadAdminAsset } from "@/lib/server/content-management";
import { loadLandingPageRecord } from "@/lib/server/landing-page-management";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const posters = (await loadWebsitePosters()).filter(
      (poster) => poster.categoryId === id || poster.category === id,
    );
    return NextResponse.json({ ok: true, posters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load posters.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  ) {
  try {
    await requireRole(req, ["admin"]);
    const { id } = await params;
    const landingPage = await loadLandingPageRecord();
    const formData = await req.formData();
    const image = formData.get("image");
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const active = String(formData.get("active") ?? "true") !== "false";
    const categoryItem = landingPage.categories.items.find((item) => item.id === id);
    const categoryLabel = categoryItem?.title.trim() || id;

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Poster image is required." }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Poster image must be 500 KB or smaller." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `landing/posters/${id}-${now}.${ext}`,
    );
    const ref = adminDb.collection("websitePosters").doc();
    await ref.set({
      id: ref.id,
      category: categoryLabel,
      categoryId: id,
      categoryLabel,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
      active,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ ok: true, posterId: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
