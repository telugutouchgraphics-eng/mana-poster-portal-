import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import {
  deleteAdminAsset,
  uploadAdminAsset,
} from "@/lib/server/content-management";
import {
  getVisibleDynamicCategoryById,
  getWeekdayForCategoryId,
} from "@/lib/server/categories";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import {
  getIstEndOfDay,
  getNextIstWeekdayStart,
} from "@/lib/server/ist-schedule";
import {
  resolveFeedPublishAtMs,
  resolveManualFeedPublishAtMs,
} from "@/lib/server/poster-feed-schedule";

export const USER_UPLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const defaultUserUploadPersonalizationConfig = {
  photoShape: "circle",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  photoFrameStyle: "none",
  showSafeAreas: true,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  showWhatsapp: false,
  sampleName: "User Name",
};

export function sanitizeUserUploadPersonalizationConfig(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultUserUploadPersonalizationConfig;
  }
  return {
    ...defaultUserUploadPersonalizationConfig,
    ...(raw as Record<string, unknown>),
  };
}

export async function resolveUserUploadPublishSchedule(
  categoryId: string,
  uploadedAt: number,
  approvedAt: number,
  applicableFromAt: number,
) {
  const applicableStart = Math.max(applicableFromAt, 0);
  const visibilityBaseline = Math.max(approvedAt, applicableStart);
  const weekday = getWeekdayForCategoryId(categoryId);
  if (weekday) {
    const publishAt = Math.max(
      getNextIstWeekdayStart(
        applicableStart > 0 ? applicableStart : approvedAt,
        weekday,
      ),
      visibilityBaseline,
    );
    return {
      publishAt,
      eventStartAt: publishAt,
      eventEndAt: getIstEndOfDay(publishAt),
    };
  }

  const dynamicSchedule = getVisibleDynamicCategoryById(
    categoryId,
    new Date(visibilityBaseline),
    3,
    7,
    3,
  );
  if (dynamicSchedule) {
    const eventStartAt = dynamicSchedule.eventStartAt ?? 0;
    const eventEndAt = dynamicSchedule.eventEndAt ?? 0;
    return {
      publishAt: resolveFeedPublishAtMs(eventStartAt, visibilityBaseline),
      eventStartAt,
      eventEndAt,
    };
  }

  const manualCategory = await getManualEventCategoryById(categoryId);
  if (manualCategory) {
    return {
      publishAt: resolveManualFeedPublishAtMs(
        manualCategory.startAt,
        visibilityBaseline,
      ),
      eventStartAt: manualCategory.startAt,
      eventEndAt: manualCategory.endAt,
    };
  }

  return {
    // Non-event uploads follow the applicable IST date. If approval happens
    // after that date has started, the poster can appear immediately.
    publishAt: Math.max(uploadedAt, visibilityBaseline),
    eventStartAt: 0,
    eventEndAt: 0,
  };
}

export async function deleteUserUploadCascade(uploadId: string) {
  const uploadRef = adminDb.collection("userPosterUploads").doc(uploadId);
  const uploadSnap = await uploadRef.get();
  if (!uploadSnap.exists) {
    return { deletedUpload: false, deletedPoster: false };
  }

  const current = uploadSnap.data() as Record<string, unknown>;
  const approvedPosterTemplateId = String(
    current.approvedPosterTemplateId ?? "",
  ).trim();
  const imagePath = String(current.imagePath ?? "").trim();

  let deletedPoster = false;
  if (approvedPosterTemplateId) {
    const posterRef = adminDb
      .collection("creatorPosters")
      .doc(approvedPosterTemplateId);
    const posterSnap = await posterRef.get();
    if (posterSnap.exists) {
      const poster = posterSnap.data() as Record<string, unknown>;
      await Promise.all([
        deleteAdminAsset(String(poster.imagePath ?? "").trim()),
        deleteAdminAsset(String(poster.videoPath ?? "").trim()),
      ]);
      await posterRef.delete();
      deletedPoster = true;
    }
  }

  await deleteAdminAsset(imagePath);
  await uploadRef.delete();
  return { deletedUpload: true, deletedPoster };
}

function inferImageExtension(contentType: string) {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.includes("png")) return ".png";
  if (normalized.includes("webp")) return ".webp";
  return ".jpg";
}

export async function promoteUserUploadAssetToPublicPosterAsset(params: {
  sourcePath: string;
  fallbackImageUrl: string;
  posterId: string;
}) {
  const safeSourcePath = params.sourcePath.trim();
  const safeFallbackUrl = params.fallbackImageUrl.trim();
  if (!safeSourcePath) {
    return {
      imagePath: "",
      imageUrl: safeFallbackUrl,
    };
  }

  if (safeSourcePath.startsWith("creator-posters/")) {
    return {
      imagePath: safeSourcePath,
      imageUrl: safeFallbackUrl,
    };
  }

  const bucket = adminStorage.bucket();
  const sourceFile = bucket.file(safeSourcePath);
  const [buffer, metadata] = await Promise.all([
    sourceFile.download().then((parts) => parts[0]),
    sourceFile.getMetadata().then((parts) => parts[0]),
  ]);
  const contentType = String(metadata.contentType ?? "image/jpeg").trim() || "image/jpeg";
  const extension = inferImageExtension(contentType);
  const destinationPath = `creator-posters/community_user/${params.posterId}/poster${extension}`;
  const uploaded = await uploadAdminAsset(buffer, contentType, destinationPath);
  return {
    imagePath: uploaded.filePath,
    imageUrl: uploaded.imageUrl,
  };
}

export function buildUserUploadHistoryEntry(params: {
  type: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  reason?: string;
}) {
  return {
    type: params.type,
    actorId: params.actorId,
    actorRole: params.actorRole,
    actorName: params.actorName,
    reason: params.reason ?? "",
    createdAt: Date.now(),
  };
}

export function buildUserUploadApprovalWrite(params: {
  uploadId: string;
  posterId: string;
  userName: string;
  userEmail: string;
  userMobile: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string;
  imagePath: string;
  approvedAt: number;
  publishAt: number;
  eventStartAt: number;
  eventEndAt: number;
  personalizationConfig: Record<string, unknown>;
}) {
  return {
    id: params.posterId,
    title: `${params.userName} contribution`,
    creatorPublicId: "community_user",
    creatorName: params.userName,
    creatorEmail: params.userEmail,
    creatorPhone: params.userMobile,
    categoryId: params.categoryId,
    categoryLabel: params.categoryLabel,
    imageUrl: params.imageUrl,
    imagePath: params.imagePath,
    mediaType: "image",
    status: "approved",
    reviewComment: "Approved from user contribution queue.",
    createdAt: params.approvedAt,
    updatedAt: params.approvedAt,
    approvedAt: params.approvedAt,
    publishAt: params.publishAt,
    eventStartAt: params.eventStartAt,
    eventEndAt: params.eventEndAt,
    performanceWindowStartAt: params.publishAt,
    performanceWindowEndAt:
      params.eventEndAt > 0 && params.eventEndAt >= params.publishAt
        ? params.eventEndAt
        : params.publishAt + 24 * 60 * 60 * 1000,
    createdByRole: "manager",
    createdBySurface: "user_upload_review",
    sourceUploadId: params.uploadId,
    saleCount: 0,
    grossAmount: 0,
    creatorEarnings: 0,
    platformEarnings: 0,
    shareCount: 0,
    downloadCount: 0,
    personalizationConfig: params.personalizationConfig,
    reviewHistory: FieldValue.arrayUnion({
      type: "approved",
      actorRole: "manager",
      actorId: "user_upload_review",
      actorName: "User Upload Review",
      comment: "Approved from community upload queue.",
      createdAt: params.approvedAt,
    }),
  };
}

export function buildNewApprovedPosterId() {
  return randomUUID();
}
