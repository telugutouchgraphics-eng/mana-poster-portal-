import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  getWeekdayForCategoryId,
  getVisibleDynamicCategoryById,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import {
  getManualEventCategoryById,
  listVisibleManualEventCategories,
} from "@/lib/server/manual-event-categories";
import { uploadAdminAsset } from "@/lib/server/content-management";
import { getNextIstMidnight, getNextIstWeekdayStart } from "@/lib/server/ist-schedule";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const PERMANENT_SAMPLE_NAME = "Gopi Krishna";
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const payloadSchema = z.object({
  categoryId: z.string().trim().min(1),
  /** FormData.get returns null when missing; Zod .default only runs for undefined. */
  uploadSource: z.preprocess(
    (val) => (val === null || val === "" ? undefined : val),
    z.enum(["app_posters", "upload_posters"]).default("app_posters"),
  ),
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

function mapPoster(id: string, data: Record<string, unknown>) {
  return {
    id,
    creatorPublicId: String(data.creatorPublicId ?? ""),
    title: String(data.title ?? "Admin Poster"),
    categoryId: String(data.categoryId ?? ""),
    categoryLabel: String(data.categoryLabel ?? ""),
    mediaType: String(data.mediaType ?? "image"),
    imageUrl: String(data.imageUrl ?? ""),
    imagePath: String(data.imagePath ?? ""),
    videoUrl: String(data.videoUrl ?? ""),
    videoPath: String(data.videoPath ?? ""),
    status: String(data.status ?? ""),
    createdBySurface: String(data.createdBySurface ?? ""),
    storageFolderKey: String(data.storageFolderKey ?? ""),
    createdAt: Number(data.createdAt ?? 0),
    approvedAt: Number(data.approvedAt ?? 0),
  };
}

async function buildAdminAppPosterCategories() {
  const visibleCategories = getVisibleAssignableCategories(new Date(), 2, 7, 2).filter(
    (item) => item.id !== "all",
  );
  const manualCategories = await listVisibleManualEventCategories();
  const mergedVisible = [...visibleCategories, ...manualCategories];
  const visibleIds = new Set(mergedVisible.map((item) => item.id));
  const weekdayCategories = CREATOR_ASSIGNABLE_CATEGORIES.filter(
    (item) => item.id.startsWith("weekday_") && item.id !== "weekday_special",
  ).map((item) => ({
    id: item.id,
    label: item.label,
    isDynamic: true,
  }));

  return [
    ...mergedVisible,
    ...weekdayCategories.filter((item) => !visibleIds.has(item.id)),
  ];
}

async function resolveAdminPosterSchedule(
  categoryId: string,
  now: number,
  uploadSource: "app_posters" | "upload_posters" = "app_posters",
) {
  const weekday = getWeekdayForCategoryId(categoryId);
  if (weekday) {
    const scheduledStart = getNextIstWeekdayStart(now, weekday);
    const publishAt = uploadSource === "app_posters" ? 0 : scheduledStart;
    return {
      publishAt,
      eventStartAt: scheduledStart,
      eventEndAt: getNextIstMidnight(scheduledStart) - 1,
      dynamicCategoryId: categoryId,
      dynamicCategoryLabel:
        CREATOR_ASSIGNABLE_CATEGORIES.find((item) => item.id === categoryId)?.label ?? "",
    };
  }

  const dynamicSchedule = getVisibleDynamicCategoryById(
    categoryId,
    new Date(now),
    2,
    7,
    2,
  );
  if (!dynamicSchedule) {
    const item = await getManualEventCategoryById(categoryId);
    if (!item) {
      return {
        publishAt: 0,
        eventStartAt: 0,
        eventEndAt: 0,
        dynamicCategoryId: "",
        dynamicCategoryLabel: "",
      };
    }
    // Manual Firestore categories: do not delay app feed by publishAt — the
    // calendar JSON repo does not drive these chips; gating hid admin uploads.
    return {
      publishAt: 0,
      eventStartAt: item.startAt,
      eventEndAt: item.endAt,
      dynamicCategoryId: item.id,
      dynamicCategoryLabel: item.label,
    };
  }
  const eventStartAt = dynamicSchedule?.eventStartAt ?? 0;
  const eventEndAt = dynamicSchedule?.eventEndAt ?? 0;
  const dynamicPublishAt =
    eventStartAt > 0 ? Math.max(eventStartAt - THREE_DAYS_MS, now) : 0;
  return {
    publishAt: uploadSource === "app_posters" ? 0 : dynamicPublishAt,
    eventStartAt,
    eventEndAt,
    dynamicCategoryId: dynamicSchedule?.id ?? "",
    dynamicCategoryLabel: dynamicSchedule?.label ?? "",
  };
}

function resolveAdminPosterStorageFolder(uploadSource: "app_posters" | "upload_posters") {
  return uploadSource === "upload_posters"
    ? "portal_assets/admin_upload_posters"
    : "portal_assets/admin_app_posters";
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const sourceParam = req.nextUrl.searchParams.get("source");
    const sourceFilter =
      sourceParam === "upload_posters" || sourceParam === "app_posters"
        ? sourceParam
        : "app_posters";
    const snap = await adminDb
      .collection("creatorPosters")
      .where("createdByRole", "==", "admin")
      .limit(120)
      .get();
    const posters = snap.docs
      .map((doc) => mapPoster(doc.id, doc.data()))
      .filter((poster) => {
        const surface = poster.storageFolderKey || poster.createdBySurface;
        if (sourceFilter === "upload_posters") {
          return surface === "upload_posters";
        }
        return !surface || surface === "app_posters";
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 80);
    return NextResponse.json({
      ok: true,
      categories: await buildAdminAppPosterCategories(),
      posters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load app posters.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      categoryId: formData.get("categoryId"),
      uploadSource: formData.get("uploadSource"),
    });

    const manualCategory = await getManualEventCategoryById(parsed.categoryId);
    const category =
      CREATOR_ASSIGNABLE_CATEGORIES.find(
        (item) => item.id === parsed.categoryId && item.id !== "all",
      ) ??
      (manualCategory?.active
        ? {
            id: manualCategory.id,
            label: manualCategory.label,
          }
        : undefined);
    if (!category) {
      return NextResponse.json({ ok: false, error: "Valid category is required." }, { status: 400 });
    }

    let personalizationConfig = personalizationSchema.parse({});
    const personalizationRaw = formData.get("personalizationConfig");
    if (typeof personalizationRaw === "string" && personalizationRaw.trim().length > 0) {
      personalizationConfig = personalizationSchema.parse(JSON.parse(personalizationRaw));
    }
    personalizationConfig = {
      ...clampPersonalizationSafeArea(personalizationConfig),
      sampleName: PERMANENT_SAMPLE_NAME,
    };

    const media = formData.get("media") ?? formData.get("image");
    if (!(media instanceof File)) {
      return NextResponse.json({ ok: false, error: "Poster image is required." }, { status: 400 });
    }
    const mediaKind = getMediaKind(media);
    if (!mediaKind) {
      return NextResponse.json(
        { ok: false, error: "Only PNG, JPG, WEBP, MP4, MOV, or WEBM files are allowed." },
        { status: 400 },
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
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await media.arrayBuffer());
    const imageHash = createHash("sha256").update(bytes).digest("hex");
    const duplicateSnap = await adminDb
      .collection("creatorPosters")
      .where("categoryId", "==", parsed.categoryId)
      .where("imageHash", "==", imageHash)
      .limit(1)
      .get();
    if (!duplicateSnap.empty) {
      return NextResponse.json(
        { ok: false, error: "Same poster already exists in this category." },
        { status: 409 },
      );
    }

    const mimeType = media.type || "image/png";
    const ext = resolveFileExtension(media);
    const now = Date.now();
    const schedule = await resolveAdminPosterSchedule(parsed.categoryId, now, parsed.uploadSource);
    const posterRef = adminDb.collection("creatorPosters").doc();
    const safeOriginal = sanitizeFileName(media.name || `poster.${ext}`);
    const storageFolder = resolveAdminPosterStorageFolder(parsed.uploadSource);
    const uploaded = await uploadAdminAsset(
      bytes,
      mimeType,
      `${storageFolder}/${parsed.categoryId}/${posterRef.id}/${now}-${safeOriginal}`,
    );

    const title = `Admin ${category.label}`;
    await posterRef.set({
      id: posterRef.id,
      creatorPublicId: "ADMIN",
      creatorUid: actor.uid,
      managerUid: actor.uid,
      managerEmail: actor.email ?? "",
      managerName: actor.email ?? "Admin",
      title,
      categoryId: parsed.categoryId,
      categoryLabel: category.label,
      mediaType: mediaKind,
      imageHash,
      imagePath: mediaKind === "image" ? uploaded.filePath : "",
      imageUrl: mediaKind === "image" ? uploaded.imageUrl : "",
      videoPath: mediaKind === "video" ? uploaded.filePath : "",
      videoUrl: mediaKind === "video" ? uploaded.imageUrl : "",
      status: "approved",
      reviewComment: "",
      duplicateStatus: "unique",
      reviewHistory: [
        {
          type: "submitted",
          actorRole: "admin",
          actorId: actor.uid,
          actorName: actor.email ?? actor.uid,
          comment: "Poster uploaded from admin dashboard.",
          createdAt: now,
        },
        {
          type: "approved",
          actorRole: "admin",
          actorId: actor.uid,
          actorName: actor.email ?? actor.uid,
          comment: "Auto-approved by admin.",
          createdAt: now,
        },
      ],
      personalizationConfig,
      creatorIdLabel: "ADMIN",
      grossAmount: 0,
      creatorEarnings: 0,
      platformEarnings: 0,
      payoutStatus: "not_applicable",
      uploadDayKey: "",
      publishAt: schedule.publishAt,
      eventStartAt: schedule.eventStartAt,
      eventEndAt: schedule.eventEndAt,
      dynamicCategoryId: schedule.dynamicCategoryId,
      dynamicCategoryLabel: schedule.dynamicCategoryLabel,
      approvedAt: now,
      performanceWindowStartAt: schedule.publishAt || now,
      performanceWindowEndAt: (schedule.publishAt || now) + 24 * 60 * 60 * 1000,
      createdByUid: actor.uid,
      createdByEmail: actor.email ?? "",
      createdByRole: "admin",
      createdBySurface: parsed.uploadSource,
      storageFolderKey: parsed.uploadSource,
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.app-poster.create",
      targetType: "creatorPoster",
      targetId: posterRef.id,
      message: `Uploaded app poster: ${category.label}`,
      metadata: {
        categoryId: parsed.categoryId,
        categoryLabel: category.label,
        uploadSource: parsed.uploadSource,
        publishAt: schedule.publishAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
      },
    });

    return NextResponse.json({
      ok: true,
      poster: {
        id: posterRef.id,
        title,
        categoryId: parsed.categoryId,
        categoryLabel: category.label,
        mediaType: mediaKind,
        imageUrl: mediaKind === "image" ? uploaded.imageUrl : "",
        videoUrl: mediaKind === "video" ? uploaded.imageUrl : "",
        status: "approved",
        createdAt: now,
        approvedAt: now,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poster upload failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
