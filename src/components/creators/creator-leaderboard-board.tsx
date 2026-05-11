"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";

interface LeaderboardRow {
  rank: number;
  creatorPublicId: string;
  creatorName: string;
  posterId: string;
  posterTitle: string;
  shares: number;
  downloads: number;
  performancePercent: number;
}

interface LeaderboardCategory {
  categoryId: string;
  categoryLabel: string;
  myEntry: LeaderboardRow | null;
  rows: LeaderboardRow[];
}

interface LeaderboardResponse {
  ok: boolean;
  error?: string;
  leaderboard?: LeaderboardCategory[];
}

function rankTone(rank: number): string {
  if (rank === 1) return "bg-amber-100 text-amber-900 border-amber-300";
  if (rank === 2) return "bg-slate-100 text-slate-900 border-slate-300";
  if (rank === 3) return "bg-orange-100 text-orange-900 border-orange-300";
  return "bg-white text-slate-700 border-[var(--portal-border)]";
}

export function CreatorLeaderboardBoard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { language } = useDashboardLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LeaderboardCategory[]>([]);
  const isTelugu = language === "telugu";
  const copy = {
    loginRequired: isTelugu ? "లాగిన్ రిక్వైర్డ్." : "Login required.",
    unable: isTelugu ? "లీడర్‌బోర్డ్ లోడ్ చేయలేకపోయాం." : "Unable to load leaderboard.",
    leaderboard: isTelugu ? "లీడర్‌బోర్డ్" : "Leaderboard",
    categoryRankings: isTelugu ? "క్యాటగిరీ ర్యాంకింగ్స్" : "Category Rankings",
    subtitle: isTelugu
      ? "లైవ్ 24 అవర్స్ యాక్టివ్ పోస్టర్స్‌కి క్యాటగిరీ-వైజ్ ర్యాంక్స్ ఇక్కడ కనిపిస్తాయి."
      : "Category-wise ranks for live 24 hour active posters appear here.",
    refreshing: isTelugu ? "రిఫ్రెష్ అవుతోంది..." : "Refreshing...",
    refresh: isTelugu ? "రిఫ్రెష్" : "Refresh",
    loading: isTelugu ? "లీడర్‌బోర్డ్ లోడింగ్..." : "Loading leaderboard...",
    empty: isTelugu ? "యాక్టివ్ లీడర్‌బోర్డ్ డేటా లేదు." : "Active leaderboard data is not available.",
    yourRank: isTelugu ? "యోర్ ర్యాంక్" : "Your rank",
    noActivePoster: isTelugu ? "ఈ క్యాటగిరీలో మీ యాక్టివ్ పోస్టర్ కరెంట్‌గా లేదు." : "You do not have an active poster in this category right now.",
    rank: isTelugu ? "ర్యాంక్" : "Rank",
    creator: isTelugu ? "క్రియేటర్" : "Creator",
    poster: isTelugu ? "పోస్టర్" : "Poster",
    shares: isTelugu ? "షేర్స్" : "Shares",
    downloads: isTelugu ? "డౌన్‌లోడ్స్" : "Downloads",
    performance: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(copy.loginRequired);
      }
      const response = await fetch(
        withCreatorImpersonationQuery("/api/creator/leaderboard", searchParams),
        {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        },
      );
      const data = (await response.json()) as LeaderboardResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unable);
      }
      setItems(data.leaderboard ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unable);
    } finally {
      setLoading(false);
    }
  }, [copy.loginRequired, copy.unable, user, searchParams]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [loadData, user]);

  return (
    <section className="space-y-6">
      <article className="px-1 py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
              {copy.leaderboard}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{copy.categoryRankings}</h3>
            <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
          >
            {loading ? copy.refreshing : copy.refresh}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              {copy.loading}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              {copy.empty}
            </div>
          ) : (
            items.map((category) => (
              <article
                key={category.categoryId}
                className="rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-950">{category.categoryLabel}</h4>
                    {category.myEntry ? (
                      <p className="mt-1 text-sm text-slate-600">
                        {copy.yourRank}: #{category.myEntry.rank} • {category.myEntry.shares} {copy.shares.toLowerCase()} •{" "}
                        {category.myEntry.performancePercent.toFixed(1)}%
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600">{copy.noActivePoster}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-[24px] border border-[var(--portal-border)]">
                  <table className="min-w-full bg-white text-sm">
                    <thead className="bg-[var(--portal-surface-soft)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{copy.rank}</th>
                        <th className="px-4 py-3">{copy.creator}</th>
                        <th className="px-4 py-3">{copy.poster}</th>
                        <th className="px-4 py-3">{copy.shares}</th>
                        <th className="px-4 py-3">{copy.downloads}</th>
                        <th className="px-4 py-3">{copy.performance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.rows.map((row) => (
                        <tr key={`${category.categoryId}-${row.posterId}`} className="border-t border-slate-100">
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${rankTone(row.rank)}`}>
                              #{row.rank}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.creatorName}</td>
                          <td className="px-4 py-3 text-slate-700">{row.posterTitle || copy.poster}</td>
                          <td className="px-4 py-3 text-slate-700">{row.shares}</td>
                          <td className="px-4 py-3 text-slate-700">{row.downloads}</td>
                          <td className="px-4 py-3 text-slate-700">{row.performancePercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
