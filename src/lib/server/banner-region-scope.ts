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

export async function assertActorCanManageBannerTarget(
  actor: RequestUser,
  targetState: string,
) {
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const hasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
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

export async function filterBannersForActor<T extends { targetState?: string }>(
  actor: RequestUser,
  banners: T[],
): Promise<T[]> {
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const hasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
  if (hasAllRegions) {
    return banners;
  }

  return banners.filter((banner) => {
    const targetRegionId = regionIdForTargetState(String(banner.targetState ?? ""));
    return Boolean(targetRegionId && allowedRegionIds.includes(targetRegionId));
  });
}
