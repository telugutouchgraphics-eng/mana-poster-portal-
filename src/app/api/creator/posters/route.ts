import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES } from "@/lib/server/categories";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const payloadSchema = z.object({
  categoryId: z.string().trim().min(1),
});

const personalizationSchema = z.object({
  photoShape: z.enum(["circle", "rounded", "square", "hexagon", "pill"]).default("circle"),
  photoX: z.number().min(0).max(100).default(50),
  photoY: z.number().min(0).max(100).default(45),
  photoScale: z.number().min(10).max(100).default(36),
  nameX: z.number().min(0).max(100).default(50),
  nameY: z.number().min(0).max(100).default(82),
  showBottomStrip: z.boolean().default(true),
  stripHeight: z.number().min(8).max(40).default(16),
  showWhatsapp: z.boolean().default(true),
  sampleName: z.string().trim().min(1).max(80).default("Bommidi Naga Gopi"),
});

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function derivePosterTitle(fileName: string, categoryLabel: string): string {
  const cleaned = fileName.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 80);
  }
  return `${categoryLabel} Poster`;
}

export async function POST(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      categoryId: formData.get("categoryId"),
    });
    let personalizationConfig = personalizationSchema.parse({});
    const personalizationRaw = formData.get("personalizationConfig");
    if (typeof personalizationRaw === "string" && personalizationRaw.trim().length > 0) {
      const parsedJson = JSON.parse(personalizationRaw) as unknown;
      personalizationConfig = personalizationSchema.parse(parsedJson);
    }

    if (!creator.assignedCategories.includes(parsed.categoryId)) {
      return NextResponse.json(
        { ok: false, error: "This category is not assigned to you." },
        { status: 403 }
      );
    }

    const category = CREATOR_ASSIGNABLE_CATEGORIES.find(
      (item) => item.id === parsed.categoryId
    );
    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Invalid category." },
        { status: 400 }
      );
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Poster image is required." },
        { status: 400 }
      );
    }
    if (image.size <= 0 || image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be smaller than 15 MB." },
        { status: 400 }
      );
    }

    const mimeType = image.type || "image/png";
    const ext = mimeType.includes("jpeg")
      ? "jpg"
      : mimeType.includes("webp")
      ? "webp"
      : "png";
    const safeOriginal = sanitizeFileName(image.name || `poster.${ext}`);
    const title = derivePosterTitle(safeOriginal, category.label);
    const now = Date.now();
    const bucket = adminStorage.bucket();
    const filePath = `creator_posters/${creator.creatorPublicId}/${now}-${safeOriginal}`;
    const file = bucket.file(filePath);
    const bytes = Buffer.from(await image.arrayBuffer());
    await file.save(bytes, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        cacheControl: "public,max-age=31536000",
      },
    });

    const [imageUrl] = await file.getSignedUrl({
      action: "read",
      expires: "2491-01-01",
    });

    const posterRef = adminDb.collection("creatorPosters").doc();
    await posterRef.set({
      id: posterRef.id,
      creatorPublicId: creator.creatorPublicId,
      creatorUid: creator.uid,
      title,
      categoryId: parsed.categoryId,
      categoryLabel: category.label,
      imagePath: filePath,
      imageUrl,
      status: "pending",
      reviewComment: "",
      personalizationConfig,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      poster: {
        id: posterRef.id,
        title,
        categoryId: parsed.categoryId,
        categoryLabel: category.label,
        imageUrl,
        status: "pending",
        personalizationConfig,
        createdAt: now,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poster upload failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
