import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanManageBannerTarget } from "@/lib/server/banner-region-scope";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;

function regionMetadataForStateName(stateName: string) {
  const normalized = stateName.trim().toLowerCase();
  const region = DASHBOARD_REGIONS.find((item) => item.name.trim().toLowerCase() === normalized);
  return region ? { regionId: region.id, regionName: region.name } : {};
}

function parseTargetRegionIds(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
    }
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function parseTargetReligions(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") {
    return [];
  }
  const allowed = new Set(["all", "hindu", "muslim", "christian"]);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? "").trim().toLowerCase()).filter((item) => allowed.has(item));
    }
  } catch {
    return value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item));
  }
  return [];
}

function parsePromoCardGroup(value: FormDataEntryValue | null): number {
  const numeric = Number(value ?? 1);
  return Number.isFinite(numeric) ? Math.min(3, Math.max(1, Math.trunc(numeric))) : 1;
}

function cleanTargetRegionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function regionMetadataForIds(regionIds: string[]) {
  const regions = regionIds
    .map((id) => DASHBOARD_REGIONS.find((item) => item.id === id))
    .filter(Boolean) as typeof DASHBOARD_REGIONS;
  return {
    regionIds: regions.map((item) => item.id),
    regionNames: regions.map((item) => item.name),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { bannerId } = await params;
    const existingRef = adminDb.collection("appBanners").doc(bannerId);
    const existingSnap = await existingRef.get();
    if (!existingSnap.exists) {
      return NextResponse.json({ ok: false, error: "Banner not found." }, { status: 404 });
    }
    const existingData = existingSnap.data() as {
      imagePath?: string;
      placement?: string;
      targetState?: string;
      targetRegionIds?: string[];
    };
    await assertActorCanManageBannerTarget(
      actor,
      String(existingData.targetState ?? ""),
      cleanTargetRegionIds(existingData.targetRegionIds),
    );
    const existingRegionIds = cleanTargetRegionIds(existingData.targetRegionIds);
    const existingRegionMetadata = existingRegionIds.length > 0
      ? regionMetadataForIds(existingRegionIds)
      : regionMetadataForStateName(String(existingData.targetState ?? ""));
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { active?: boolean; sortOrder?: number };
      await existingRef.set(
        {
          active: typeof body.active === "boolean" ? body.active : true,
          sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
      await writeAuditLog({
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        action: "admin.banner.update",
        targetId: bannerId,
        targetType: "appBanner",
        message: "Updated app banner status/order",
        metadata: existingRegionMetadata,
      });
      return NextResponse.json({ ok: true });
    }

    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
    const ctaTarget = String(formData.get("ctaTarget") ?? "").trim();
    const placement = String(formData.get("placement") ?? existingData.placement ?? "home_category_banner").trim();
    const targetRegionIds = parseTargetRegionIds(formData.get("targetRegionIds"));
    const targetReligions = parseTargetReligions(formData.get("targetReligions"));
    const promoCardGroup = parsePromoCardGroup(formData.get("promoCardGroup"));
    const targetState = String(formData.get("targetState") ?? "").trim();
    const targetDistrict = String(formData.get("targetDistrict") ?? "").trim();
    const targetCity = String(formData.get("targetCity") ?? "").trim();
    const active = String(formData.get("active") ?? "true").trim() !== "false";
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const image = formData.get("image");
    let imageUrl: string | undefined;
    let imagePath: string | undefined;
    const effectiveRegionIds = targetRegionIds.length > 0
      ? targetRegionIds
      : DASHBOARD_REGIONS.filter((item) => item.name === targetState).map((item) => item.id);
    const regionMetadata = targetRegionIds.length > 0
      ? regionMetadataForIds(targetRegionIds)
      : regionMetadataForStateName(targetState);
    if (effectiveRegionIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Valid State / UT target is required." }, { status: 400 });
    }
    await assertActorCanManageBannerTarget(actor, targetState, effectiveRegionIds);

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
        return NextResponse.json({ ok: false, error: "Image must be 500 KB or smaller." }, { status: 400 });
      }
      const now = Date.now();
      const ext = image.type.includes("jpeg") ? "jpg" : image.type.includes("webp") ? "webp" : "png";
      const uploaded = await uploadAdminAsset(
        Buffer.from(await image.arrayBuffer()),
        image.type || "image/png",
        `portal_assets/app_banners/${now}.${ext}`,
      );
      imageUrl = uploaded.imageUrl;
      imagePath = uploaded.filePath;
      await deleteAdminAsset(existingData.imagePath);
    }

    await existingRef.set(
      {
        title,
        subtitle,
        ctaLabel,
        ctaTarget,
        placement,
        targetRegionIds: effectiveRegionIds,
        targetReligions,
        promoCardGroup,
        targetState,
        targetDistrict,
        targetCity,
        active,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
        ...(imageUrl ? { imageUrl } : {}),
        ...(imagePath ? { imagePath } : {}),
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.update",
      targetId: bannerId,
      targetType: "appBanner",
      message: "Updated app banner content",
      metadata: regionMetadata,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bannerId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { bannerId } = await params;
    const ref = adminDb.collection("appBanners").doc(bannerId);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as { imagePath?: string; targetState?: string; targetRegionIds?: string[] }) : null;
    await assertActorCanManageBannerTarget(
      actor,
      String(snap.data()?.targetState ?? ""),
      cleanTargetRegionIds(snap.data()?.targetRegionIds),
    );
    const existingRegionIds = cleanTargetRegionIds(data?.targetRegionIds);
    const existingRegionMetadata = existingRegionIds.length > 0
      ? regionMetadataForIds(existingRegionIds)
      : regionMetadataForStateName(String(data?.targetState ?? ""));
    await ref.delete();
    await deleteAdminAsset(data?.imagePath);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.delete",
      targetId: bannerId,
      targetType: "appBanner",
      message: "Deleted app banner",
      metadata: existingRegionMetadata,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
