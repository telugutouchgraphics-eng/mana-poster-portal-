import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";

const SETTINGS_DOC_ID = "portalSettings";
const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveExtension(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  return "mp4";
}

function resolveVideoTarget(type: FormDataEntryValue | null) {
  const normalized = String(type ?? "exit").trim();
  if (normalized === "thanks") {
    return {
      fieldName: "subscriptionThanksVideo",
      folderName: "subscription_thanks_videos",
      action: "admin.settings.subscription_thanks_video.upload",
      message: "Uploaded subscription thanks video",
      deleteAction: "admin.settings.subscription_thanks_video.delete",
      deleteMessage: "Deleted subscription thanks video",
    };
  }
  return {
    fieldName: "subscriptionExitVideo",
    folderName: "subscription_exit_videos",
    action: "admin.settings.subscription_video.upload",
    message: "Uploaded subscription exit video",
    deleteAction: "admin.settings.subscription_video.delete",
    deleteMessage: "Deleted subscription exit video",
  };
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const form = await req.formData();
    const video = form.get("video");
    const target = resolveVideoTarget(form.get("type"));
    if (!(video instanceof File)) {
      return NextResponse.json({ ok: false, error: "Video file is required." }, { status: 400 });
    }
    if (!ALLOWED_VIDEO_TYPES.has(video.type)) {
      return NextResponse.json({ ok: false, error: "Only MP4, WEBM, or MOV videos are allowed." }, { status: 400 });
    }
    if (video.size > MAX_VIDEO_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Video must be 20 MB or smaller." }, { status: 400 });
    }

    const now = Date.now();
    const originalName = sanitizeFileName(video.name || `subscription-video.${resolveExtension(video)}`);
    const path = `${target.folderName}/${now}-${originalName}`;
    const buffer = Buffer.from(await video.arrayBuffer());
    const settingsRef = adminDb.collection("websiteConfig").doc(SETTINGS_DOC_ID);
    const existingSnap = await settingsRef.get();
    const existingVideo = existingSnap.data()?.[target.fieldName] as
      | { path?: string }
      | undefined;
    const uploaded = await uploadAdminAsset(buffer, video.type, path);

    const subscriptionVideo = {
      active: true,
      url: uploaded.imageUrl,
      path: uploaded.filePath,
      contentType: video.type,
      fileName: originalName,
      updatedAt: now,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };

    await settingsRef.set(
      {
        [target.fieldName]: subscriptionVideo,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email ?? "",
      },
      { merge: true },
    );
    await deleteAdminAsset(existingVideo?.path);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: target.action,
      targetId: SETTINGS_DOC_ID,
      targetType: "websiteConfig",
      message: target.message,
    });

    return NextResponse.json({ ok: true, subscriptionVideo, type: target.fieldName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload subscription video.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const target = resolveVideoTarget(new URL(req.url).searchParams.get("type"));
    const settingsRef = adminDb.collection("websiteConfig").doc(SETTINGS_DOC_ID);
    const settingsSnap = await settingsRef.get();
    const existingVideo = settingsSnap.data()?.[target.fieldName] as
      | { path?: string; url?: string; fileName?: string }
      | undefined;

    await deleteAdminAsset(existingVideo?.path);

    const now = Date.now();
    const clearedVideo = {
      active: false,
      url: "",
      path: "",
      contentType: "",
      fileName: "",
      updatedAt: now,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };

    await settingsRef.set(
      {
        [target.fieldName]: clearedVideo,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email ?? "",
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: target.deleteAction,
      targetId: SETTINGS_DOC_ID,
      targetType: "websiteConfig",
      message: target.deleteMessage,
    });

    return NextResponse.json({ ok: true, subscriptionVideo: clearedVideo, type: target.fieldName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete subscription video.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
