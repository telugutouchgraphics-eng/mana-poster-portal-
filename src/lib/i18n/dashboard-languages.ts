export type DashboardLanguage =
  | "telugu"
  | "hindi"
  | "english"
  | "tamil"
  | "kannada"
  | "malayalam";

export const DASHBOARD_LANGUAGES: Array<{
  id: DashboardLanguage;
  label: string;
  code: string;
}> = [
  { id: "telugu", label: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41", code: "te" },
  { id: "hindi", label: "\u0939\u093F\u0928\u094D\u0926\u0940", code: "hi" },
  { id: "english", label: "English", code: "en" },
  { id: "tamil", label: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD", code: "ta" },
  { id: "kannada", label: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1", code: "kn" },
  { id: "malayalam", label: "\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02", code: "ml" },
];

export function isDashboardLanguage(value: string): value is DashboardLanguage {
  return DASHBOARD_LANGUAGES.some((item) => item.id === value);
}

export function languageCodeFor(value: DashboardLanguage) {
  return DASHBOARD_LANGUAGES.find((item) => item.id === value)?.code ?? "en";
}
