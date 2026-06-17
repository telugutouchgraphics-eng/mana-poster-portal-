"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";

type CompetitionPhase =
  | "upcoming"
  | "submission_open"
  | "countdown"
  | "live"
  | "completed";

interface RewardTier {
  rank: number;
  amount: number;
  label: string;
}

interface CompetitionRow {
  creatorPublicId: string;
  creatorName: string;
  rank: number;
  shares: number;
  downloads: number;
  approvedCount: number;
  totalUploads: number;
  prizeAmount: number;
}

interface CompetitionItem {
  competition: {
    id: string;
    title: string;
    description: string;
    categoryIds: string[];
    submissionStartAt: number;
    submissionEndAt: number;
    liveAt: number;
    rewardNote: string;
    rewardTiers: RewardTier[];
  };
  categoryLabels: string[];
  phase: CompetitionPhase;
  creatorCount: number;
  totalShares: number;
  totalDownloads: number;
  leaderboard: CompetitionRow[];
  winners: CompetitionRow[];
  myEntry?: CompetitionRow | null;
}

interface CategoryOption {
  id: string;
  label: string;
  eventDateLabel?: string;
}

interface CompetitionResponse {
  ok: boolean;
  error?: string;
  competitions?: CompetitionItem[];
  categories?: CategoryOption[];
}

interface CompetitionHubProps {
  mode: "admin" | "creator";
}

const DEFAULT_REWARD_TIERS: RewardTier[] = [
  { rank: 1, amount: 5000, label: "1st Prize" },
  { rank: 2, amount: 3000, label: "2nd Prize" },
  { rank: 3, amount: 2000, label: "3rd Prize" },
  { rank: 4, amount: 1000, label: "Rank 4" },
  { rank: 5, amount: 1000, label: "Rank 5" },
  { rank: 6, amount: 750, label: "Rank 6" },
  { rank: 7, amount: 750, label: "Rank 7" },
  { rank: 8, amount: 500, label: "Rank 8" },
  { rank: 9, amount: 500, label: "Rank 9" },
  { rank: 10, amount: 500, label: "Rank 10" },
];

function formatDateTime(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseDatetimeInput(value: string): number {
  return value ? new Date(value).getTime() : 0;
}

function localizedPhaseLabel(phase: CompetitionPhase, useTelugu: boolean): string {
  switch (phase) {
    case "submission_open":
      return useTelugu ? "సబ్మిషన్ తెరిచి ఉంది" : "Submission Open";
    case "countdown":
      return useTelugu ? "రివ్యూ కౌంట్‌డౌన్" : "Review Countdown";
    case "live":
      return useTelugu ? "యాప్‌లో లైవ్" : "Live on App";
    case "completed":
      return useTelugu ? "పూర్తయింది" : "Completed";
    default:
      return useTelugu ? "రాబోతోంది" : "Upcoming";
  }
}

function hubMoneyPrefix(useTelugu: boolean) {
  return useTelugu ? "₹" : "Rs.";
}

function competitionHubTexts(mode: "admin" | "creator", creatorTelugu: boolean) {
  const t = mode === "creator" && creatorTelugu;
  const admin = mode === "admin";
  const money = hubMoneyPrefix(t);
  return {
    loginRequired: t ? "లాగిన్ అవసరం." : "Login required.",
    loadFailed: t ? "పోటీలు లోడ్ చేయలేకపోయాం." : "Unable to load competitions.",
    eyebrow: t ? "ఈవెంట్ పోటీలు" : "Event Competitions",
    heroTitle: admin
      ? "Live event leaderboard with deadline-based poster uploads"
      : t
        ? "డెడ్‌లైన్ ఆధారంగా లైవ్ ఈవెంట్ లీడర్‌బోర్డ్ మరియు పోస్టర్ అప్‌లోడ్స్"
        : "Live event leaderboard with deadline-based poster uploads",
    heroSubtitle: admin
      ? "Create only the next 10 days event competitions, set prize money, and track one joyful full-screen live board."
      : t
        ? "లైవ్ ఈవెంట్స్‌ను చూసి ర్యాంక్ల మార్పులను గమనించండి, అప్లోడ్ కస్టమైజేషన్ ఫ్లోలోకి నేరుగా వెళ్లండి."
        : "Follow live events, watch rank changes, and jump directly into the same upload customization flow.",
    statLive: t ? "లైవ్" : "Live",
    statOpen: t ? "సబ్మిషన్ ఓపెన్" : "Open",
    statAll: t ? "మొత్తం" : "All",
    tabLive: t ? "లైవ్ బోర్డ్" : "Live Board",
    tabAll: t ? "అన్ని పోటీలు" : "All Competitions",
    loading: t ? "పోటీలు లోడ్ అవుతున్నాయి..." : "Loading competitions...",
    emptyLive: t ? "ప్రస్తుతం యాక్టివ్ లేదా త్వరలోని పోటీలు లేవు." : "No active or upcoming competitions right now.",
    emptyAll: t ? "ఇంకా ఏ పోటీలూ రికార్డు చేయబడలేదు." : "No competitions created yet.",
    phase: (phase: CompetitionPhase) => localizedPhaseLabel(phase, t),
    money,
    compactDescFallback: t
      ? "ఈ కార్డులో మరిన్ని వివరాలు ఉన్నాయి."
      : "Competition details available inside this event card.",
    creators: t ? "క్రియేటర్లు" : "Creators",
    sharesWord: t ? "షేర్లు" : "shares",
    winners: t ? "గెలుపొందినవారు" : "Winners",
    eventDayPrefix: t ? "ఈవెంట్: " : "Event: ",
    card: {
      descFallback: t
        ? "క్రియేటర్ పోస్టర్ అప్‌లోడ్స్ మరియు లైవ్ షేర్ ర్యాంకింగ్‌ కోసం ఈవెంట్ పోటీ."
        : "Event competition for creator poster uploads and live share rankings.",
      submissionStart: t ? "సబ్మిషన్ ప్రారంభం" : "Submission Start",
      deadline: t ? "చివరి తేదీ" : "Deadline",
      eventDay: t ? "ఈవెంట్ రోజు" : "Event Day",
      creatorCount: t ? "క్రియేటర్ల సంఖ్య" : "Creator Count",
      totalShares: t ? "మొత్తం షేర్లు" : "Total Shares",
      totalDownloads: t ? "మొత్తం డౌన్‌లోడ్లు" : "Total Downloads",
      myRank: t ? "నా ర్యాంకు" : "My Rank",
      myShares: t ? "నా షేర్లు" : "My Shares",
      myDownloads: t ? "నా డౌన్‌లోడ్లు" : "My Downloads",
      prizeLabel: t ? "బహుమతి" : "Prize",
      prizeNotSet: t ? "నిర్ణయించలేదు" : "Not set",
      top25: t ? "టాప్ 25 లైవ్ ర్యాంకింగ్" : "Top 25 Live Ranking",
      thRank: t ? "ర్యాంకు" : "Rank",
      thCreator: t ? "క్రియేటర్" : "Creator",
      thShares: t ? "షేర్లు" : "Shares",
      thDownloads: t ? "డౌన్‌లోడ్లు" : "Downloads",
      thPrize: t ? "బహుమతి" : "Prize",
      leaderboardEmpty: t
        ? "ఈవెంట్ రోజుకు లైవ్ షేర్లు ఇంకా మొదలుకాలేదు లేదా ఆమోదం పొందిన పోస్టర్లు లేవు."
        : "Event day live shares have not started yet or approved posters are not available.",
      prizeHighlights: t ? "బహుమతి వివరాలు" : "Prize Highlights",
      prizeTiersMissing: t ? "బహుమతి మెట్లకు నమోదు లేదు." : "Prize tiers not configured.",
      winnerPreview: t ? "గెలుపొందినవారు" : "Winner Preview",
      winnersPending: t ? "గెలుపొందినవారిని ఇంకా నిర్ణయించలేదు." : "Top winners are not decided yet.",
      rankLine: (n: number) => (t ? `ర్యాంకు #${n}` : `Rank #${n}`),
      prizePending: t ? "బహుమతి పెండింగ్" : "Prize pending",
      sharesCount: (n: number) => (t ? `${n} షేర్లు` : `${n} shares`),
    },
  };
}

function phaseTone(phase: CompetitionPhase): string {
  switch (phase) {
    case "submission_open":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "countdown":
      return "border-amber-300 bg-amber-50 text-amber-700";
    case "live":
      return "border-rose-300 bg-rose-50 text-rose-700";
    case "completed":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-sky-300 bg-sky-50 text-sky-700";
  }
}

function rankTone(rank: number): string {
  if (rank === 1) return "border-yellow-300 bg-yellow-50 text-yellow-900";
  if (rank === 2) return "border-slate-300 bg-slate-100 text-slate-800";
  if (rank === 3) return "border-orange-300 bg-orange-50 text-orange-900";
  if (rank <= 10) return "border-violet-300 bg-violet-50 text-violet-800";
  return "border-slate-200 bg-white text-slate-700";
}

function rankBadgeLabel(rank: number): string {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank);
}

function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h4l1 4-3 3-2-7Z" />
      <path d="M13 3h4l-2 7-3-3 1-4Z" />
      <circle cx="12" cy="15" r="5" />
      <path d="m10.8 15 1 1 1.8-2.2" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="12" rx="7" ry="8" />
      <path d="M10 9.5h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 1 0 0 3h3" />
      <path d="M12 8v8" />
    </svg>
  );
}

export function CompetitionHub({ mode }: CompetitionHubProps) {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
  const creatorTelugu = mode === "creator" && language === "telugu";
  const texts = useMemo(
    () => competitionHubTexts(mode, creatorTelugu),
    [mode, creatorTelugu],
  );
  const searchParams = useSearchParams();
  const [competitions, setCompetitions] = useState<CompetitionItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "all">("live");
  const [form, setForm] = useState({
    title: "",
    description: "",
    submissionStartAt: "",
    submissionEndAt: "",
    liveAt: "",
    rewardNote: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>(DEFAULT_REWARD_TIERS);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(texts.loginRequired);
      }
      const endpoint =
        mode === "admin"
          ? `/api/admin/competitions?regionId=${encodeURIComponent(region.id)}`
          : withCreatorImpersonationQuery(
              `/api/creator/competitions?regionId=${encodeURIComponent(region.id)}`,
              searchParams,
            );
      const response = await fetch(endpoint, {
        headers:
          mode === "creator"
            ? withDeviceHeader({ authorization: `Bearer ${token}` })
            : { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as CompetitionResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? texts.loadFailed);
      }
      setCompetitions(data.competitions ?? []);
      setCategories(data.categories ?? []);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : texts.loadFailed,
      );
    } finally {
      setLoading(false);
    }
  }, [mode, user, region.id, searchParams, texts.loginRequired, texts.loadFailed]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user, loadData]);

  const liveCompetitions = useMemo(
    () => competitions.filter((item) => item.phase !== "completed"),
    [competitions],
  );
  async function handleCreateCompetition() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      if (selectedCategories.length === 0) {
        throw new Error("Select at least one category.");
      }
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryIds: selectedCategories,
        submissionStartAt: parseDatetimeInput(form.submissionStartAt),
        submissionEndAt: parseDatetimeInput(form.submissionEndAt),
        liveAt: parseDatetimeInput(form.liveAt),
        rewardNote: form.rewardNote.trim(),
        regionId: region.id,
        rewardTiers: rewardTiers
          .map((item) => ({
            ...item,
            amount: Number(item.amount || 0),
          }))
          .filter((item) => item.amount > 0),
      };
      const response = await fetch("/api/admin/competitions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to create competition.");
      }
      setNotice("Competition created successfully.");
      setForm({
        title: "",
        description: "",
        submissionStartAt: "",
        submissionEndAt: "",
        liveAt: "",
        rewardNote: "",
      });
      setSelectedCategories([]);
      setRewardTiers(DEFAULT_REWARD_TIERS);
      await loadData();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create competition.",
      );
    } finally {
      setSaving(false);
    }
  }

  const headerGradient =
    mode === "admin"
      ? "bg-[linear-gradient(135deg,#0f172a_0%,#831843_45%,#f59e0b_100%)]"
      : "bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_48%,#f97316_100%)]";

  return (
    <section className="space-y-6">
      <div className={`overflow-hidden rounded-[28px] ${headerGradient} px-5 py-6 text-white sm:px-8 sm:py-8`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">
              {texts.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{texts.heroTitle}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">
              {texts.heroSubtitle}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroStat label={texts.statLive} value={String(liveCompetitions.filter((item) => item.phase === "live").length)} />
            <HeroStat label={texts.statOpen} value={String(liveCompetitions.filter((item) => item.phase === "submission_open").length)} />
            <HeroStat label={texts.statAll} value={String(competitions.length)} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <TabButton active={tab === "live"} onClick={() => setTab("live")} label={texts.tabLive} />
        <TabButton active={tab === "all"} onClick={() => setTab("all")} label={texts.tabAll} />
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {mode === "admin" ? (
        <div className="rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Create Event
              </p>
              <h3 className="mt-2 text-xl font-black text-slate-950">
                Launch a competition with deadline, live day, and prize money
              </h3>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Competition Title">
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                  />
                </Field>
                <Field label="Reward Note">
                  <input
                    value={form.rewardNote}
                    onChange={(event) => setForm((prev) => ({ ...prev, rewardNote: event.target.value }))}
                    placeholder="Festival special competition"
                    className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="min-h-[110px] w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Submission Start">
                  <input
                    type="datetime-local"
                    value={form.submissionStartAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, submissionStartAt: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                  />
                </Field>
                <Field label="Deadline">
                  <input
                    type="datetime-local"
                    value={form.submissionEndAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, submissionEndAt: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                  />
                </Field>
                <Field label="Event Live Day">
                  <input
                    type="datetime-local"
                    value={form.liveAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, liveAt: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-purple)] focus:bg-white"
                  />
                </Field>
              </div>

              <Field label="Competition Categories">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {categories.map((category) => {
                    const selected = selectedCategories.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() =>
                          setSelectedCategories((prev) =>
                            prev.includes(category.id)
                              ? prev.filter((item) => item !== category.id)
                              : [...prev, category.id],
                          )
                        }
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          selected
                            ? "border-[var(--portal-purple)] bg-violet-50 text-violet-900"
                            : "border-[var(--portal-border)] bg-white text-slate-700 hover:border-[var(--portal-purple)]"
                        }`}
                      >
                        <span className="block">{category.label}</span>
                        {category.eventDateLabel ? (
                          <span className="mt-1 block text-xs font-medium text-slate-500">
                            {category.eventDateLabel}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Prize Money
                  </p>
                  <h4 className="mt-1 text-lg font-black text-slate-950">
                    Top 10 rewards
                  </h4>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {rewardTiers.map((tier, index) => (
                  <div
                    key={`tier-${tier.rank}`}
                    className="grid gap-2 rounded-2xl border border-white bg-white p-3 sm:grid-cols-[90px_minmax(0,1fr)_120px]"
                  >
                    <input
                      value={tier.label}
                      onChange={(event) =>
                        setRewardTiers((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: event.target.value } : item,
                          ),
                        )
                      }
                      className="rounded-xl border border-[var(--portal-border)] px-3 py-2 text-sm outline-none"
                    />
                    <div className="rounded-xl border border-dashed border-[var(--portal-border)] px-3 py-2 text-sm font-semibold text-slate-700">
                      Rank {tier.rank}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={tier.amount}
                      onChange={(event) =>
                        setRewardTiers((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, amount: Number(event.target.value || 0) }
                              : item,
                          ),
                        )
                      }
                      className="rounded-xl border border-[var(--portal-border)] px-3 py-2 text-sm outline-none"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreateCompetition()}
                className="mt-4 w-full rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create Competition"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-[var(--portal-border)] bg-white px-5 py-8 text-center text-sm text-slate-500">
          {texts.loading}
        </div>
      ) : null}

      {!loading && tab === "live" ? (
        <div className="space-y-5">
          {liveCompetitions.length === 0 ? (
            <EmptyState text={texts.emptyLive} />
          ) : (
            liveCompetitions.map((item) => (
              <CompetitionCard key={item.competition.id} item={item} mode={mode} card={texts.card} phaseLabel={texts.phase} moneyPrefix={texts.money} />
            ))
          )}
        </div>
      ) : null}

      {!loading && tab === "all" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {competitions.length === 0 ? (
            <EmptyState text={texts.emptyAll} />
          ) : (
            competitions.map((item) => (
              <CompactCompetitionCard
                key={`all-${item.competition.id}`}
                item={item}
                phaseLabel={texts.phase}
                compact={texts}
              />
            ))
          )}
        </div>
      ) : null}

    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white/14 px-4 py-4 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-[var(--portal-border)] bg-white text-slate-700 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-[var(--portal-border)] bg-white px-5 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function CompetitionCard({
  item,
  mode,
  card,
  phaseLabel,
  moneyPrefix,
}: {
  item: CompetitionItem;
  mode: "admin" | "creator";
  card: ReturnType<typeof competitionHubTexts>["card"];
  phaseLabel: (phase: CompetitionPhase) => string;
  moneyPrefix: string;
}) {
  return (
    <article className="overflow-hidden rounded-[30px] border border-[var(--portal-border)] bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,#fdf2f8_0%,#ffffff_40%,#eff6ff_100%)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${phaseTone(item.phase)}`}>
                {phaseLabel(item.phase)}
              </span>
              {item.competition.rewardNote ? (
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                  {item.competition.rewardNote}
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-2xl font-black text-slate-950">
              {item.competition.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              {item.competition.description || card.descFallback}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.categoryLabels.map((label) => (
                <span
                  key={`${item.competition.id}-${label}`}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[340px]">
            <MiniMetric label={card.submissionStart} value={formatDateTime(item.competition.submissionStartAt)} />
            <MiniMetric label={card.deadline} value={formatDateTime(item.competition.submissionEndAt)} />
            <MiniMetric label={card.eventDay} value={formatDateTime(item.competition.liveAt)} />
            <MiniMetric label={card.creatorCount} value={String(item.creatorCount)} />
            <MiniMetric label={card.totalShares} value={String(item.totalShares)} />
            <MiniMetric label={card.totalDownloads} value={String(item.totalDownloads)} />
          </div>
        </div>
      </div>

      {mode === "creator" && item.myEntry ? (
        <div className="border-t border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-4 sm:px-6">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label={card.myRank} value={`#${item.myEntry.rank}`} tone={rankTone(item.myEntry.rank)} />
            <MiniMetric label={card.myShares} value={String(item.myEntry.shares)} />
            <MiniMetric label={card.myDownloads} value={String(item.myEntry.downloads)} />
            <MiniMetric
              label={card.prizeLabel}
              value={item.myEntry.prizeAmount > 0 ? `${moneyPrefix}${item.myEntry.prizeAmount}` : card.prizeNotSet}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] sm:px-6">
        <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)]">
          <div className="border-b border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3">
            <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{card.top25}</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">{card.thRank}</th>
                  <th className="px-4 py-3">{card.thCreator}</th>
                  <th className="px-4 py-3">{card.thShares}</th>
                  <th className="px-4 py-3">{card.thDownloads}</th>
                  <th className="px-4 py-3">{card.thPrize}</th>
                </tr>
              </thead>
              <tbody>
                {item.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      {card.leaderboardEmpty}
                    </td>
                  </tr>
                ) : (
                  item.leaderboard.map((row) => (
                    <tr key={`${item.competition.id}-${row.creatorPublicId}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <span className={`inline-flex min-w-[52px] items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${rankTone(row.rank)}`}>
                          <MedalIcon />
                          <span>#{rankBadgeLabel(row.rank)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">{row.creatorName}</p>
                          <p className="text-xs text-slate-500">{row.creatorPublicId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.shares}</td>
                      <td className="px-4 py-3 text-slate-700">{row.downloads}</td>
                      <td className="px-4 py-3">
                        {row.prizeAmount > 0 ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            <CoinIcon />
                            <span>{moneyPrefix}</span>
                            <span>{row.prizeAmount}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{card.prizeHighlights}</h4>
            <div className="mt-4 space-y-2">
              {item.competition.rewardTiers.length === 0 ? (
                <p className="text-sm text-slate-500">{card.prizeTiersMissing}</p>
              ) : (
                item.competition.rewardTiers.slice(0, 10).map((tier) => (
                  <div key={`${item.competition.id}-reward-${tier.rank}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${rankTone(tier.rank)}`}>
                      <MedalIcon />
                      {tier.label}
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      {moneyPrefix}
                      {tier.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{card.winnerPreview}</h4>
            <div className="mt-4 space-y-2">
              {item.winners.length === 0 ? (
                <p className="text-sm text-slate-500">{card.winnersPending}</p>
              ) : (
                item.winners.map((winner) => (
                  <div key={`${item.competition.id}-winner-${winner.creatorPublicId}`} className={`rounded-2xl border px-4 py-3 ${rankTone(winner.rank)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black">{winner.creatorName}</p>
                        <p className="text-xs opacity-75">{card.rankLine(winner.rank)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black">{card.sharesCount(winner.shares)}</p>
                        <p className="text-xs opacity-75">
                          {winner.prizeAmount > 0 ? `${moneyPrefix}${winner.prizeAmount}` : card.prizePending}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactCompetitionCard({
  item,
  phaseLabel,
  compact,
}: {
  item: CompetitionItem;
  phaseLabel: (phase: CompetitionPhase) => string;
  compact: ReturnType<typeof competitionHubTexts>;
}) {
  return (
    <article className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${phaseTone(item.phase)}`}>
          {phaseLabel(item.phase)}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {formatDateTime(item.competition.liveAt)}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-black text-slate-950">{item.competition.title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        {item.competition.description || compact.compactDescFallback}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {item.categoryLabels.map((label) => (
          <span key={`${item.competition.id}-compact-${label}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric label={compact.creators} value={String(item.creatorCount)} />
        <MiniMetric label={compact.card.thShares} value={String(item.totalShares)} />
        <MiniMetric label={compact.winners} value={item.winners.length > 0 ? item.winners.map((winner) => `#${winner.rank}`).join(", ") : "-"} />
      </div>
      {item.winners.length > 0 ? (
        <div className="mt-4 space-y-2">
          {item.winners.map((winner) => (
            <div key={`${item.competition.id}-allwinner-${winner.creatorPublicId}`} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${rankTone(winner.rank)}`}>
              <div>
                <p className="text-sm font-black">{winner.creatorName}</p>
                <p className="text-xs opacity-75">
                  {compact.eventDayPrefix}
                  {formatDateTime(item.competition.liveAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black">#{winner.rank}</p>
                <p className="text-xs opacity-75">
                  {winner.prizeAmount > 0 ? `${compact.money}${winner.prizeAmount}` : "-"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone ?? "border-[var(--portal-border)] bg-white"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
