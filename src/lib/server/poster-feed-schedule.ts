import { getManualAppPublishAt } from "@/lib/server/manual-event-categories";

/** App home feed: posters appear no earlier than 3 days before event start. */
export const POSTER_FEED_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Earliest instant the poster may appear in the app feed:
 * max(eventStart − 3 days, approval/upload time).
 * After event day, uploads still go live from approval time until eventEnd (Flutter).
 */
export function resolveFeedPublishAtMs(eventStartAt: number, approvalOrUploadMs: number): number {
  if (eventStartAt <= 0) {
    return 0;
  }
  const earliestVisible = eventStartAt - POSTER_FEED_LEAD_MS;
  return Math.max(earliestVisible, approvalOrUploadMs);
}

/** Manual Firestore event categories use IST day-aligned start + same 3-day lead as portal. */
export function resolveManualFeedPublishAtMs(
  manualStartAt: number,
  approvalOrUploadMs: number,
): number {
  const earliestVisible = getManualAppPublishAt(manualStartAt);
  return Math.max(earliestVisible, approvalOrUploadMs);
}
