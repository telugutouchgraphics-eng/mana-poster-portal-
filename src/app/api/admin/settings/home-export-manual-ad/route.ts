import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import { adminDb } from "@/lib/firebase/admin";

const SETTINGS_DOC_ID = "portalSettings";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function scopedSettingsDocId(regionId: string) {
  return `${SETTINGS_DOC_ID}_${regionId}`;
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveExtension(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("webm")) return "webm";
  if (type.includes("quicktime")) return "mov";
  if (type.includes("mp4")) return "mp4";
  return "jpg";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function targetRegionsFor(actor: Awaited<ReturnType<typeof requireRole>>, regionId: string, targetRegionIds: string[]) {
  const fallbackRegion = await assertActorCanAccessRegion(actor, regionId);
  if (!targetRegionIds.length) {
    return [fallbackRegion];
  }
  return Promise.all(
    Array.from(new Set(targetRegionIds)).map((id) => assertActorCanAccessRegion(actor, id)),
  );
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
    const media = form.get("media");
    if (!(media instanceof File)) {
      return NextResponse.json({ ok: false, error: "Image or video file is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(media.type)) {
      return NextResponse.json({ ok: false, error: "Only JPG, PNG, WEBP, MP4, WEBM, or MOV files are allowed." }, { status: 400 });
    }
    if (media.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Manual ad file must be 20 MB or smaller." }, { status: 400 });
    }

    const now = Date.now();
    const primaryRegion = targetRegions[0];
    const originalName = sanitizeFileName(media.name || `home-export-manual-ad.${resolveExtension(media)}`);
    const path = `home_export_manual_ads/${primaryRegion.id}/${now}-${originalName}`;
    const buffer = Buffer.from(await media.arrayBuffer());
    const uploaded = await uploadAdminAsset(buffer, media.type, path);
    const manualAd = {
      active: true,
      url: uploaded.imageUrl,
      path: uploaded.filePath,
      contentType: media.type,
      fileName: originalName,
      updatedAt: now,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };

    await Promise.all(
      targetRegions.map(async (region) => {
        const settingsDocId = scopedSettingsDocId(region.id);
        const settingsRef = adminDb.collection("websiteConfig").doc(settingsDocId);
        const existingSnap = await settingsRef.get();
        const existingManualAd = existingSnap.data()?.ads?.homeExportManualAd as { path?: string } | undefined;
        await settingsRef.set(
          {
            regionId: region.id,
            regionName: region.name,
            ads: {
              ...(existingSnap.data()?.ads || {}),
              homeExportManualAd: manualAd,
            },
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
        await deleteAdminAsset(existingManualAd?.path);
      }),
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.settings.home_export_manual_ad.upload",
      targetId: scopedSettingsDocId(primaryRegion.id),
      targetType: "websiteConfig",
      message: "Uploaded home export manual ad",
      metadata: {
        regionIds: targetRegions.map((region) => region.id),
        contentType: media.type,
      },
    });

    return NextResponse.json({ ok: true, manualAd });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload manual ad.";
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
    const now = Date.now();
    const clearedManualAd = {
      active: false,
      url: "",
      path: "",
      contentType: "",
      fileName: "",
      updatedAt: now,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };

    await Promise.all(
      targetRegions.map(async (region) => {
        const settingsRef = adminDb.collection("websiteConfig").doc(scopedSettingsDocId(region.id));
        const existingSnap = await settingsRef.get();
        const existingManualAd = existingSnap.data()?.ads?.homeExportManualAd as { path?: string } | undefined;
        await settingsRef.set(
          {
            regionId: region.id,
            regionName: region.name,
            ads: {
              ...(existingSnap.data()?.ads || {}),
              homeExportManualAd: clearedManualAd,
            },
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
        await deleteAdminAsset(existingManualAd?.path);
      }),
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.settings.home_export_manual_ad.delete",
      targetId: scopedSettingsDocId(targetRegions[0].id),
      targetType: "websiteConfig",
      message: "Deleted home export manual ad",
      metadata: { regionIds: targetRegions.map((region) => region.id) },
    });

    return NextResponse.json({ ok: true, manualAd: clearedManualAd });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete manual ad.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
