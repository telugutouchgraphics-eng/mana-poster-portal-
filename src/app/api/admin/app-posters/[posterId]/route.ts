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
import { getNextIstMidnight, getNextIstWeekdayStart } from "@/lib/server/ist-schedule";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const payloadSchema = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1),
});

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

async function resolveAdminPosterSchedule(
  categoryId: string,
  now: number,
  _uploadSource: string | undefined,
) {
  const weekday = getWeekdayForCategoryId(categoryId);
  if (weekday) {
    const scheduledStart = getNextIstWeekdayStart(now, weekday);
    return {
      publishAt: 0,
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
  return {
    publishAt: 0,
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
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json({ ok: false, error: "Only admin app posters can be edited." }, { status: 403 });
    }

    const formData = await req.formData();
    const parsed = payloadSchema.parse({
      title: formData.get("title"),
      categoryId: formData.get("categoryId"),
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

    const updatedAt = Date.now();
    const uploadSource = existing.storageFolderKey ?? existing.createdBySurface;
    const schedule = await resolveAdminPosterSchedule(parsed.categoryId, updatedAt, uploadSource);
    await posterRef.set(
      {
        title: parsed.title,
        categoryId: parsed.categoryId,
        categoryLabel: category.label,
        publishAt: schedule.publishAt,
        eventStartAt: schedule.eventStartAt,
        eventEndAt: schedule.eventEndAt,
        dynamicCategoryId: schedule.dynamicCategoryId,
        dynamicCategoryLabel: schedule.dynamicCategoryLabel,
        performanceWindowStartAt: schedule.publishAt || updatedAt,
        performanceWindowEndAt: (schedule.publishAt || updatedAt) + 24 * 60 * 60 * 1000,
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
    };
    if (existing.createdByRole !== "admin") {
      return NextResponse.json({ ok: false, error: "Only admin app posters can be deleted." }, { status: 403 });
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
