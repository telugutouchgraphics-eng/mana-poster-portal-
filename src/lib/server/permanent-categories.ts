import { adminDb } from "@/lib/firebase/admin";
import {
  readCategoryLabelsByLanguage,
  type CategoryLabelsByLanguage,
} from "@/lib/server/category-label-translations";
import type { CategoryDef } from "./categories";

const COLLECTION_NAME = "permanentCategories";

export interface PermanentCategoryRecord extends CategoryDef {
  labelsByLanguage: CategoryLabelsByLanguage;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  createdByRole: string;
}

export function normalizePermanentCategoryId(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!base) {
    return "";
  }
  return base.startsWith("perm_") ? base : `perm_${base}`;
}

export function generatePermanentCategoryId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `perm_${timePart}_${randomPart}`;
}

function mapRecord(
  id: string,
  data: Record<string, unknown>,
): PermanentCategoryRecord {
  const regionIds = Array.isArray(data.regionIds)
    ? Array.from(
        new Set(
          data.regionIds
            .map((item) => String(item ?? "").trim())
            .filter(Boolean),
        ),
      )
    : [];
  return {
    id,
    label: String(data.label ?? id).trim() || id,
  labelsByLanguage: readCategoryLabelsByLanguage(data.labelsByLanguage),
  iconAssetPath: String(data.iconAssetPath ?? "").trim(),
  regionIds,
  allowPoliticalProtocol: Boolean(data.allowPoliticalProtocol ?? false),
  active: Boolean(data.active ?? true),
    sortOrder: Number(data.sortOrder ?? 0),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    createdByUid: String(data.createdByUid ?? ""),
    createdByRole: String(data.createdByRole ?? ""),
  };
}

export async function listPermanentCategories(options?: {
  includeInactive?: boolean;
  regionId?: string | null;
}): Promise<PermanentCategoryRecord[]> {
  const includeInactive = Boolean(options?.includeInactive);
  const regionId = options?.regionId?.trim() ?? "";
  const snapshot = await adminDb.collection(COLLECTION_NAME).get();
  return snapshot.docs
    .map((doc) => mapRecord(doc.id, doc.data()))
    .filter((item) => includeInactive || item.active)
    .filter((item) => {
      const itemRegionIds = item.regionIds ?? [];
      return (
        !regionId ||
        itemRegionIds.length === 0 ||
        itemRegionIds.includes(regionId)
      );
    })
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.label.localeCompare(right.label),
    );
}

export async function listActivePermanentCategories(
  regionId?: string | null,
): Promise<PermanentCategoryRecord[]> {
  return listPermanentCategories({ includeInactive: false, regionId });
}

export async function getPermanentCategoryById(
  categoryId: string,
  options?: { includeInactive?: boolean; regionId?: string | null },
): Promise<PermanentCategoryRecord | null> {
  const normalized = categoryId.trim();
  if (!normalized) {
    return null;
  }
  const snap = await adminDb.collection(COLLECTION_NAME).doc(normalized).get();
  if (!snap.exists) {
    return null;
  }
  const item = mapRecord(snap.id, snap.data() as Record<string, unknown>);
  if (!options?.includeInactive && !item.active) {
    return null;
  }
  const regionId = options?.regionId?.trim() ?? "";
  const itemRegionIds = item.regionIds ?? [];
  if (
    regionId &&
    itemRegionIds.length > 0 &&
    !itemRegionIds.includes(regionId)
  ) {
    return null;
  }
  return item;
}

export async function isValidPermanentCategoryId(
  categoryId: string,
): Promise<boolean> {
  return Boolean(await getPermanentCategoryById(categoryId));
}
