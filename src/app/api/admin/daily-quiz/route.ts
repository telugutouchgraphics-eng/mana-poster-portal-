import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

const QUIZ_COLLECTION = "dailyQuizzes";
const ATTEMPT_COLLECTION = "dailyQuizAttempts";
const LEADERBOARD_COLLECTION = "weeklyQuizLeaderboards";
const WEEKLY_SCORE_COLLECTION = "weeklyQuizScores";
const USER_QUIZ_STATS_COLLECTION = "userQuizStats";
const APP_PRO_ENTITLEMENT_PATH = "entitlements/pro";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const APP_MONTHLY_PRODUCT_ID = "mana_poster_premium_monthly_149";
const APP_MONTHLY_BASE_PLAN_ID = "monthly-149";
const EDITOR_BUNDLE_PRODUCT_ID = "mana_poster_editor_pro";
const EDITOR_YEARLY_BASE_PLAN_ID = "yearly-699";
const INELIGIBLE_PRIZE_PRODUCT_IDS = new Set([
  "first150_trial",
  "manual_lifetime_whitelist",
  "referral_reward",
]);
const INELIGIBLE_PRIZE_SOURCES = new Set([
  "first150_trial",
  "manual_lifetime_whitelist",
]);
const INELIGIBLE_PRIZE_STATES = new Set([
  "FIRST150_TRIAL",
  "REFERRAL_REWARD",
]);

type LocalizedText = Record<string, string>;
type QuizReportParticipant = {
  id?: string;
  uid?: string;
  userName?: string;
  userEmail?: string;
  correctCount?: number;
  totalAnswered?: number;
  totalDurationSeconds?: number;
  effectiveDurationSeconds?: number;
  weeklyExpectedTotal?: number;
  missedQuestions?: number;
  prizeEligible?: boolean;
  prizeEligibilityReason?: string;
  prizeSubscriptionProductId?: string;
  rank?: number;
};

type QuizDoc = FirebaseFirestore.DocumentData & {
  id?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  dateKey?: string;
  targetStates?: string[];
};
const QUIZ_LANGUAGE_KEYS = [
  "telugu",
  "english",
] as const;

function normalizeRegionId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function weekKeyForDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function istHourNow() {
  const value = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(value);
}

function todayIstDateKey(offsetDays = 0): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() + offsetDays);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

function quizCreatedAtMillis(data: QuizDoc): number {
  const value = data.createdAt;
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

function canEditQuiz(data: QuizDoc): boolean {
  const createdAt = quizCreatedAtMillis(data);
  return createdAt > 0 && Date.now() - createdAt <= ONE_DAY_MS;
}

function correctOptionIdForQuestion(question: FirebaseFirestore.DocumentData): string {
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const configuredId = String(question.correctOptionId ?? "").trim();
  if (configuredId) return configuredId;
  const index = Number(question.correctOptionIndex);
  if (Number.isInteger(index) && index >= 0 && index < rawOptions.length) {
    return String(rawOptions[index]?.id ?? `o${index}`).trim();
  }
  return "";
}

function quizQuestionCount(data: FirebaseFirestore.DocumentData): number {
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const validQuestions = questions.filter((question) => {
    const source = question && typeof question === "object" ? question as FirebaseFirestore.DocumentData : {};
    const options = Array.isArray(source.options) ? source.options : [];
    return String(source.id ?? "").trim() && options.length >= 4 && correctOptionIdForQuestion(source);
  });
  return Math.min(10, validQuestions.length);
}

function quizTargetsRegion(data: FirebaseFirestore.DocumentData, regionId: string): boolean {
  const targets = Array.isArray(data.targetStates)
    ? data.targetStates.map(normalizeRegionId).filter(Boolean)
    : [];
  return targets.includes("all") || targets.includes(regionId);
}

async function loadWeeklyExpectedTotal(weekKey: string, regionId: string): Promise<number> {
  if (!weekKey || !regionId) return 0;
  const snap = await adminDb.collection(QUIZ_COLLECTION)
    .where("weekKey", "==", weekKey)
    .where("active", "==", true)
    .limit(200)
    .get();
  return snap.docs.reduce((sum, doc) => {
    const data = doc.data();
    return quizTargetsRegion(data, regionId) ? sum + quizQuestionCount(data) : sum;
  }, 0);
}

async function loadDailyExpectedTotal(dateKey: string, regionId: string): Promise<number> {
  if (!dateKey || !regionId) return 10;
  const snap = await adminDb.collection(QUIZ_COLLECTION)
    .where("dateKey", "==", dateKey)
    .where("active", "==", true)
    .limit(50)
    .get();
  const total = snap.docs.reduce((sum, doc) => {
    const data = doc.data();
    return quizTargetsRegion(data, regionId) ? sum + quizQuestionCount(data) : sum;
  }, 0);
  return total > 0 ? total : 10;
}

function effectiveQuizDurationSeconds(input: {
  totalDurationSeconds?: number;
  totalAnswered?: number;
  weeklyExpectedTotal?: number;
}): number {
  const expected = Math.max(0, Number(input.weeklyExpectedTotal || 0));
  const answered = Math.max(0, Number(input.totalAnswered || 0));
  const missed = Math.max(0, expected - answered);
  const rawDuration = Number(input.totalDurationSeconds || 0);
  const answeredDuration = answered > 0 && rawDuration <= 0 ? answered * 30 : Math.max(0, rawDuration);
  return answeredDuration + missed * 30;
}

function sortWeeklyParticipants(rows: QuizReportParticipant[]) {
  return [...rows].sort((a, b) => {
    const correctDiff = Number(b.correctCount || 0) - Number(a.correctCount || 0);
    if (correctDiff !== 0) return correctDiff;
    const durationDiff = Number(a.effectiveDurationSeconds || 0) - Number(b.effectiveDurationSeconds || 0);
    if (durationDiff !== 0) return durationDiff;
    const answeredDiff = Number(b.totalAnswered || 0) - Number(a.totalAnswered || 0);
    if (answeredDiff !== 0) return answeredDiff;
    return String(a.uid || "").localeCompare(String(b.uid || ""));
  });
}

function sortDailyParticipants(rows: QuizReportParticipant[]) {
  return [...rows].sort((a, b) => {
    const correctDiff = Number(b.correctCount || 0) - Number(a.correctCount || 0);
    if (correctDiff !== 0) return correctDiff;
    const durationDiff = Number(a.effectiveDurationSeconds || 0) - Number(b.effectiveDurationSeconds || 0);
    if (durationDiff !== 0) return durationDiff;
    const answeredDiff = Number(b.totalAnswered || 0) - Number(a.totalAnswered || 0);
    if (answeredDiff !== 0) return answeredDiff;
    return String(a.uid || "").localeCompare(String(b.uid || ""));
  });
}

function userEmailFromQuizData(data: FirebaseFirestore.DocumentData): string {
  const userDetails = data.userDetails;
  const nestedEmail =
    userDetails && typeof userDetails === "object" && !Array.isArray(userDetails)
      ? String((userDetails as Record<string, unknown>).email ?? "").trim()
      : "";
  return String(data.userEmail ?? data.email ?? nestedEmail).trim().toLowerCase();
}

function readTimestampMillis(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

function hasActiveEntitlement(data: FirebaseFirestore.DocumentData | undefined, now = Date.now()) {
  if (!data || data.isPro !== true) return false;
  const expiryMillis = readTimestampMillis(data.expiryTime);
  return expiryMillis <= 0 || expiryMillis > now;
}

function prizeEligibilityFromEntitlement(data: FirebaseFirestore.DocumentData | undefined, now = Date.now()) {
  if (!data) {
    return {
      prizeEligible: false,
      prizeEligibilityReason: "No active subscription",
      prizeSubscriptionProductId: "",
    };
  }
  const productId = String(data.productId ?? "").trim();
  const basePlanId = String(data.basePlanId ?? "").trim();
  const offerId = String(data.offerId ?? "").trim();
  const source = String(data.source ?? "").trim();
  const subscriptionState = String(data.subscriptionState ?? "").trim();
  const accessScope = String(data.accessScope ?? "").trim();
  const active = hasActiveEntitlement(data, now);
  if (!active) {
    return {
      prizeEligible: false,
      prizeEligibilityReason: "Subscription inactive or expired",
      prizeSubscriptionProductId: productId,
    };
  }
  if (
    INELIGIBLE_PRIZE_PRODUCT_IDS.has(productId) ||
    INELIGIBLE_PRIZE_SOURCES.has(source) ||
    INELIGIBLE_PRIZE_STATES.has(subscriptionState) ||
    data.referralRewardActive === true
  ) {
    return {
      prizeEligible: false,
      prizeEligibilityReason: "Trial, free, promo, or referral access",
      prizeSubscriptionProductId: productId,
    };
  }
  const marker = `${basePlanId} ${offerId}`.toLowerCase();
  if (data.isTrialOrIntro === true || marker.includes("trial") || marker.includes("intro")) {
    return {
      prizeEligible: false,
      prizeEligibilityReason: "Trial, free, promo, or referral access",
      prizeSubscriptionProductId: productId,
    };
  }
  const isPaidAppMonthly =
    productId === APP_MONTHLY_PRODUCT_ID &&
    data.appAccess === true &&
    (basePlanId === APP_MONTHLY_BASE_PLAN_ID || basePlanId === "");
  const isPaidYearlyBundle =
    productId === EDITOR_BUNDLE_PRODUCT_ID &&
    data.appAccess === true &&
    data.editorAccess === true &&
    accessScope === "bundle" &&
    basePlanId === EDITOR_YEARLY_BASE_PLAN_ID;
  if (!isPaidAppMonthly && !isPaidYearlyBundle) {
    return {
      prizeEligible: false,
      prizeEligibilityReason: "Plan not eligible for prize payout",
      prizeSubscriptionProductId: productId,
    };
  }
  return {
    prizeEligible: true,
    prizeEligibilityReason: "Active paid plan",
    prizeSubscriptionProductId: productId,
  };
}

async function attachPrizeEligibility<T extends QuizReportParticipant>(participants: T[]): Promise<T[]> {
  const uidList = Array.from(new Set(participants.map((item) => String(item.uid ?? "").trim()).filter(Boolean)));
  if (uidList.length === 0) return participants;
  const refs = uidList.map((uid) => adminDb.doc(`users/${uid}/${APP_PRO_ENTITLEMENT_PATH}`));
  const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += 100) {
    const chunk = refs.slice(index, index + 100);
    snapshots.push(...await adminDb.getAll(...chunk));
  }
  const byUid = new Map<string, FirebaseFirestore.DocumentData>();
  for (const snapshot of snapshots) {
    if (snapshot.exists) {
      const uid = snapshot.ref.parent.parent?.id;
      if (uid) byUid.set(uid, snapshot.data() ?? {});
    }
  }
  const now = Date.now();
  return participants.map((item) => {
    const uid = String(item.uid ?? "").trim();
    return {
      ...item,
      ...prizeEligibilityFromEntitlement(byUid.get(uid), now),
    };
  });
}

async function countQuery(query: FirebaseFirestore.Query) {
  const snap = await query.count().get();
  return snap.data().count;
}

async function cleanupOldQuizHistory() {
  const cutoff = todayIstDateKey(-7);
  const snap = await adminDb.collection(QUIZ_COLLECTION)
    .where("dateKey", "<", cutoff)
    .limit(200)
    .get();
  if (snap.empty) return;
  for (const doc of snap.docs) {
    await deleteQuizAndResults(doc.id);
  }
}

async function deleteQuizAndResults(quizId: string) {
  while (true) {
    const attemptSnap = await adminDb.collection(ATTEMPT_COLLECTION)
      .where("quizId", "==", quizId)
      .limit(150)
      .get();
    if (attemptSnap.empty) break;
    const batch = adminDb.batch();
    for (const attemptDoc of attemptSnap.docs) {
      const data = attemptDoc.data();
      const uid = String(data.uid ?? "");
      const weekKey = String(data.weekKey ?? "");
      const regionId = normalizeRegionId(data.regionId);
      const correctCount = Number(data.correctCount || 0);
      const totalAnswered = Number(data.totalAnswered || 0);
      const durationSeconds = Number(data.durationSeconds || 0);
      if (uid && weekKey && regionId) {
        const scoreRef = adminDb.collection(WEEKLY_SCORE_COLLECTION).doc(`${weekKey}_${regionId}_${uid}`);
        batch.set(scoreRef, {
          correctCount: FieldValue.increment(-correctCount),
          totalAnswered: FieldValue.increment(-totalAnswered),
          totalDurationSeconds: FieldValue.increment(-durationSeconds),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (uid) {
        const statsRef = adminDb.collection(USER_QUIZ_STATS_COLLECTION).doc(uid);
        batch.set(statsRef, {
          totalCorrect: FieldValue.increment(-correctCount),
          totalAnswered: FieldValue.increment(-totalAnswered),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      batch.delete(attemptDoc.ref);
    }
    await batch.commit();
  }
  await adminDb.collection(QUIZ_COLLECTION).doc(quizId).delete();
}

async function deleteOverlappingQuizzes(dateKey: string, targetStates: string[], excludeQuizId = "") {
  const targetSet = new Set(targetStates.map(normalizeRegionId).filter(Boolean));
  if (!dateKey || targetSet.size === 0) return;
  const snap = await adminDb.collection(QUIZ_COLLECTION)
    .where("dateKey", "==", dateKey)
    .where("active", "==", true)
    .limit(200)
    .get();
  for (const doc of snap.docs) {
    if (doc.id === excludeQuizId) continue;
    const data = doc.data() as QuizDoc;
    const existingTargets = Array.isArray(data.targetStates)
      ? data.targetStates.map(normalizeRegionId).filter(Boolean)
      : [];
    const overlaps = existingTargets.includes("all") ||
      targetSet.has("all") ||
      existingTargets.some((regionId) => targetSet.has(regionId));
    if (overlaps) {
      await deleteQuizAndResults(doc.id);
    }
  }
}

async function loadDailyReport(dateKey: string, regionId: string) {
  if (!dateKey || !regionId) return null;
  const regionName = DASHBOARD_REGIONS.find((item) => item.id === regionId)?.name ?? regionId;
  const baseAttemptQuery = adminDb.collection(ATTEMPT_COLLECTION)
    .where("dateKey", "==", dateKey)
    .where("regionId", "==", regionId);
  const dailyExpectedTotal = await loadDailyExpectedTotal(dateKey, regionId);
  const [totalUsers, participatedUsers, completedUsers, attemptSnap] = await Promise.all([
    countQuery(adminDb.collection("users").where("selectedRegion", "==", regionId)),
    countQuery(baseAttemptQuery),
    countQuery(baseAttemptQuery.where("totalAnswered", ">=", dailyExpectedTotal)),
    baseAttemptQuery
      .orderBy("correctCount", "desc")
      .orderBy("totalAnswered", "desc")
      .limit(500)
      .get(),
  ]);
  const participants = await attachPrizeEligibility(sortDailyParticipants(attemptSnap.docs.map((doc) => {
    const data = doc.data();
    const correctCount = Number(data.correctCount || 0);
    const totalAnswered = Number(data.totalAnswered || 0);
    const totalDurationSeconds = Number(data.totalDurationSeconds ?? data.durationSeconds ?? 0);
    const effectiveDurationSeconds = effectiveQuizDurationSeconds({
      totalDurationSeconds,
      totalAnswered,
      weeklyExpectedTotal: dailyExpectedTotal,
    });
    return {
      id: doc.id,
      uid: String(data.uid ?? ""),
      userName: String(data.userName ?? ""),
      userEmail: userEmailFromQuizData(data),
      correctCount,
      totalAnswered,
      totalDurationSeconds,
      effectiveDurationSeconds,
      completed: totalAnswered >= dailyExpectedTotal,
    };
  })).map((item, index) => ({ ...item, rank: index + 1 })));
  const totalAnswers = participants.reduce((sum, item) => sum + Number(item.totalAnswered || 0), 0);
  const totalCorrect = participants.reduce((sum, item) => sum + Number(item.correctCount || 0), 0);
  const participationRate = totalUsers > 0 ? Math.round((participatedUsers / totalUsers) * 10000) / 100 : 0;
  const nowIstHour = istHourNow();
  return {
    dateKey,
    regionId,
    regionName,
    finalCutoffLabel: "10:00 PM IST",
    isFinalForToday: nowIstHour >= 22,
    totalUsers,
    participatedUsers,
    completedUsers,
    totalAnswers,
    totalCorrect,
    participationRate,
    dailyExpectedTotal,
    topParticipants: participants.slice(0, 500),
  };
}

async function loadWeeklyReport(weekKey: string, regionId: string, participants: QuizReportParticipant[]) {
  if (!weekKey || !regionId) return null;
  const regionName = DASHBOARD_REGIONS.find((item) => item.id === regionId)?.name ?? regionId;
  const weeklyExpectedTotal = await loadWeeklyExpectedTotal(weekKey, regionId);
  const baseScoreQuery = adminDb.collection(WEEKLY_SCORE_COLLECTION)
    .where("weekKey", "==", weekKey)
    .where("regionId", "==", regionId);
  const [totalUsers, participatedUsers, activeUsers] = await Promise.all([
    countQuery(adminDb.collection("users").where("selectedRegion", "==", regionId)),
    countQuery(baseScoreQuery),
    countQuery(baseScoreQuery.where("totalAnswered", ">=", 1)),
  ]);
  const topParticipants = await attachPrizeEligibility(participants.slice(0, 50).map((item, index) => ({
    ...item,
    weeklyExpectedTotal,
    missedQuestions: Math.max(0, weeklyExpectedTotal - Number(item.totalAnswered || 0)),
    effectiveDurationSeconds: effectiveQuizDurationSeconds({
      totalDurationSeconds: Number(item.totalDurationSeconds || 0),
      totalAnswered: Number(item.totalAnswered || 0),
      weeklyExpectedTotal,
    }),
    rank: index + 1,
  })));
  const topAnswers = topParticipants.reduce((sum, item) => sum + Number(item.totalAnswered || 0), 0);
  const topCorrect = topParticipants.reduce((sum, item) => sum + Number(item.correctCount || 0), 0);
  const participationRate = totalUsers > 0 ? Math.round((participatedUsers / totalUsers) * 10000) / 100 : 0;
  return {
    weekKey,
    regionId,
    regionName,
    totalUsers,
    participatedUsers,
    activeUsers,
    participationRate,
    topAnswers,
    topCorrect,
    weeklyExpectedTotal,
    topParticipants,
  };
}

function cleanLocalizedText(input: unknown): LocalizedText {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const out: LocalizedText = {};
  for (const key of QUIZ_LANGUAGE_KEYS) {
    const value = String(source[key] ?? "").trim();
    if (value) out[key] = value;
  }
  return out;
}

function hasTeluguAndEnglishText(input: LocalizedText): boolean {
  return Boolean(String(input.telugu ?? "").trim() && String(input.english ?? "").trim());
}

function cleanQuestions(input: unknown) {
  const rows = Array.isArray(input) ? input : [];
  return rows.slice(0, 10).map((row, index) => {
    const source = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const rawCorrectOptionIndex = Number(source.correctOptionIndex);
    const hasValidCorrectOption = Number.isInteger(rawCorrectOptionIndex) && rawCorrectOptionIndex >= 0 && rawCorrectOptionIndex <= 3;
    const options = (Array.isArray(source.options) ? source.options : []).slice(0, 4).map((option, optionIndex) => {
      const optionSource = option && typeof option === "object" ? option as Record<string, unknown> : {};
      return {
        id: `o${optionIndex}`,
        text: cleanLocalizedText(optionSource.text),
      };
    });
    return {
      id: String(source.id ?? `q${index + 1}`).trim() || `q${index + 1}`,
      text: cleanLocalizedText(source.text),
      options,
      correctOptionId: hasValidCorrectOption ? `o${rawCorrectOptionIndex}` : "",
      correctOptionIndex: hasValidCorrectOption ? rawCorrectOptionIndex : null,
    };
  }).filter((question) => {
    const hasQuestion = hasTeluguAndEnglishText(question.text);
    const hasOptions = question.options.length === 4 && question.options.every((item) => hasTeluguAndEnglishText(item.text));
    return hasQuestion && hasOptions && question.correctOptionIndex != null;
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    await cleanupOldQuizHistory();
    const dateKey = normalizeDateKey(req.nextUrl.searchParams.get("dateKey"));
    const weekKey = String(req.nextUrl.searchParams.get("weekKey") ?? "").trim();
    const regionId = normalizeRegionId(req.nextUrl.searchParams.get("regionId"));

    const historyCutoff = todayIstDateKey(-7);
    const historySnap = await adminDb.collection(QUIZ_COLLECTION)
      .where("dateKey", ">=", historyCutoff)
      .orderBy("dateKey", "desc")
      .limit(500)
      .get();
    const quizzes = historySnap.docs.map((doc) => {
      const data = doc.data() as QuizDoc;
      return { id: doc.id, ...data, canEdit: canEditQuiz(data) };
    }).filter((quiz) => {
      const targets = Array.isArray(quiz.targetStates) ? quiz.targetStates.map(normalizeRegionId) : [];
      return !regionId || targets.includes(regionId) || targets.includes("all");
    }).slice(0, 50);

    let dailyReport = null;
    if (dateKey && regionId) {
      dailyReport = await loadDailyReport(dateKey, regionId);
    }

    let leaderboard = null;
    let weeklyReport = null;
    if (weekKey && regionId) {
      const weeklyExpectedTotal = await loadWeeklyExpectedTotal(weekKey, regionId);
      const boardSnap = await adminDb.collection(LEADERBOARD_COLLECTION).doc(`${weekKey}_${regionId}`).get();
      const scoresSnap = await adminDb.collection(WEEKLY_SCORE_COLLECTION)
        .where("weekKey", "==", weekKey)
        .where("regionId", "==", regionId)
        .orderBy("rankSort", "asc")
        .limit(500)
        .get();
      const participants = scoresSnap.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data(),
        weeklyExpectedTotal,
        missedQuestions: Math.max(0, weeklyExpectedTotal - Number(doc.data().totalAnswered || 0)),
        effectiveDurationSeconds: effectiveQuizDurationSeconds({
          totalDurationSeconds: Number(doc.data().totalDurationSeconds || 0),
          totalAnswered: Number(doc.data().totalAnswered || 0),
          weeklyExpectedTotal,
        }),
        userEmail: userEmailFromQuizData(doc.data()),
      }));
      const sortedParticipants = await attachPrizeEligibility(sortWeeklyParticipants(participants).map((item, index) => ({
        ...item,
        rank: index + 1,
      })));
      leaderboard = {
        ...(boardSnap.exists ? { id: boardSnap.id, ...boardSnap.data() } : {}),
        participants: sortedParticipants,
      };
      weeklyReport = await loadWeeklyReport(weekKey, regionId, sortedParticipants);
    }

    return NextResponse.json({ ok: true, quizzes, dailyReport, weeklyReport, leaderboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load quiz.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = await req.json() as Record<string, unknown>;
    const dateKey = normalizeDateKey(body.dateKey);
    if (!dateKey) {
      return NextResponse.json({ ok: false, error: "Valid date is required." }, { status: 400 });
    }
    const targetStatesRaw = Array.isArray(body.targetStates) ? body.targetStates : [];
    const targetStates = targetStatesRaw.map(normalizeRegionId).filter(Boolean);
    if (targetStates.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one state." }, { status: 400 });
    }
    const title = cleanLocalizedText(body.title);
    if (!hasTeluguAndEnglishText(title)) {
      return NextResponse.json({ ok: false, error: "Quiz title is required in Telugu and English." }, { status: 400 });
    }
    const questions = cleanQuestions(body.questions);
    if (questions.length < 10) {
      return NextResponse.json({ ok: false, error: "At least 10 valid Telugu and English questions are required." }, { status: 400 });
    }
    const now = Date.now();
    await deleteOverlappingQuizzes(dateKey, targetStates);
    const ref = adminDb.collection(QUIZ_COLLECTION).doc(`${dateKey}_${targetStates.slice(0, 4).join("_")}`);
    await ref.set({
      id: ref.id,
      dateKey,
      weekKey: weekKeyForDateKey(dateKey),
      title,
      targetStates,
      questions,
      active: body.active !== false,
      createdBy: actor.uid,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save quiz.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = await req.json() as Record<string, unknown>;
    const quizId = String(body.id ?? "").trim();
    if (!quizId) {
      return NextResponse.json({ ok: false, error: "Quiz id is required." }, { status: 400 });
    }
    const ref = adminDb.collection(QUIZ_COLLECTION).doc(quizId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Quiz not found." }, { status: 404 });
    }
    const existing = snap.data() as QuizDoc;
    if (!canEditQuiz(existing)) {
      return NextResponse.json({ ok: false, error: "Quiz can be edited only within 24 hours." }, { status: 403 });
    }
    const dateKey = normalizeDateKey(body.dateKey);
    if (!dateKey) {
      return NextResponse.json({ ok: false, error: "Valid date is required." }, { status: 400 });
    }
    const targetStatesRaw = Array.isArray(body.targetStates) ? body.targetStates : [];
    const targetStates = targetStatesRaw.map(normalizeRegionId).filter(Boolean);
    if (targetStates.length === 0) {
      return NextResponse.json({ ok: false, error: "Select at least one state." }, { status: 400 });
    }
    const title = cleanLocalizedText(body.title);
    if (!hasTeluguAndEnglishText(title)) {
      return NextResponse.json({ ok: false, error: "Quiz title is required in Telugu and English." }, { status: 400 });
    }
    const questions = cleanQuestions(body.questions);
    if (questions.length < 10) {
      return NextResponse.json({ ok: false, error: "At least 10 valid Telugu and English questions are required." }, { status: 400 });
    }
    await deleteQuizAndResults(quizId);
    await deleteOverlappingQuizzes(dateKey, targetStates, quizId);
    await ref.set({
      id: quizId,
      dateKey,
      weekKey: weekKeyForDateKey(dateKey),
      title,
      targetStates,
      questions,
      active: body.active !== false,
      createdBy: existing.createdBy ?? actor.uid,
      createdAt: quizCreatedAtMillis(existing) || Date.now(),
      updatedBy: actor.uid,
      updatedAt: Date.now(),
    }, { merge: true });
    return NextResponse.json({ ok: true, id: quizId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update quiz.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const quizId = String(req.nextUrl.searchParams.get("id") ?? "").trim();
    if (!quizId) {
      return NextResponse.json({ ok: false, error: "Quiz id is required." }, { status: 400 });
    }
    const ref = adminDb.collection(QUIZ_COLLECTION).doc(quizId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true });
    }
    const data = snap.data() as QuizDoc;
    if (!canEditQuiz(data)) {
      return NextResponse.json({ ok: false, error: "Quiz can be deleted only within 24 hours." }, { status: 403 });
    }
    await deleteQuizAndResults(quizId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete quiz.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
