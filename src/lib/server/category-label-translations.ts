const CATEGORY_LABEL_LANGUAGES = [
  { key: "telugu", code: "te" },
  { key: "hindi", code: "hi" },
  { key: "english", code: "en" },
  { key: "tamil", code: "ta" },
  { key: "kannada", code: "kn" },
  { key: "malayalam", code: "ml" },
  { key: "assamese", code: "as" },
  { key: "konkani", code: "gom" },
  { key: "gujarati", code: "gu" },
  { key: "marathi", code: "mr" },
  { key: "meitei", code: "mni-Mtei" },
  { key: "mizo", code: "lus" },
  { key: "odia", code: "or" },
  { key: "punjabi", code: "pa" },
  { key: "nepali", code: "ne" },
  { key: "bengali", code: "bn" },
  { key: "kashmiri", code: "ks" },
  { key: "ladakhi", code: "bo" },
] as const;

export type CategoryLabelLanguage = (typeof CATEGORY_LABEL_LANGUAGES)[number]["key"];

export type CategoryLabelsByLanguage = Partial<Record<CategoryLabelLanguage, string>>;

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeLabelsByLanguage(input: unknown): CategoryLabelsByLanguage {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const raw = input as Record<string, unknown>;
  const next: CategoryLabelsByLanguage = {};
  for (const language of CATEGORY_LABEL_LANGUAGES) {
    const label = normalizeLabel(String(raw[language.key] ?? ""));
    if (label) {
      next[language.key] = label;
    }
  }
  return next;
}

async function translateLabel(label: string, targetLanguage: string): Promise<string> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", label);

  const response = await fetch(url.toString(), {
    headers: { "user-agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Category label translation failed.");
  }

  const payload = (await response.json()) as unknown[];
  const parts = Array.isArray(payload[0]) ? (payload[0] as unknown[]) : [];
  const translated = parts
    .map((item) => (Array.isArray(item) ? String(item[0] ?? "") : ""))
    .join("")
    .trim();
  return normalizeLabel(translated || label);
}

export async function buildCategoryLabelsByLanguage(
  label: string,
  existing?: unknown,
  overrides?: unknown,
): Promise<CategoryLabelsByLanguage> {
  const normalized = normalizeLabel(label);
  const labels = sanitizeLabelsByLanguage(existing);
  const manualLabels = sanitizeLabelsByLanguage(overrides);
  if (!normalized) {
    return { ...labels, ...manualLabels };
  }

  await Promise.all(
    CATEGORY_LABEL_LANGUAGES.map(async (language) => {
      if (manualLabels[language.key]) {
        labels[language.key] = manualLabels[language.key];
        return;
      }
      try {
        labels[language.key] = await translateLabel(normalized, language.code);
      } catch {
        labels[language.key] = labels[language.key] || normalized;
      }
    }),
  );

  return labels;
}

export function readCategoryLabelsByLanguage(input: unknown): CategoryLabelsByLanguage {
  return sanitizeLabelsByLanguage(input);
}
