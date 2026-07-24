export type AdminCategoryIconOption = {
  id: string;
  label: string;
  assetPath: string;
  previewPath: string;
};

const ICON_IDS = [
  ["festival_lamp", "Festival Lamp"],
  ["temple", "Temple"],
  ["calendar", "Calendar"],
  ["star_badge", "Star Badge"],
  ["birthday_cake", "Birthday Cake"],
  ["flower", "Flower"],
  ["heart", "Heart"],
  ["book", "Book"],
  ["quote", "Quote"],
  ["sunrise", "Sunrise"],
  ["moon", "Moon"],
  ["sparkles", "Sparkles"],
  ["flag", "Flag"],
  ["megaphone", "Megaphone"],
  ["crown", "Crown"],
  ["trophy", "Trophy"],
  ["rocket", "Rocket"],
  ["camera", "Camera"],
  ["paint", "Paint"],
  ["music", "Music"],
  ["leaf", "Leaf"],
  ["globe", "Globe"],
  ["hands", "Hands"],
  ["shield", "Shield"],
  ["bell", "Bell"],
  ["medal", "Medal"],
  ["news", "News"],
  ["map_pin", "Map Pin"],
  ["shopping", "Shopping"],
  ["gift", "Gift"],
  ["ribbon", "Ribbon"],
  ["people", "People"],
  ["user_star", "User Star"],
  ["prayer", "Prayer"],
  ["lotus", "Lotus"],
  ["diya", "Diya"],
  ["om", "Om"],
  ["cross", "Cross"],
  ["crescent", "Crescent"],
  ["wheel", "Wheel"],
  ["mountain", "Mountain"],
  ["water_drop", "Water Drop"],
  ["fire", "Fire"],
  ["tree", "Tree"],
  ["home", "Home"],
  ["handshake", "Handshake"],
  ["justice", "Justice"],
  ["microphone", "Microphone"],
  ["movie", "Movie"],
  ["sports", "Sports"],
  ["education", "Education"],
  ["health", "Health"],
  ["food", "Food"],
  ["travel", "Travel"],
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
