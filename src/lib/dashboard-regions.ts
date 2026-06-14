export type DashboardRegionLanguage =
  | "assamese"
  | "bengali"
  | "english"
  | "gujarati"
  | "hindi"
  | "kannada"
  | "kashmiri"
  | "konkani"
  | "ladakhi"
  | "malayalam"
  | "marathi"
  | "meitei"
  | "mizo"
  | "nepali"
  | "odia"
  | "punjabi"
  | "tamil"
  | "telugu";

export interface DashboardRegion {
  id: string;
  name: string;
  kind: "State" | "Union Territory";
  primaryLanguage: string;
  language: DashboardRegionLanguage;
}

export const DASHBOARD_REGIONS: DashboardRegion[] = [
  { id: "andhra_pradesh", name: "Andhra Pradesh", kind: "State", primaryLanguage: "Telugu", language: "telugu" },
  { id: "arunachal_pradesh", name: "Arunachal Pradesh", kind: "State", primaryLanguage: "English", language: "english" },
  { id: "assam", name: "Assam", kind: "State", primaryLanguage: "Assamese", language: "assamese" },
  { id: "bihar", name: "Bihar", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "chhattisgarh", name: "Chhattisgarh", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "goa", name: "Goa", kind: "State", primaryLanguage: "Konkani", language: "konkani" },
  { id: "gujarat", name: "Gujarat", kind: "State", primaryLanguage: "Gujarati", language: "gujarati" },
  { id: "haryana", name: "Haryana", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "himachal_pradesh", name: "Himachal Pradesh", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "jharkhand", name: "Jharkhand", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "karnataka", name: "Karnataka", kind: "State", primaryLanguage: "Kannada", language: "kannada" },
  { id: "kerala", name: "Kerala", kind: "State", primaryLanguage: "Malayalam", language: "malayalam" },
  { id: "madhya_pradesh", name: "Madhya Pradesh", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "maharashtra", name: "Maharashtra", kind: "State", primaryLanguage: "Marathi", language: "marathi" },
  { id: "manipur", name: "Manipur", kind: "State", primaryLanguage: "Meitei (Manipuri)", language: "meitei" },
  { id: "meghalaya", name: "Meghalaya", kind: "State", primaryLanguage: "English", language: "english" },
  { id: "mizoram", name: "Mizoram", kind: "State", primaryLanguage: "Mizo", language: "mizo" },
  { id: "nagaland", name: "Nagaland", kind: "State", primaryLanguage: "English", language: "english" },
  { id: "odisha", name: "Odisha", kind: "State", primaryLanguage: "Odia", language: "odia" },
  { id: "punjab", name: "Punjab", kind: "State", primaryLanguage: "Punjabi", language: "punjabi" },
  { id: "rajasthan", name: "Rajasthan", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "sikkim", name: "Sikkim", kind: "State", primaryLanguage: "Nepali", language: "nepali" },
  { id: "tamil_nadu", name: "Tamil Nadu", kind: "State", primaryLanguage: "Tamil", language: "tamil" },
  { id: "telangana", name: "Telangana", kind: "State", primaryLanguage: "Telugu", language: "telugu" },
  { id: "tripura", name: "Tripura", kind: "State", primaryLanguage: "Bengali", language: "bengali" },
  { id: "uttar_pradesh", name: "Uttar Pradesh", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "uttarakhand", name: "Uttarakhand", kind: "State", primaryLanguage: "Hindi", language: "hindi" },
  { id: "west_bengal", name: "West Bengal", kind: "State", primaryLanguage: "Bengali", language: "bengali" },
  { id: "delhi", name: "Delhi", kind: "Union Territory", primaryLanguage: "Hindi", language: "hindi" },
  { id: "jammu_kashmir", name: "Jammu & Kashmir", kind: "Union Territory", primaryLanguage: "Kashmiri", language: "kashmiri" },
  { id: "ladakh", name: "Ladakh", kind: "Union Territory", primaryLanguage: "Ladakhi", language: "ladakhi" },
  { id: "puducherry", name: "Puducherry", kind: "Union Territory", primaryLanguage: "Tamil", language: "tamil" },
  { id: "chandigarh", name: "Chandigarh", kind: "Union Territory", primaryLanguage: "Punjabi", language: "punjabi" },
  { id: "andaman_nicobar", name: "Andaman & Nicobar Islands", kind: "Union Territory", primaryLanguage: "Hindi", language: "hindi" },
  { id: "lakshadweep", name: "Lakshadweep", kind: "Union Territory", primaryLanguage: "Malayalam", language: "malayalam" },
  { id: "dadra_nagar_haveli_daman_diu", name: "Dadra & Nagar Haveli and Daman & Diu", kind: "Union Territory", primaryLanguage: "Gujarati", language: "gujarati" },
];

export const DEFAULT_DASHBOARD_REGION_ID = "andhra_pradesh";

export function getDashboardRegion(regionId?: string | null): DashboardRegion {
  return (
    DASHBOARD_REGIONS.find((item) => item.id === String(regionId ?? "").trim()) ??
    DASHBOARD_REGIONS.find((item) => item.id === DEFAULT_DASHBOARD_REGION_ID)!
  );
}

