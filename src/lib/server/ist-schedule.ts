const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function shiftedDate(epochMs: number) {
  return new Date(epochMs + IST_OFFSET_MINUTES * MINUTE_MS);
}

export function getIstDayKey(epochMs: number): string {
  const date = shiftedDate(epochMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getIstHour(epochMs: number): number {
  return shiftedDate(epochMs).getUTCHours();
}

export function getIstMinute(epochMs: number): number {
  return shiftedDate(epochMs).getUTCMinutes();
}

export function getIstStartOfDay(epochMs: number): number {
  const date = shiftedDate(epochMs);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - IST_OFFSET_MINUTES * MINUTE_MS;
}

export function getNextIstMidnight(epochMs: number): number {
  return getIstStartOfDay(epochMs) + DAY_MS;
}

/**
 * IST midnight at the start of the target weekday.
 * If today is already that weekday, returns today's midnight (same day), not next week's.
 */
export function getNextIstWeekdayStart(
  epochMs: number,
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): number {
  const startOfDay = getIstStartOfDay(epochMs);
  const shifted = shiftedDate(startOfDay);
  const todayWeekday = ((shifted.getUTCDay() + 6) % 7) + 1;
  let daysAhead = weekday - todayWeekday;
  if (daysAhead < 0) {
    daysAhead += 7;
  }
  return startOfDay + daysAhead * DAY_MS;
}

export function isCreatorUploadWindowOpen(epochMs: number): boolean {
  const hour = getIstHour(epochMs);
  return hour < 22;
}

export function buildCreatorUploadWindow(epochMs: number) {
  const isOpen = isCreatorUploadWindowOpen(epochMs);
  return {
    isOpen,
    closesAt: getIstStartOfDay(epochMs) + 22 * 60 * 60 * 1000,
    opensAt: isOpen ? getNextIstMidnight(epochMs) : getNextIstMidnight(epochMs),
    cutoffLabel: "10:00 PM",
    dayKey: getIstDayKey(epochMs),
  };
}

export function getPosterPublishAt(uploadedAt: number, approvedAt: number): number {
  const nextMidnight = getNextIstMidnight(uploadedAt);
  return Math.max(nextMidnight, approvedAt);
}
