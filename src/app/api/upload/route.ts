import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { uploadAdminAsset } from "@/lib/server/content-management";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 500 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const image = formData.get("image");
    const folder = String(formData.get("folder") ?? "landing/uploads").replace(/[^a-z0-9/_-]/gi, "");

    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Image is required." }, { status: 400 });
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

    const ext = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type,
      `${folder}/${Date.now()}.${ext}`,
    );

    return NextResponse.json({
      ok: true,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload image.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
