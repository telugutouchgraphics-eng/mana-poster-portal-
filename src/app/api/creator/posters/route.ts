import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { z } from "zod";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES, getWeekdayForCategoryId } from "@/lib/server/categories";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import {
  buildCreatorUploadWindow,
  getCreatorPosterPublishAt,
  getIstWeekday,
  parseIstDateKeyToEpoch,
} from "@/lib/server/ist-schedule";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const PERMANENT_SAMPLE_NAME = "Gopi Krishna";

const payloadSchema = z.object({
  categoryId: z.string().trim().min(1),
  requestedPublishDate: z.string().trim().optional(),
});

const photoShapeSchema = z.enum([
  "circle",
  "scallop_circle",
  "soft_burst",
  "badge",
  "square",
  "rounded_square",
  "vertical_rectangle",
  "oval",
  "flower",
  "blob",
  "wave_bottom",
  "arch",
  "diagonal_cut",
  "diamond",
  "hexagon",
  "parallelogram",
  "sunburst",
  "transparent_bottom_fade",
  "transparent_clean",
  "transparent_soft_round",
  "transparent_sharp_round",
]);

const photoFrameStyleSchema = z.enum([
  "none",
  "inner_shadow",
  "white_outline",
  "glow_edge",
  "double_border",
]);

const personalizationSchema = z.object({
  photoShape: photoShapeSchema.default("circle"),
  photoRenderMode: z.enum(["cutout", "original"]).default("cutout"),
  edgeStyle: z.enum(["soft_fade", "sharp", "bottom_fade", "feather"]).default("soft_fade"),
  photoFrameStyle: photoFrameStyleSchema.default("none"),
  showSafeAreas: z.boolean().default(true),
  photoX: z.number().min(0).max(100).default(78),
  photoY: z.number().min(0).max(100).default(42),
  photoScale: z.number().min(10).max(100).default(44),
  nameX: z.number().min(0).max(100).default(50),
  nameY: z.number().min(0).max(100).default(82),
  showBottomStrip: z.boolean().default(true),
  stripHeight: z.number().min(8).max(40).default(16),
  sampleName: z.string().trim().min(1).max(80).default(PERMANENT_SAMPLE_NAME),
});

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampPersonalizationSafeArea(
  config: z.infer<typeof personalizationSchema>,
): z.infer<typeof personalizationSchema> {
  const margin = 0;
  const bleed = 6;
  const photoScale = clampNumber(config.photoScale, 12, 90);
  const half = photoScale / 2;
  return {
    ...config,
    photoScale,
    photoX: clampNumber(config.photoX, margin + half - bleed, 100 - margin - half + bleed),
    photoY: clampNumber(config.photoY, margin + half - bleed, 100 - margin - half + bleed),
  };
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getMediaKind(file: File): "image" | "video" | null {
  const mimeType = (file.type || "").toLowerCase();
  if (["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) {
    return "image";
  }
  if (["video/mp4", "video/quicktime", "video/webm"].includes(mimeType)) {
    return "video";
  }
  return null;
}

function resolveFileExtension(file: File): string {
  const mimeType = (file.type || "").toLowerCase();
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return "png";
}

function buildStorageDownloadUrl(bucketName: string, filePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucketName,
  )}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
}

export async function POST(req: NextRequest) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const creatorProfileSnap = await adminDb
      .collection("creatorProfiles")
      .doc(creator.creatorPublicId)
      .get();
    const creatorProfileData = creatorProfileSnap.data() as
      | Record<string, unknown>
      | undefined;
    const managerUid = String(
      creatorProfileData?.managerUid ?? creatorProfileData?.assignedByUid ?? "",
    ).trim();
    let managerEmail = String(creatorProfileData?.managerEmail ?? "").trim().toLowerCase();
    let managerName = String(creatorProfileData?.managerName ?? "").trim();
    if (managerUid && (!managerEmail || !managerName)) {
      const managerUserSnap = await adminDb.collection("users").doc(managerUid).get();
      const managerUserData = managerUserSnap.data() as Record<string, unknown> | undefined;
      managerEmail = managerEmail || String(managerUserData?.email ?? "").trim().toLowerCase();
      managerName = managerName || String(managerUserData?.name ?? "").trim();
    }
    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      categoryId: formData.get("categoryId"),
      requestedPublishDate: String(formData.get("requestedPublishDate") ?? "").trim() || undefined,
    });
    let personalizationConfig = personalizationSchema.parse({});
    const personalizationRaw = formData.get("personalizationConfig");
    if (typeof personalizationRaw === "string" && personalizationRaw.trim().length > 0) {
      const parsedJson = JSON.parse(personalizationRaw) as unknown;
      personalizationConfig = personalizationSchema.parse(parsedJson);
    }
    personalizationConfig = {
      ...clampPersonalizationSafeArea(personalizationConfig),
      sampleName: PERMANENT_SAMPLE_NAME,
    };

    if (!creator.assignedCategories.includes(parsed.categoryId)) {
      return NextResponse.json(
        { ok: false, error: "This category is not assigned to you." },
        { status: 403 }
      );
    }

    const manualCategory = await getManualEventCategoryById(parsed.categoryId);
    const category =
      CREATOR_ASSIGNABLE_CATEGORIES.find((item) => item.id === parsed.categoryId) ??
      (manualCategory?.active
        ? {
            id: manualCategory.id,
            label: manualCategory.label,
          }
        : undefined);
    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Invalid category." },
        { status: 400 }
      );
    }

    const media = formData.get("media") ?? formData.get("image");
    if (!(media instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Poster image is required." },
        { status: 400 }
      );
    }
    const mediaKind = getMediaKind(media);
    if (!mediaKind) {
      return NextResponse.json(
        { ok: false, error: "Only PNG, JPG, WEBP, MP4, MOV, or WEBM files are allowed." },
        { status: 400 }
      );
    }
    const maxBytes =
      mediaKind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
    if (media.size <= 0 || media.size > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          error:
            mediaKind === "video"
              ? "Video must be 5 MB or smaller."
              : "Poster image must be 500 KB or smaller.",
        },
        { status: 400 }
      );
    }

    const mimeType = media.type || "image/png";
    const ext = resolveFileExtension(media);
    const safeOriginal = sanitizeFileName(media.name || `poster.${ext}`);
    const title = creator.creatorPublicId;
    const now = Date.now();
    const uploadWindow = buildCreatorUploadWindow(now);
    if (!uploadWindow.isOpen) {
      return NextResponse.json(
        {
          ok: false,
          error: "Uploads are open until 10:00 PM. Uploads reopen after 12:00 AM.",
        },
        { status: 403 },
      );
    }
    const requestedPublishAtRaw = parsed.requestedPublishDate
      ? parseIstDateKeyToEpoch(parsed.requestedPublishDate)
      : null;
    if (parsed.requestedPublishDate && requestedPublishAtRaw == null) {
      return NextResponse.json(
        { ok: false, error: "Choose a valid publish date." },
        { status: 400 },
      );
    }
    const weekday = getWeekdayForCategoryId(parsed.categoryId);
    let requestedPublishAt = 0;
    if (weekday) {
      const earliestWeekdayPublishAt = getCreatorPosterPublishAt(now);
      if (requestedPublishAtRaw != null) {
        if (getIstWeekday(requestedPublishAtRaw) !== weekday) {
          return NextResponse.json(
            { ok: false, error: "Selected publish date must match the category weekday." },
            { status: 400 },
          );
        }
        if (requestedPublishAtRaw < earliestWeekdayPublishAt) {
          return NextResponse.json(
            { ok: false, error: "Publish date cannot be earlier than the default app publish date." },
            { status: 400 },
          );
        }
        requestedPublishAt = requestedPublishAtRaw;
      }
    } else if (!manualCategory) {
      const earliestRegularPublishAt = getCreatorPosterPublishAt(now);
      if (requestedPublishAtRaw != null) {
        if (requestedPublishAtRaw < earliestRegularPublishAt) {
          return NextResponse.json(
            { ok: false, error: "Publish date cannot be earlier than the default app publish date." },
            { status: 400 },
          );
        }
        requestedPublishAt = requestedPublishAtRaw;
      } else {
        requestedPublishAt = earliestRegularPublishAt;
      }
    }
    const bucket = adminStorage.bucket();
    const folderName = "creator_posters";
    const filePath = `${folderName}/${creator.creatorPublicId}/${now}-${safeOriginal}`;
    const file = bucket.file(filePath);
    const downloadToken = randomUUID();
    const bytes = Buffer.from(await media.arrayBuffer());
    const imageHash = createHash("sha256").update(bytes).digest("hex");

    const duplicateSnap = await adminDb
      .collection("creatorPosters")
      .where("creatorPublicId", "==", creator.creatorPublicId)
      .where("categoryId", "==", parsed.categoryId)
      .where("imageHash", "==", imageHash)
      .limit(1)
      .get();

    if (!duplicateSnap.empty) {
      return NextResponse.json(
        {
          ok: false,
          error: "Same poster already uploaded in this category. Change design and upload again.",
        },
        { status: 409 },
      );
    }

    await file.save(bytes, {
      resumable: false,
      contentType: mimeType,
      metadata: {
        cacheControl: "public,max-age=31536000",
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          createdAt: String(now),
        },
      },
    });
    const assetUrl = buildStorageDownloadUrl(bucket.name, filePath, downloadToken);

    const posterRef = adminDb.collection("creatorPosters").doc();
    await posterRef.set({
      id: posterRef.id,
      creatorPublicId: creator.creatorPublicId,
      creatorUid: creator.uid,
      managerUid,
      managerEmail,
      managerName,
      title,
      categoryId: parsed.categoryId,
      categoryLabel: category.label,
      mediaType: mediaKind,
      imageHash,
      imagePath: mediaKind === "image" ? filePath : "",
      imageUrl: mediaKind === "image" ? assetUrl : "",
      videoPath: mediaKind === "video" ? filePath : "",
      videoUrl: mediaKind === "video" ? assetUrl : "",
      status: "pending",
      reviewComment: "",
      duplicateStatus: "unique",
      reviewHistory: [
        {
          type: "submitted",
          actorRole: "creator",
          actorId: creator.creatorPublicId,
          actorName: creator.name,
          comment: "Poster submitted for review.",
          createdAt: now,
        },
      ],
      personalizationConfig,
      creatorIdLabel: creator.creatorPublicId,
      grossAmount: 0,
      creatorEarnings: 0,
      platformEarnings: 0,
      payoutStatus: "pending",
      uploadDayKey: uploadWindow.dayKey,
      requestedPublishAt,
      publishAt: 0,
      performanceWindowStartAt: 0,
      performanceWindowEndAt: 0,
      dashboardVisibleUntil: now + 24 * 60 * 60 * 1000,
      dashboardHiddenAt: 0,
      dashboardHiddenReason: "",
      createdByRole: "creator",
      createdBySurface: "creator_upload",
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
        mediaType: mediaKind,
        imageUrl: mediaKind === "image" ? assetUrl : "",
        videoUrl: mediaKind === "video" ? assetUrl : "",
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
