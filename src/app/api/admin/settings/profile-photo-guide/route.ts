import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const SETTINGS_DOC_ID = "portalSettings";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function scopedSettingsDocId(regionId: string) {
  return `${SETTINGS_DOC_ID}_${regionId}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveExtension(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
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

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const form = await req.formData();
    const slot = stringValue(form.get("slot"));
    const regionId = stringValue(form.get("regionId"));
    const targetRegionIds = stringValue(form.get("targetRegionIds"))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (slot !== "good" && slot !== "bad") {
      return NextResponse.json({ ok: false, error: "Guide image slot is required." }, { status: 400 });
    }
    const targetRegions = await targetRegionsFor(actor, regionId, targetRegionIds);
    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Guide image is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ ok: false, error: "Only JPG, PNG, or WEBP images are allowed." }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Guide image must be 5 MB or smaller." }, { status: 400 });
    }

    const now = Date.now();
    const primaryRegion = targetRegions[0];
    const originalName = sanitizeFileName(image.name || `${slot}-profile-guide.${resolveExtension(image)}`);
    const path = `profile_photo_guide/${primaryRegion.id}/${slot}-${now}-${originalName}`;
    const uploaded = await uploadAdminAsset(Buffer.from(await image.arrayBuffer()), image.type, path);
    const imageRecord = {
      active: true,
      url: uploaded.imageUrl,
      path: uploaded.filePath,
      contentType: image.type,
      fileName: originalName,
      updatedAt: now,
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };

    await Promise.all(
      targetRegions.map(async (region) => {
        const settingsRef = adminDb.collection("websiteConfig").doc(scopedSettingsDocId(region.id));
        const existingSnap = await settingsRef.get();
        const existingGuide = existingSnap.data()?.profilePhotoGuide as
          | { goodImage?: { path?: string }; badImage?: { path?: string } }
          | undefined;
        const existingSlot = slot === "good" ? existingGuide?.goodImage : existingGuide?.badImage;
        await settingsRef.set(
          {
            regionId: region.id,
            regionName: region.name,
            profilePhotoGuide: {
              ...(existingGuide || {}),
              [slot === "good" ? "goodImage" : "badImage"]: imageRecord,
            },
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
        await deleteAdminAsset(existingSlot?.path);
      }),
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: `admin.settings.profile_photo_guide.${slot}.upload`,
      targetId: scopedSettingsDocId(primaryRegion.id),
      targetType: "websiteConfig",
      message: `Uploaded ${slot} profile photo guide image`,
      metadata: {
        regionIds: targetRegions.map((region) => region.id),
        contentType: image.type,
      },
    });

    return NextResponse.json({ ok: true, image: imageRecord });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload guide image.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
