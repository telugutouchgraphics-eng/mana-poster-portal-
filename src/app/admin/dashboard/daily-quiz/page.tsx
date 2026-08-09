"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";

const QUIZ_LANGUAGES = [
  { key: "telugu", label: "Telugu" },
  { key: "hindi", label: "Hindi" },
  { key: "english", label: "English" },
  { key: "tamil", label: "Tamil" },
  { key: "kannada", label: "Kannada" },
  { key: "malayalam", label: "Malayalam" },
  { key: "assamese", label: "Assamese" },
  { key: "konkani", label: "Konkani" },
  { key: "gujarati", label: "Gujarati" },
  { key: "marathi", label: "Marathi" },
  { key: "meitei", label: "Meitei" },
  { key: "mizo", label: "Mizo" },
  { key: "odia", label: "Odia" },
  { key: "punjabi", label: "Punjabi" },
  { key: "nepali", label: "Nepali" },
  { key: "bengali", label: "Bengali" },
  { key: "kashmiri", label: "Kashmiri" },
  { key: "ladakhi", label: "Ladakhi" },
] as const;

type QuizLanguageKey = typeof QUIZ_LANGUAGES[number]["key"];
type LocalizedTextForm = Record<QuizLanguageKey, string>;
type TranslateTargetCode =
  | "te"
  | "hi"
  | "en"
  | "ta"
  | "kn"
  | "ml"
  | "as"
  | "gom"
  | "gu"
  | "mr"
  | "mni-Mtei"
  | "lus"
  | "or"
  | "pa"
  | "ne"
  | "bn"
  | "ur"
  | "bo";

type QuizQuestionForm = {
  text: LocalizedTextForm;
  options: LocalizedTextForm[];
  correctOptionIndex: number | null;
};

type LeaderboardRow = {
  uid: string;
  userName: string;
  userEmail?: string;
  correctCount: number;
  totalAnswered: number;
  totalDurationSeconds?: number;
  effectiveDurationSeconds?: number;
  weeklyExpectedTotal?: number;
  missedQuestions?: number;
  rank: number;
};

type DailyReport = {
  dateKey: string;
  regionId: string;
  regionName: string;
  finalCutoffLabel: string;
  isFinalForToday: boolean;
  totalUsers: number;
  participatedUsers: number;
  completedUsers: number;
  totalAnswers: number;
  totalCorrect: number;
  participationRate: number;
  dailyExpectedTotal?: number;
  topParticipants: LeaderboardRow[];
};

type WeeklyReport = {
  weekKey: string;
  regionId: string;
  regionName: string;
  totalUsers: number;
  participatedUsers: number;
  activeUsers: number;
  participationRate: number;
  topAnswers: number;
  topCorrect: number;
  weeklyExpectedTotal?: number;
  topParticipants: LeaderboardRow[];
};

type QuizHistoryItem = {
  id: string;
  dateKey: string;
  title?: Partial<Record<QuizLanguageKey, string>>;
  targetStates?: string[];
  questions?: Array<{
    id?: string;
    text?: Partial<Record<QuizLanguageKey, string>>;
    options?: Array<{ id?: string; text?: Partial<Record<QuizLanguageKey, string>> }>;
    correctOptionIndex?: number | null;
    correctOptionId?: string;
  }>;
  active?: boolean;
  createdAt?: number;
  updatedAt?: number;
  canEdit?: boolean;
};

const QUIZ_TRANSLATE_TARGETS: Record<QuizLanguageKey, TranslateTargetCode> = {
  telugu: "te",
  hindi: "hi",
  english: "en",
  tamil: "ta",
  kannada: "kn",
  malayalam: "ml",
  assamese: "as",
  konkani: "gom",
  gujarati: "gu",
  marathi: "mr",
  meitei: "mni-Mtei",
  mizo: "lus",
  odia: "or",
  punjabi: "pa",
  nepali: "ne",
  bengali: "bn",
  kashmiri: "ur",
  ladakhi: "bo",
};

const QUESTION_STYLES = [
  { panel: "border-sky-200 bg-sky-50/80", chip: "bg-sky-600", option: "border-sky-200 bg-white hover:bg-sky-50", selected: "border-sky-500 bg-sky-100 text-sky-950" },
  { panel: "border-emerald-200 bg-emerald-50/80", chip: "bg-emerald-600", option: "border-emerald-200 bg-white hover:bg-emerald-50", selected: "border-emerald-500 bg-emerald-100 text-emerald-950" },
  { panel: "border-amber-200 bg-amber-50/80", chip: "bg-amber-600", option: "border-amber-200 bg-white hover:bg-amber-50", selected: "border-amber-500 bg-amber-100 text-amber-950" },
  { panel: "border-rose-200 bg-rose-50/80", chip: "bg-rose-600", option: "border-rose-200 bg-white hover:bg-rose-50", selected: "border-rose-500 bg-rose-100 text-rose-950" },
  { panel: "border-indigo-200 bg-indigo-50/80", chip: "bg-indigo-600", option: "border-indigo-200 bg-white hover:bg-indigo-50", selected: "border-indigo-500 bg-indigo-100 text-indigo-950" },
  { panel: "border-teal-200 bg-teal-50/80", chip: "bg-teal-600", option: "border-teal-200 bg-white hover:bg-teal-50", selected: "border-teal-500 bg-teal-100 text-teal-950" },
  { panel: "border-fuchsia-200 bg-fuchsia-50/80", chip: "bg-fuchsia-600", option: "border-fuchsia-200 bg-white hover:bg-fuchsia-50", selected: "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-950" },
  { panel: "border-lime-200 bg-lime-50/80", chip: "bg-lime-600", option: "border-lime-200 bg-white hover:bg-lime-50", selected: "border-lime-500 bg-lime-100 text-lime-950" },
  { panel: "border-cyan-200 bg-cyan-50/80", chip: "bg-cyan-600", option: "border-cyan-200 bg-white hover:bg-cyan-50", selected: "border-cyan-500 bg-cyan-100 text-cyan-950" },
  { panel: "border-orange-200 bg-orange-50/80", chip: "bg-orange-600", option: "border-orange-200 bg-white hover:bg-orange-50", selected: "border-orange-500 bg-orange-100 text-orange-950" },
];

function emptyLocalizedText(seed: Partial<Record<QuizLanguageKey, string>> = {}): LocalizedTextForm {
  return Object.fromEntries(QUIZ_LANGUAGES.map((language) => [language.key, seed[language.key] ?? ""])) as LocalizedTextForm;
}

function emptyQuestion(): QuizQuestionForm {
  return {
    text: emptyLocalizedText(),
    options: Array.from({ length: 4 }, () => emptyLocalizedText()),
    correctOptionIndex: null,
  };
}

function localizedTextFromHistory(text: Partial<Record<QuizLanguageKey, string>> | undefined): LocalizedTextForm {
  return emptyLocalizedText(text ?? {});
}

function questionFromHistory(question: NonNullable<QuizHistoryItem["questions"]>[number]): QuizQuestionForm {
  const options = Array.from({ length: 4 }, (_, index) =>
    localizedTextFromHistory(question.options?.[index]?.text),
  );
  const correctById = question.correctOptionId
    ? question.options?.findIndex((option) => option.id === question.correctOptionId) ?? -1
    : -1;
  const correctOptionIndex =
    typeof question.correctOptionIndex === "number"
      ? question.correctOptionIndex
      : correctById >= 0
        ? correctById
        : null;
  return {
    text: localizedTextFromHistory(question.text),
    options,
    correctOptionIndex,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function weekKeyFor(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return "";
  }
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const weekday = date.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function compactLocalizedText(text: LocalizedTextForm) {
  return Object.fromEntries(
    QUIZ_LANGUAGES
      .map((language) => [language.key, text[language.key].trim()])
      .filter(([, value]) => value),
  );
}

function firstAvailableText(text: LocalizedTextForm, preferredLanguage: QuizLanguageKey) {
  const preferred = text[preferredLanguage].trim();
  if (preferred) return preferred;
  for (const language of QUIZ_LANGUAGES) {
    const value = text[language.key].trim();
    if (value) return value;
  }
  return "";
}

function formatDuration(totalSeconds: number | undefined) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatQuizTime(row: Pick<LeaderboardRow, "totalDurationSeconds" | "effectiveDurationSeconds" | "totalAnswered">) {
  const rawDuration = Number(row.totalDurationSeconds || 0);
  const effectiveDuration = Number(row.effectiveDurationSeconds || 0);
  if (rawDuration > 0) return formatDuration(rawDuration);
  if (effectiveDuration > 0 && Number(row.totalAnswered || 0) > 0) {
    return `~${formatDuration(effectiveDuration)}`;
  }
  return "-";
}

function replaceLocalizedText(
  text: LocalizedTextForm,
  language: QuizLanguageKey,
  value: string,
) {
  return { ...text, [language]: value } satisfies LocalizedTextForm;
}

export default function AdminDailyQuizPage() {
  const { user } = useAuth();
  const { region, regions } = useDashboardRegion();
  const [dateKey, setDateKey] = useState(todayKey());
  const [targetStates, setTargetStates] = useState<string[]>([region.id]);
  const editingLanguage: QuizLanguageKey = "english";
  const [title, setTitle] = useState<LocalizedTextForm>(
    () => emptyLocalizedText({
      english: "Daily Quiz",
    }),
  );
  const [questions, setQuestions] = useState<QuizQuestionForm[]>(
    () => Array.from({ length: 10 }, () => emptyQuestion()),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [reportTab, setReportTab] = useState<"daily" | "weekly">("daily");
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [sendingWinnerUid, setSendingWinnerUid] = useState<string | null>(null);
  const weekKey = useMemo(() => weekKeyFor(dateKey), [dateKey]);

  useEffect(() => {
    setTargetStates((prev) => (prev.length > 0 ? prev : [region.id]));
  }, [region.id]);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await user?.getIdToken();
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    return headers;
  }

  async function loadReports() {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch(
      `/api/admin/daily-quiz?dateKey=${encodeURIComponent(dateKey)}&weekKey=${encodeURIComponent(weekKey)}&regionId=${encodeURIComponent(region.id)}`,
      { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const data = await response.json() as {
      ok: boolean;
      dailyReport?: DailyReport;
      weeklyReport?: WeeklyReport;
      leaderboard?: { participants?: LeaderboardRow[] };
      quizzes?: QuizHistoryItem[];
      error?: string;
    };
    if (response.ok && data.ok) {
      setDailyReport(data.dailyReport
        ? { ...data.dailyReport, topParticipants: data.dailyReport.topParticipants ?? [] }
        : null);
      setWeeklyReport(data.weeklyReport
        ? { ...data.weeklyReport, topParticipants: data.weeklyReport.topParticipants ?? [] }
        : null);
      setLeaderboard(data.leaderboard?.participants ?? []);
      setHistory(data.quizzes ?? []);
      return;
    }
    setStatus(data.error ?? "Unable to load reports.");
  }

  async function translateMissingQuizContent() {
    let translatedTitle = { ...title };
    let translatedQuestions = questions.map((question) => ({
      ...question,
      text: { ...question.text },
      options: question.options.map((option) => ({ ...option })),
    }));

    for (const language of QUIZ_LANGUAGES) {
      const targetLanguage = language.key;
      const texts: string[] = [];
      const applyTranslation: Array<(value: string) => void> = [];

      const queueText = (
        localizedText: LocalizedTextForm,
        apply: (next: LocalizedTextForm) => void,
      ) => {
        const source = firstAvailableText(localizedText, editingLanguage);
        if (!source) return;
        texts.push(source);
        applyTranslation.push((value) => {
          apply(replaceLocalizedText(localizedText, targetLanguage, value));
        });
      };

      queueText(translatedTitle, (next) => {
        translatedTitle = next;
      });

      translatedQuestions.forEach((question, questionIndex) => {
        queueText(question.text, (next) => {
          translatedQuestions = translatedQuestions.map((item, index) =>
            index === questionIndex ? { ...item, text: next } : item,
          );
        });
        question.options.forEach((option, optionIndex) => {
          queueText(option, (next) => {
            translatedQuestions = translatedQuestions.map((item, index) => {
              if (index !== questionIndex) return item;
              return {
                ...item,
                options: item.options.map((currentOption, currentOptionIndex) =>
                  currentOptionIndex === optionIndex ? next : currentOption,
                ),
              };
            });
          });
        });
      });

      if (texts.length === 0) continue;

      const translatedTexts: string[] = [];
      for (let index = 0; index < texts.length; index += 200) {
        const batch = texts.slice(index, index + 200);
        const response = await fetch("/api/i18n/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            targetLanguage: QUIZ_TRANSLATE_TARGETS[targetLanguage],
            texts: batch,
            mode: "translate",
          }),
        });
        const data = await response.json() as { ok: boolean; translations?: string[]; error?: string };
        if (!response.ok || !data.ok || !Array.isArray(data.translations)) {
          throw new Error(data.error ?? `Unable to translate ${language.label}.`);
        }
        translatedTexts.push(...data.translations);
      }

      translatedTexts.forEach((value, index) => {
        applyTranslation[index]?.(value);
      });
    }

    return { translatedTitle, translatedQuestions };
  }

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region.id, dateKey, weekKey]);

  function updateQuestionText(index: number, language: QuizLanguageKey, value: string) {
    setQuestions((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, text: { ...item.text, [language]: value } } : item,
      ),
    );
  }

  function updateOption(index: number, optionIndex: number, language: QuizLanguageKey, value: string) {
    setQuestions((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const options = item.options.map((option, currentOptionIndex) =>
          currentOptionIndex === optionIndex ? { ...option, [language]: value } : option,
        );
        return { ...item, options };
      }),
    );
  }

  function updateCorrectOption(index: number, correctOptionIndex: number) {
    setQuestions((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, correctOptionIndex } : item,
      ),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missingCorrectIndex = questions.findIndex((question) => question.correctOptionIndex == null);
    if (missingCorrectIndex >= 0) {
      setStatus(`Question ${missingCorrectIndex + 1}: select correct answer.`);
      return;
    }
    setStatus("Auto-translating quiz...");
    let translatedTitle = title;
    let translatedQuestions = questions;
    try {
      const translated = await translateMissingQuizContent();
      translatedTitle = translated.translatedTitle;
      translatedQuestions = translated.translatedQuestions;
      setTitle(translatedTitle);
      setQuestions(translatedQuestions);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to translate quiz.");
      return;
    }
    setStatus(editingQuizId ? "Updating quiz..." : "Saving quiz...");
    const payload = {
      id: editingQuizId,
      dateKey,
      targetStates,
      title: compactLocalizedText(translatedTitle),
      active: true,
      questions: translatedQuestions.map((question, index) => ({
        id: `q${index + 1}`,
        text: compactLocalizedText(question.text),
        options: question.options.map((option, optionIndex) => ({
          id: `o${optionIndex}`,
          text: compactLocalizedText(option),
        })),
        correctOptionIndex: question.correctOptionIndex ?? 0,
      })),
    };
    const response = await fetch("/api/admin/daily-quiz", {
      method: editingQuizId ? "PUT" : "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Unable to save quiz.");
      return;
    }
    const successMessage = editingQuizId ? "Quiz updated." : "Quiz saved.";
    clearFormAfterSave(successMessage);
    await loadReports();
  }

  function startEditQuiz(item: QuizHistoryItem) {
    if (!item.canEdit) {
      setStatus("Quiz can be edited only within 24 hours.");
      return;
    }
    setEditingQuizId(item.id);
    setDateKey(item.dateKey);
    setTargetStates(item.targetStates?.length ? item.targetStates : [region.id]);
    setTitle(localizedTextFromHistory(item.title));
    const nextQuestions = Array.from({ length: 10 }, (_, index) =>
      item.questions?.[index] ? questionFromHistory(item.questions[index]) : emptyQuestion(),
    );
    setQuestions(nextQuestions);
    setStatus("Editing quiz. Update and save again.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingQuizId(null);
    setDateKey(todayKey());
    setTargetStates([region.id]);
    setTitle(emptyLocalizedText({ english: "Daily Quiz" }));
    setQuestions(Array.from({ length: 10 }, () => emptyQuestion()));
    setStatus(null);
  }

  function clearFormAfterSave(message: string) {
    setEditingQuizId(null);
    setDateKey("");
    setTargetStates([]);
    setTitle(emptyLocalizedText());
    setQuestions(Array.from({ length: 10 }, () => emptyQuestion()));
    setStatus(message);
  }

  async function deleteQuiz(item: QuizHistoryItem) {
    if (!item.canEdit) {
      setStatus("Quiz can be deleted only within 24 hours.");
      return;
    }
    const ok = window.confirm("Delete this quiz? App lo ventane remove avuthundi.");
    if (!ok) return;
    setStatus("Deleting quiz...");
    const response = await fetch(`/api/admin/daily-quiz?id=${encodeURIComponent(item.id)}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    const data = await response.json() as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Unable to delete quiz.");
      return;
    }
    if (editingQuizId === item.id) resetForm();
    setStatus("Quiz deleted.");
    await loadReports();
  }

  async function sendWinnerPush(row: LeaderboardRow) {
    if (!row.uid) {
      setStatus("Winner UID missing.");
      return;
    }
    const ok = window.confirm(
      `Send congratulations push to ${row.userEmail || row.userName || row.uid}?`,
    );
    if (!ok) return;
    setSendingWinnerUid(row.uid);
    setStatus("Sending winner push notification...");
    const response = await fetch("/api/admin/daily-quiz/winner-notification", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        uid: row.uid,
        userName: row.userName,
        userEmail: row.userEmail ?? "",
        rank: row.rank,
        weekKey,
        regionId: region.id,
        regionName: region.name,
        correctCount: row.correctCount,
        totalAnswered: row.totalAnswered,
        scoreTotal: row.weeklyExpectedTotal || weeklyReport?.weeklyExpectedTotal || row.totalAnswered,
      }),
    });
    const data = await response.json() as {
      ok: boolean;
      deliveredCount?: number;
      targetCount?: number;
      failedCount?: number;
      error?: string;
    };
    setSendingWinnerUid(null);
    if (!response.ok || !data.ok) {
      setStatus(data.error ?? "Unable to send winner push.");
      return;
    }
    setStatus(
      `Winner push sent: ${data.deliveredCount ?? 0}/${data.targetCount ?? 0} delivered, ${data.failedCount ?? 0} failed.`,
    );
  }

  const dailyCompletionRate =
    dailyReport && dailyReport.participatedUsers > 0
      ? Math.round((dailyReport.completedUsers / dailyReport.participatedUsers) * 10000) / 100
      : 0;

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">Daily Quiz</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Create state-wise daily quiz</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Type quiz content once. It is auto-translated for every app language during save.
        </p>
        {editingQuizId ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Editing quiz: {editingQuizId}</p>
            <button type="button" onClick={resetForm} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800">
              Cancel edit
            </button>
          </div>
        ) : null}
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <input type="date" value={dateKey} onChange={(event) => setDateKey(event.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold outline-none" />
            <input value={title[editingLanguage]} onChange={(event) => setTitle((prev) => ({ ...prev, [editingLanguage]: event.target.value }))} placeholder="Quiz title" className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none" />
          </div>
          <RegionMultiSelectDropdown regions={regions} selectedRegionIds={targetStates} onChange={setTargetStates} />
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={index} className={`rounded-[24px] border p-4 shadow-sm ${QUESTION_STYLES[index % QUESTION_STYLES.length].panel}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow-sm ${QUESTION_STYLES[index % QUESTION_STYLES.length].chip}`}>
                    {index + 1}
                  </span>
                  <input value={question.text[editingLanguage]} onChange={(event) => updateQuestionText(index, editingLanguage, event.target.value)} placeholder="Question" className="min-h-12 w-full rounded-2xl border border-white/80 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400" />
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {[0, 1, 2, 3].map((optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`rounded-full border p-2 shadow-sm transition ${question.correctOptionIndex === optionIndex ? QUESTION_STYLES[index % QUESTION_STYLES.length].selected : QUESTION_STYLES[index % QUESTION_STYLES.length].option}`}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <input type="radio" className="sr-only" checked={question.correctOptionIndex === optionIndex} onChange={() => updateCorrectOption(index, optionIndex)} />
                        <input value={question.options[optionIndex][editingLanguage]} onChange={(event) => updateOption(index, optionIndex, editingLanguage, event.target.value)} placeholder={`Option ${optionIndex + 1}`} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold outline-none placeholder:text-slate-400" />
                        {question.correctOptionIndex === optionIndex ? (
                          <span className="rounded-full bg-white/75 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]">
                            Correct
                          </span>
                        ) : null}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white">
            {editingQuizId ? "Update quiz" : "Save quiz"}
          </button>
          {status ? <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">{status}</p> : null}
        </form>
      </article>
      <details className="group rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Quiz History</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">Last one week quizzes</h3>
            <p className="mt-1 text-sm text-slate-500">{history.length} quizzes for {region.name}. Click to open history.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={(event) => { event.preventDefault(); void loadReports(); }} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold">Refresh</button>
            <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 group-open:hidden">Open</span>
            <span className="hidden rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white group-open:inline-flex">Close</span>
          </div>
        </summary>
        <p className="mt-4 text-sm text-slate-500">Edit/Delete options are available only for quizzes created within 24 hours.</p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">States</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-slate-500">No quiz history in last one week.</td></tr>
              ) : history.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.dateKey}</td>
                  <td className="px-4 py-3">{item.title?.english || item.title?.telugu || item.id}</td>
                  <td className="px-4 py-3">{item.targetStates?.join(", ") || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.canEdit ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {item.canEdit ? "Editable 24hrs" : "Locked"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!item.canEdit}
                        onClick={() => startEditQuiz(item)}
                        className="rounded-xl border border-sky-200 px-3 py-2 text-xs font-bold text-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={!item.canEdit}
                        onClick={() => void deleteQuiz(item)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Weekly Report</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{region.name} leaderboard</h3>
          </div>
          <button type="button" onClick={() => void loadReports()} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold">Refresh</button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["daily", "weekly"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setReportTab(tab)}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${reportTab === tab ? "border-[var(--portal-purple)] bg-violet-50 text-[var(--portal-purple)]" : "border-slate-200 text-slate-600"}`}
            >
              {tab === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
        {reportTab === "daily" ? (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 lg:grid-cols-5">
              <ReportMetric label="State users" value={dailyReport?.totalUsers ?? 0} />
              <ReportMetric label="Participants" value={dailyReport?.participatedUsers ?? 0} />
              <ReportMetric label="Completed 10/10" value={dailyReport?.completedUsers ?? 0} />
              <ReportMetric label="Participation" value={`${dailyReport?.participationRate ?? 0}%`} />
              <ReportMetric label="Completion" value={`${dailyCompletionRate}%`} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <ReportMetric label="Top 500 answers" value={dailyReport?.totalAnswers ?? 0} />
              <ReportMetric label="Top 500 correct" value={dailyReport?.totalCorrect ?? 0} />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {dailyReport?.regionName ?? region.name} daily report final cutoff: {dailyReport?.finalCutoffLabel ?? "10:00 PM IST"}.
              {" "}{dailyReport?.isFinalForToday ? "Final count window reached." : "Live count is still updating."}
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Daily score</th><th className="px-4 py-3">Quiz time</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody>
                  {!dailyReport || dailyReport.topParticipants.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-slate-500">No daily participants yet.</td></tr>
                  ) : dailyReport.topParticipants.map((row) => (
                    <tr key={row.uid} className={row.rank <= 3 ? "bg-amber-50 font-semibold" : "border-t border-slate-100"}>
                      <td className="px-4 py-3">#{row.rank}</td>
                      <td className="px-4 py-3">{row.userName || row.uid}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.userEmail || "-"}</td>
                      <td className="px-4 py-3">{row.correctCount} / {dailyReport.dailyExpectedTotal || row.totalAnswered}</td>
                      <td className="px-4 py-3">{formatQuizTime(row)}</td>
                      <td className="px-4 py-3">{row.totalAnswered >= (dailyReport.dailyExpectedTotal || 10) ? "Completed" : "Active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 lg:grid-cols-5">
              <ReportMetric label="State users" value={weeklyReport?.totalUsers ?? 0} />
              <ReportMetric label="Weekly participants" value={weeklyReport?.participatedUsers ?? 0} />
              <ReportMetric label="Active users" value={weeklyReport?.activeUsers ?? 0} />
              <ReportMetric label="Participation" value={`${weeklyReport?.participationRate ?? 0}%`} />
              <ReportMetric label="Week start" value={weeklyReport?.weekKey ?? weekKey} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <ReportMetric label="Top 50 answers" value={weeklyReport?.topAnswers ?? 0} />
              <ReportMetric label="Top 50 correct" value={weeklyReport?.topCorrect ?? 0} />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <ReportMetric label="Weekly target" value={weeklyReport?.weeklyExpectedTotal ?? 0} />
              <ReportMetric label="Missed days count as" value="0 score" />
            </div>
            <p className="text-xs font-semibold text-slate-500">
              {weeklyReport?.regionName ?? region.name} weekly report is live. Missed quiz questions stay as 0 in weekly score.
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Quiz time</th><th className="px-4 py-3">Answered</th><th className="px-4 py-3">Winner push</th></tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-slate-500">No weekly participants yet.</td></tr>
                  ) : leaderboard.map((row) => (
                    <tr key={row.uid} className={row.rank <= 3 ? "bg-amber-50 font-semibold" : "border-t border-slate-100"}>
                      <td className="px-4 py-3">#{row.rank}</td>
                      <td className="px-4 py-3">{row.userName || row.uid}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{row.userEmail || "-"}</td>
                      <td className="px-4 py-3">{row.correctCount} / {row.weeklyExpectedTotal || weeklyReport?.weeklyExpectedTotal || row.totalAnswered}</td>
                      <td className="px-4 py-3">
                        {formatQuizTime(row)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.totalAnswered} answered
                        {row.missedQuestions ? `, ${row.missedQuestions} missed` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {row.rank <= 3 ? (
                          <button
                            type="button"
                            disabled={sendingWinnerUid === row.uid}
                            onClick={() => void sendWinnerPush(row)}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sendingWinnerUid === row.uid ? "Sending..." : "Send push"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Top 3 only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
