import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeRoles } from "@/lib/server/role-utils";
import { filterKnownAssignedCategories } from "@/lib/server/categories";
import { listManualEventCategories } from "@/lib/server/manual-event-categories";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { loadActorAllowedRegionIds, sanitizeDashboardRegionIds } from "@/lib/server/region-scope";

interface RawManagerDoc {
  uid: string;
  role?: string;
  roles?: unknown;
  managerPublicId?: string;
  email?: string;
  name?: string;
  phone?: string;
  managerStatus?: string;
  assignedRegionIds?: unknown;
  createdAt?: number;
  updatedAt?: number;
}

interface RawCreatorDoc {
  creatorPublicId?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  managerUid?: string;
  managerName?: string;
  managerEmail?: string;
  assignedByUid?: string;
  assignedCategories?: string[];
  assignedRegionIds?: unknown;
  createdAt?: number;
  updatedAt?: number;
}

function overlapsAllowedRegions(
  assignedRegionIdsInput: unknown,
  allowedRegionIds: string[],
  actorHasAllRegions: boolean,
) {
  const assignedRegionIds = sanitizeDashboardRegionIds(assignedRegionIdsInput);
  return assignedRegionIds.length === 0
    ? actorHasAllRegions
    : assignedRegionIds.some((regionId) => allowedRegionIds.includes(regionId));
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = (url.searchParams.get("status") ?? "all").trim();
    const actorAllowedRegionIds = await loadActorAllowedRegionIds(actor);
    const actorHasAllRegions = actorAllowedRegionIds.length === DASHBOARD_REGIONS.length;

    const [primaryRoleSnapshot, multiRoleSnapshot, creatorSnapshot, manualCategories] = await Promise.all([
      adminDb.collection("users").where("role", "==", "manager").get(),
      adminDb.collection("users").where("roles", "array-contains", "manager").get(),
      adminDb.collection("creatorProfiles").get(),
      listManualEventCategories(),
    ]);
    const manualCategoryIds = manualCategories.map((item) => item.id);

    const mergedDocs = new Map<string, (typeof primaryRoleSnapshot.docs)[number]>();
    for (const doc of primaryRoleSnapshot.docs) {
      mergedDocs.set(doc.id, doc);
    }
    for (const doc of multiRoleSnapshot.docs) {
      mergedDocs.set(doc.id, doc);
    }

    const creatorsByManager = new Map<
      string,
      Array<{
        creatorPublicId: string;
        name: string;
        email: string;
        phone: string;
        status: string;
        assignedCategoriesCount: number;
        createdAt: number;
        updatedAt: number;
      }>
    >();

    for (const doc of creatorSnapshot.docs) {
      const item = doc.data() as RawCreatorDoc;
      if (!overlapsAllowedRegions(item.assignedRegionIds, actorAllowedRegionIds, actorHasAllRegions)) {
        continue;
      }
      const managerUid = String(item.managerUid ?? item.assignedByUid ?? "").trim();
      if (!managerUid) {
        continue;
      }

      const creators = creatorsByManager.get(managerUid) ?? [];
      const rawAssignedCategories = Array.isArray(item.assignedCategories)
        ? item.assignedCategories.map(String)
        : [];
      const { assignedCategories } = filterKnownAssignedCategories(
        rawAssignedCategories,
        manualCategoryIds,
      );
      creators.push({
        creatorPublicId: String(item.creatorPublicId ?? doc.id),
        name: String(item.name ?? "-"),
        email: String(item.email ?? ""),
        phone: String(item.phone ?? ""),
        status: String(item.status ?? "pending_invite"),
        assignedCategoriesCount: assignedCategories.length,
        createdAt: Number(item.createdAt ?? 0),
        updatedAt: Number(item.updatedAt ?? 0),
      });
      creatorsByManager.set(managerUid, creators);
    }

    const managers = Array.from(mergedDocs.values())
      .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<RawManagerDoc, "uid">) }))
      .filter((item) => {
        const hasManagerRole =
          item.role === "manager" || normalizeRoles(item.roles).includes("manager");
        if (!hasManagerRole) {
          return false;
        }

        const hasVisibleIdentity =
          String(item.name ?? "").trim().length > 0 ||
          String(item.email ?? "").trim().length > 0;
        if (!hasVisibleIdentity) {
          return false;
        }

        const normalizedStatus = String(item.managerStatus ?? "active");
        if (status !== "all" && normalizedStatus !== status) {
          return false;
        }
        if (!overlapsAllowedRegions(item.assignedRegionIds, actorAllowedRegionIds, actorHasAllRegions)) {
          return false;
        }

        const creators = creatorsByManager.get(String(item.uid)) ?? [];
        if (!q) {
          return true;
        }

        const managerSearch = [
          item.uid,
          item.managerPublicId,
          item.email,
          item.name,
          item.phone,
          normalizedStatus,
        ]
          .join(" ")
          .toLowerCase();
        if (managerSearch.includes(q)) {
          return true;
        }

        return creators.some((creator) =>
          [
            creator.creatorPublicId,
            creator.name,
            creator.email,
            creator.phone,
            creator.status,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );
      })
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .map((item) => {
        const creators = (creatorsByManager.get(String(item.uid)) ?? []).sort(
          (a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0),
        );

        return {
          uid: String(item.uid),
          managerPublicId: String(item.managerPublicId ?? ""),
          email: String(item.email ?? ""),
          name: String(item.name ?? ""),
          phone: String(item.phone ?? ""),
          managerStatus: String(item.managerStatus ?? "active"),
          creatorCount: creators.length,
          creators,
        };
      });

    return NextResponse.json({ ok: true, managers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load manager creator summary.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
