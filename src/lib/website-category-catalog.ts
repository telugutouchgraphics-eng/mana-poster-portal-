export interface WebsiteCategoryCatalogEntry {
  id: string;
  label: string;
  aliases?: string[];
  uploadable?: boolean;
}

const LEADING_DECORATIONS_PATTERN = /^[^A-Za-z0-9]+/u;

export const WEBSITE_CATEGORY_CATALOG: WebsiteCategoryCatalogEntry[] = [
  { id: "all", label: "All", aliases: ["all posters", "everything"], uploadable: false },
  { id: "good-night", label: "Good Night" },
  { id: "good-morning", label: "Good Morning" },
  { id: "good-afternoon", label: "Good Afternoon", aliases: ["afternoon", "good noon", "noon"] },
  { id: "motivational", label: "Motivational" },
  { id: "love-quotes", label: "Love Quotes" },
  { id: "today-special", label: "Today Special" },
  { id: "birthdays", label: "Birthdays", aliases: ["birthday"] },
  { id: "life-advice", label: "Life Advice", aliases: ["life advice quotes", "advice"] },
  { id: "gita-wisdom", label: "Gita Wisdom", aliases: ["bhagavad gita", "gita", "gita quotes"] },
  { id: "news", label: "News" },
  { id: "devotional", label: "Devotional", aliases: ["bhakti"] },
  { id: "mahabharata", label: "Mahabharata", aliases: ["mahabharatam", "maha bharatam"] },
  { id: "anniversary", label: "Anniversary", aliases: ["anniversaries"] },
  { id: "good-thoughts", label: "Good Thoughts", aliases: ["good thought"] },
  { id: "bible", label: "Bible" },
  { id: "islam", label: "Islam", aliases: ["islamic"] },
  { id: "jokes", label: "Jokes", aliases: ["funny", "humor", "comedy"] },
  { id: "new", label: "More", aliases: ["new", "latest"] },
];

export const UPLOADABLE_WEBSITE_CATEGORIES = WEBSITE_CATEGORY_CATALOG.filter(
  (item) => item.uploadable !== false,
);

export function normalizeWebsiteCategoryKey(raw: string) {
  return raw
    .replace(LEADING_DECORATIONS_PATTERN, "")
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function findWebsiteCategory(raw: string) {
  const normalized = normalizeWebsiteCategoryKey(raw);
  return WEBSITE_CATEGORY_CATALOG.find((entry) => {
    if (entry.id === normalized) {
      return true;
    }
    if (normalizeWebsiteCategoryKey(entry.label) === normalized) {
      return true;
    }
    return (entry.aliases ?? []).some((alias) => normalizeWebsiteCategoryKey(alias) === normalized);
  });
}

export function canonicalWebsiteCategoryLabel(raw: string) {
  const matched = findWebsiteCategory(raw);
  if (matched) {
    return matched.label;
  }
  return raw.replace(LEADING_DECORATIONS_PATTERN, "").trim();
}
