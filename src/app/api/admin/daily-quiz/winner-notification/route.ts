import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

function cleanText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function isInvalidTokenMessage(message: string) {
  return (
    /registration-token-not-registered/i.test(message) ||
    /requested entity was not found/i.test(message) ||
    /notregistered/i.test(message)
  );
}

function tokenDocId(token: string) {
  return token.replace(/\//g, "_");
}

async function tokenBelongsToUid(token: string, uid: string) {
  const publicSnap = await adminDb
    .collection("publicDeviceTokens")
    .doc(tokenDocId(token))
    .get();
  if (!publicSnap.exists) {
    return true;
  }
  const ownerUid = cleanText(publicSnap.data()?.uid);
  return !ownerUid || ownerUid === uid;
}

function sanitizeLanguage(value: unknown, fallback = "english") {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  const aliases: Record<string, string> = {
    te: "telugu",
    hi: "hindi",
    en: "english",
    ta: "tamil",
    kn: "kannada",
    ml: "malayalam",
    as: "assamese",
    gu: "gujarati",
    mr: "marathi",
    or: "odia",
    pa: "punjabi",
    ne: "nepali",
    bn: "bengali",
  };
  return aliases[normalized] ?? (normalized || fallback);
}

function languageFromData(data: FirebaseFirestore.DocumentData, fallback = "english") {
  return sanitizeLanguage(
    data.selectedRegionLanguageCode || data.preferredLanguage || data.language || data.locale,
    fallback,
  );
}

function winnerText(language: string, input: { userName: string; rank: number; scoreLabel: string }) {
  const rank = input.rank > 0 ? String(input.rank) : "";
  const score = input.scoreLabel ? ` ${input.scoreLabel}` : "";
  const copy: Record<string, { title: string; body: string }> = {
    telugu: {
      title: "అభినందనలు",
      body: `${input.userName}, మీరు ఈ వారం రాష్ట్ర టాప్ ${rank} క్విజ్ విజేత. స్కోర్${score}`,
    },
    hindi: {
      title: "बधाई हो",
      body: `${input.userName}, आप इस सप्ताह राज्य टॉप ${rank} क्विज विजेता हैं। स्कोर${score}`,
    },
    tamil: {
      title: "வாழ்த்துகள்",
      body: `${input.userName}, இந்த வார மாநில டாப் ${rank} க்விஸ் வெற்றியாளர் நீங்கள். ஸ்கோர்${score}`,
    },
    kannada: {
      title: "ಅಭಿನಂದನೆಗಳು",
      body: `${input.userName}, ನೀವು ಈ ವಾರ ರಾಜ್ಯ ಟಾಪ್ ${rank} ಕ್ವಿಜ್ ವಿಜೇತರು. ಸ್ಕೋರ್${score}`,
    },
    malayalam: {
      title: "അഭിനന്ദനങ്ങൾ",
      body: `${input.userName}, ഈ ആഴ്ച സംസ്ഥാന ടോപ്പ് ${rank} ക്വിസ് വിജയി നിങ്ങളാണ്. സ്കോർ${score}`,
    },
    english: {
      title: "Congratulations",
      body: `${input.userName}, you are this week's State Top ${rank} Quiz Winner${input.scoreLabel ? ` with score ${input.scoreLabel}` : ""}.`,
    },
    assamese: {
      title: "অভিনন্দন",
      body: `${input.userName}, আপুনি এই সপ্তাহৰ ৰাজ্যৰ টপ ${rank} কুইজ বিজয়ী। স্কোৰ${score}`,
    },
    konkani: {
      title: "अभिनंदनां",
      body: `${input.userName}, तुमी ह्या आठवड्याचे राज्य टॉप ${rank} क्विझ जैतिवंत. स्कोर${score}`,
    },
    gujarati: {
      title: "અભિનંદન",
      body: `${input.userName}, તમે આ અઠવાડિયે રાજ્યના ટોપ ${rank} ક્વિઝ વિજેતા છો. સ્કોર${score}`,
    },
    marathi: {
      title: "अभिनंदन",
      body: `${input.userName}, तुम्ही या आठवड्याचे राज्य टॉप ${rank} क्विझ विजेते आहात. स्कोअर${score}`,
    },
    meitei: {
      title: "ꯊꯥꯒꯠꯆꯔꯤ",
      body: `${input.userName}, ꯅꯍꯥꯛ ꯃꯁꯤꯒꯤ ꯆꯌꯣꯜ ꯂꯩꯄꯥꯛ ꯇꯣꯞ ${rank} ꯀ꯭ꯕꯤꯖ ꯃꯥꯏꯄꯥꯛꯄ ꯑꯣꯏꯔꯦ. ꯁ꯭ꯀꯣꯔ${score}`,
    },
    mizo: {
      title: "Kan lawmpui",
      body: `${input.userName}, he kar chhung hian state Top ${rank} quiz winner i ni. Score${score}`,
    },
    odia: {
      title: "ଅଭିନନ୍ଦନ",
      body: `${input.userName}, ଆପଣ ଏହି ସପ୍ତାହର ରାଜ୍ୟ ଟପ୍ ${rank} କ୍ୱିଜ୍ ବିଜେତା। ସ୍କୋର${score}`,
    },
    punjabi: {
      title: "ਵਧਾਈਆਂ",
      body: `${input.userName}, ਤੁਸੀਂ ਇਸ ਹਫ਼ਤੇ ਦੇ ਰਾਜ ਟਾਪ ${rank} ਕਵਿਜ਼ ਜੇਤੂ ਹੋ। ਸਕੋਰ${score}`,
    },
    nepali: {
      title: "बधाई छ",
      body: `${input.userName}, तपाईं यो हप्ताको राज्य टप ${rank} क्विज विजेता हुनुहुन्छ। स्कोर${score}`,
    },
    bengali: {
      title: "অভিনন্দন",
      body: `${input.userName}, আপনি এই সপ্তাহের রাজ্য টপ ${rank} কুইজ বিজয়ী। স্কোর${score}`,
    },
    kashmiri: {
      title: "مبارک",
      body: `${input.userName}, توہۍ چھو اَمہ ہفتہ ریاست ٹاپ ${rank} کوئز وِنر۔ سکور${score}`,
    },
    ladakhi: {
      title: "བཀྲ་ཤིས་བདེ་ལེགས",
      body: `${input.userName}, ཁྱེད་རང་འདི་གཟའ་འཁོར་གྱི་རྒྱལ་ཁབ་ཊོཔ ${rank} ཀྭིཛ་རྒྱལ་ཁ་ཐོབ་མཁན་ཡིན། སྐོར${score}`,
    },
  };
  return copy[language] ?? copy.english;
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const uid = cleanText(body.uid);
    const userName = cleanText(body.userName, "Quiz Winner");
    const userEmail = cleanText(body.userEmail).toLowerCase();
    const rank = Number(body.rank || 0);
    const weekKey = cleanText(body.weekKey);
    const regionId = cleanText(body.regionId);
    const regionName = cleanText(body.regionName, regionId || "State");
    const correctCount = Number(body.correctCount || 0);
    const totalAnswered = Number(body.totalAnswered || 0);
    const scoreTotal = Number(body.scoreTotal || totalAnswered || 0);
    const scoreLabel =
      scoreTotal > 0 ? `${Math.max(0, correctCount)}/${Math.max(0, scoreTotal)}` : "";

    if (!uid) {
      return NextResponse.json({ ok: false, error: "Winner UID is required." }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userLanguage = languageFromData(userSnap.data() ?? {}, "english");
    const tokenSnap = await adminDb.collection("users").doc(uid).collection("deviceTokens").limit(20).get();
    const tokenRows: Array<{ id: string; refPath: string; token: string; language: string }> = [];
    for (const doc of tokenSnap.docs) {
        const data = doc.data() ?? {};
        const token = cleanText(data.token);
        if (!token) {
          continue;
        }
        if (!(await tokenBelongsToUid(token, uid))) {
          await adminDb.doc(doc.ref.path).delete().catch(() => undefined);
          continue;
        }
        tokenRows.push({
          id: doc.id,
          refPath: doc.ref.path,
          token,
          language: languageFromData(data, userLanguage),
        });
    }

    if (tokenRows.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "This user has no active device token. Ask user to open the app with notifications enabled.",
      }, { status: 400 });
    }

    let deliveredCount = 0;
    let failedCount = 0;
    const languageGroups = new Map<string, typeof tokenRows>();
    for (const row of tokenRows) {
      const rows = languageGroups.get(row.language) ?? [];
      rows.push(row);
      languageGroups.set(row.language, rows);
    }

    for (const [language, rows] of languageGroups.entries()) {
      const localized = winnerText(language, { userName, rank, scoreLabel });
      const response = await adminMessaging.sendEachForMulticast({
        tokens: rows.map((item) => item.token),
        data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        route: "home",
        category: "daily_quiz",
        categoryKey: "daily_quiz",
        title: localized.title,
        body: localized.body,
        notificationKind: "daily_quiz",
        imageUrl: "",
        posterImage: "",
        posterBaseImage: "",
        userPhoto: "",
        headerText: localized.body,
        footerText: "Mana Poster Ai Daily Quiz",
        source: "admin_quiz_winner_push",
        uid,
        userEmail,
        weekKey,
        regionId,
        regionName,
        rank: String(rank || ""),
        score: scoreLabel,
        language,
      },
      android: {
        priority: "high",
      },
      });
      deliveredCount += response.successCount;
      failedCount += response.failureCount;

      for (let index = 0; index < response.responses.length; index += 1) {
        const result = response.responses[index];
        const tokenRow = rows[index];
        if (!result.success && result.error && isInvalidTokenMessage(result.error.message || "")) {
          await adminDb.doc(tokenRow.refPath).delete().catch(() => undefined);
        }
      }
    }
    const auditText = winnerText(userLanguage, { userName, rank, scoreLabel });

    const sentAt = Date.now();
    await adminDb.collection("quizWinnerNotifications").add({
      uid,
      userName,
      userEmail,
      rank,
      weekKey,
      regionId,
      regionName,
      scoreLabel,
      title: auditText.title,
      message: auditText.body,
      languages: Array.from(languageGroups.keys()),
      usesTextOnlyFrame: true,
      targetCount: tokenRows.length,
      deliveredCount,
      failedCount,
      createdByUid: actor.uid,
      createdByEmail: actor.email ?? "",
      createdAt: sentAt,
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.daily_quiz.winner_push",
      targetId: uid,
      targetType: "dailyQuizWinner",
      message: `Sent quiz winner push to ${userEmail || userName || uid}`,
      metadata: {
        uid,
        userName,
        userEmail,
        rank,
        weekKey,
        regionId,
        regionName,
        scoreLabel,
        languages: Array.from(languageGroups.keys()),
        targetCount: tokenRows.length,
        deliveredCount,
        failedCount,
      },
    });

    return NextResponse.json({
      ok: true,
      targetCount: tokenRows.length,
      deliveredCount,
      failedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send winner notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
