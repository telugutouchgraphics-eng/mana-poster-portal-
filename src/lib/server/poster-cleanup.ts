import { adminDb } from "@/lib/firebase/admin";
import { deleteAdminAsset } from "@/lib/server/content-management";
import {
  getIstStartOfDay,
  getNextIstMidnight,
} from "@/lib/server/ist-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const REGULAR_RETENTION_MS = 7 * DAY_MS;

export type ExpiryReason =
  | "today_special_next_day"
  | "weekday_next_day"
  | "dynamic_event_ended"
  | "regular_7_days_exceeded"
  | "invalid_timestamp";

export interface ExpiryCheckResult {
  expired: boolean;
  reason?: ExpiryReason;
  effectiveTime: number;
}

export function evaluatePosterExpiry(
  data: Record<string, unknown>,
  now: number = Date.now(),
): ExpiryCheckResult {
  const categoryId = String(data.categoryId ?? "").trim().toLowerCase();
  const dynamicCategoryId = String(data.dynamicCategoryId ?? "").trim().toLowerCase();
  const eventEndAt = typeof data.eventEndAt === "number" ? data.eventEndAt : 0;

  const effectiveTime =
    typeof data.publishAt === "number" && data.publishAt > 0
      ? data.publishAt
      : typeof data.requestedPublishAt === "number" && data.requestedPublishAt > 0
      ? data.requestedPublishAt
      : typeof data.createdAt === "number" && data.createdAt > 0
      ? data.createdAt
      : 0;

  const isTodaySpecial =
    categoryId === "today_special" || dynamicCategoryId === "today_special";

  const isWeekdaySpecial =
    categoryId.startsWith("weekday_") || dynamicCategoryId.startsWith("weekday_");

  const isDynamicEvent =
    eventEndAt > 0 ||
    (Boolean(dynamicCategoryId) &&
      dynamicCategoryId !== "today_special" &&
      !dynamicCategoryId.startsWith("weekday_"));

  // Rule 1: Today Special & Weekday Specials:
  // Visible during their specific day. Must be deleted once the next day starts (00:00 IST).
  if (isTodaySpecial || isWeekdaySpecial) {
    if (effectiveTime <= 0) {
      return { expired: true, reason: "invalid_timestamp", effectiveTime };
    }
    const todayStartIst = getIstStartOfDay(now);
    const posterDayStartIst = getIstStartOfDay(effectiveTime);
    if (todayStartIst > posterDayStartIst) {
      return {
        expired: true,
        reason: isTodaySpecial ? "today_special_next_day" : "weekday_next_day",
        effectiveTime,
      };
    }
    if (eventEndAt > 0 && now > eventEndAt) {
      return {
        expired: true,
        reason: isTodaySpecial ? "today_special_next_day" : "weekday_next_day",
        effectiveTime,
      };
    }
    return { expired: false, effectiveTime };
  }

  // Rule 2: Dynamic Events (Festivals, Jayanthi, Holidays, Manual dynamic events):
  // Visible until the event day ends. Must be deleted as soon as the event concludes.
  if (isDynamicEvent) {
    if (eventEndAt > 0) {
      if (now > eventEndAt) {
        return { expired: true, reason: "dynamic_event_ended", effectiveTime };
      }
      return { expired: false, effectiveTime };
    }
    if (effectiveTime > 0) {
      const fallbackEndAt = getNextIstMidnight(effectiveTime) - 1;
      if (now > fallbackEndAt) {
        return { expired: true, reason: "dynamic_event_ended", effectiveTime };
      }
      return { expired: false, effectiveTime };
    }
    return { expired: true, reason: "invalid_timestamp", effectiveTime };
  }

  // Rule 3: Remaining Categories (Good Morning, Devotional, Birthdays, Jokes, etc.):
  // 7 days rolling retention from effective time.
  // After 7 days, must be deleted permanently from backend and app.
  if (effectiveTime <= 0) {
    return { expired: true, reason: "invalid_timestamp", effectiveTime };
  }
  if (now - effectiveTime >= REGULAR_RETENTION_MS) {
    return { expired: true, reason: "regular_7_days_exceeded", effectiveTime };
  }

  return { expired: false, effectiveTime };
}

export interface CleanupResult {
  ok: boolean;
  scannedCount: number;
  deletedCount: number;
  deletedIds: string[];
  reasons: Record<string, number>;
  errors: string[];
}

export async function cleanupExpiredPosters(
  options?: { dryRun?: boolean; maxDeletions?: number },
): Promise<CleanupResult> {
  const isDryRun = Boolean(options?.dryRun);
  const maxDeletions = options?.maxDeletions ?? 500;
  const now = Date.now();

  const snap = await adminDb.collection("creatorPosters").get();
  const deletedIds: string[] = [];
  const reasons: Record<string, number> = {
    today_special_next_day: 0,
    weekday_next_day: 0,
    dynamic_event_ended: 0,
    regular_7_days_exceeded: 0,
    invalid_timestamp: 0,
  };
  const errors: string[] = [];

  for (const doc of snap.docs) {
    if (deletedIds.length >= maxDeletions) {
      break;
    }

    const data = doc.data() as Record<string, unknown>;
    const evaluation = evaluatePosterExpiry(data, now);

    if (evaluation.expired) {
      const reasonKey = evaluation.reason ?? "invalid_timestamp";
      reasons[reasonKey] = (reasons[reasonKey] ?? 0) + 1;
      deletedIds.push(doc.id);

      if (!isDryRun) {
        // Collect Storage file paths to delete permanently
        const filePaths = new Set<string>();
        if (typeof data.imagePath === "string" && data.imagePath.trim()) {
          filePaths.add(data.imagePath.trim());
        }
        if (typeof data.videoPath === "string" && data.videoPath.trim()) {
          filePaths.add(data.videoPath.trim());
        }
        if (
          typeof data.thumbnailStoragePath === "string" &&
          data.thumbnailStoragePath.trim()
        ) {
          filePaths.add(data.thumbnailStoragePath.trim());
        }
        if (
          typeof data.thumbnailPath === "string" &&
          data.thumbnailPath.trim()
        ) {
          filePaths.add(data.thumbnailPath.trim());
        }

        // 1. Delete associated Cloud Storage assets
        for (const path of filePaths) {
          try {
            await deleteAdminAsset(path);
          } catch (storageErr) {
            const errStr = `Storage delete error (${doc.id}, ${path}): ${
              storageErr instanceof Error ? storageErr.message : String(storageErr)
            }`;
            console.error(errStr);
            errors.push(errStr);
          }
        }

        // 2. Permanently delete Firestore document
        try {
          await doc.ref.delete();
        } catch (dbErr) {
          const errStr = `Firestore delete error (${doc.id}): ${
            dbErr instanceof Error ? dbErr.message : String(dbErr)
          }`;
          console.error(errStr);
          errors.push(errStr);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    scannedCount: snap.docs.length,
    deletedCount: deletedIds.length,
    deletedIds,
    reasons,
    errors,
  };
}

let lastAutoCleanupRunAt = 0;
const AUTO_CLEANUP_THROTTLE_MS = 60 * 60 * 1000; // 1 hour throttle

export function triggerThrottledPosterCleanup(): void {
  const now = Date.now();
  if (now - lastAutoCleanupRunAt < AUTO_CLEANUP_THROTTLE_MS) {
    return;
  }
  lastAutoCleanupRunAt = now;
  // Non-blocking fire and forget
  cleanupExpiredPosters().catch((error) => {
    console.error("Background throttled poster cleanup failed:", error);
  });
}
