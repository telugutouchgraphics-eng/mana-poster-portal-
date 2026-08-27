import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  canonicalCategoryId,
  categoryAllowsPoliticalProtocol,
  getWeekdayForCategoryId,
  getVisibleDynamicCategoryById,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import {
  getManualEventCategoryById,
  listVisibleManualEventCategories,
} from "@/lib/server/manual-event-categories";
import {
  getPermanentCategoryById,
  listActivePermanentCategories,
} from "@/lib/server/permanent-categories";
import { uploadAdminAsset } from "@/lib/server/content-management";
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
import {
  localizeCategoryLabel,
  localizeCategoryList,
} from "@/lib/dashboard-category-localization";
import type { CategoryType } from "@/lib/category-groups";
import {
  POLITICAL_PARTY_CATEGORY_IDS,
  politicalPartyCategoriesForRegion,
} from "@/lib/political-party-categories";
import { politicalPartyCategoriesForRegionManaged } from "@/lib/server/political-parties";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;
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
  categoryId: z.string().trim().min(1),
  requestedPublishDate: z.string().trim().optional(),
  regionId: z.string().trim().optional(),
  /** FormData.get returns null when missing; Zod .default only runs for undefined. */
  uploadSource: z.preprocess(
    (val) => (val === null || val === "" ? undefined : val),
    z.enum(["app_posters", "upload_posters"]).default("app_posters"),
  ),
});

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

function stablePosterHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash & 0x7fffffff;
}

function defaultPosterDisplayViewCount(posterId: string): number {
  return 120 + (stablePosterHash(`default-view:${posterId}`) % 121);
}

function defaultPosterDisplayShareCount(posterId: string): number {
  const views = defaultPosterDisplayViewCount(posterId);
  const percentage = 62 + (stablePosterHash(`default-share:${posterId}`) % 14);
  return Math.min(views - 1, Math.round((views * percentage) / 100));
}

function boostedPosterDisplayCount(
  posterId: string,
  kind: "view" | "share" | "download",
  realCount: number,
): number {
  const real = Math.max(0, Number(realCount) || 0);
  if (real <= 0) {
    if (kind === "view") return defaultPosterDisplayViewCount(posterId);
    if (kind === "share") return defaultPosterDisplayShareCount(posterId);
    return 0;
  }
  const baseCount =
    kind === "view"
      ? defaultPosterDisplayViewCount(posterId)
      : kind === "share"
        ? defaultPosterDisplayShareCount(posterId)
        : 0;
  const ranges = {
    view: [25, 60],
    share: [8, 20],
    download: [10, 25],
  } as const;
  const [min, max] = ranges[kind];
  const multiplier = min + (stablePosterHash(`${kind}:${posterId}`) % (max - min + 1));
  return baseCount + real * multiplier;
}

function boostedPosterDisplayEngagementCount(
  posterId: string,
  shareCount: number,
  downloadCount: number,
): number {
  const real = Math.max(0, Number(shareCount || 0) + Number(downloadCount || 0));
  const base = defaultPosterDisplayShareCount(posterId);
  if (real <= 0) return base;
  const multiplier = 2 + (stablePosterHash(`engagement:${posterId}`) % 4);
  return base + real * multiplier;
}

function mapPoster(id: string, data: Record<string, unknown>) {
  const viewCount = Number(data.viewCount ?? 0);
  const shareCount = Number(data.shareCount ?? 0);
  const downloadCount = Number(data.downloadCount ?? 0);
  const displayViewCount =
    Number(data.displayViewCount ?? 0) || boostedPosterDisplayCount(id, "view", viewCount);
  const displayShareCount =
    Number(data.displayShareCount ?? 0) || boostedPosterDisplayCount(id, "share", shareCount);
  const displayDownloadCount =
    Number(data.displayDownloadCount ?? 0) ||
    boostedPosterDisplayCount(id, "download", downloadCount);
  return {
    id,
    creatorPublicId: String(data.creatorPublicId ?? ""),
    title: String(data.title ?? "Admin Poster"),
    categoryId: String(data.categoryId ?? ""),
    categoryLabel: String(data.categoryLabel ?? ""),
    regionId: String(data.regionId ?? ""),
    targetRegionIds: Array.isArray(data.targetRegionIds)
      ? data.targetRegionIds
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
      : [],
    regionName: String(data.regionName ?? ""),
    mediaType: String(data.mediaType ?? "image"),
    imageUrl: String(data.imageUrl ?? ""),
    imagePath: String(data.imagePath ?? ""),
    videoUrl: String(data.videoUrl ?? ""),
    videoPath: String(data.videoPath ?? ""),
    personalizationConfig: data.personalizationConfig ?? null,
    status: String(data.status ?? ""),
    engagementCount: Number(
      data.engagementCount ??
        Number(data.shareCount ?? 0) + Number(data.downloadCount ?? 0),
    ),
    displayEngagementCount: boostedPosterDisplayEngagementCount(
      id,
      shareCount,
      downloadCount,
    ),
    viewCount,
    shareCount,
    downloadCount,
    displayViewCount,
    displayShareCount,
    displayDownloadCount,
    createdBySurface: String(data.createdBySurface ?? ""),
    storageFolderKey: String(data.storageFolderKey ?? ""),
    createdAt: Number(data.createdAt ?? 0),
    approvedAt: Number(data.approvedAt ?? 0),
    requestedPublishAt: Number(data.requestedPublishAt ?? 0),
  };
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

async function buildAdminAppPosterCategories(regionId?: string | null) {
  const visibleCategories = getVisibleAssignableCategories(
    new Date(),
    2,
    7,
    2,
    regionId,
  ).filter((item) => item.id !== "all");
  const politicalCategories =
    await politicalPartyCategoriesForRegionManaged(regionId);
  const manualCategories = await listVisibleManualEventCategories(
    Date.now(),
    regionId,
  );
  const permanentCategories = await listActivePermanentCategories(regionId);
  const mergedVisible = [
    ...visibleCategories.map((category) => ({
      ...category,
      categoryType: (category.id.startsWith("weekday_")
        ? "weekday"
        : category.isDynamic
          ? "event"
          : "daily") as CategoryType,
    })),
    ...politicalCategories.map((category) => ({
      ...category,
      categoryType: "political" as CategoryType,
    })),
    ...manualCategories.map((category) => ({
      ...category,
      categoryType: "manual" as CategoryType,
    })),
    ...permanentCategories.map((category) => ({
      ...category,
      categoryType: "permanent" as CategoryType,
    })),
  ];
  const visibleIds = new Set(mergedVisible.map((item) => item.id));
  const weekdayCategories = CREATOR_ASSIGNABLE_CATEGORIES.filter(
    (item) => item.id.startsWith("weekday_") && item.id !== "weekday_special",
  ).map((item) => ({
    id: item.id,
    label: item.label,
    isDynamic: true,
    categoryType: "weekday" as CategoryType,
  }));

  return localizeCategoryList(
    [
      ...mergedVisible,
      ...weekdayCategories.filter((item) => !visibleIds.has(item.id)),
    ],
    regionId,
  );
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

function resolveAdminPosterStorageFolder(
  uploadSource: "app_posters" | "upload_posters",
) {
  return uploadSource === "upload_posters"
    ? "portal_assets/admin_upload_posters"
    : "portal_assets/admin_app_posters";
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const dashboardResultLimit = 500;
    const dashboardFetchPageSize = 500;
    const dashboardMaxScanned = 5000;
    const sourceParam = req.nextUrl.searchParams.get("source");
    const sourceFilter =
      sourceParam === "upload_posters" || sourceParam === "app_posters"
        ? sourceParam
        : "app_posters";
    const region = await assertActorCanAccessRegion(
      actor,
      req.nextUrl.searchParams.get("regionId"),
    );
    const posters: ReturnType<typeof mapPoster>[] = [];
    let scanned = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (posters.length < dashboardResultLimit && scanned < dashboardMaxScanned) {
      let query: FirebaseFirestore.Query = adminDb
        .collection("creatorPosters")
        .where("createdByRole", "==", "admin")
        .orderBy("createdAt", "desc")
        .limit(dashboardFetchPageSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      const snap = await query.get();
      if (snap.empty) {
        break;
      }

      for (const doc of snap.docs) {
        scanned += 1;
        const poster = mapPoster(doc.id, doc.data());
        if (poster.status.trim().toLowerCase() === "expired") {
          continue;
        }
        const matchesRegion =
          poster.targetRegionIds.length > 0
            ? poster.targetRegionIds.includes(region.id)
            : poster.regionId === region.id;
        if (!matchesRegion) {
          continue;
        }
        const surface = poster.storageFolderKey || poster.createdBySurface;
        const matchesSource =
          sourceFilter === "upload_posters"
            ? surface === "upload_posters"
            : !surface || surface === "app_posters";
        if (!matchesSource) {
          continue;
        }
        posters.push({
          ...poster,
          categoryLabel: localizeCategoryLabel(
            {
              id: poster.categoryId,
              label: poster.categoryLabel || poster.categoryId,
            },
            region,
          ),
        });
        if (posters.length >= dashboardResultLimit) {
          break;
        }
      }

      lastDoc = snap.docs[snap.docs.length - 1] ?? null;
      if (snap.docs.length < dashboardFetchPageSize) {
        break;
      }
    }

    posters.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({
      ok: true,
      categories: await buildAdminAppPosterCategories(region.id),
      posters,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load app posters.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      categoryId: formData.get("categoryId"),
      requestedPublishDate:
        String(formData.get("requestedPublishDate") ?? "").trim() || undefined,
      regionId: String(formData.get("regionId") ?? "").trim() || undefined,
      uploadSource: formData.get("uploadSource"),
    });
    const region = await assertActorCanAccessRegion(actor, parsed.regionId);
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

    let personalizationConfig = personalizationSchema.parse({});
    const personalizationRaw = formData.get("personalizationConfig");
    if (
      typeof personalizationRaw === "string" &&
      personalizationRaw.trim().length > 0
    ) {
      personalizationConfig = personalizationSchema.parse(
        JSON.parse(personalizationRaw),
      );
    }
    personalizationConfig = {
      ...clampPersonalizationSafeArea(personalizationConfig),
      sampleName: PERMANENT_SAMPLE_NAME,
      sampleDesignation: PERMANENT_SAMPLE_DESIGNATION,
    };

    const media = formData.get("media") ?? formData.get("image");
    if (!(media instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Poster image is required." },
        { status: 400 },
      );
    }
    const mediaKind = getMediaKind(media);
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
      .where("categoryId", "==", categoryId)
      .where("imageHash", "==", imageHash)
      .get();
    const duplicate = duplicateSnap.docs.find((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return String(data.status ?? "") !== "deleted";
    });
    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: "Same poster already exists in this category." },
        { status: 409 },
      );
    }

    const mimeType = media.type || "image/png";
    const ext = resolveFileExtension(media);
    const now = Date.now();
    const canUsePoliticalProtocol = categoryAllowsPoliticalProtocol(category);
    personalizationConfig = {
      ...personalizationConfig,
      showPoliticalProtocol:
        canUsePoliticalProtocol &&
        personalizationConfig.showPoliticalProtocol === true,
      politicalProtocolEnabledAtMillis:
        canUsePoliticalProtocol &&
        personalizationConfig.showPoliticalProtocol === true
          ? now
          : 0,
    };
    if (mediaKind === "image" && isJokesCategoryId(categoryId)) {
      personalizationConfig = forcePlainWatermarkPersonalization(
        personalizationConfig,
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
    const weekday = getWeekdayForCategoryId(categoryId);
    let requestedPublishAt = 0;
    if (weekday && parsed.uploadSource === "upload_posters") {
      const earliestWeekdayPublishAt = getNextIstWeekdayStart(now, weekday);
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
      parsed.uploadSource === "upload_posters"
    ) {
      const earliestRegularPublishAt = getCreatorPosterPublishAt(now);
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
    const schedule = await resolveAdminPosterSchedule(
      categoryId,
      now,
      parsed.uploadSource,
      requestedPublishAt,
      region.id,
    );
    const posterRef = adminDb.collection("creatorPosters").doc();
    const safeOriginal = sanitizeFileName(media.name || `poster.${ext}`);
    const storageFolder = resolveAdminPosterStorageFolder(parsed.uploadSource);
    const uploaded = await uploadAdminAsset(
      bytes,
      mimeType,
      `${storageFolder}/${categoryId}/${posterRef.id}/${now}-${safeOriginal}`,
    );

    const title = `Admin ${categoryLabel}`;
    await posterRef.set({
      id: posterRef.id,
      creatorPublicId: "ADMIN",
      creatorUid: actor.uid,
      managerUid: actor.uid,
      managerEmail: actor.email ?? "",
      managerName: actor.email ?? "Admin",
      title,
      categoryId,
      categoryLabel,
      regionId: region.id,
      targetRegionIds,
      regionName: region.name,
      regionLanguage: region.primaryLanguage,
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
      viewCount: 0,
      shareCount: 0,
      downloadCount: 0,
      engagementCount: 0,
      displayViewCount: 0,
      displayShareCount: 0,
      displayDownloadCount: 0,
      displayEngagementCount: 0,
      creatorEarnings: 0,
      platformEarnings: 0,
      payoutStatus: "not_applicable",
      uploadDayKey: "",
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
      message: `Uploaded app poster: ${categoryLabel}`,
      metadata: {
        categoryId,
        categoryLabel,
        regionId: region.id,
        targetRegionIds,
        regionName: region.name,
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
        categoryId,
        categoryLabel,
        mediaType: mediaKind,
        imageUrl: mediaKind === "image" ? uploaded.imageUrl : "",
        videoUrl: mediaKind === "video" ? uploaded.imageUrl : "",
        status: "approved",
        createdAt: now,
        approvedAt: now,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Poster upload failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
