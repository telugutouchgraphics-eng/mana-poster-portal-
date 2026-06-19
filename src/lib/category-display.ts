const CATEGORY_ICONS: Record<string, string> = {
  all: "🏠",
  good_morning: "🌅",
  good_afternoon: "☀️",
  good_night: "🌙",
  motivational: "🔥",
  love_quotes: "❤️",
  today_special: "⭐",
  birthdays: "🎂",
  life_advice: "🧭",
  gita_wisdom: "📖",
  devotional: "🙏",
  mahabharata: "🏹",
  anniversary: "💞",
  good_thoughts: "💡",
  bible: "✝️",
  islam: "☪️",
  jokes: "😂",
  new: "✨",
  festival: "🎉",
  jayanthi: "🙏",
  vardhanthi: "🕯️",
  important_day: "⭐",
  regional_special: "📍",
  weekday_special: "📅",
};

const PARTY_LOGO_EXTENSIONS: Record<string, string> = {
  aap: "png",
  ad_s: "jpg",
  agp: "png",
  aiadmk: "png",
  aifb: "png",
  aimim: "png",
  aitc: "png",
  aiudf: "webp",
  ajsupa: "jpg",
  bap: "png",
  bjd: "png",
  bjp: "png",
  bpf: "svg",
  brs: "png",
  bsp: "png",
  cpi: "png",
  cpi_m: "png",
  cpi_ml_l: "png",
  dmdk: "png",
  dmk: "png",
  gfp: "jpg",
  ham_s: "jpg",
  hspdp: "png",
  inc: "png",
  inld: "png",
  ipft: "svg",
  iuml: "jpg",
  jccj: "svg",
  jds: "png",
  jdu: "png",
  jjp: "jpg",
  jknc: "png",
  jkpc: "svg",
  jmm: "png",
  jsdl: "png",
  jsp: "png",
  kc: "png",
  kc_m: "png",
  kpa: "svg",
  ljp_rv: "jpg",
  mdmk: "png",
  mgp: "jpg",
  mnf: "jpg",
  mns: "jpg",
  ncp: "png",
  ncp_sp: "jpg",
  ndpp: "svg",
  npf: "png",
  npp: "png",
  ntk: "jpg",
  pdp: "png",
  pmk: "png",
  ppa: "svg",
  prahar: "jpg",
  rgp: "jpg",
  rjd: "jpg",
  rld: "jpg",
  rljp: "jpg",
  rlp: "svg",
  rpi_a: "png",
  rsp: "png",
  sad: "png",
  sbsp: "jpg",
  sdf: "png",
  shiv_sena: "png",
  shs_ubt: "jpg",
  skm: "png",
  sp: "png",
  swabhimani: "jpg",
  tdp: "png",
  tmc_m: "png",
  tmp: "jpg",
  tvk: "png",
  udp: "jpg",
  ukd: "gif",
  uppl: "svg",
  vba: "jpg",
  vck: "png",
  vip: "png",
  vpp: "svg",
  wpi: "jpg",
  ysrcp: "jpg",
  zpm: "svg",
};

const LEADING_ICON_PATTERN = /^[^\p{L}\p{N}]+/u;

export function stripCategoryIcon(label: string): string {
  return label.replace(LEADING_ICON_PATTERN, "").trim();
}

export function categoryIconFor(id: string, label = ""): string {
  const key = id.trim().toLowerCase().replaceAll("-", "_");
  const text = label.toLowerCase();
  if (key.startsWith("party_")) return "";
  if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
  if (key.startsWith("weekday_")) return "📅";
  if (key.includes("jayanthi") || text.includes("jayanthi")) return "🙏";
  if (key.includes("vardhanthi") || text.includes("vardhanthi")) return "🕯️";
  if (key.includes("festival") || text.includes("festival")) return "🎉";
  if (key.includes("regional") || text.includes("regional")) return "📍";
  if (key.includes("important") || text.includes("important")) return "⭐";
  if (text.includes("birthday")) return "🎂";
  if (text.includes("anniversary")) return "💞";
  if (text.includes("morning")) return "🌅";
  if (text.includes("afternoon")) return "☀️";
  if (text.includes("night")) return "🌙";
  if (text.includes("devotional") || text.includes("bhakti")) return "🙏";
  if (text.includes("bible")) return "✝️";
  if (text.includes("islam")) return "☪️";
  if (text.includes("joke") || text.includes("fun")) return "😂";
  return "✨";
}

export function categoryLabelWithIcon(id: string, label: string): string {
  const cleanLabel = stripCategoryIcon(label);
  if (!cleanLabel) return cleanLabel;
  if (isPoliticalPartyCategory(id)) return cleanLabel;
  return `${categoryIconFor(id, cleanLabel)} ${cleanLabel}`;
}

export function isPoliticalPartyCategory(id: string): boolean {
  return id.trim().toLowerCase().replaceAll("-", "_").startsWith("party_");
}

export function partyLogoPathForCategory(id: string): string | null {
  const key = id.trim().toLowerCase().replaceAll("-", "_");
  if (!key.startsWith("party_")) return null;
  const partyId = key.slice("party_".length);
  const extension = PARTY_LOGO_EXTENSIONS[partyId];
  if (!extension) return null;
  return `/political/party_logos/${partyId}.${extension}`;
}
