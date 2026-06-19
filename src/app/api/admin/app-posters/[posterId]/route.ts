import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  deleteAdminAsset,
  uploadAdminAsset,
} from "@/lib/server/content-management";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  getVisibleDynamicCategoryById,
  getWeekdayForCategoryId,
} from "@/lib/server/categories";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import {
  getCreatorPosterPublishAt,
  getIstWeekday,
  getNextIstMidnight,
  getNextIstWeekdayStart,
  parseIstDateKeyToEpoch,
} from "@/lib/server/ist-schedule";
import {
  resolveFeedPublishAtMs,
  resolveManualFeedPublishAtMs,
} from "@/lib/server/poster-feed-schedule";
import { localizeCategoryLabel } from "@/lib/dashboard-category-localization";
import {
  POLITICAL_PARTY_CATEGORY_IDS,
  politicalPartyCategoriesForRegion,
} from "@/lib/political-party-categories";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const payloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1),
  requestedPublishDate: z.string().trim().optional(),
  regionId: z.string().trim().optional(),
});

const PERMANENT_SAMPLE_NAME = "Gopi Krishna";
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
const videoPhotoAnimationSchema = z.enum([
  "none",
  "top_to_place",
  "bottom_to_place",
  "left_to_place",
  "right_to_place",
  "zoom_in",
  "zoom_out",
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
  showVideoExtraPhoto: z.boolean().default(false),
  videoExtraPhotoShape: photoShapeSchema.default("circle"),
  videoExtraPhotoRenderMode: z.enum(["cutout", "original"]).default("cutout"),
  videoExtraPhotoEdgeStyle: z.enum(["soft_fade", "sharp", "bottom_fade", "feather"]).default("soft_fade"),
  videoExtraPhotoFrameStyle: photoFrameStyleSchema.default("none"),
  videoExtraPhotoX: z.number().min(0).max(100).default(24),
  videoExtraPhotoY: z.number().min(0).max(100).default(44),
  videoExtraPhotoScale: z.number().min(10).max(100).default(28),
  photoAnimation: videoPhotoAnimationSchema.default("none"),
  videoExtraPhotoAnimation: videoPhotoAnimationSchema.default("none"),
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
  const clampOverlay = (x: number, y: number, scale: number) => {
    const safeScale = clampNumber(scale, 12, 90);
    const half = safeScale / 2;
    return {
      scale: safeScale,
      x: clampNumber(x, margin + half - bleed, 100 - margin - half + bleed),
      y: clampNumber(y, margin + half - bleed, 100 - margin - half + bleed),
    };
  };
  const mainOverlay = clampOverlay(config.photoX, config.photoY, config.photoScale);
  const extraOverlay = clampOverlay(
    config.videoExtraPhotoX,
    config.videoExtraPhotoY,
    config.videoExtraPhotoScale,
  );
  return {
    ...config,
    photoScale: mainOverlay.scale,
    photoX: mainOverlay.x,
    photoY: mainOverlay.y,
    videoExtraPhotoScale: extraOverlay.scale,
    videoExtraPhotoX: extraOverlay.x,
    videoExtraPhotoY: extraOverlay.y,
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

function resolveAdminPosterUploadSource(
  uploadSource: string | undefined,
): "app_posters" | "upload_posters" {
  return uploadSource === "upload_posters" ? "upload_posters" : "app_posters";
}

async function resolveAdminPosterSchedule(
  categoryId: string,
  now: number,
  uploadSource: "app_posters" | "upload_posters",
  requestedPublishAt: number,
  regionId: string,
) {
  const weekday = getWeekdayForCategoryId(categoryId);
  if (weekday) {
    const fallbackWeekdayStart = getNextIstWeekdayStart(now, weekday);
    const scheduledStart =
      requestedPublishAt > 0 && getIstWeekday(requestedPublishAt) === weekday
        ? Math.max(requestedPublishAt, fallbackWeekdayStart)
        : fallbackWeekdayStart;
    return {
      publishAt: scheduledStart,
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
    regionId,
  );
  if (!dynamicSchedule) {
    const item = await getManualEventCategoryById(categoryId, regionId);
    if (!item) {
      const publishAt =
        uploadSource === "upload_posters"
          ? Math.max(requestedPublishAt || getCreatorPosterPublishAt(now), getCreatorPosterPublishAt(now))
          : now;
      return {
        publishAt,
        eventStartAt: 0,
        eventEndAt: 0,
        dynamicCategoryId: "",
        dynamicCategoryLabel: "",
      };
    }
    return {
      publishAt: resolveManualFeedPublishAtMs(item.startAt, now),
      eventStartAt: item.startAt,
      eventEndAt: item.endAt,
      dynamicCategoryId: item.id,
      dynamicCategoryLabel: item.label,
    };
  }
  const eventStartAt = dynamicSchedule?.eventStartAt ?? 0;
  const eventEndAt = dynamicSchedule?.eventEndAt ?? 0;
  return {
    publishAt: resolveFeedPublishAtMs(eventStartAt, now),
    eventStartAt,
    eventEndAt,
    dynamicCategoryId: dynamicSchedule?.id ?? "",
    dynamicCategoryLabel: dynamicSchedule?.label ?? "",
  };
}

function resolveAdminPosterStorageFolder(uploadSource: string | undefined) {
  return uploadSource === "upload_posters"
    ? "portal_assets/admin_upload_posters"
    : "portal_assets/admin_app_posters";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { posterId } = await params;
    const posterRef = adminDb.collection("creatorPosters").doc(posterId);
    const posterSnap = await posterRef.get();
    if (!posterSnap.exists) {
      return NextResponse.json({ ok: false, error: "Poster not found." }, { status: 404 });
    }

    const existing = posterSnap.data() as {
      categoryId?: string;
      imagePath?: string;
      videoPath?: string;
      createdByRole?: string;
      storageFolderKey?: string;
      createdBySurface?: string;
      title?: string;
      regionId?: string;
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json({ ok: false, error: "Only admin app posters can be edited." }, { status: 403 });
    }

    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      title: formData.get("title"),
      categoryId: formData.get("categoryId"),
      requestedPublishDate: String(formData.get("requestedPublishDate") ?? "").trim() || undefined,
      regionId: String(formData.get("regionId") ?? "").trim() || undefined,
    });
    if (existing.regionId) {
      await assertActorCanAccessRegion(actor, existing.regionId);
    }
    const region = await assertActorCanAccessRegion(actor, parsed.regionId);
    let personalizationConfig: unknown = undefined;
    const personalizationRaw = formData.get("personalizationConfig");
    if (typeof personalizationRaw === "string" && personalizationRaw.trim().length > 0) {
      try {
        personalizationConfig = {
          ...clampPersonalizationSafeArea(
            personalizationSchema.parse(JSON.parse(personalizationRaw)),
          ),
          sampleName: PERMANENT_SAMPLE_NAME,
        };
      } catch {
        return NextResponse.json(
          { ok: false, error: "Unable to parse personalization config." },
          { status: 400 },
        );
      }
    }

    const manualCategory = await getManualEventCategoryById(parsed.categoryId, region.id);
    const isPoliticalCategory = POLITICAL_PARTY_CATEGORY_IDS.has(parsed.categoryId);
    const category =
      (isPoliticalCategory
        ? politicalPartyCategoriesForRegion(region.id).find((item) => item.id === parsed.categoryId)
        : CREATOR_ASSIGNABLE_CATEGORIES.find(
            (item) => item.id === parsed.categoryId && item.id !== "all",
          )) ??
      (manualCategory?.active
        ? {
            id: manualCategory.id,
            label: manualCategory.label,
          }
        : undefined);
    if (!category) {
      return NextResponse.json({ ok: false, error: "Valid category is required." }, { status: 400 });
    }
    const categoryLabel = localizeCategoryLabel(category, region);
    const updatedAt = Date.now();
    const uploadSource = resolveAdminPosterUploadSource(
      existing.storageFolderKey ?? existing.createdBySurface,
    );
    const requestedPublishAtRaw = parsed.requestedPublishDate
      ? parseIstDateKeyToEpoch(parsed.requestedPublishDate)
      : null;
    if (parsed.requestedPublishDate && requestedPublishAtRaw == null) {
      return NextResponse.json({ ok: false, error: "Choose a valid publish date." }, { status: 400 });
    }
    const weekday = getWeekdayForCategoryId(parsed.categoryId);
    let requestedPublishAt = 0;
    if (weekday && uploadSource === "upload_posters") {
      const earliestWeekdayPublishAt = getNextIstWeekdayStart(updatedAt, weekday);
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
    } else if (!manualCategory && !weekday && uploadSource === "upload_posters") {
      const earliestRegularPublishAt = getCreatorPosterPublishAt(updatedAt);
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

    let mediaType: "image" | "video" | undefined;
    let imageUrl: string | undefined;
    let imagePath: string | undefined;
    let videoUrl: string | undefined;
    let videoPath: string | undefined;
    let imageHash: string | undefined;
    const media = formData.get("media") ?? formData.get("image");
    if (media instanceof File && media.size > 0) {
      const mediaKind = getMediaKind(media);
      if (!mediaKind) {
        return NextResponse.json(
          { ok: false, error: "Only PNG, JPG, WEBP, MP4, MOV, or WEBM files are allowed." },
          { status: 400 },
        );
      }
      const maxBytes =
        mediaKind === "video" ? MAX_VIDEO_UPLOAD_BYTES : MAX_IMAGE_UPLOAD_BYTES;
      if (media.size > maxBytes) {
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
      imageHash = createHash("sha256").update(bytes).digest("hex");
      mediaType = mediaKind;
      const mimeType = media.type || "image/png";
      const ext = resolveFileExtension(media);
      const now = Date.now();
      const safeOriginal = sanitizeFileName(media.name || `poster.${ext}`);
      const storageFolder = resolveAdminPosterStorageFolder(
        existing.storageFolderKey ?? existing.createdBySurface,
      );
      const uploaded = await uploadAdminAsset(
        bytes,
        mimeType,
        `${storageFolder}/${parsed.categoryId}/${posterId}/${now}-${safeOriginal}`,
      );
      imageUrl = mediaKind === "image" ? uploaded.imageUrl : "";
      imagePath = mediaKind === "image" ? uploaded.filePath : "";
      videoUrl = mediaKind === "video" ? uploaded.imageUrl : "";
      videoPath = mediaKind === "video" ? uploaded.filePath : "";
      await deleteAdminAsset(existing.imagePath);
      await deleteAdminAsset(existing.videoPath);
    }

    const schedule = await resolveAdminPosterSchedule(
      parsed.categoryId,
      updatedAt,
      uploadSource,
      requestedPublishAt,
      region.id,
    );
    await posterRef.set(
      {
        title: parsed.title,
        categoryId: parsed.categoryId,
        categoryLabel,
        regionId: region.id,
        regionName: region.name,
        regionLanguage: region.primaryLanguage,
        requestedPublishAt,
        publishAt: schedule.publishAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
        dynamicCategoryId: schedule.dynamicCategoryId,
        dynamicCategoryLabel: schedule.dynamicCategoryId
          ? localizeCategoryLabel(
              { id: schedule.dynamicCategoryId, label: schedule.dynamicCategoryLabel },
              region,
            )
          : "",
        performanceWindowStartAt: schedule.publishAt || updatedAt,
        performanceWindowEndAt: (schedule.publishAt || updatedAt) + 24 * 60 * 60 * 1000,
        ...(personalizationConfig != null ? { personalizationConfig } : {}),
        ...(mediaType ? { mediaType } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(typeof imagePath === "string" ? { imagePath } : {}),
        ...(typeof videoUrl === "string" ? { videoUrl } : {}),
        ...(typeof videoPath === "string" ? { videoPath } : {}),
        ...(imageHash ? { imageHash } : {}),
        updatedAt,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.app-poster.update",
      targetType: "creatorPoster",
      targetId: posterId,
      message: `Updated admin app poster: ${parsed.title}`,
      metadata: { categoryId: parsed.categoryId, categoryLabel: category.label },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update app poster.";
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
    const posterRef = adminDb.collection("creatorPosters").doc(posterId);
    const posterSnap = await posterRef.get();
    if (!posterSnap.exists) {
      return NextResponse.json({ ok: false, error: "Poster not found." }, { status: 404 });
    }

    const existing = posterSnap.data() as {
      title?: string;
      imagePath?: string;
      videoPath?: string;
      createdByRole?: string;
      regionId?: string;
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json({ ok: false, error: "Only admin app posters can be deleted." }, { status: 403 });
    }
    if (existing.regionId) {
      await assertActorCanAccessRegion(actor, existing.regionId);
    }

    await posterRef.delete();
    await deleteAdminAsset(existing.imagePath);
    await deleteAdminAsset(existing.videoPath);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.app-poster.delete",
      targetType: "creatorPoster",
      targetId: posterId,
      message: `Deleted admin app poster: ${existing.title ?? posterId}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete app poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
