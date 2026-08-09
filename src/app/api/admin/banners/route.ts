import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { loadAppBanners, uploadAdminAsset } from "@/lib/server/content-management";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import {
  assertActorCanManageBannerTarget,
  filterBannersForActor,
} from "@/lib/server/banner-region-scope";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

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

function regionMetadataForIds(regionIds: string[]) {
  const regions = regionIds
    .map((id) => DASHBOARD_REGIONS.find((item) => item.id === id))
    .filter(Boolean) as typeof DASHBOARD_REGIONS;
  return {
    regionIds: regions.map((item) => item.id),
    regionNames: regions.map((item) => item.name),
  };
}

function bannerMatchesRegion(
  banner: { targetRegionIds?: string[]; targetState?: string },
  region: { id: string; name: string },
) {
  const regionIds = Array.isArray(banner.targetRegionIds)
    ? banner.targetRegionIds.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  if (regionIds.length > 0) {
    return regionIds.includes(region.id);
  }
  return String(banner.targetState ?? "").trim() === region.name;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const regionId = req.nextUrl.searchParams.get("regionId");
    const banners = await loadAppBanners();
    const scopedBanners = await filterBannersForActor(actor, banners);
    if (!regionId) {
      return NextResponse.json({ ok: true, banners: scopedBanners });
    }
    const targetRegion = await assertActorCanAccessRegion(actor, regionId);
    return NextResponse.json({
      ok: true,
      banners: scopedBanners.filter((banner) => bannerMatchesRegion(banner, targetRegion)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load banners.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const ctaLabel = String(formData.get("ctaLabel") ?? "").trim();
    const ctaTarget = String(formData.get("ctaTarget") ?? "").trim();
    const placement = String(formData.get("placement") ?? "home_category_banner").trim();
    const targetRegionIds = parseTargetRegionIds(formData.get("targetRegionIds"));
    const targetReligions = parseTargetReligions(formData.get("targetReligions"));
    const promoCardGroup = parsePromoCardGroup(formData.get("promoCardGroup"));
    const targetState = String(formData.get("targetState") ?? "").trim();
    const targetDistrict = String(formData.get("targetDistrict") ?? "").trim();
    const targetCity = String(formData.get("targetCity") ?? "").trim();
    const active = String(formData.get("active") ?? "true").trim() !== "false";
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const image = formData.get("image");

    if (!title) {
      return NextResponse.json({ ok: false, error: "Banner title is required." }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ ok: false, error: "Banner image is required." }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be 500 KB or smaller." }, { status: 400 });
    }
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

    const now = Date.now();
    const ext = image.type.includes("jpeg") ? "jpg" : image.type.includes("webp") ? "webp" : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `portal_assets/app_banners/${now}.${ext}`,
    );

    const ref = adminDb.collection("appBanners").doc();
    await ref.set({
      id: ref.id,
      title,
      subtitle,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
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
      createdAt: now,
      updatedAt: now,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.banner.create",
      targetId: ref.id,
      targetType: "appBanner",
      message: `Created app banner: ${title}`,
      metadata: regionMetadata,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create banner.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
