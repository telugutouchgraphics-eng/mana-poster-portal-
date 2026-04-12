import {
  CSV_FIXED_DYNAMIC_EVENT_CATEGORIES,
  CSV_LUNAR_PLACEHOLDER_CATEGORIES,
} from "./dynamic-event-catalog";
import { RESOLVED_LUNAR_EVENT_DATES } from "./dynamic-lunar-event-dates";

export interface CategoryDef {
  id: string;
  label: string;
}

export interface VisibleCategoryDef extends CategoryDef {
  isBlinking?: boolean;
}

// Flutter app HomeScreen static category set ki aligned.
export const PERMANENT_CREATOR_CATEGORIES: CategoryDef[] = [
  { id: "all", label: "All" },
  { id: "good_night", label: "Good Night" },
  { id: "good_morning", label: "Good Morning" },
  { id: "motivational", label: "Motivational" },
  { id: "love_quotes", label: "Love Quotes" },
  { id: "today_special", label: "Today Special" },
  { id: "birthdays", label: "Birthdays" },
  { id: "life_advice", label: "Life Advice" },
  { id: "gita_wisdom", label: "Gita Wisdom" },
  { id: "news", label: "News" },
  { id: "devotional", label: "Devotional" },
  { id: "mahabharata", label: "Mahabharata" },
  { id: "anniversary", label: "Anniversary" },
  { id: "good_thoughts", label: "Good Thoughts" },
  { id: "bible", label: "Bible" },
  { id: "islam", label: "Islam" },
  { id: "new", label: "New" },
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

const DYNAMIC_EVENT_CATEGORIES = CSV_FIXED_DYNAMIC_EVENT_CATEGORIES;
const LUNAR_DYNAMIC_CATEGORIES: CategoryDef[] = CSV_LUNAR_PLACEHOLDER_CATEGORIES;

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

export function getVisibleAssignableCategories(
  now: Date = new Date(),
  daysBeforeEvent = 2,
  daysBeforeDashboard = 7,
  blinkingDays = daysBeforeEvent,
): VisibleCategoryDef[] {
  const today = startOfDay(now);
  const visibleDynamicEvents = DYNAMIC_EVENT_CATEGORIES.flatMap((event) => {
    const eventStart = new Date(today.getFullYear(), event.month - 1, event.day);
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
      },
    ];
  });

  const resolvedLunarEvents = LUNAR_DYNAMIC_CATEGORIES.flatMap((event) => {
    const resolved = RESOLVED_LUNAR_EVENT_DATES[today.getFullYear()]?.[event.id];
    if (!resolved) {
      return [];
    }

    const eventStart = new Date(today.getFullYear(), resolved.month - 1, resolved.day);
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
      },
    ];
  });

  const todayWeekday = ((today.getDay() + 6) % 7) + 1;
  const visibleWeekday = WEEKDAY_DYNAMIC_CATEGORIES.filter(
    (item) => item.weekday === todayWeekday,
  ).map((item) => ({ id: item.id, label: item.label }));

  return uniqueById([
    ...PERMANENT_CREATOR_CATEGORIES,
    ...visibleDynamicEvents,
    ...resolvedLunarEvents,
    ...visibleWeekday,
  ]);
}

export const CREATOR_ASSIGNABLE_CATEGORIES: CategoryDef[] = uniqueById([
  ...PERMANENT_CREATOR_CATEGORIES,
  ...DYNAMIC_META_CATEGORIES,
  ...WEEKDAY_DYNAMIC_CATEGORIES.map((item) => ({ id: item.id, label: item.label })),
  ...DYNAMIC_EVENT_CATEGORIES.map((item) => ({ id: item.id, label: item.label })),
  ...LUNAR_DYNAMIC_CATEGORIES,
]);

export function isValidCategoryId(id: string): boolean {
  return CREATOR_ASSIGNABLE_CATEGORIES.some((category) => category.id === id);
}
