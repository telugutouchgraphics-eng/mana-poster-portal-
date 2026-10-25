export type AdminCategoryIconOption = {
  id: string;
  label: string;
  assetPath: string;
  previewPath: string;
};

const ICON_IDS = [
  ["ammavaru", "Ammavaru / Festivals"],
  ["diya", "Diwali Glowing Diya"],
  ["indian_flag", "Indian National Flag"],
  ["politics", "Politics / Leadership Podium"],
  ["ganesha", "Lord Ganesha"],
  ["bonalu", "Bonalu Pot"],
  ["sankranti", "Sankranti Kite & Sugarcane"],
  ["good_morning", "Temple Sunrise"],
  ["temple", "Temple / Devotional"],
  ["prayer", "Prayer / Namaste"],
  ["gita_wisdom", "Bhagavad Gita / Wisdom"],
  ["birthday_cake", "Birthday Cake"],
  ["anniversary", "Anniversary Rings"],
  ["today_special", "Today Special Star Badge"],
  ["motivational", "Motivational Torch"],
  ["good_night", "Good Night Moon & Stars"],
  ["jokes", "Comedy & Jokes"],
  ["home", "All Categories Home"],
] as const;

export const ADMIN_CATEGORY_ICON_OPTIONS: AdminCategoryIconOption[] = ICON_IDS.map(
  ([id, label]) => ({
    id,
    label,
    assetPath: `assets/admin_category_icons/${id}.svg`,
    previewPath: `/admin-category-icons/${id}.svg`,
  }),
);

export function adminCategoryIconPreviewPath(assetPath: string): string {
  const clean = assetPath.trim();
  const match = /^assets\/admin_category_icons\/([a-z0-9_]+)\.svg$/i.exec(clean);
  return match ? `/admin-category-icons/${match[1]}.svg` : "";
}
