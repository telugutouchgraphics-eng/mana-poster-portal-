import { adminDb } from "@/lib/firebase/admin";
import type { CategoryDef, VisibleCategoryDef } from "./categories";

const COLLECTION_NAME = "manualEventCategories";
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_LEAD_DAYS = 7;
const APP_PUBLISH_LEAD_DAYS = 3;

export interface ManualEventCategoryRecord {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  createdByRole: string;
}

export function parseIsoDateInput(value: string): number {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("Invalid date.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error("Invalid date.");
  }

  return parsed.getTime();
}

function startOfDay(epochMs: number): number {
  const date = new Date(epochMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(epochMs: number): number {
  const date = new Date(epochMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

export function normalizeManualEventDateRange(
  startAt: number,
  endAt?: number,
): { startAt: number; endAt: number } {
  const normalizedStart = startOfDay(startAt);
  const candidateEnd = endAt != null ? endAt : startAt;
  const normalizedEnd = Math.max(normalizedStart, endOfDay(candidateEnd));
  return {
    startAt: normalizedStart,
    endAt: normalizedEnd,
  };
}

export function getManualDashboardVisibleAt(startAt: number): number {
  return startOfDay(startAt) - DASHBOARD_LEAD_DAYS * DAY_MS;
}

export function getManualAppPublishAt(startAt: number): number {
  return Math.max(0, startOfDay(startAt) - APP_PUBLISH_LEAD_DAYS * DAY_MS);
}

function mapRecord(id: string, data: Record<string, unknown>): ManualEventCategoryRecord {
  const normalized = normalizeManualEventDateRange(
    Number(data.startAt ?? 0),
    Number(data.endAt ?? data.startAt ?? 0),
  );
  return {
    id,
    label: String(data.label ?? id),
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

export async function listManualEventCategories(): Promise<ManualEventCategoryRecord[]> {
  const snapshot = await adminDb.collection(COLLECTION_NAME).get();
  return snapshot.docs
    .map((doc) => mapRecord(doc.id, doc.data()))
    .sort((left, right) => left.startAt - right.startAt || left.label.localeCompare(right.label));
}

export async function getManualEventCategoryById(
  categoryId: string,
): Promise<ManualEventCategoryRecord | null> {
  const normalized = categoryId.trim();
  if (!normalized) {
    return null;
  }
  const snap = await adminDb.collection(COLLECTION_NAME).doc(normalized).get();
  if (!snap.exists) {
    return null;
  }
  return mapRecord(snap.id, snap.data() as Record<string, unknown>);
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
    isDynamic: true,
    isBlinking: now >= getManualAppPublishAt(item.startAt) && now <= item.endAt,
    eventDateLabel: formatEventDateLabel(item.startAt),
    eventStartAt: item.startAt,
    eventEndAt: item.endAt,
  };
}

export async function listVisibleManualEventCategories(
  now: number = Date.now(),
): Promise<VisibleCategoryDef[]> {
  const items = await listManualEventCategories();
  return items
    .map((item) => toVisibleManualEventCategory(item, now))
    .filter((item): item is VisibleCategoryDef => item != null);
}

export async function isValidManualEventCategoryId(categoryId: string): Promise<boolean> {
  const item = await getManualEventCategoryById(categoryId);
  return Boolean(item?.active);
}

export function toAssignableManualCategory(item: ManualEventCategoryRecord): CategoryDef {
  return {
    id: item.id,
    label: item.label,
  };
}
