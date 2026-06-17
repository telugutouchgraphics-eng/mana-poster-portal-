"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";

interface CreatorPoster {
  id: string;
  categoryId: string;
  categoryLabel: string;
  mediaType?: string;
  imageUrl: string;
  videoUrl?: string;
  status: string;
  reviewComment?: string;
  createdAt: number;
  publishAt?: number;
  performanceWindowEndAt?: number;
}

interface DashboardResponse {
  ok: boolean;
  error?: string;
  posters?: CreatorPoster[];
}

interface RecentPoster {
  posterId: string;
  shares: number;
  downloads: number;
  performancePercent: number;
  rank: number;
}

interface PerformanceResponse {
  ok: boolean;
  error?: string;
  recentPosters?: RecentPoster[];
}

function statusPill(status: string): string {
  if (status === "approved") return "bg-emerald-600 text-white";
  if (status === "rejected") return "bg-rose-600 text-white";
  return "bg-violet-600 text-white";
}

function isVideoPoster(poster: Pick<CreatorPoster, "mediaType" | "videoUrl">): boolean {
  return poster.mediaType === "video" && Boolean(poster.videoUrl);
}

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function CreatorMyUploadsBoard() {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const searchParams = useSearchParams();
  const { language } = useDashboardLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posters, setPosters] = useState<CreatorPoster[]>([]);
  const [recentMap, setRecentMap] = useState<Record<string, RecentPoster>>({});
  const [now, setNow] = useState(() => Date.now());
  const isTelugu = language === "telugu";
  const copy = {
    loginRequired: isTelugu ? "లాగిన్ రిక్వైర్డ్." : "Login required.",
    unableUploads: isTelugu ? "అప్లోడ్స్ లోడ్ చేయలేకపోయాం." : "Unable to load uploads.",
    unablePerformance: isTelugu ? "పెర్ఫార్మెన్స్ లోడ్ చేయలేకపోయాం." : "Unable to load performance.",
    myUploads: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
    activeUploads: isTelugu ? "లైవ్ పోస్టర్ పెర్ఫార్మెన్స్" : "Live Poster Performance",
    subtitle: isTelugu
      ? "అప్రూవ్ అయి లైవ్‌లో ఉన్న పోస్టర్ల షేర్స్, డౌన్‌లోడ్స్, ర్యాంక్ ఇక్కడ కనిపిస్తాయి."
      : "Shares, downloads, and rank appear here for approved posters currently live in the app.",
    refreshing: isTelugu ? "రిఫ్రెష్ అవుతోంది..." : "Refreshing...",
    refresh: isTelugu ? "రిఫ్రెష్" : "Refresh",
    loading: isTelugu ? "అప్లోడ్స్ లోడింగ్..." : "Loading uploads...",
    empty: isTelugu ? "కరెంట్‌గా లైవ్ పెర్ఫార్మెన్స్ పోస్టర్లు లేవు." : "No live poster performance is available right now.",
    uploadedAt: isTelugu ? "అప్లోడ్ టైమ్" : "Uploaded",
    accepted: isTelugu ? "యాక్సెప్టెడ్" : "Accepted",
    rejected: isTelugu ? "రిజెక్టెడ్" : "Rejected",
    pending: isTelugu ? "పెండింగ్" : "Pending",
    reason: isTelugu ? "రీజన్" : "Reason",
    performance: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
    rank: isTelugu ? "ర్యాంక్" : "Rank",
    shares: isTelugu ? "షేర్స్" : "Shares",
    downloads: isTelugu ? "డౌన్‌లోడ్స్" : "Downloads",
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(copy.loginRequired);
      }
      const [dashboardResponse, performanceResponse] = await Promise.all([
        fetch(withCreatorImpersonationQuery(`/api/creator/dashboard?regionId=${encodeURIComponent(region.id)}`, searchParams), {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
          cache: "no-store",
        }),
        fetch(withCreatorImpersonationQuery(`/api/creator/performance?regionId=${encodeURIComponent(region.id)}`, searchParams), {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
          cache: "no-store",
        }),
      ]);

      const dashboardData = (await dashboardResponse.json()) as DashboardResponse;
      const performanceData = (await performanceResponse.json()) as PerformanceResponse;

      if (!dashboardResponse.ok || !dashboardData.ok) {
        throw new Error(dashboardData.error ?? copy.unableUploads);
      }
      if (!performanceResponse.ok || !performanceData.ok) {
        throw new Error(performanceData.error ?? copy.unablePerformance);
      }

      setPosters(dashboardData.posters ?? []);
      setRecentMap(
        Object.fromEntries(
          (performanceData.recentPosters ?? []).map((item) => [item.posterId, item]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableUploads);
    } finally {
      setLoading(false);
    }
  }, [copy.loginRequired, copy.unablePerformance, copy.unableUploads, region.id, user, searchParams]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [loadData, user]);

  useEffect(() => {
    setNow(Date.now());
  }, [posters]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const visiblePosters = useMemo(() => {
    return posters
      .filter((poster) => {
        if (poster.status === "approved") {
          return Number(poster.performanceWindowEndAt ?? 0) > now;
        }
        return now - poster.createdAt <= 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [posters, now]);

  return (
    <section className="space-y-6">
      <article className="px-1 py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
              {copy.myUploads}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{copy.activeUploads}</h3>
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
          ) : visiblePosters.length === 0 ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              {copy.empty}
            </div>
          ) : (
            visiblePosters.map((poster) => {
              const performance = recentMap[poster.id];
              return (
                <article
                  key={poster.id}
                  className="grid gap-3 rounded-[28px] border border-[var(--portal-border)] bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:gap-4 sm:p-4 md:grid-cols-[100px_minmax(0,1fr)] lg:grid-cols-[120px_minmax(0,1fr)]"
                >
                  <div className="mx-auto aspect-[3/4] w-full max-w-[120px] overflow-hidden rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] md:mx-0 md:max-h-40 md:max-w-none">
                    {isVideoPoster(poster) ? (
                      <video
                        src={poster.videoUrl}
                        className="h-full max-h-40 w-full bg-slate-950 object-cover"
                        controls
                        muted
                        playsInline
                      />
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={poster.imageUrl}
                          alt={poster.categoryLabel || poster.categoryId}
                          className="h-full max-h-40 w-full object-cover"
                        />
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-bold text-slate-950">
                          {poster.categoryLabel || poster.categoryId}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {copy.uploadedAt}: {formatDate(poster.createdAt)}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(poster.status)}`}>
                        {poster.status === "approved"
                          ? copy.accepted
                          : poster.status === "rejected"
                            ? copy.rejected
                            : copy.pending}
                      </span>
                    </div>

                    {poster.status === "rejected" && poster.reviewComment ? (
                      <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {copy.reason}: {poster.reviewComment}
                      </p>
                    ) : null}

                    {poster.status === "approved" && performance ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <StatCard label={copy.performance} value={`${performance.performancePercent.toFixed(1)}%`} />
                        <StatCard label={copy.rank} value={`#${performance.rank}`} />
                        <StatCard label={copy.shares} value={String(performance.shares)} />
                        <StatCard label={copy.downloads} value={String(performance.downloads)} />
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--portal-surface-soft)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}
