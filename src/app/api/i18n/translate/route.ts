import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type SupportedLanguage = "te" | "hi" | "en" | "ta" | "kn" | "ml";

const payloadSchema = z.object({
  targetLanguage: z.enum(["te", "hi", "en", "ta", "kn", "ml"]),
  texts: z.array(z.string().trim().min(1).max(500)).max(250),
});

const EXACT_TRANSLITERATION_TE = new Map<string, string>([
  ["Mana Poster Ai", "మన పోస్టర్"],
  ["Dashboard", "డాష్‌బోర్డ్"],
  ["Overview", "ఓవర్వ్యూ"],
  ["Upload", "అప్లోడ్"],
  ["Upload Posters", "అప్లోడ్ పోస్టర్స్"],
  ["Upload Studio", "అప్లోడ్ స్టూడియో"],
  ["My Uploads", "మై అప్లోడ్స్"],
  ["Leaderboard", "లీడర్‌బోర్డ్"],
  ["Performance", "పెర్ఫార్మెన్స్"],
  ["Creator Performance", "క్రియేటర్ పెర్ఫార్మెన్స్"],
  ["Performance Dashboard", "పెర్ఫార్మెన్స్ డాష్‌బోర్డ్"],
  ["Refresh", "రిఫ్రెష్"],
  ["Refreshing...", "రిఫ్రెష్ అవుతోంది..."],
  ["Admin Dashboard", "అడ్మిన్ డాష్‌బోర్డ్"],
  ["Manager Dashboard", "మేనేజర్ డాష్‌బోర్డ్"],
  ["Creator Dashboard", "క్రియేటర్ డాష్‌బోర్డ్"],
  ["Open Admin Dashboard", "అడ్మిన్ డాష్‌బోర్డ్ తెరవండి"],
  ["Open Manager Dashboard", "మేనేజర్ డాష్‌బోర్డ్ తెరవండి"],
  ["Open Creator Dashboard", "క్రియేటర్ డాష్‌బోర్డ్ తెరవండి"],
  ["Accepted", "యాక్సెప్టెడ్"],
  ["Rejected", "రిజెక్టెడ్"],
  ["Pending", "పెండింగ్"],
  ["Reason", "రీజన్"],
  ["Assigned Categories", "అసైన్డ్ క్యాటగిరీలు"],
  ["Selected Category", "సెలెక్ట్ చేసిన క్యాటగిరీ"],
  ["Select Category", "సెలెక్ట్ క్యాటగిరీ"],
  ["Select Creator", "సెలెక్ట్ క్రియేటర్"],
  ["Choose Poster", "పోస్టర్ ఎంచుకోండి"],
  ["Customization", "కస్టమైజేషన్"],
  ["Customize", "కస్టమైజ్"],
  ["Submit", "సబ్మిట్"],
  ["Login", "లాగిన్"],
  ["Sign in", "సైన్ ఇన్"],
  ["Continue to dashboard", "డాష్‌బోర్డ్‌కు కొనసాగండి"],
  ["Access your dashboard", "మీ డాష్‌బోర్డ్‌ను యాక్సెస్ చేయండి"],
  ["Photo Shape", "ఫోటో షేప్"],
  ["Photo Size", "ఫోటో సైజ్"],
  ["Photo Mode", "ఫోటో మోడ్"],
  ["Original Photo", "ఒరిజినల్ ఫోటో"],
  ["BG Removed", "బ్యాక్‌గ్రౌండ్ తీసేసినది"],
  ["Name Strip", "నేమ్ స్ట్రిప్"],
  ["Premium Shapes", "ప్రీమియం షేప్స్"],
  ["Transparent Cutouts", "ట్రాన్స్‌పరెంట్ కటౌట్స్"],
  ["Earnings", "ఎర్నింగ్స్"],
  ["Close", "క్లోజ్"],
  ["Apply", "అప్లై"],
  ["Loading...", "లోడింగ్..."],
  ["Search Creator", "సెర్చ్ క్రియేటర్"],
  ["Search manager", "సెర్చ్ మేనేజర్"],
  ["Search by name, ID, email", "పేరు, ID, ఇమెయిల్‌తో సెర్చ్ చేయండి"],
  ["All statuses", "అన్ని స్టేటస్‌లు"],
]);

const EXISTING_TELUGU_NORMALIZATION_TE: Array<[RegExp, string]> = [
  [/à°…à°µà°²à±‹à°•à°¨à°‚/gi, "ఓవర్వ్యూ"],
  [/à°†à°®à±‹à°¦à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿|à°…à°‚à°—à±€à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿/gi, "యాక్సెప్టెడ్"],
  [/à°¤à°¿à°°à°¸à±à°•à°°à°¿à°‚à°šà°¬à°¡à°¿à°‚à°¦à°¿/gi, "రిజెక్టెడ్"],
  [/à°•à°¾à°°à°£à°‚/gi, "రీజన్"],
  [/à°†à°¦à°¾à°¯à°‚/gi, "ఎర్నింగ్స్"],
  [/à°®à±‚à°¸à°¿à°µà±‡à°¯à°¿/gi, "క్లోజ్"],
  [/à°Žà°‚à°šà±à°•à±à°¨à±à°¨ à°•à±‡à°Ÿà°—à°¿à°°à±€/gi, "సెలెక్ట్ చేసిన క్యాటగిరీ"],
  [/à°•à±‡à°Ÿà°—à°¿à°°à±€ à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿/gi, "సెలెక్ట్ క్యాటగిరీ"],
  [/à° à°•à±‡à°Ÿà°—à°¿à°°à±€à°²à± à°•à±‡à°Ÿà°¾à°¯à°¿à°‚à°šà°¬à°¡à°²à±‡à°¦à±/gi, "అసైన్డ్ క్యాటగిరీలు లేవు"],
  [/à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°‚à°šà±à°•à±‹à°‚à°¡à°¿/gi, "పోస్టర్ ఎంచుకోండి"],
  [/à°…à°ªà±â€Œà°²à±‹à°¡à±|à°…à°ªà±à°²à±‹à°¡à±/gi, "అప్లోడ్"],
  [/à°¨à°¾ à°…à°ªà±à°²à±‹à°¡à±à°¸à±|à°¨à°¾ à°…à°ªà±â€Œà°²à±‹à°¡à±à°¸à±/gi, "మై అప్లోడ్స్"],
  [/à°¯à°¾à°•à±à°Ÿà°¿à°µà± à°…à°ªà±à°²à±‹à°¡à±à°¸à±|à°¯à°¾à°•à±à°Ÿà°¿à°µà± à°…à°ªà±â€Œà°²à±‹à°¡à±à°¸à±/gi, "యాక్టివ్ అప్లోడ్స్"],
  [/à°ªà°¨à°¿à°¤à±€à°°à±|à°ªà°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±|à°ªà±†à°°à±à°«à°¾à°°à±à°®à±†à°¨à±à°¸à±/gi, "పెర్ఫార్మెన్స్"],
  [/à°²à±€à°¡à°°à±â€Œà°¬à±‹à°°à±à°¡à±|à°²à±€à°¡à°°à±à°¬à±‹à°°à±à°¡à±/gi, "లీడర్‌బోర్డ్"],
  [/à°¡à°¾à°·à±à°¬à±‹à°°à±à°¡à±|à°¡à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±|à°¡à±à°¯à°¾à°·à±â€Œà°¬à±‹à°°à±à°¡à±/gi, "డాష్‌బోర్డ్"],
  [/à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°•à±à°•à°¡\s*\?/gi, "మన పోస్టర్"],
  [/à°®à°¨ à°ªà±‹à°¸à±à°Ÿà°°à± à°Žà°•à±à°•à°¡/gi, "మన పోస్టర్"],
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
    let restored = transliterated.replaceAll("__MANA_POSTER__", "మన పోస్టర్");
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

