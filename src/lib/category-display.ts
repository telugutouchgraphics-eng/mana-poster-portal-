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

/**
 * Returns a high-definition realistic vector/cultural icon path for any category ID or label.
 * Replaces standard keyboard emojis with authentic Indian festival and event icons.
 */
export function categoryRealisticIconPath(id: string, label = ""): string {
  const key = id.trim().toLowerCase().replaceAll("-", "_");
  const text = label.toLowerCase();
  if (key.startsWith("party_")) return "";
  if (key === "all") return "/admin-category-icons/home.svg";
  if (
    key.includes("ammavaru") ||
    key.includes("festival") ||
    text.includes("festival") ||
    text.includes("పండుగ") ||
    text.includes("దసరా") ||
    text.includes("నవరాత్రి")
  ) {
    return "/admin-category-icons/ammavaru.svg";
  }
  if (
    key.includes("diya") ||
    key.includes("diwali") ||
    key.includes("deepavali") ||
    text.includes("దీపావళి") ||
    text.includes("దీపం")
  ) {
    return "/admin-category-icons/diya.svg";
  }
  if (
    key.includes("flag") ||
    key.includes("independence") ||
    key.includes("republic") ||
    key.includes("national") ||
    text.includes("జెండా") ||
    text.includes("జాతీయ")
  ) {
    return "/admin-category-icons/indian_flag.svg";
  }
  if (
    key.includes("ganesh") ||
    key.includes("vinayak") ||
    text.includes("వినాయక") ||
    text.includes("గణపతి")
  ) {
    return "/admin-category-icons/ganesha.svg";
  }
  if (key.includes("bonalu") || text.includes("బోనాలు")) {
    return "/admin-category-icons/bonalu.svg";
  }
  if (
    key.includes("sankranti") ||
    key.includes("pongal") ||
    text.includes("సంక్రాంతి") ||
    text.includes("పొంగల్")
  ) {
    return "/admin-category-icons/sankranti.svg";
  }
  if (key.includes("morning") || text.includes("morning") || text.includes("శుభోదయం")) {
    return "/admin-category-icons/good_morning.svg";
  }
  if (key.includes("night") || text.includes("night") || text.includes("శుభరాత్రి")) {
    return "/admin-category-icons/good_night.svg";
  }
  if (key.includes("birthday") || text.includes("birthday") || text.includes("పుట్టినరోజు")) {
    return "/admin-category-icons/birthday_cake.svg";
  }
  if (key.includes("anniversary") || text.includes("anniversary") || text.includes("వివాహ")) {
    return "/admin-category-icons/anniversary.svg";
  }
  if (key.includes("motivation") || text.includes("motivation") || text.includes("స్ఫూర్తి")) {
    return "/admin-category-icons/motivational.svg";
  }
  if (
    key.includes("devotional") ||
    key.includes("temple") ||
    key.includes("jayanthi") ||
    text.includes("భక్తి") ||
    text.includes("దేవాలయం")
  ) {
    return "/admin-category-icons/temple.svg";
  }
  if (
    key.includes("prayer") ||
    key.includes("vardhanthi") ||
    text.includes("నమస్కారం") ||
    text.includes("వర్ధంతి")
  ) {
    return "/admin-category-icons/prayer.svg";
  }
  if (key.includes("gita") || text.includes("గీత") || text.includes("wisdom")) {
    return "/admin-category-icons/gita_wisdom.svg";
  }
  if (
    key.includes("politic") ||
    text.includes("politic") ||
    text.includes("రాజకీయ")
  ) {
    return "/admin-category-icons/politics.svg";
  }
  if (key.includes("joke") || text.includes("joke") || text.includes("హాస్యం") || text.includes("comedy")) {
    return "/admin-category-icons/jokes.svg";
  }
  return "/admin-category-icons/today_special.svg";
}

/**
 * Returns empty string; raw keyboard emojis removed in favor of clean presentation & realistic icons.
 */
export function categoryIconFor(id: string, label = ""): string {
  void id;
  void label;
  return "";
}

/**
 * Returns a clean category label with leading raw keyboard emojis stripped.
 */
export function categoryLabelWithIcon(id: string, label: string): string {
  void id;
  return stripCategoryIcon(label);
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
