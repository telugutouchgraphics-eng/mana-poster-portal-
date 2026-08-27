import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const SETTINGS_DOC_ID = "portalSettings";
const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function scopedSettingsDocId(regionId: string) {
  return `${SETTINGS_DOC_ID}_${regionId}`;
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveExtension(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  return "mp4";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function targetRegionsFor(
  actor: Awaited<ReturnType<typeof requireRole>>,
  regionId: string,
  targetRegionIds: string[],
) {
  const fallbackRegion = await assertActorCanAccessRegion(actor, regionId);
  if (!targetRegionIds.length) {
    return [fallbackRegion];
  }
  return Promise.all(
    Array.from(new Set(targetRegionIds)).map((id) => assertActorCanAccessRegion(actor, id)),
  );
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
    const regionId = stringValue(form.get("regionId"));
    const targetRegionIds = stringValue(form.get("targetRegionIds"))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const targetRegions = await targetRegionsFor(actor, regionId, targetRegionIds);
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
    const primaryRegion = targetRegions[0];
    const originalName = sanitizeFileName(video.name || `subscription-video.${resolveExtension(video)}`);
    const path = `${target.folderName}/${primaryRegion.id}/${now}-${originalName}`;
    const buffer = Buffer.from(await video.arrayBuffer());
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

    const pathsToDelete = new Set<string>();
    await Promise.all(
      targetRegions.map(async (region) => {
        const settingsDocId = scopedSettingsDocId(region.id);
        const settingsRef = adminDb.collection("websiteConfig").doc(settingsDocId);
        const existingSnap = await settingsRef.get();
        const existingVideo = existingSnap.data()?.[target.fieldName] as
          | { path?: string }
          | undefined;
        if (existingVideo?.path) {
          pathsToDelete.add(existingVideo.path);
        }
        await settingsRef.set(
          {
            regionId: region.id,
            regionName: region.name,
            [target.fieldName]: subscriptionVideo,
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
      }),
    );
    await Promise.all(Array.from(pathsToDelete).map((item) => deleteAdminAsset(item)));

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: target.action,
      targetId: scopedSettingsDocId(primaryRegion.id),
      targetType: "websiteConfig",
      message: target.message,
      metadata: {
        regionIds: targetRegions.map((region) => region.id),
        regionNames: targetRegions.map((region) => region.name),
      },
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
    const url = new URL(req.url);
    const regionId = stringValue(url.searchParams.get("regionId"));
    const targetRegionIds = url.searchParams
      .getAll("targetRegionIds")
      .map((item) => item.trim())
      .filter(Boolean);
    const targetRegions = await targetRegionsFor(actor, regionId, targetRegionIds);
    const target = resolveVideoTarget(url.searchParams.get("type"));
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

    const pathsToDelete = new Set<string>();
    await Promise.all(
      targetRegions.map(async (region) => {
        const settingsRef = adminDb.collection("websiteConfig").doc(scopedSettingsDocId(region.id));
        const settingsSnap = await settingsRef.get();
        const existingVideo = settingsSnap.data()?.[target.fieldName] as
          | { path?: string; url?: string; fileName?: string }
          | undefined;
        if (existingVideo?.path) {
          pathsToDelete.add(existingVideo.path);
        }
        await settingsRef.set(
          {
            regionId: region.id,
            regionName: region.name,
            [target.fieldName]: clearedVideo,
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
      }),
    );
    await Promise.all(Array.from(pathsToDelete).map((item) => deleteAdminAsset(item)));

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: target.deleteAction,
      targetId: scopedSettingsDocId(targetRegions[0].id),
      targetType: "websiteConfig",
      message: target.deleteMessage,
      metadata: { regionIds: targetRegions.map((region) => region.id) },
    });

    return NextResponse.json({ ok: true, subscriptionVideo: clearedVideo, type: target.fieldName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete subscription video.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
