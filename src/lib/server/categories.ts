import {
  CSV_FIXED_DYNAMIC_EVENT_CATEGORIES,
  CSV_FLOATING_DYNAMIC_EVENT_CATEGORIES,
  CSV_LUNAR_PLACEHOLDER_CATEGORIES,
  type FloatingDynamicEventCategoryDef,
} from "./dynamic-event-catalog";
import { RESOLVED_LUNAR_EVENT_DATES } from "./dynamic-lunar-event-dates";
import { getIstEndOfDay, getNextIstWeekdayStart } from "./ist-schedule";
import { REGIONAL_DYNAMIC_EVENT_CATEGORIES } from "./regional-dynamic-events";
import { POLITICAL_PARTY_CATEGORIES } from "@/lib/political-party-categories";

export interface CategoryDef {
  id: string;
  label: string;
}

export interface VisibleCategoryDef extends CategoryDef {
  isBlinking?: boolean;
  isDynamic?: boolean;
  eventDateLabel?: string;
  eventStartAt?: number;
  eventEndAt?: number;
}

function formatEventDateLabel(month: number, day: number): string {
  return new Date(2026, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatEpochEventDateLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

// Flutter app HomeScreen static category set ki aligned.
export const PERMANENT_CREATOR_CATEGORIES: CategoryDef[] = [
  { id: "all", label: "All" },
  { id: "good_morning", label: "Good Morning" },
  { id: "good_afternoon", label: "Good Afternoon" },
  { id: "good_night", label: "Good Night" },
  { id: "motivational", label: "Motivational" },
  { id: "love_quotes", label: "Love Quotes" },
  { id: "today_special", label: "Today Special" },
  { id: "birthdays", label: "Birthdays" },
  { id: "life_advice", label: "Life Advice" },
  { id: "gita_wisdom", label: "Gita Wisdom" },
  { id: "devotional", label: "Devotional" },
  { id: "mahabharata", label: "Mahabharata" },
  { id: "anniversary", label: "Anniversary" },
  { id: "good_thoughts", label: "Good Thoughts" },
  { id: "bible", label: "Bible" },
  { id: "islam", label: "Islam" },
  { id: "jokes", label: "Jokes" },
  { id: "new", label: "More" },
];

const DYNAMIC_META_CATEGORIES: CategoryDef[] = [
  { id: "festival", label: "Festival" },
  { id: "jayanthi", label: "Jayanthi" },
  { id: "vardhanthi", label: "Vardhanthi" },
  { id: "important_day", label: "Important Day" },
  { id: "regional_special", label: "Regional Special" },
  { id: "weekday_special", label: "Weekday Special" },
];

const WEEKDAY_DYNAMIC_CATEGORIES: Array<
  CategoryDef & { weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
> = [
  { id: "weekday_monday_special", label: "Monday Special", weekday: 1 },
  { id: "weekday_tuesday_special", label: "Tuesday Special", weekday: 2 },
  { id: "weekday_wednesday_special", label: "Wednesday Special", weekday: 3 },
  { id: "weekday_thursday_special", label: "Thursday Special", weekday: 4 },
  { id: "weekday_friday_special", label: "Friday Special", weekday: 5 },
  { id: "weekday_saturday_special", label: "Saturday Special", weekday: 6 },
  { id: "weekday_sunday_special", label: "Sunday Special", weekday: 7 },
];

export function getUpcomingWeekdayAssignableCategories(
  now: Date = new Date(),
): VisibleCategoryDef[] {
  return WEEKDAY_DYNAMIC_CATEGORIES.map((item) => {
    const eventStartAt = getNextIstWeekdayStart(now.getTime(), item.weekday);
    return {
      id: item.id,
      label: item.label,
      isDynamic: true,
      eventDateLabel: formatEpochEventDateLabel(eventStartAt),
      eventStartAt,
      eventEndAt: getIstEndOfDay(eventStartAt),
    };
  });
}

const DYNAMIC_EVENT_CATEGORIES = [
  ...CSV_FIXED_DYNAMIC_EVENT_CATEGORIES,
  ...REGIONAL_DYNAMIC_EVENT_CATEGORIES,
];
const FLOATING_DYNAMIC_EVENT_CATEGORIES = CSV_FLOATING_DYNAMIC_EVENT_CATEGORIES;
const LUNAR_DYNAMIC_CATEGORIES: CategoryDef[] =
  CSV_LUNAR_PLACEHOLDER_CATEGORIES;
const EVENT_DYNAMIC_CATEGORY_IDS = new Set<string>([
  ...DYNAMIC_EVENT_CATEGORIES.map((item) => item.id),
  ...FLOATING_DYNAMIC_EVENT_CATEGORIES.map((item) => item.id),
  ...LUNAR_DYNAMIC_CATEGORIES.map((item) => item.id),
]);

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function plusDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekdayOfMonth: number,
  weekOfMonth: number,
): Date | null {
  if (weekOfMonth < 1 || weekOfMonth > 5) {
    return null;
  }
  const firstDay = new Date(year, month - 1, 1);
  const offset = (weekdayOfMonth - firstDay.getDay() + 7) % 7;
  const day = 1 + offset + (weekOfMonth - 1) * 7;
  const candidate = new Date(year, month - 1, day);
  if (candidate.getMonth() !== month - 1) {
    return null;
  }
  return candidate;
}

function resolveFloatingEventStart(
  event: FloatingDynamicEventCategoryDef,
  year: number,
): Date | null {
  return nthWeekdayOfMonth(
    year,
    event.month,
    event.weekdayOfMonth,
    event.weekOfMonth,
  );
}

function uniqueById(items: CategoryDef[]): CategoryDef[] {
  const seen = new Set<string>();
  const output: CategoryDef[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      output.push(item);
    }
  }
  return output;
}

const TELUGU_SHARED_CONTENT_REGION_IDS = new Set([
  "andhra_pradesh",
  "telangana",
]);
const HINDI_SHARED_CONTENT_REGION_IDS = new Set([
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

function sharedContentRegionIdsFor(regionId: string): Set<string> {
  if (TELUGU_SHARED_CONTENT_REGION_IDS.has(regionId)) {
    return TELUGU_SHARED_CONTENT_REGION_IDS;
  }
  if (HINDI_SHARED_CONTENT_REGION_IDS.has(regionId)) {
    return HINDI_SHARED_CONTENT_REGION_IDS;
  }
  return new Set(regionId ? [regionId] : []);
}

function dynamicEventMatchesRegion(
  eventRegionIds: string[] | undefined,
  selectedRegionId: string,
): boolean {
  const eventRegions = (eventRegionIds ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (eventRegions.length === 0) {
    return true;
  }
  const sharedRegionIds = sharedContentRegionIdsFor(selectedRegionId);
  return eventRegions.some((regionId) => sharedRegionIds.has(regionId));
}

export function getVisibleAssignableCategories(
  now: Date = new Date(),
  daysBeforeEvent = 2,
  daysBeforeDashboard = 7,
  blinkingDays = daysBeforeEvent,
  regionId?: string | null,
): VisibleCategoryDef[] {
  const normalizedRegionId = String(regionId ?? "").trim();
  const today = startOfDay(now);
  const visibleDynamicEvents = DYNAMIC_EVENT_CATEGORIES.flatMap((event) => {
    if (!dynamicEventMatchesRegion(event.regionIds, normalizedRegionId)) {
      return [];
    }
    const eventStart = new Date(
      today.getFullYear(),
      event.month - 1,
      event.day,
    );
    const visibleStart = plusDays(eventStart, -daysBeforeDashboard);
    const blinkingStart = plusDays(eventStart, -blinkingDays);
    const durationDays = Math.max(1, event.durationDays ?? 1);
    const eventEnd = plusDays(eventStart, durationDays - 1);
    if (!isDateInRange(today, visibleStart, eventEnd)) {
      return [];
    }
    return [
      {
        id: event.id,
        label: event.label,
        isBlinking: isDateInRange(today, blinkingStart, eventEnd),
        isDynamic: true,
        eventDateLabel: formatEventDateLabel(event.month, event.day),
        eventStartAt: eventStart.getTime(),
        eventEndAt: endOfDay(eventEnd).getTime(),
      },
    ];
  });

  const visibleFloatingDynamicEvents =
    FLOATING_DYNAMIC_EVENT_CATEGORIES.flatMap((event) => {
      const eventStart = resolveFloatingEventStart(event, today.getFullYear());
      if (!eventStart) {
        return [];
      }
      const visibleStart = plusDays(eventStart, -daysBeforeDashboard);
      const blinkingStart = plusDays(eventStart, -blinkingDays);
      const durationDays = Math.max(1, event.durationDays ?? 1);
      const eventEnd = plusDays(eventStart, durationDays - 1);
      if (!isDateInRange(today, visibleStart, eventEnd)) {
        return [];
      }
      return [
        {
          id: event.id,
          label: event.label,
          isBlinking: isDateInRange(today, blinkingStart, eventEnd),
          isDynamic: true,
          eventDateLabel: formatEventDateLabel(
            event.month,
            eventStart.getDate(),
          ),
          eventStartAt: eventStart.getTime(),
          eventEndAt: endOfDay(eventEnd).getTime(),
        },
      ];
    });

  const resolvedLunarEvents = LUNAR_DYNAMIC_CATEGORIES.flatMap((event) => {
    const resolved =
      RESOLVED_LUNAR_EVENT_DATES[today.getFullYear()]?.[event.id];
    if (!resolved) {
      return [];
    }

    const eventStart = new Date(
      today.getFullYear(),
      resolved.month - 1,
      resolved.day,
    );
    const visibleStart = plusDays(eventStart, -daysBeforeDashboard);
    const blinkingStart = plusDays(eventStart, -blinkingDays);
    const eventEnd =
      resolved.endMonth != null && resolved.endDay != null
        ? new Date(today.getFullYear(), resolved.endMonth - 1, resolved.endDay)
        : plusDays(eventStart, Math.max(1, resolved.durationDays ?? 1) - 1);

    if (!isDateInRange(today, visibleStart, eventEnd)) {
      return [];
    }

    return [
      {
        id: event.id,
        label: event.label,
        isBlinking: isDateInRange(today, blinkingStart, eventEnd),
        isDynamic: true,
        eventDateLabel: formatEventDateLabel(resolved.month, resolved.day),
        eventStartAt: eventStart.getTime(),
        eventEndAt: endOfDay(eventEnd).getTime(),
      },
    ];
  });

  const todayWeekday = ((today.getDay() + 6) % 7) + 1;
  const visibleWeekday = WEEKDAY_DYNAMIC_CATEGORIES.filter(
    (item) => item.weekday === todayWeekday,
  ).map((item) => ({
    id: item.id,
    label: item.label,
    isDynamic: true,
    eventDateLabel: formatEpochEventDateLabel(today.getTime()),
    eventStartAt: today.getTime(),
    eventEndAt: getIstEndOfDay(today.getTime()),
  }));

  return uniqueById([
    ...PERMANENT_CREATOR_CATEGORIES.map((item) => ({
      ...item,
      isDynamic: false,
    })),
    ...visibleDynamicEvents,
    ...visibleFloatingDynamicEvents,
    ...resolvedLunarEvents,
    ...visibleWeekday,
  ]);
}

export const CREATOR_ASSIGNABLE_CATEGORIES: CategoryDef[] = uniqueById([
  ...PERMANENT_CREATOR_CATEGORIES,
  ...POLITICAL_PARTY_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
  })),
  ...DYNAMIC_META_CATEGORIES,
  ...WEEKDAY_DYNAMIC_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
  })),
  ...DYNAMIC_EVENT_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
  })),
  ...FLOATING_DYNAMIC_EVENT_CATEGORIES.map((item) => ({
    id: item.id,
    label: item.label,
  })),
  ...LUNAR_DYNAMIC_CATEGORIES,
]);
const CREATOR_ASSIGNABLE_CATEGORY_ID_SET = new Set(
  CREATOR_ASSIGNABLE_CATEGORIES.map((item) => item.id),
);

export function isValidCategoryId(id: string): boolean {
  return CREATOR_ASSIGNABLE_CATEGORIES.some((category) => category.id === id);
}

export function filterKnownAssignedCategories(
  assignedCategories: string[],
  extraValidIds: string[] = [],
): { assignedCategories: string[]; removedCategoryIds: string[] } {
  const validIds = new Set([
    ...CREATOR_ASSIGNABLE_CATEGORY_ID_SET,
    ...extraValidIds,
  ]);
  const keptCategoryIds: string[] = [];
  const removedCategoryIds: string[] = [];

  for (const categoryId of assignedCategories) {
    if (!validIds.has(categoryId)) {
      removedCategoryIds.push(categoryId);
      continue;
    }
    if (!keptCategoryIds.includes(categoryId)) {
      keptCategoryIds.push(categoryId);
    }
  }

  return {
    assignedCategories: keptCategoryIds,
    removedCategoryIds,
  };
}

export function getVisibleDynamicCategoryById(
  categoryId: string,
  now: Date = new Date(),
  daysBeforeEvent = 2,
  daysBeforeDashboard = 7,
  blinkingDays = daysBeforeEvent,
  regionId?: string | null,
): VisibleCategoryDef | null {
  const normalized = categoryId.trim();
  if (!normalized) {
    return null;
  }
  return (
    getVisibleAssignableCategories(
      now,
      daysBeforeEvent,
      daysBeforeDashboard,
      blinkingDays,
      regionId,
    ).find((item) => item.id === normalized && item.isDynamic) ?? null
  );
}

export function getWeekdayForCategoryId(
  categoryId: string,
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const normalized = categoryId.trim();
  return (
    WEEKDAY_DYNAMIC_CATEGORIES.find((item) => item.id === normalized)
      ?.weekday ?? null
  );
}

export function pruneInactiveAssignedCategories(
  assignedCategories: string[],
  now: Date = new Date(),
  daysBeforeEvent = 2,
  daysBeforeDashboard = 7,
  blinkingDays = daysBeforeEvent,
  regionId?: string | null,
): { assignedCategories: string[]; removedCategoryIds: string[] } {
  const visibleDynamicCategoryIds = new Set(
    getVisibleAssignableCategories(
      now,
      daysBeforeEvent,
      daysBeforeDashboard,
      blinkingDays,
      regionId,
    )
      .filter((item) => item.isDynamic)
      .map((item) => item.id),
  );

  const keptCategoryIds: string[] = [];
  const removedCategoryIds: string[] = [];

  for (const categoryId of assignedCategories) {
    if (!EVENT_DYNAMIC_CATEGORY_IDS.has(categoryId)) {
      keptCategoryIds.push(categoryId);
      continue;
    }

    if (visibleDynamicCategoryIds.has(categoryId)) {
      keptCategoryIds.push(categoryId);
      continue;
    }

    removedCategoryIds.push(categoryId);
  }

  return {
    assignedCategories: keptCategoryIds,
    removedCategoryIds,
  };
}
