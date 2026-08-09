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
  canonicalCategoryId,
  categoryAllowsPoliticalProtocol,
  getVisibleDynamicCategoryById,
  getWeekdayForCategoryId,
} from "@/lib/server/categories";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import { getPermanentCategoryById } from "@/lib/server/permanent-categories";
import {
  getCreatorPosterPublishAt,
  getIstWeekday,
  getNextIstHourStart,
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
import { politicalPartyCategoriesForRegionManaged } from "@/lib/server/political-parties";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const TELUGU_SHARED_CONTENT_REGION_IDS = ["andhra_pradesh", "telangana"];
const HINDI_SHARED_CONTENT_REGION_IDS = [
  "bihar",
  "chhattisgarh",
  "haryana",
  "himachal_pradesh",
  "jharkhand",
  "madhya_pradesh",
  "rajasthan",
  "uttar_pradesh",
  "uttarakhand",
  "delhi",
  "andaman_nicobar",
];
const payloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1),
  requestedPublishDate: z.string().trim().optional(),
  regionId: z.string().trim().optional(),
});

const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;
const photoShapeSchema = z.enum([
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
  photoShape: photoShapeSchema.default("transparent_bottom_fade"),
  photoRenderMode: z.enum(["cutout", "original"]).default("cutout"),
  edgeStyle: z
    .enum(["soft_fade", "sharp", "bottom_fade", "feather"])
    .default("soft_fade"),
  photoFrameStyle: photoFrameStyleSchema.default("none"),
  showSafeAreas: z.boolean().default(true),
  showPoliticalProtocol: z.boolean().default(false),
  politicalProtocolEnabledAtMillis: z.number().int().nonnegative().default(0),
  politicalProtocolX: z.number().min(4).max(96).default(50),
  politicalProtocolY: z.number().min(4).max(96).default(7),
  politicalProtocolScale: z.number().min(45).max(135).default(85),
  politicalProtocolSlots: z
    .array(
      z.object({
        x: z.number().min(4).max(96),
        y: z.number().min(4).max(96),
        scale: z.number().min(45).max(135),
      }),
    )
    .max(2)
    .default([]),
  photoX: z.number().min(0).max(100).default(78),
  photoY: z.number().min(0).max(100).default(42),
  photoScale: z.number().min(10).max(100).default(44),
  showVideoExtraPhoto: z.boolean().default(false),
  videoExtraPhotoShape: photoShapeSchema.default("transparent_bottom_fade"),
  videoExtraPhotoRenderMode: z.enum(["cutout", "original"]).default("cutout"),
  videoExtraPhotoEdgeStyle: z
    .enum(["soft_fade", "sharp", "bottom_fade", "feather"])
    .default("soft_fade"),
  videoExtraPhotoFrameStyle: photoFrameStyleSchema.default("none"),
  videoExtraPhotoX: z.number().min(0).max(100).default(24),
  videoExtraPhotoY: z.number().min(0).max(100).default(44),
  videoExtraPhotoScale: z.number().min(10).max(100).default(28),
  photoAnimation: videoPhotoAnimationSchema.default("none"),
  videoExtraPhotoAnimation: videoPhotoAnimationSchema.default("none"),
  nameX: z.number().min(0).max(100).default(50),
  nameY: z.number().min(0).max(100).default(82),
  showBottomStrip: z.boolean().default(true),
  stripHeight: z.number().min(1).max(40).default(16),
  stripWidth: z.number().min(35).max(100).default(100),
  stripX: z.number().min(0).max(100).default(50),
  stripBottom: z.number().min(0).max(20).default(0),
  stripLayoutStyle: z.enum(["full", "split", "badge"]).default("full"),
  sampleName: z.string().trim().min(1).max(80).default(PERMANENT_SAMPLE_NAME),
  sampleDesignation: z
    .string()
    .trim()
    .max(80)
    .default(PERMANENT_SAMPLE_DESIGNATION),
});

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function protocolSlotSidePercent(scale: number): number {
  return 15 * (clampNumber(scale, 45, 135) / 100);
}

function preventPoliticalProtocolOverlap(
  slots: z.infer<typeof personalizationSchema>["politicalProtocolSlots"],
): z.infer<typeof personalizationSchema>["politicalProtocolSlots"] {
  if (slots.length < 2) return slots;
  const first = slots[0]!;
  const second = slots[1]!;
  const minimumGap =
    (protocolSlotSidePercent(first.scale) +
      protocolSlotSidePercent(second.scale)) /
      2 +
    2;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  if (Math.hypot(deltaX, deltaY) >= minimumGap) return slots;

  const centerX = clampNumber(
    (first.x + second.x) / 2,
    minimumGap / 2,
    100 - minimumGap / 2,
  );
  const direction = deltaX >= 0 ? 1 : -1;
  return [
    {
      ...first,
      x: clampNumber(
        centerX - (minimumGap / 2) * direction,
        protocolSlotSidePercent(first.scale) / 2,
        100 - protocolSlotSidePercent(first.scale) / 2,
      ),
    },
    {
      ...second,
      x: clampNumber(
        centerX + (minimumGap / 2) * direction,
        protocolSlotSidePercent(second.scale) / 2,
        100 - protocolSlotSidePercent(second.scale) / 2,
      ),
    },
  ];
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
  const mainOverlay = clampOverlay(
    config.photoX,
    config.photoY,
    config.photoScale,
  );
  const extraOverlay = clampOverlay(
    config.videoExtraPhotoX,
    config.videoExtraPhotoY,
    config.videoExtraPhotoScale,
  );
  const stripWidth = clampNumber(config.stripWidth, 35, 100);
  return {
    ...config,
    stripHeight: clampNumber(config.stripHeight, 1, 40),
    stripWidth,
    stripX: clampNumber(config.stripX, stripWidth / 2, 100 - stripWidth / 2),
    stripBottom: clampNumber(config.stripBottom, 0, 20),
    politicalProtocolX: clampNumber(config.politicalProtocolX, 4, 96),
    politicalProtocolY: clampNumber(config.politicalProtocolY, 4, 96),
    politicalProtocolScale: clampNumber(config.politicalProtocolScale, 45, 135),
    politicalProtocolSlots: preventPoliticalProtocolOverlap(
      config.politicalProtocolSlots.slice(0, 2).map((slot) => ({
        x: clampNumber(slot.x, 4, 96),
        y: clampNumber(slot.y, 4, 96),
        scale: clampNumber(slot.scale, 45, 135),
      })),
    ),
    photoScale: mainOverlay.scale,
    photoX: mainOverlay.x,
    photoY: mainOverlay.y,
    videoExtraPhotoScale: extraOverlay.scale,
    videoExtraPhotoX: extraOverlay.x,
    videoExtraPhotoY: extraOverlay.y,
  };
}

function isJokesCategoryId(categoryId: string): boolean {
  const normalized = categoryId.trim().toLowerCase();
  return ["jokes", "funny", "humor", "comedy"].includes(normalized);
}

function forcePlainWatermarkPersonalization(
  config: z.infer<typeof personalizationSchema>,
): z.infer<typeof personalizationSchema> {
  return {
    ...config,
    showBottomStrip: false,
    showVideoExtraPhoto: false,
    showSafeAreas: false,
    showPoliticalProtocol: false,
    politicalProtocolEnabledAtMillis: 0,
    politicalProtocolSlots: [],
  };
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getMediaKind(file: File): "image" | "video" | null {
  const mimeType = (file.type || "").toLowerCase();
  if (
    ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)
  ) {
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

function sharedContentRegionIdsFor(regionId: string) {
  if (TELUGU_SHARED_CONTENT_REGION_IDS.includes(regionId)) {
    return TELUGU_SHARED_CONTENT_REGION_IDS;
  }
  if (HINDI_SHARED_CONTENT_REGION_IDS.includes(regionId)) {
    return HINDI_SHARED_CONTENT_REGION_IDS;
  }
  return regionId ? [regionId] : [];
}

function resolvePosterTargetRegionIds(regionId: string, categoryId: string) {
  if (!regionId) {
    return [];
  }
  if (
    categoryId.startsWith("party_") ||
    POLITICAL_PARTY_CATEGORY_IDS.has(categoryId)
  ) {
    return [regionId];
  }
  return sharedContentRegionIdsFor(regionId);
}

async function resolveAdminPosterSchedule(
  categoryId: string,
  now: number,
  uploadSource: "app_posters" | "upload_posters",
  requestedPublishAt: number,
  regionId: string,
) {
  const timeCategoryStartHour = {
    good_morning: 4,
    good_afternoon: 12,
    good_evening: 15,
    good_night: 20,
  }[categoryId];
  if (timeCategoryStartHour != null) {
    const publishAt = getNextIstHourStart(now, timeCategoryStartHour);
    return {
      publishAt,
      eventStartAt: publishAt,
      eventEndAt: 0,
      dynamicCategoryId: "",
      dynamicCategoryLabel: "",
    };
  }

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
        CREATOR_ASSIGNABLE_CATEGORIES.find((item) => item.id === categoryId)
          ?.label ?? "",
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
          ? Math.max(
              requestedPublishAt || getCreatorPosterPublishAt(now),
              getCreatorPosterPublishAt(now),
            )
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
      return NextResponse.json(
        { ok: false, error: "Poster not found." },
        { status: 404 },
      );
    }

    const existing = posterSnap.data() as {
      categoryId?: string;
      imagePath?: string;
      videoPath?: string;
      createdByRole?: string;
      storageFolderKey?: string;
      createdBySurface?: string;
      mediaType?: string;
      title?: string;
      regionId?: string;
      personalizationConfig?: Record<string, unknown>;
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Only admin app posters can be edited." },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      title: formData.get("title"),
      categoryId: formData.get("categoryId"),
      requestedPublishDate:
        String(formData.get("requestedPublishDate") ?? "").trim() || undefined,
      regionId: String(formData.get("regionId") ?? "").trim() || undefined,
    });
    if (existing.regionId) {
      await assertActorCanAccessRegion(actor, existing.regionId);
    }
    const region = await assertActorCanAccessRegion(actor, parsed.regionId);
    let personalizationConfig: unknown = undefined;
    const personalizationRaw = formData.get("personalizationConfig");
    if (
      typeof personalizationRaw === "string" &&
      personalizationRaw.trim().length > 0
    ) {
      try {
        personalizationConfig = {
          ...clampPersonalizationSafeArea(
            personalizationSchema.parse(JSON.parse(personalizationRaw)),
          ),
          sampleName: PERMANENT_SAMPLE_NAME,
          sampleDesignation: PERMANENT_SAMPLE_DESIGNATION,
        };
      } catch {
        return NextResponse.json(
          { ok: false, error: "Unable to parse personalization config." },
          { status: 400 },
        );
      }
    }

    const categoryId = canonicalCategoryId(parsed.categoryId);
    const manualCategory = await getManualEventCategoryById(
      categoryId,
      region.id,
    );
    const permanentCategory = await getPermanentCategoryById(categoryId, {
      regionId: region.id,
    });
    const politicalCategories = categoryId.startsWith("party_")
      ? await politicalPartyCategoriesForRegionManaged(region.id)
      : [];
    const isPoliticalCategory =
      POLITICAL_PARTY_CATEGORY_IDS.has(categoryId) ||
      politicalCategories.some((item) => item.id === categoryId);
    const category =
      (isPoliticalCategory
        ? (politicalCategories.find((item) => item.id === categoryId) ??
          politicalPartyCategoriesForRegion(region.id).find(
            (item) => item.id === categoryId,
          ))
        : CREATOR_ASSIGNABLE_CATEGORIES.find(
            (item) => item.id === categoryId && item.id !== "all",
          )) ??
      (permanentCategory
        ? {
            id: permanentCategory.id,
            label: permanentCategory.label,
            allowPoliticalProtocol: permanentCategory.allowPoliticalProtocol,
          }
        : undefined) ??
      (manualCategory?.active
        ? {
            id: manualCategory.id,
            label: manualCategory.label,
            allowPoliticalProtocol: manualCategory.allowPoliticalProtocol,
          }
        : undefined);
    if (!category) {
      return NextResponse.json(
        { ok: false, error: "Valid category is required." },
        { status: 400 },
      );
    }
    const categoryLabel = localizeCategoryLabel(category, region);
    const targetRegionIds = resolvePosterTargetRegionIds(region.id, categoryId);
    const updatedAt = Date.now();
    const media = formData.get("media") ?? formData.get("image");
    const existingMediaType =
      String(existing.mediaType ?? "").toLowerCase() === "video"
        ? "video"
        : "image";
    const submittedMediaKind =
      media instanceof File && media.size > 0 ? getMediaKind(media) : undefined;
    const effectiveMediaKind = submittedMediaKind ?? existingMediaType;
    const canUsePoliticalProtocol =
      effectiveMediaKind === "image" &&
      categoryAllowsPoliticalProtocol(category);
    if (
      personalizationConfig != null &&
      typeof personalizationConfig === "object" &&
      !Array.isArray(personalizationConfig)
    ) {
      const existingPoliticalProtocolEnabledAt = Number(
        (existing.personalizationConfig as Record<string, unknown> | undefined)
          ?.politicalProtocolEnabledAtMillis ?? 0,
      );
      const parsedPersonalization = personalizationConfig as Record<
        string,
        unknown
      >;
      const showPoliticalProtocol =
        canUsePoliticalProtocol &&
        parsedPersonalization.showPoliticalProtocol === true;
      personalizationConfig = {
        ...parsedPersonalization,
        showPoliticalProtocol,
        politicalProtocolEnabledAtMillis:
          showPoliticalProtocol &&
          Number.isFinite(existingPoliticalProtocolEnabledAt) &&
          existingPoliticalProtocolEnabledAt > 0
            ? existingPoliticalProtocolEnabledAt
            : 0,
      };
    } else if (!canUsePoliticalProtocol) {
      personalizationConfig = {
        ...((existing.personalizationConfig as
          Record<string, unknown> | undefined) ?? {}),
        showPoliticalProtocol: false,
        politicalProtocolEnabledAtMillis: 0,
      };
    }
    if (effectiveMediaKind === "image" && isJokesCategoryId(categoryId)) {
      personalizationConfig = forcePlainWatermarkPersonalization({
        ...clampPersonalizationSafeArea(
          personalizationSchema.parse(
            personalizationConfig ?? existing.personalizationConfig ?? {},
          ),
        ),
        sampleName: PERMANENT_SAMPLE_NAME,
        sampleDesignation: PERMANENT_SAMPLE_DESIGNATION,
      });
    }
    const uploadSource = resolveAdminPosterUploadSource(
      existing.storageFolderKey ?? existing.createdBySurface,
    );
    const requestedPublishAtRaw = parsed.requestedPublishDate
      ? parseIstDateKeyToEpoch(parsed.requestedPublishDate)
      : null;
    if (parsed.requestedPublishDate && requestedPublishAtRaw == null) {
      return NextResponse.json(
        { ok: false, error: "Choose a valid publish date." },
        { status: 400 },
      );
    }
    const weekday = getWeekdayForCategoryId(categoryId);
    let requestedPublishAt = 0;
    if (weekday && uploadSource === "upload_posters") {
      const earliestWeekdayPublishAt = getNextIstWeekdayStart(
        updatedAt,
        weekday,
      );
      if (requestedPublishAtRaw != null) {
        if (getIstWeekday(requestedPublishAtRaw) !== weekday) {
          return NextResponse.json(
            {
              ok: false,
              error: "Selected publish date must match the category weekday.",
            },
            { status: 400 },
          );
        }
        if (requestedPublishAtRaw < earliestWeekdayPublishAt) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Publish date cannot be earlier than the default app publish date.",
            },
            { status: 400 },
          );
        }
        requestedPublishAt = requestedPublishAtRaw;
      }
    } else if (
      !manualCategory &&
      !weekday &&
      uploadSource === "upload_posters"
    ) {
      const earliestRegularPublishAt = getCreatorPosterPublishAt(updatedAt);
      if (requestedPublishAtRaw != null) {
        if (requestedPublishAtRaw < earliestRegularPublishAt) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Publish date cannot be earlier than the default app publish date.",
            },
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
    if (media instanceof File && media.size > 0) {
      const mediaKind = submittedMediaKind;
      if (!mediaKind) {
        return NextResponse.json(
          {
            ok: false,
            error: "Only PNG, JPG, WEBP, MP4, MOV, or WEBM files are allowed.",
          },
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
      const duplicateSnap = await adminDb
        .collection("creatorPosters")
        .where("categoryId", "==", categoryId)
        .where("imageHash", "==", imageHash)
        .get();
      const duplicate = duplicateSnap.docs.find((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return doc.id !== posterId && String(data.status ?? "") !== "deleted";
      });
      if (duplicate) {
        return NextResponse.json(
          { ok: false, error: "Same poster already exists in this category." },
          { status: 409 },
        );
      }
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
        `${storageFolder}/${categoryId}/${posterId}/${now}-${safeOriginal}`,
      );
      imageUrl = mediaKind === "image" ? uploaded.imageUrl : "";
      imagePath = mediaKind === "image" ? uploaded.filePath : "";
      videoUrl = mediaKind === "video" ? uploaded.imageUrl : "";
      videoPath = mediaKind === "video" ? uploaded.filePath : "";
      await deleteAdminAsset(existing.imagePath);
      await deleteAdminAsset(existing.videoPath);
    }

    const schedule = await resolveAdminPosterSchedule(
      categoryId,
      updatedAt,
      uploadSource,
      requestedPublishAt,
      region.id,
    );
    await posterRef.set(
      {
        title: parsed.title,
        categoryId,
        categoryLabel,
        regionId: region.id,
        targetRegionIds,
        regionName: region.name,
        regionLanguage: region.primaryLanguage,
        requestedPublishAt,
        publishAt: schedule.publishAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
        dynamicCategoryId: schedule.dynamicCategoryId,
        dynamicCategoryLabel: schedule.dynamicCategoryId
          ? localizeCategoryLabel(
              {
                id: schedule.dynamicCategoryId,
                label: schedule.dynamicCategoryLabel,
              },
              region,
            )
          : "",
        performanceWindowStartAt: schedule.publishAt || updatedAt,
        performanceWindowEndAt:
          (schedule.publishAt || updatedAt) + 24 * 60 * 60 * 1000,
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
      metadata: { categoryId, categoryLabel: category.label },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update app poster.";
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
      return NextResponse.json(
        { ok: false, error: "Poster not found." },
        { status: 404 },
      );
    }

    const existing = posterSnap.data() as {
      title?: string;
      imagePath?: string;
      videoPath?: string;
      createdByRole?: string;
      regionId?: string;
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Only admin app posters can be deleted." },
        { status: 403 },
      );
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
    const message =
      error instanceof Error ? error.message : "Unable to delete app poster.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
