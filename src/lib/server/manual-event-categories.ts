import { adminDb } from "@/lib/firebase/admin";
import {
  readCategoryLabelsByLanguage,
  type CategoryLabelsByLanguage,
} from "@/lib/server/category-label-translations";
import type { CategoryDef, VisibleCategoryDef } from "./categories";
import {
  getIstEndOfDay,
  getIstStartOfDay,
  parseIstDateKeyToEpoch,
} from "@/lib/server/ist-schedule";

const COLLECTION_NAME = "manualEventCategories";
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_LEAD_DAYS = 7;
const APP_PUBLISH_LEAD_DAYS = 3;

export interface ManualEventCategoryRecord {
  id: string;
  label: string;
  labelsByLanguage: CategoryLabelsByLanguage;
  iconAssetPath: string;
  regionId: string;
  regionIds: string[];
  regionName: string;
  startAt: number;
  endAt: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  createdByRole: string;
}

export function normalizeManualEventCategoryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function generateManualEventCategoryId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `manual_event_${timePart}_${randomPart}`;
}

export function parseIsoDateInput(value: string): number {
  const normalized = value.trim();
  const parsed = parseIstDateKeyToEpoch(normalized);
  if (parsed == null) {
    throw new Error("Invalid date.");
  }
  return parsed;
}

export function normalizeManualEventDateRange(
  startAt: number,
  endAt?: number,
): { startAt: number; endAt: number } {
  const normalizedStart = getIstStartOfDay(startAt);
  const candidateEnd = endAt != null ? endAt : startAt;
  const normalizedEnd = Math.max(normalizedStart, getIstEndOfDay(candidateEnd));
  return {
    startAt: normalizedStart,
    endAt: normalizedEnd,
  };
}

export function getManualDashboardVisibleAt(startAt: number): number {
  return getIstStartOfDay(startAt) - DASHBOARD_LEAD_DAYS * DAY_MS;
}

export function getManualAppPublishAt(startAt: number): number {
  return Math.max(
    0,
    getIstStartOfDay(startAt) - APP_PUBLISH_LEAD_DAYS * DAY_MS,
  );
}

function mapRecord(
  id: string,
  data: Record<string, unknown>,
): ManualEventCategoryRecord {
  const regionId = String(data.regionId ?? "").trim();
  const regionIds = Array.isArray(data.regionIds)
    ? data.regionIds.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  const normalized = normalizeManualEventDateRange(
    Number(data.startAt ?? 0),
    Number(data.endAt ?? data.startAt ?? 0),
  );
  return {
    id,
    label: String(data.label ?? id),
    labelsByLanguage: readCategoryLabelsByLanguage(data.labelsByLanguage),
    iconAssetPath: String(data.iconAssetPath ?? "").trim(),
    regionId,
    regionIds:
      regionIds.length > 0
        ? Array.from(new Set(regionIds))
        : regionId
          ? [regionId]
          : [],
    regionName: String(data.regionName ?? "").trim(),
    startAt: normalized.startAt,
    endAt: normalized.endAt,
    active: Boolean(data.active ?? true),
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    createdByUid: String(data.createdByUid ?? ""),
    createdByRole: String(data.createdByRole ?? ""),
  };
}

function formatEventDateLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export async function listManualEventCategories(
  regionId?: string | null,
): Promise<ManualEventCategoryRecord[]> {
  const selectedRegionId = String(regionId ?? "").trim();
  const teluguSharedRegionIds = new Set(["andhra_pradesh", "telangana"]);
  const hindiSharedRegionIds = new Set([
    "bihar",
    "chhattisgarh",
    "haryana",
    "himachal_pradesh",
    "jharkhand",
    "madhya_pradesh",
    "rajasthan",
    "uttar_pradesh",
    "uttarakhand",
    "delhi",
    "andaman_nicobar",
  ]);
  const sharedRegionIdsFor = (value: string) => {
    if (teluguSharedRegionIds.has(value)) return teluguSharedRegionIds;
    if (hindiSharedRegionIds.has(value)) return hindiSharedRegionIds;
    return new Set(value ? [value] : []);
  };
  const matchesRegion = (item: ManualEventCategoryRecord) => {
    const itemRegionIds =
      item.regionIds.length > 0
        ? item.regionIds
        : item.regionId
          ? [item.regionId]
          : [];
    if (!selectedRegionId || itemRegionIds.length === 0) return true;
    const selectedSharedRegionIds = sharedRegionIdsFor(selectedRegionId);
    return itemRegionIds.some((itemRegionId) =>
      selectedSharedRegionIds.has(itemRegionId),
    );
  };
  const snapshot = await adminDb.collection(COLLECTION_NAME).get();
  return snapshot.docs
    .map((doc) => mapRecord(doc.id, doc.data()))
    .filter((item) => matchesRegion(item))
    .sort(
      (left, right) =>
        left.startAt - right.startAt || left.label.localeCompare(right.label),
    );
}

export async function getManualEventCategoryById(
  categoryId: string,
  regionId?: string | null,
): Promise<ManualEventCategoryRecord | null> {
  const normalized = categoryId.trim();
  if (!normalized) {
    return null;
  }
  const snap = await adminDb.collection(COLLECTION_NAME).doc(normalized).get();
  if (!snap.exists) {
    return null;
  }
  const item = mapRecord(snap.id, snap.data() as Record<string, unknown>);
  const selectedRegionId = String(regionId ?? "").trim();
  const teluguSharedRegionIds = new Set(["andhra_pradesh", "telangana"]);
  const hindiSharedRegionIds = new Set([
    "bihar",
    "chhattisgarh",
    "haryana",
    "himachal_pradesh",
    "jharkhand",
    "madhya_pradesh",
    "rajasthan",
    "uttar_pradesh",
    "uttarakhand",
    "delhi",
    "andaman_nicobar",
  ]);
  const sharedRegionIds = teluguSharedRegionIds.has(selectedRegionId)
    ? teluguSharedRegionIds
    : hindiSharedRegionIds.has(selectedRegionId)
      ? hindiSharedRegionIds
      : new Set(selectedRegionId ? [selectedRegionId] : []);
  const itemRegionIds =
    item.regionIds.length > 0
      ? item.regionIds
      : item.regionId
        ? [item.regionId]
        : [];
  if (
    selectedRegionId &&
    itemRegionIds.length > 0 &&
    !itemRegionIds.some((regionId) => sharedRegionIds.has(regionId))
  ) {
    return null;
  }
  return item;
}

export function toVisibleManualEventCategory(
  item: ManualEventCategoryRecord,
  now: number = Date.now(),
): VisibleCategoryDef | null {
  if (!item.active) {
    return null;
  }
  const visibleAt = getManualDashboardVisibleAt(item.startAt);
  if (now < visibleAt || now > item.endAt) {
    return null;
  }
  return {
    id: item.id,
    label: item.label,
    labelsByLanguage: item.labelsByLanguage,
    iconAssetPath: item.iconAssetPath,
    regionIds: item.regionIds,
    isDynamic: true,
    isBlinking: now >= getManualAppPublishAt(item.startAt) && now <= item.endAt,
    eventDateLabel: formatEventDateLabel(item.endAt),
    eventStartAt: item.startAt,
    eventEndAt: item.endAt,
  };
}

export async function listVisibleManualEventCategories(
  now: number = Date.now(),
  regionId?: string | null,
): Promise<VisibleCategoryDef[]> {
  const items = await listManualEventCategories(regionId);
  return items
    .map((item) => toVisibleManualEventCategory(item, now))
    .filter((item): item is VisibleCategoryDef => item != null);
}

export async function isValidManualEventCategoryId(
  categoryId: string,
  regionId?: string | null,
): Promise<boolean> {
  const item = await getManualEventCategoryById(categoryId, regionId);
  return Boolean(item?.active);
}

export function toAssignableManualCategory(
  item: ManualEventCategoryRecord,
): CategoryDef {
  return {
    id: item.id,
    label: item.label,
    labelsByLanguage: item.labelsByLanguage,
    iconAssetPath: item.iconAssetPath,
    regionIds: item.regionIds,
  };
}
