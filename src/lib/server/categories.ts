export interface CategoryDef {
  id: string;
  label: string;
}

interface DynamicEventCategoryDef extends CategoryDef {
  month: number;
  day: number;
  durationDays?: number;
}

// Flutter app HomeScreen _staticCategorySlugs కి aligned.
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

// Dynamic event types (manual assignmentకి కావాలంటే valid IDs గా ఉండాలి)
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

// Flutter dynamic_event_repository.dart (Gregorian events) కి aligned.
const DYNAMIC_EVENT_CATEGORIES: DynamicEventCategoryDef[] = [
  { id: "new_year_day", label: "New Year Day", month: 1, day: 1 },
  { id: "national_youth_day", label: "National Youth Day", month: 1, day: 12 },
  { id: "makara_sankranti", label: "Makara Sankranti", month: 1, day: 14, durationDays: 3 },
  { id: "army_day", label: "Army Day", month: 1, day: 15 },
  { id: "gandhi_vardhanthi", label: "Gandhi Vardhanthi", month: 1, day: 30 },
  { id: "mother_language_day", label: "Mother Language Day", month: 2, day: 21 },
  { id: "international_womens_day", label: "International Women's Day", month: 3, day: 8 },
  { id: "world_health_day", label: "World Health Day", month: 4, day: 7 },
  { id: "ambedkar_jayanthi", label: "Ambedkar Jayanthi", month: 4, day: 14 },
  { id: "labour_day", label: "Labour Day", month: 5, day: 1 },
  {
    id: "alluri_sitarama_raju_vardhanthi",
    label: "Alluri Sitarama Raju Vardhanthi",
    month: 5,
    day: 7,
  },
  { id: "ntr_jayanthi", label: "NTR Jayanthi", month: 5, day: 28 },
  { id: "telangana_formation_day", label: "Telangana Formation Day", month: 6, day: 2 },
  { id: "world_environment_day", label: "World Environment Day", month: 6, day: 5 },
  { id: "international_yoga_day", label: "International Yoga Day", month: 6, day: 21 },
  { id: "pv_narasimha_rao_jayanthi", label: "P.V. Narasimha Rao Jayanthi", month: 6, day: 28 },
  { id: "national_doctors_day", label: "National Doctors Day", month: 7, day: 1 },
  { id: "alluri_sitarama_raju_jayanthi", label: "Alluri Sitarama Raju Jayanthi", month: 7, day: 4 },
  { id: "ysr_jayanthi", label: "YSR Jayanthi", month: 7, day: 8 },
  { id: "prof_jayashankar_jayanthi", label: "Prof. Jayashankar Jayanthi", month: 8, day: 6 },
  { id: "independence_day", label: "Independence Day", month: 8, day: 15 },
  { id: "tanguturi_prakasam_jayanthi", label: "Tanguturi Prakasam Jayanthi", month: 8, day: 23 },
  { id: "telugu_language_day", label: "Telugu Language Day", month: 8, day: 29 },
  { id: "teachers_day", label: "Teachers Day", month: 9, day: 5 },
  { id: "kaloji_narayana_rao_jayanthi", label: "Kaloji Narayana Rao Jayanthi", month: 9, day: 9 },
  { id: "ysr_vardhanthi", label: "YSR Vardhanthi", month: 9, day: 2 },
  { id: "gandhi_jayanthi", label: "Gandhi Jayanthi", month: 10, day: 2 },
  { id: "national_unity_day", label: "National Unity Day", month: 10, day: 31 },
  { id: "andhra_pradesh_formation_day", label: "Andhra Pradesh Formation Day", month: 11, day: 1 },
  { id: "childrens_day", label: "Children's Day", month: 11, day: 14 },
  { id: "constitution_day", label: "Constitution Day", month: 11, day: 26 },
  { id: "potti_sriramulu_vardhanthi", label: "Potti Sriramulu Vardhanthi", month: 12, day: 15 },
  { id: "national_farmers_day", label: "National Farmers Day", month: 12, day: 23 },
  { id: "christmas", label: "Christmas", month: 12, day: 25 },
];

// Lunar placeholders (app repo లో enabled:false)
const LUNAR_DYNAMIC_CATEGORIES: CategoryDef[] = [
  { id: "ugadi", label: "Ugadi" },
  { id: "sri_rama_navami", label: "Sri Rama Navami" },
  { id: "bonalu", label: "Bonalu" },
  { id: "bathukamma", label: "Bathukamma" },
  { id: "vinayaka_chavithi", label: "Vinayaka Chavithi" },
  { id: "deepavali", label: "Deepavali" },
];

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
  daysBeforeEvent = 3
): CategoryDef[] {
  const today = startOfDay(now);
  const visibleDynamicEvents = DYNAMIC_EVENT_CATEGORIES.filter((event) => {
    const eventStart = new Date(today.getFullYear(), event.month - 1, event.day);
    const visibleStart = plusDays(eventStart, -daysBeforeEvent);
    const durationDays = Math.max(1, event.durationDays ?? 1);
    const eventEnd = plusDays(eventStart, durationDays - 1);
    return isDateInRange(today, visibleStart, eventEnd);
  }).map((event) => ({ id: event.id, label: event.label }));

  const todayWeekday = ((today.getDay() + 6) % 7) + 1; // Mon=1..Sun=7
  const visibleWeekday = WEEKDAY_DYNAMIC_CATEGORIES.filter(
    (item) => item.weekday === todayWeekday
  ).map((item) => ({ id: item.id, label: item.label }));

  return uniqueById([
    ...PERMANENT_CREATOR_CATEGORIES,
    ...visibleDynamicEvents,
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

