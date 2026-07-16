import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import type { RequestUser } from "@/lib/server/auth";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function regionIdForTargetState(targetState: string): string | null {
  const normalized = normalize(targetState);
  if (!normalized) {
    return null;
  }
  return DASHBOARD_REGIONS.find((region) => normalize(region.name) === normalized)?.id ?? "";
}

function cleanRegionIds(regionIds?: unknown): string[] {
  if (!Array.isArray(regionIds)) {
    return [];
  }
  return regionIds
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function assertValidRegionIds(regionIds: string[]) {
  const knownRegionIds = new Set(DASHBOARD_REGIONS.map((region) => region.id));
  if (regionIds.some((regionId) => !knownRegionIds.has(regionId))) {
    throw new Error("Valid State / UT target is required.");
  }
}

export async function assertActorCanManageBannerTarget(
  actor: RequestUser,
  targetState: string,
  targetRegionIds?: string[],
) {
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const hasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
  const regionIds = cleanRegionIds(targetRegionIds);
  if (regionIds.length > 0) {
    assertValidRegionIds(regionIds);
    if (hasAllRegions || regionIds.every((regionId) => allowedRegionIds.includes(regionId))) {
      return;
    }
    throw new Error("Forbidden");
  }
  const targetRegionId = regionIdForTargetState(targetState);

  if (targetRegionId === null) {
    if (hasAllRegions) {
      return;
    }
    throw new Error("Forbidden");
  }

  if (targetRegionId && allowedRegionIds.includes(targetRegionId)) {
    return;
  }

  throw new Error("Forbidden");
}

export async function filterBannersForActor<T extends { targetState?: string; targetRegionIds?: string[] }>(
  actor: RequestUser,
  banners: T[],
): Promise<T[]> {
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const hasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
  if (hasAllRegions) {
    return banners;
  }

  return banners.filter((banner) => {
    const regionIds = cleanRegionIds(banner.targetRegionIds);
    if (regionIds.length > 0) {
      return regionIds.some((regionId) => allowedRegionIds.includes(regionId));
    }
    const targetRegionId = regionIdForTargetState(String(banner.targetState ?? ""));
    return Boolean(targetRegionId && allowedRegionIds.includes(targetRegionId));
  });
}
