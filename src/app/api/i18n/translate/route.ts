import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type SupportedLanguage = "te" | "hi" | "en" | "ta" | "kn" | "ml";

const payloadSchema = z.object({
  targetLanguage: z.enum(["te", "hi", "en", "ta", "kn", "ml"]),
  texts: z.array(z.string().trim().min(1).max(500)).max(250),
});

const EXACT_TRANSLITERATION_TE = new Map<string, string>([
  ["Mana Poster Ai", "à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à±"],
  ["Dashboard", "à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Overview", "à°“à°µà°°à±à°µà±à°¯à±‚"],
  ["Upload", "à°…à°ªà±à°²à±‹à°¡à±"],
  ["Upload Posters", "à°…à°ªà±à°²à±‹à°¡à± à°ªà±‹à°¸à±à°Ÿà°°à±à°¸à±"],
  ["Upload Studio", "à°…à°ªà±à°²à±‹à°¡à± à°¸à±à°Ÿà±‚à°¡à°¿à°¯à±‹"],
  ["My Uploads", "à°®à±ˆ à°…à°ªà±à°²à±‹à°¡à±à°¸à±"],
  ["Leaderboard", "à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Performance", "à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±"],
  ["Creator Performance", "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±"],
  ["Performance Dashboard", "à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Refresh", "à°°à°¿à°«à±à°°à±†à°·à±"],
  ["Refreshing...", "à°°à°¿à°«à±à°°à±†à°·à± à°…à°µà±à°¤à±‹à°‚à°¦à°¿..."],
  ["Admin Dashboard", "à°…à°¡à±à°®à°¿à°¨à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Manager Dashboard", "à°®à±‡à°¨à±‡à°œà°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Creator Dashboard", "à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Open Admin Dashboard", "à°“à°ªà±†à°¨à± à°…à°¡à±à°®à°¿à°¨à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Open Manager Dashboard", "à°“à°ªà±†à°¨à± à°®à±‡à°¨à±‡à°œà°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Open Creator Dashboard", "à°“à°ªà±†à°¨à± à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  ["Accepted", "à°¯à°¾à°•à±à°¸à±†à°ªà±à°Ÿà±†à°¡à±"],
  ["Rejected", "à°°à°¿à°œà±†à°•à±à°Ÿà±†à°¡à±"],
  ["Pending", "à°ªà±†à°‚à°¡à°¿à°‚à°—à±"],
  ["Reason", "à°°à±€à°œà°¨à±"],
  ["Assigned Categories", "à°…à°¸à±ˆà°¨à±à°¡à± à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€à°¸à±"],
  ["Selected Category", "à°¸à±†à°²à±†à°•à±à°Ÿà± à°šà±‡à°¸à°¿à°¨ à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€"],
  ["Select Category", "à°¸à±†à°²à±†à°•à±à°Ÿà± à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€"],
  ["Select Creator", "à°¸à±†à°²à±†à°•à±à°Ÿà± à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±"],
  ["Choose Poster", "à°šà±‚à°¸à± à°ªà±‹à°¸à±à°Ÿà°°à±"],
  ["Customization", "à°•à°¸à±à°Ÿà°®à±ˆà°œà±‡à°·à°¨à±"],
  ["Customize", "à°•à°¸à±à°Ÿà°®à±ˆà°œà±"],
  ["Submit", "à°¸à°¬à±à°®à°¿à°Ÿà±"],
  ["Login", "à°²à°¾à°—à°¿à°¨à±"],
  ["Sign in", "à°¸à±ˆà°¨à± à°‡à°¨à±"],
  ["Continue to dashboard", "à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±â€Œà°•à°¿ à°•à°‚à°Ÿà°¿à°¨à±à°¯à±‚ à°šà±‡à°¯à°‚à°¡à°¿"],
  ["Access your dashboard", "à°¯à±‹à°°à± à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±â€Œà°¨à°¿ à°¯à°¾à°•à±à°¸à±†à°¸à± à°šà±‡à°¯à°‚à°¡à°¿"],
  ["Photo Shape", "à°«à±‹à°Ÿà±‹ à°·à±‡à°ªà±"],
  ["Photo Size", "à°«à±‹à°Ÿà±‹ à°¸à±ˆà°œà±"],
  ["Photo Mode", "à°«à±‹à°Ÿà±‹ à°®à±‹à°¡à±"],
  ["Original Photo", "à°’à°°à°¿à°œà°¿à°¨à°²à± à°«à±‹à°Ÿà±‹"],
  ["BG Removed", "à°¬à±€à°œà±€ à°°à°¿à°®à±‚à°µà±à°¡à±"],
  ["Name Strip", "à°¨à±‡à°®à± à°¸à±à°Ÿà±à°°à°¿à°ªà±"],
  ["Premium Shapes", "à°ªà±à°°à±€à°®à°¿à°¯à°‚ à°·à±‡à°ªà±à°¸à±"],
  ["Transparent Cutouts", "à°Ÿà±à°°à°¾à°¨à±à°¸à±â€Œà°ªà°°à±†à°‚à°Ÿà± à°•à°Ÿà±Œà°Ÿà±à°¸à±"],
  ["Earnings", "à°Žà°°à±à°¨à°¿à°‚à°—à±à°¸à±"],
  ["Close", "à°•à±à°²à±‹à°œà±"],
  ["Apply", "à°…à°ªà±à°²à±ˆ"],
  ["Loading...", "à°²à±‹à°¡à°¿à°‚à°—à±..."],
  ["Search Creator", "à°¸à±†à°°à±à°šà± à°•à±à°°à°¿à°¯à±‡à°Ÿà°°à±"],
  ["Search manager", "à°¸à±†à°°à±à°šà± à°®à±‡à°¨à±‡à°œà°°à±"],
  ["Search by name, ID, email", "à°¨à±‡à°®à±, à°à°¡à°¿, à°‡à°®à±†à°¯à°¿à°²à±â€Œà°¤à±‹ à°¸à±†à°°à±à°šà± à°šà±‡à°¯à°‚à°¡à°¿"],
  ["All statuses", "à°†à°²à± à°¸à±à°Ÿà±‡à°Ÿà°¸à±†à°¸à±"],
]);

const EXISTING_TELUGU_NORMALIZATION_TE: Array<[RegExp, string]> = [
  [/à°…à°µà°²à±‹à°•à°¨à°‚/gi, "à°“à°µà°°à±à°µà±à°¯à±‚"],
  [/à°†à°®à±‹à°¦à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿|à°…à°‚à°—à±€à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿/gi, "à°¯à°¾à°•à±à°¸à±†à°ªà±à°Ÿà±†à°¡à±"],
  [/à°¤à°¿à°°à°¸à±à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿/gi, "à°°à°¿à°œà±†à°•à±à°Ÿà±†à°¡à±"],
  [/à°•à°¾à°°à°£à°‚/gi, "à°°à±€à°œà°¨à±"],
  [/à°†à°¦à°¾à°¯à°‚/gi, "à°Žà°°à±à°¨à°¿à°‚à°—à±à°¸à±"],
  [/à°®à±‚à°¸à°¿à°µà±‡à°¯à°¿/gi, "à°•à±à°²à±‹à°œà±"],
  [/à°Žà°‚à°šà±à°•à±à°¨à±à°¨ à°•à±‡à°Ÿà°—à°¿à°°à±€/gi, "à°¸à±†à°²à±†à°•à±à°Ÿà± à°šà±‡à°¸à°¿à°¨ à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€"],
  [/à°•à±‡à°Ÿà°—à°¿à°°à±€ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿/gi, "à°¸à±†à°²à±†à°•à±à°Ÿà± à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€"],
  [/à° à°•à±‡à°Ÿà°—à°¿à°°à±€à°²à± à°•à±‡à°Ÿà°¾à°¯à°¿à°‚à°šà°¬à°¡à°²à±‡à°¦à±/gi, "à°…à°¸à±ˆà°¨à±à°¡à± à°•à±à°¯à°¾à°Ÿà°—à°¿à°°à±€à°¸à± à°²à±‡à°µà±"],
  [/à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿/gi, "à°šà±‚à°¸à± à°ªà±‹à°¸à±à°Ÿà°°à±"],
  [/à°…à°ªà±â€Œà°²à±‹à°¡à±|à°…à°ªà±à°²à±‹à°¡à±/gi, "à°…à°ªà±à°²à±‹à°¡à±"],
  [/à°¨à°¾ à°…à°ªà±à°²à±‹à°¡à±à°¸à±|à°¨à°¾ à°…à°ªà±â€Œà°²à±‹à°¡à±à°¸à±/gi, "à°®à±ˆ à°…à°ªà±à°²à±‹à°¡à±à°¸à±"],
  [/à°¯à°¾à°•à±à°Ÿà°¿à°µà± à°…à°ªà±à°²à±‹à°¡à±à°¸à±|à°¯à°¾à°•à±à°Ÿà°¿à°µà± à°…à°ªà±â€Œà°²à±‹à°¡à±à°¸à±/gi, "à°¯à°¾à°•à±à°Ÿà°¿à°µà± à°…à°ªà±à°²à±‹à°¡à±à°¸à±"],
  [/à°ªà°¨à°¿à°¤à±€à°°à±|à°ªà°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±|à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±/gi, "à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±"],
  [/à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±|à°²à±€à°¡à°°à±à°¬à±‹à°°à±à°¡à±/gi, "à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±"],
  [/à°¡à°¾à°·à±à°¬à±‹à°°à±à°¡à±|à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±|à°¡à±à°¯à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±/gi, "à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±"],
  [/à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°•à±à°•à°¡\s*\?/gi, "à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à±"],
  [/à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°•à±à°•à°¡/gi, "à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à±"],
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function applyExistingTeluguNormalization(text: string) {
  let next = text;
  EXISTING_TELUGU_NORMALIZATION_TE.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  return next;
}

async function transliterateWithGoogleInputTools(text: string) {
  const url = new URL("https://inputtools.google.com/request");
  url.searchParams.set("text", text);
  url.searchParams.set("itc", "te-t-i0-und");
  url.searchParams.set("num", "1");

  const response = await fetch(url.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Transliteration request failed.");
  }

  const payload = (await response.json()) as unknown[];
  if (!Array.isArray(payload) || payload[0] !== "SUCCESS" || !Array.isArray(payload[1])) {
    throw new Error("Transliteration request failed.");
  }

  const parts = payload[1] as Array<[string, string[]]>;
  return parts
    .map((item) => (Array.isArray(item[1]) && item[1][0] ? item[1][0] : item[0]))
    .join("")
    .trim();
}

async function translateWithGoogle(
  text: string,
  targetLanguage: Exclude<SupportedLanguage, "te" | "en">,
) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Translation request failed.");
  }

  const payload = (await response.json()) as unknown[];
  const parts = Array.isArray(payload[0]) ? (payload[0] as unknown[]) : [];
  return (
    parts
      .map((item) => (Array.isArray(item) ? String(item[0] ?? "") : ""))
      .join("")
      .trim() || text
  );
}

async function translateSingle(text: string, targetLanguage: SupportedLanguage) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return normalized;
  }

  if (targetLanguage === "en") {
    return normalized;
  }

  if (targetLanguage === "te") {
    const normalizedTelugu = applyExistingTeluguNormalization(normalized);
    const exact = EXACT_TRANSLITERATION_TE.get(normalizeText(normalizedTelugu));
    if (exact) {
      return exact;
    }

    if (/[\u0C00-\u0C7F]/.test(normalizedTelugu)) {
      return normalizedTelugu;
    }

    const numberPlaceholders: string[] = [];
    let protectedText = normalizedTelugu.replace(/Mana Poster Ai/gi, "__MANA_POSTER__");
    protectedText = protectedText.replace(/\d+/g, (match) => {
      const index = numberPlaceholders.push(match) - 1;
      return `__NUM_${index}__`;
    });

    const transliterated = await transliterateWithGoogleInputTools(protectedText);
    let restored = transliterated.replaceAll("__MANA_POSTER__", "à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à±");
    numberPlaceholders.forEach((value, index) => {
      restored = restored.replaceAll(`__NUM_${index}__`, value);
    });

    return applyExistingTeluguNormalization(restored);
  }

  return translateWithGoogle(
    normalized,
    targetLanguage as Exclude<SupportedLanguage, "te" | "en">,
  );
}

export async function POST(req: NextRequest) {
  try {
    const payload = payloadSchema.parse(await req.json());
    const translations = await Promise.all(
      payload.texts.map((text) => translateSingle(text, payload.targetLanguage)),
    );
    return NextResponse.json({ ok: true, translations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to translate.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

