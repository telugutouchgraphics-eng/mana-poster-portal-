import { adminDb } from "@/lib/firebase/admin";
import {
  DASHBOARD_REGIONS,
  DashboardRegion,
  getDashboardRegion,
} from "@/lib/dashboard-regions";
import { RequestUser } from "@/lib/server/auth";
import { isPermanentDashboardAdminEmail } from "@/lib/server/permanent-admins";

const ALL_REGION_IDS = DASHBOARD_REGIONS.map((item) => item.id);

export function sanitizeDashboardRegionIds(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  const allowed = new Set(ALL_REGION_IDS);
  return Array.from(
    new Set(
      values
        .map((item) => String(item ?? "").trim())
        .filter((item) => allowed.has(item)),
    ),
  );
}

export async function loadActorAllowedRegionIds(actor: RequestUser): Promise<string[]> {
  const userSnap = await adminDb.collection("users").doc(actor.uid).get();
  const userData = userSnap.data();
  const contactEmail = String(userData?.email ?? actor.email ?? "").trim();

  if (actor.roles.includes("admin") && isPermanentDashboardAdminEmail(contactEmail)) {
    return ALL_REGION_IDS;
  }

  const userRegions = sanitizeDashboardRegionIds(userData?.assignedRegionIds);
  if (userRegions.length > 0) {
    return userRegions;
  }

  const creatorPublicId = String(userData?.creatorPublicId ?? "").trim();
  if (creatorPublicId) {
    const creatorSnap = await adminDb.collection("creatorProfiles").doc(creatorPublicId).get();
    const creatorRegions = sanitizeDashboardRegionIds(creatorSnap.data()?.assignedRegionIds);
    if (creatorRegions.length > 0) {
      return creatorRegions;
    }
  }

  if (actor.roles.includes("admin")) {
    return [];
  }

  // Legacy accounts created before state scoping remain usable until explicit state assignment.
  return ALL_REGION_IDS;
}

export async function assertActorCanAccessRegion(
  actor: RequestUser,
  regionId?: string | null,
): Promise<DashboardRegion> {
  const region = getDashboardRegion(regionId);
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  if (!allowedRegionIds.includes(region.id)) {
    throw new Error("Forbidden");
  }
  return region;
}

export async function assertActorCanAssignRegions(
  actor: RequestUser,
  regionIds: string[],
): Promise<string[]> {
  const sanitized = sanitizeDashboardRegionIds(regionIds);
  if (sanitized.length === 0) {
    throw new Error("Select at least one State / UT.");
  }
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const denied = sanitized.find((regionId) => !allowedRegionIds.includes(regionId));
  if (denied) {
    throw new Error("Forbidden");
  }
  return sanitized;
}

export async function assertRecordOverlapsActorRegions(
  actor: RequestUser,
  data: Record<string, unknown> | undefined,
) {
  const recordRegionIds = sanitizeDashboardRegionIds(data?.assignedRegionIds);
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  if (recordRegionIds.length === 0) {
    if (allowedRegionIds.length === ALL_REGION_IDS.length) {
      return;
    }
    throw new Error("Forbidden");
  }
  if (!recordRegionIds.some((regionId) => allowedRegionIds.includes(regionId))) {
    throw new Error("Forbidden");
  }
}

export function recordAllowsRegion(data: Record<string, unknown>, regionId: string): boolean {
  const assignedRegionIds = sanitizeDashboardRegionIds(data.assignedRegionIds);
  return assignedRegionIds.length === 0 || assignedRegionIds.includes(regionId);
}
