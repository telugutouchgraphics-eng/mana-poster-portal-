"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface CreatorCompetitionLeader {
  creatorPublicId: string;
  creatorName: string;
  approvedCount: number;
  totalUploads: number;
  creatorEarnings: number;
}

interface CreatorDashboardResponse {
  ok: boolean;
  error?: string;
  categoryPerformance?: Array<{
    categoryId: string;
    categoryLabel: string;
    totalUploads: number;
    approvedCount: number;
    rejectedCount: number;
    pendingCount: number;
  }>;
  competition?: Array<{
    categoryId: string;
    categoryLabel: string;
    rank: number;
    creatorCount: number;
    approvedCount: number;
    totalUploads: number;
    creatorEarnings: number;
    leaders: CreatorCompetitionLeader[];
  }>;
  activeCompetitions?: Array<{
    id: string;
    title: string;
    description: string;
    rewardNote: string;
    status: string;
    creatorCount: number;
    myRank: number | null;
    myApprovedCount: number;
    myUploads: number;
    leaders: Array<CreatorCompetitionLeader & { rank: number }>;
  }>;
}

export default function CreatorPerformancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<CreatorDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await user?.getIdToken();
        if (!token) return;
        const response = await fetch("/api/creator/dashboard", {
          headers: { authorization: `Bearer ${token}` },
        });
        const next = (await response.json()) as CreatorDashboardResponse;
        if (!response.ok || !next.ok) {
          throw new Error(next.error ?? "Unable to load creator performance.");
        }
        if (!cancelled) {
          setData(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load creator performance.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const categoryPerformance = data?.categoryPerformance ?? [];
  const competition = data?.competition ?? [];
  const activeCompetitions = data?.activeCompetitions ?? [];

  return (
    <>
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
            Performance View
          </p>
          <h3 className="mt-3 text-2xl font-bold text-slate-950">
            Assigned category progress and ranking view designed for quick self-tracking.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Creator ki e category lo growth undi, e category lo improve avvali ane signal immediate
            ga kanipinchela layout polish chesam.
          </p>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(37,211,102,0.16),rgba(255,255,255,0.95))] px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-green-dark)]">
            Focus Area
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            Approvals, rankings, and earnings ni separate sections lo clean ga chupisthunnam kabatti
            creator ki comparison and planning rendu easy avtayi.
          </p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <h3 className="text-xl font-bold text-slate-950">Live Competitions</h3>
          <p className="mt-2 text-sm text-slate-600">
            Active contest lo mee position and top creators.
          </p>
          <div className="mt-5 space-y-4">
            {activeCompetitions.length === 0 ? (
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
                Competition active ayyaka mee live contest rank ikkada kanipisthundi.
              </div>
            ) : (
              activeCompetitions.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <span className="rounded-full border border-[var(--portal-green)]/25 bg-[var(--portal-green)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--portal-green-dark)]">
                      {item.myRank ? `Rank #${item.myRank}` : "Not ranked yet"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{item.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Approved {item.myApprovedCount} | Uploads {item.myUploads} | Reward {item.rewardNote || "-"}
                  </p>
                  <div className="mt-3 space-y-2">
                    {item.leaders.slice(0, 3).map((leader) => (
                      <div key={`${item.id}-${leader.creatorPublicId}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">
                            #{leader.rank} {leader.creatorName}
                          </p>
                          <p className="text-slate-500">{leader.creatorPublicId}</p>
                        </div>
                        <div className="text-right text-slate-600">
                          <p>Approved {leader.approvedCount}</p>
                          <p>Uploads {leader.totalUploads}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <h3 className="text-xl font-bold text-slate-950">Category Performance</h3>
          <p className="mt-2 text-sm text-slate-600">
            Nee assigned categories lo upload quality and approval momentum ikkada kanipisthundi.
          </p>
          <div className="mt-5 space-y-3">
            {categoryPerformance.length === 0 ? (
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
                Uploads review ayyaka category performance blocks ikkada fill avthai.
              </div>
            ) : (
              categoryPerformance.map((item) => (
                <div
                  key={item.categoryId}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.categoryLabel}</p>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                      {item.totalUploads} uploads
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white px-2 py-2 text-emerald-700">
                      <p className="font-semibold">{item.approvedCount}</p>
                      <p className="text-slate-500">Approved</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 text-violet-700">
                      <p className="font-semibold">{item.pendingCount}</p>
                      <p className="text-slate-500">Pending</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 text-rose-700">
                      <p className="font-semibold">{item.rejectedCount}</p>
                      <p className="text-slate-500">Rejected</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <h3 className="text-xl font-bold text-slate-950">Assigned Category Rankings</h3>
          <p className="mt-2 text-sm text-slate-600">
            Nee category lo migatha creators ela perform chesthunaro compare cheyadaniki.
          </p>
          <div className="mt-5 space-y-4">
            {competition.length === 0 ? (
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
                Category ranking data ready ayyaka top creators and mee rank ikkada kanipisthai.
              </div>
            ) : (
              competition.map((item) => (
                <div
                  key={item.categoryId}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.categoryLabel}</p>
                    <span className="rounded-full border border-[var(--portal-green)]/25 bg-[var(--portal-green)]/10 px-3 py-1 text-[11px] font-semibold text-[var(--portal-green-dark)]">
                      Rank #{item.rank}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Approved {item.approvedCount} | Uploads {item.totalUploads} | Creators{" "}
                    {item.creatorCount} | Earnings Rs.{item.creatorEarnings}
                  </p>
                  <div className="mt-3 space-y-2">
                    {item.leaders.slice(0, 3).map((leader, index) => (
                      <div
                        key={`${item.categoryId}-${leader.creatorPublicId}`}
                        className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {index + 1}. {leader.creatorName}
                          </p>
                          <p className="mt-1 text-slate-500">{leader.creatorPublicId}</p>
                        </div>
                        <div className="text-right text-slate-600">
                          <p>Approved {leader.approvedCount}</p>
                          <p>Rs.{leader.creatorEarnings}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </>
  );
}
