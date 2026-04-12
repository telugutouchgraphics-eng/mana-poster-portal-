"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface ManagerOverviewResponse {
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
  categoryLeaderboards?: Array<{
    categoryId: string;
    categoryLabel: string;
    creatorCount: number;
    leaders: Array<{
      creatorPublicId: string;
      creatorName: string;
      approvedCount: number;
      totalUploads: number;
      creatorEarnings: number;
    }>;
  }>;
  activeCompetitions?: Array<{
    competition: {
      id: string;
      title: string;
      description: string;
      rewardNote: string;
      status: string;
    };
    creatorCount: number;
    leaders: Array<{
      rank: number;
      creatorPublicId: string;
      creatorName: string;
      approvedCount: number;
      totalUploads: number;
      creatorEarnings: number;
    }>;
  }>;
}

export default function ManagerPerformancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ManagerOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await user?.getIdToken();
        if (!token) return;
        const response = await fetch("/api/manager/overview", {
          headers: { authorization: `Bearer ${token}` },
        });
        const next = (await response.json()) as ManagerOverviewResponse;
        if (!response.ok || !next.ok) {
          throw new Error(next.error ?? "Unable to load performance.");
        }
        if (!cancelled) {
          setData(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load performance.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const categoryPerformance = data?.categoryPerformance ?? [];
  const categoryLeaderboards = data?.categoryLeaderboards ?? [];
  const activeCompetitions = data?.activeCompetitions ?? [];

  return (
    <div className="grid gap-6">
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
            Review Summary
          </p>
          <h3 className="mt-3 text-2xl font-bold text-slate-950">
            Category performance and creator rankings ni single view lo monitor cheyyachu.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Review load ekkada ekkuva undo, e category lo approvals ekkuva vastunnayo, e creators active ga upload chesthunnaroo ikkada clear ga kanipisthundi.
          </p>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-green-dark)]">
            Manager Focus
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            Review decisions, creator follow-up, and category planning ki avasaram ayye numbers ikkade ready ga untayi.
          </p>
        </article>
      </section>

      <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <h3 className="text-xl font-bold text-slate-950">Active Competitions</h3>
        <p className="mt-2 text-sm text-slate-600">
          Active competitions lo top creators and current standings.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {activeCompetitions.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              Active competitions unnapudu ikkada list kanipisthundi.
            </div>
          ) : (
            activeCompetitions.map((item) => (
              <article key={item.competition.id} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.competition.title}</p>
                  <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {item.competition.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{item.competition.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Creators {item.creatorCount} | Reward {item.competition.rewardNote || "-"}
                </p>
                <div className="mt-3 space-y-2">
                  {item.leaders.slice(0, 3).map((leader) => (
                    <div key={`${item.competition.id}-${leader.creatorPublicId}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-xs">
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
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <h3 className="text-xl font-bold text-slate-950">Category Performance</h3>
        <p className="mt-2 text-sm text-slate-600">
          Category-wise uploads, approvals, rejections, and pending work ni clear ga chudachu.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categoryPerformance.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              Upload data available ayyaka category stats ikkada kanipisthai.
            </div>
          ) : (
            categoryPerformance.slice(0, 9).map((item) => (
              <article
                key={item.categoryId}
                className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">{item.categoryLabel}</p>
                <p className="mt-2 text-xs text-slate-600">
                  Uploads {item.totalUploads} | Approved {item.approvedCount}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Pending {item.pendingCount} | Rejected {item.rejectedCount}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <h3 className="text-xl font-bold text-slate-950">Creator Rankings</h3>
        <p className="mt-2 text-sm text-slate-600">
          Assigned categories lo top creators and relative movement.
        </p>
        <div className="mt-5 grid gap-4">
          {categoryLeaderboards.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              Creator ranking data ready ayyaka top creators ikkada auto ga fill avtaru.
            </div>
          ) : (
            categoryLeaderboards.slice(0, 6).map((board) => (
              <article
                key={board.categoryId}
                className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{board.categoryLabel}</p>
                  <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {board.creatorCount} creators
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {board.leaders.map((leader, index) => (
                    <div
                      key={`${board.categoryId}-${leader.creatorPublicId}`}
                      className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {index + 1}. {leader.creatorName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {leader.creatorPublicId}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <p>Approved {leader.approvedCount}</p>
                        <p>Uploads {leader.totalUploads}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
