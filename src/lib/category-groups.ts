export type CategoryType =
  | "daily"
  | "event"
  | "weekday"
  | "political"
  | "manual"
  | "permanent";

export interface CategoryGroupItem {
  id: string;
  label: string;
  isDynamic?: boolean;
  categoryType?: CategoryType | string;
}

export const CATEGORY_TYPE_ORDER: CategoryType[] = [
  "daily",
  "event",
  "weekday",
  "political",
  "manual",
  "permanent",
];

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  daily: "Daily categories",
  event: "Dynamic event categories",
  weekday: "Weekday categories",
  political: "Political parties",
  manual: "Manual event categories",
  permanent: "Permanent custom categories",
};

export function normalizeCategoryType(
  value: string | null | undefined,
): CategoryType | null {
  return CATEGORY_TYPE_ORDER.includes(value as CategoryType)
    ? (value as CategoryType)
    : null;
}

export function inferCategoryType(category: CategoryGroupItem): CategoryType {
  const explicitType = normalizeCategoryType(category.categoryType);
  if (explicitType) return explicitType;

  const id = category.id.trim().toLowerCase();
  if (id.startsWith("party_")) return "political";
  if (id.startsWith("perm_")) return "permanent";
  if (id.startsWith("weekday_")) return "weekday";
  if (category.isDynamic) return "event";
  return "daily";
}

export function groupCategories<T extends CategoryGroupItem>(
  categories: T[],
): Array<{ type: CategoryType; label: string; categories: T[] }> {
  return CATEGORY_TYPE_ORDER.map((type) => ({
    type,
    label: CATEGORY_TYPE_LABELS[type],
    categories: categories.filter((category) => inferCategoryType(category) === type),
  })).filter((group) => group.categories.length > 0);
}
