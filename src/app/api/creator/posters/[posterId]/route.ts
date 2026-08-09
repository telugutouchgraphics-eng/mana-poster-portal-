import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  canonicalCategoryId,
  categoryAllowsPoliticalProtocol,
  getWeekdayForCategoryId,
} from "@/lib/server/categories";
import {
  deleteAdminAsset,
  uploadAdminAsset,
} from "@/lib/server/content-management";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import { getPermanentCategoryById } from "@/lib/server/permanent-categories";
import {
  getCreatorPosterPublishAt,
  getIstWeekday,
  parseIstDateKeyToEpoch,
} from "@/lib/server/ist-schedule";
import { normalizeStoredPosterFrameSize } from "@/lib/video-frame-size";
import { getDashboardRegion } from "@/lib/dashboard-regions";
import { localizeCategoryLabel } from "@/lib/dashboard-category-localization";
import { recordAllowsRegion } from "@/lib/server/region-scope";
import {
  POLITICAL_PARTY_CATEGORY_IDS,
  politicalPartyCategoriesForRegion,
} from "@/lib/political-party-categories";
import { politicalPartyCategoriesForRegionManaged } from "@/lib/server/political-parties";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;

const payloadSchema = z.object({
  categoryId: z.string().trim().min(1),
  requestedPublishDate: z.string().trim().optional(),
  regionId: z.string().trim().optional(),
});

const photoShapeSchema = z.enum([
  "transparent_bottom_fade",
  "transparent_clean",
  "transparent_soft_round",
  "transparent_sharp_round",
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
  photoFrameStyle: z
    .enum([
      "none",
      "inner_shadow",
      "white_outline",
      "glow_edge",
      "double_border",
    ])
    .default("none"),
  showSafeAreas: z.boolean().default(true),
  photoX: z.number().min(0).max(100).default(78),
  photoY: z.number().min(0).max(100).default(42),
  photoScale: z.number().min(10).max(100).default(44),
  showVideoExtraPhoto: z.boolean().default(false),
  videoExtraPhotoShape: photoShapeSchema.default("transparent_bottom_fade"),
  videoExtraPhotoRenderMode: z.enum(["cutout", "original"]).default("cutout"),
  videoExtraPhotoEdgeStyle: z
    .enum(["soft_fade", "sharp", "bottom_fade", "feather"])
    .default("soft_fade"),
  videoExtraPhotoFrameStyle: z
    .enum([
      "none",
      "inner_shadow",
      "white_outline",
      "glow_edge",
      "double_border",
    ])
    .default("none"),
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
  videoFit: z.enum(["contain", "cover"]).default("contain"),
  videoScale: z.number().min(50).max(200).default(100),
  videoOffsetX: z.number().min(0).max(100).default(50),
  videoOffsetY: z.number().min(0).max(100).default(50),
  videoCornerRadius: z.number().min(0).max(48).default(24),
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
    photoScale: mainOverlay.scale,
    photoX: mainOverlay.x,
    photoY: mainOverlay.y,
    videoExtraPhotoScale: extraOverlay.scale,
    videoExtraPhotoX: extraOverlay.x,
    videoExtraPhotoY: extraOverlay.y,
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

function isEditableStatus(status: string): boolean {
  return status === "pending" || status === "rejected";
}

function isDeletableStatus(status: string): boolean {
  return status === "pending" || status === "rejected";
}

async function assertCreatorOwnsPoster(
  posterId: string,
  creatorPublicId: string,
) {
  const posterRef = adminDb.collection("creatorPosters").doc(posterId);
  const posterSnap = await posterRef.get();
  if (!posterSnap.exists) {
    throw new Error("Poster not found.");
  }
  const poster = posterSnap.data() as Record<string, unknown>;
  if (String(poster.creatorPublicId ?? "") !== creatorPublicId) {
    throw new Error("Forbidden");
  }
  return { posterRef, poster };
}

async function assertCreatorOwnsEditablePoster(
  posterId: string,
  creatorPublicId: string,
) {
  const result = await assertCreatorOwnsPoster(posterId, creatorPublicId);
  const poster = result.poster;
  if (!isEditableStatus(String(poster.status ?? "pending"))) {
    throw new Error("Only pending or rejected posters can be changed.");
  }
  return result;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const { posterId } = await params;
    const { posterRef, poster } = await assertCreatorOwnsEditablePoster(
      posterId,
      creator.creatorPublicId,
    );

    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      categoryId: formData.get("categoryId"),
      requestedPublishDate:
        String(formData.get("requestedPublishDate") ?? "").trim() || undefined,
      regionId: String(formData.get("regionId") ?? "").trim() || undefined,
    });
    const region = getDashboardRegion(parsed.regionId);
    const creatorProfileSnap = await adminDb
      .collection("creatorProfiles")
      .doc(creator.creatorPublicId)
      .get();
    if (!recordAllowsRegion(creatorProfileSnap.data() ?? {}, region.id)) {
      return NextResponse.json(
        { ok: false, error: "This State / UT is not assigned to you." },
        { status: 403 },
      );
    }

    const categoryId = canonicalCategoryId(parsed.categoryId);
    if (!creator.assignedCategories.includes(categoryId)) {
      return NextResponse.json(
        { ok: false, error: "This category is not assigned to you." },
        { status: 403 },
      );
    }

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
            (item) => item.id === categoryId,
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
        { ok: false, error: "Invalid category." },
        { status: 400 },
      );
    }
    const categoryLabel = localizeCategoryLabel(category, region);

    let personalizationConfig = personalizationSchema.parse({});
    const personalizationRaw = formData.get("personalizationConfig");
    if (
      typeof personalizationRaw === "string" &&
      personalizationRaw.trim().length > 0
    ) {
      personalizationConfig = personalizationSchema.parse(
        JSON.parse(personalizationRaw) as unknown,
      );
    }
    personalizationConfig = {
      ...clampPersonalizationSafeArea(personalizationConfig),
      sampleName: PERMANENT_SAMPLE_NAME,
      sampleDesignation: PERMANENT_SAMPLE_DESIGNATION,
    };
    const widthPxRaw = Number(formData.get("widthPx") ?? 0);
    const heightPxRaw = Number(formData.get("heightPx") ?? 0);

    const now = Date.now();
    const media = formData.get("media") ?? formData.get("image");
    const existingMediaType =
      String(poster.mediaType ?? "").toLowerCase() === "video"
        ? "video"
        : "image";
    const submittedMediaKind =
      media instanceof File && media.size > 0 ? getMediaKind(media) : undefined;
    const effectiveMediaKind = submittedMediaKind ?? existingMediaType;
    const canUsePoliticalProtocol =
      effectiveMediaKind === "image" &&
      categoryAllowsPoliticalProtocol(category);
    const existingPoliticalProtocolEnabledAt = Number(
      (poster.personalizationConfig as Record<string, unknown> | undefined)
        ?.politicalProtocolEnabledAtMillis ?? 0,
    );
    const showPoliticalProtocol =
      canUsePoliticalProtocol &&
      personalizationConfig.showPoliticalProtocol === true;
    personalizationConfig = {
      ...personalizationConfig,
      showPoliticalProtocol,
      politicalProtocolEnabledAtMillis:
        showPoliticalProtocol &&
        Number.isFinite(existingPoliticalProtocolEnabledAt) &&
        existingPoliticalProtocolEnabledAt > 0
          ? existingPoliticalProtocolEnabledAt
          : 0,
    };
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
    if (weekday) {
      const earliestWeekdayPublishAt = getCreatorPosterPublishAt(now);
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
    } else if (!manualCategory) {
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
    const nextUpdate: Record<string, unknown> = {
      categoryId,
      categoryLabel,
      regionId: region.id,
      regionName: region.name,
      regionLanguage: region.primaryLanguage,
      personalizationConfig,
      status: "pending",
      reviewComment: "",
      requestedPublishAt,
      publishAt: 0,
      approvedAt: 0,
      eventStartAt: 0,
      eventEndAt: 0,
      performanceWindowStartAt: 0,
      performanceWindowEndAt: 0,
      dashboardVisibleUntil: now + 24 * 60 * 60 * 1000,
      dashboardHiddenAt: 0,
      dashboardHiddenReason: "",
      updatedAt: now,
      reviewHistory: [
        ...(Array.isArray(poster.reviewHistory) ? poster.reviewHistory : []),
        {
          type: "resubmitted",
          actorRole: "creator",
          actorId: creator.creatorPublicId,
          actorName: creator.name,
          comment: "Poster edited and sent back for review.",
          createdAt: now,
        },
      ],
    };

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
      const imageHash = createHash("sha256").update(bytes).digest("hex");
      const duplicateSnap = await adminDb
        .collection("creatorPosters")
        .where("creatorPublicId", "==", creator.creatorPublicId)
        .where("categoryId", "==", categoryId)
        .where("imageHash", "==", imageHash)
        .get();
      const duplicate = duplicateSnap.docs.find((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return doc.id !== posterId && String(data.status ?? "") !== "deleted";
      });
      if (duplicate) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Same poster already uploaded in this category. Change design and upload again.",
          },
          { status: 409 },
        );
      }

      const mimeType = media.type || "image/png";
      const ext = resolveFileExtension(media);
      const safeOriginal = sanitizeFileName(media.name || `poster.${ext}`);
      const uploaded = await uploadAdminAsset(
        bytes,
        mimeType,
        `creator_posters/${creator.creatorPublicId}/${now}-${safeOriginal}`,
      );
      nextUpdate.mediaType = mediaKind;
      nextUpdate.imageHash = imageHash;
      nextUpdate.imagePath = mediaKind === "image" ? uploaded.filePath : "";
      nextUpdate.imageUrl = mediaKind === "image" ? uploaded.imageUrl : "";
      nextUpdate.videoPath = mediaKind === "video" ? uploaded.filePath : "";
      nextUpdate.videoUrl = mediaKind === "video" ? uploaded.imageUrl : "";
      const frameSize = normalizeStoredPosterFrameSize(
        mediaKind,
        widthPxRaw,
        heightPxRaw,
      );
      if (frameSize) {
        nextUpdate.widthPx = frameSize.widthPx;
        nextUpdate.heightPx = frameSize.heightPx;
      }
      await deleteAdminAsset(String(poster.imagePath ?? ""));
      await deleteAdminAsset(String(poster.videoPath ?? ""));
    }

    await posterRef.set(nextUpdate, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update poster.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> },
) {
  try {
    const creator = await requireCreatorAccessContext(req);
    const { posterId } = await params;
    const { posterRef, poster } = await assertCreatorOwnsPoster(
      posterId,
      creator.creatorPublicId,
    );
    if (!isDeletableStatus(String(poster.status ?? "pending"))) {
      throw new Error("Only pending or rejected posters can be deleted.");
    }
    await posterRef.delete();
    await deleteAdminAsset(String(poster.imagePath ?? ""));
    await deleteAdminAsset(String(poster.videoPath ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete poster.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
