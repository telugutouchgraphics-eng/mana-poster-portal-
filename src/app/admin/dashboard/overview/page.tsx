"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { portalLanguage, t } from "@/lib/i18n";

interface UploadTrendItem {
  day: string;
  uploads: number;
}

interface CategoryPerformanceItem {
  categoryId: string;
  categoryLabel: string;
  totalUploads: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

interface AdminOverviewResponse {
  ok: boolean;
  error?: string;
  headline?: {
    totalCreators: number;
    totalManagers: number;
    totalPosters: number;
    todayUploads: number;
    totalEarnings: number;
    totalInstalls?: number;
    todayActiveUsers?: number;
    last7DaysActiveUsers?: number;
    subscribedUsers?: number;
    trialUsers?: number;
    notSubscribedUsers?: number;
  };
  installMetrics?: {
    totalInstalls: number;
    todayActive: number;
    last7DaysActive: number;
    byRegion: Array<{
      regionId: string;
      regionName: string;
      totalInstalls: number;
      todayActive: number;
      last7DaysActive: number;
    }>;
  };
  subscriptionMetrics?: {
    totalUsers: number;
    subscribed: number;
    trialActive: number;
    expired: number;
    notSubscribed: number;
    manualFree: number;
    referralReward: number;
    byRegion: Array<{
      regionId: string;
      regionName: string;
      totalUsers: number;
      subscribed: number;
      trialActive: number;
      expired: number;
      notSubscribed: number;
      manualFree: number;
      referralReward: number;
    }>;
  };
  uploadsTrend?: UploadTrendItem[];
  revenue?: {
    gross: number;
    creator: number;
    platform: number;
    paidOut: number;
  };
  categoryPerformance?: CategoryPerformanceItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`rounded-[24px] border px-5 py-5 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em]">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, name } = useAuth();
  const { language } = useDashboardLanguage();
  const { region, regions } = useDashboardRegion();
  const lang = portalLanguage(language);
  const [overviewRegionId, setOverviewRegionId] = useState(region.id);
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllInstallRegions, setShowAllInstallRegions] = useState(false);
  const overviewRegionName =
    overviewRegionId === "all"
      ? "All States / UTs"
      : regions.find((item) => item.id === overviewRegionId)?.name ?? region.name;

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/overview?regionId=${encodeURIComponent(overviewRegionId)}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as AdminOverviewResponse;
      if (!response.ok || !payload.ok || !payload.headline) {
        throw new Error(payload.error ?? t("admin.overview.unableLoad", lang));
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.overview.unableLoad", lang));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang, overviewRegionId]);

  useEffect(() => {
    setOverviewRegionId(region.id);
  }, [region.id]);

  const trendMax = useMemo(
    () => Math.max(1, ...(data?.uploadsTrend?.map((item) => item.uploads) ?? [1])),
    [data?.uploadsTrend],
  );
  const isAllStatesOverview = overviewRegionId === "all";
  const installRegions = useMemo(
    () => data?.installMetrics?.byRegion ?? [],
    [data?.installMetrics?.byRegion],
  );
  const subscriptionRegions = useMemo(
    () => data?.subscriptionMetrics?.byRegion ?? [],
    [data?.subscriptionMetrics?.byRegion],
  );
  const topInstallRegions = useMemo(
    () => [...installRegions].sort((a, b) => b.totalInstalls - a.totalInstalls).slice(0, 5),
    [installRegions],
  );
  const summaryInstallRegions = isAllStatesOverview ? topInstallRegions : installRegions;
  const tableInstallRegions = showAllInstallRegions || !isAllStatesOverview ? installRegions : topInstallRegions;
  const subscriptionByRegion = useMemo(
    () => Object.fromEntries(subscriptionRegions.map((item) => [item.regionId, item])),
    [subscriptionRegions],
  );

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#111827_0%,#7c3aed_42%,#ef4444_100%)] px-6 py-8 text-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">
          {t("admin.overview.eyebrow", lang)}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">
          {name || t("admin.overview.defaultName", lang)}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/90">
          {t("admin.overview.description", lang)}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/15 bg-white/14 px-4 py-4 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
              Total Live Users
            </p>
            <p className="mt-2 text-4xl font-black text-white">
              {loading ? "..." : data?.headline?.totalInstalls ?? 0}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/70">
              {isAllStatesOverview ? "All States / UTs combined" : overviewRegionName}
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
              Today Active
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {loading ? "..." : data?.headline?.todayActiveUsers ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
              Subscribed
            </p>
            <p className="mt-2 text-3xl font-black text-white">
              {loading ? "..." : data?.headline?.subscribedUsers ?? 0}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:max-w-xs">
          <label className="text-[11px] font-black uppercase tracking-[0.24em] text-white/75">
            Overview Data
          </label>
          <select
            value={overviewRegionId}
            onChange={(event) => setOverviewRegionId(event.target.value)}
            className="min-h-11 rounded-2xl border border-white/25 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none"
            aria-label="Select overview state or union territory"
          >
            <option value="all">All States / UTs</option>
            {regions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.primaryLanguage}
              </option>
            ))}
          </select>
          <p className="text-xs font-semibold text-white/75">
            Showing: {overviewRegionName}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label={t("admin.overview.totalCreators", lang)}
          value={loading ? "..." : String(data?.headline?.totalCreators ?? 0)}
          tone="border-violet-200 bg-violet-50 text-violet-900"
        />
        <MetricCard
          label={t("admin.overview.totalManagers", lang)}
          value={loading ? "..." : String(data?.headline?.totalManagers ?? 0)}
          tone="border-sky-200 bg-sky-50 text-sky-900"
        />
        <MetricCard
          label={t("admin.overview.totalPosters", lang)}
          value={loading ? "..." : String(data?.headline?.totalPosters ?? 0)}
          tone="border-amber-200 bg-amber-50 text-amber-900"
        />
        <MetricCard
          label={t("admin.overview.todayUploads", lang)}
          value={loading ? "..." : String(data?.headline?.todayUploads ?? 0)}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
        <MetricCard
          label={t("admin.overview.totalEarnings", lang)}
          value={loading ? "..." : formatCurrency(data?.headline?.totalEarnings ?? 0)}
          tone="border-rose-200 bg-rose-50 text-rose-900"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="App Installs"
          value={loading ? "..." : String(data?.headline?.totalInstalls ?? 0)}
          tone="border-cyan-200 bg-cyan-50 text-cyan-950"
        />
        <MetricCard
          label="Today Active"
          value={loading ? "..." : String(data?.headline?.todayActiveUsers ?? 0)}
          tone="border-lime-200 bg-lime-50 text-lime-950"
        />
        <MetricCard
          label="Last 7 Days Active"
          value={loading ? "..." : String(data?.headline?.last7DaysActiveUsers ?? 0)}
          tone="border-indigo-200 bg-indigo-50 text-indigo-950"
        />
      </div>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
              Live State-wise Installs
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              Users by selected State / UT
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Counts update when users open the app or change their State/UT.
            </p>
          </div>
          <div className="rounded-3xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/65">
              Total Live Count
            </p>
            <p className="mt-2 text-4xl font-black">{data?.installMetrics?.totalInstalls ?? 0}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {summaryInstallRegions.map((item) => {
            const subscription = subscriptionByRegion[item.regionId];
            return (
              <div key={item.regionId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="truncate text-sm font-black text-slate-950">{item.regionName}</p>
                <p className="mt-3 text-3xl font-black text-slate-950">{item.totalInstalls}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  installs
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
                  <span className="rounded-2xl bg-emerald-100 px-2 py-1.5 text-emerald-700">
                    Sub {subscription?.subscribed ?? 0}
                  </span>
                  <span className="rounded-2xl bg-slate-200 px-2 py-1.5 text-slate-700">
                    Free {subscription?.notSubscribed ?? 0}
                  </span>
                  <span className="rounded-2xl bg-amber-100 px-2 py-1.5 text-amber-700">
                    Trial {subscription?.trialActive ?? 0}
                  </span>
                  <span className="rounded-2xl bg-indigo-100 px-2 py-1.5 text-indigo-700">
                    7D {item.last7DaysActive}
                  </span>
                  <span className="rounded-2xl bg-cyan-100 px-2 py-1.5 text-cyan-700">
                    Today {item.todayActive}
                  </span>
                  <span className="rounded-2xl bg-violet-100 px-2 py-1.5 text-violet-700">
                    Manual {subscription?.manualFree ?? 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {isAllStatesOverview && installRegions.length > topInstallRegions.length ? (
          <button
            type="button"
            onClick={() => setShowAllInstallRegions((value) => !value)}
            className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800"
          >
            {showAllInstallRegions ? "Show Top 5 only" : `Show all ${installRegions.length} States / UTs`}
          </button>
        ) : null}
        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <p className="text-sm font-black text-slate-950">
              {showAllInstallRegions && isAllStatesOverview ? "All States / UTs" : "Top States / UTs"}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Scroll inside this box to view more rows.
            </p>
          </div>
          <div className="grid min-w-[760px] grid-cols-[minmax(0,1.4fr)_0.6fr_0.8fr_0.7fr_0.7fr_0.7fr] bg-slate-50 px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
            <span>State / UT</span>
            <span>Installs</span>
            <span>Subscribed</span>
            <span>Free</span>
            <span>Today</span>
            <span>7D</span>
          </div>
          <div className={showAllInstallRegions && isAllStatesOverview ? "max-h-[360px] overflow-y-auto" : ""}>
            {tableInstallRegions.map((item) => {
              const subscription = subscriptionByRegion[item.regionId];
              return (
                <div
                  key={`row-${item.regionId}`}
                  className="grid min-w-[760px] grid-cols-[minmax(0,1.4fr)_0.6fr_0.8fr_0.7fr_0.7fr_0.7fr] border-t border-slate-100 px-3 py-3 text-sm"
                >
                  <span className="font-bold text-slate-950">{item.regionName}</span>
                  <span className="font-bold text-slate-700">{item.totalInstalls}</span>
                  <span className="font-bold text-emerald-700">{subscription?.subscribed ?? 0}</span>
                  <span className="font-bold text-slate-700">{subscription?.notSubscribed ?? 0}</span>
                  <span className="font-bold text-cyan-700">{item.todayActive}</span>
                  <span className="font-bold text-indigo-700">{item.last7DaysActive}</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
            Showing {tableInstallRegions.length} of {installRegions.length} States / UTs
          </div>
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                {t("admin.overview.uploadTrend", lang)}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">
                {t("admin.overview.last7DaysUploads", lang)}
              </h3>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t("admin.overview.refresh", lang)}
            </button>
          </div>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-7 sm:gap-4 sm:overflow-visible sm:pb-0">
            {(data?.uploadsTrend ?? []).map((item) => (
              <div
                key={item.day}
                className="flex min-h-44 min-w-[92px] flex-col justify-end rounded-[22px] border border-slate-100 bg-[var(--portal-surface-soft)] p-3 sm:min-h-52 sm:min-w-0"
              >
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-2xl bg-[linear-gradient(180deg,#8b5cf6_0%,#7c3aed_100%)]"
                    style={{
                      height: `${Math.max(14, (item.uploads / trendMax) * 160)}px`,
                    }}
                  />
                </div>
                <p className="mt-3 text-lg font-bold text-slate-900">{item.uploads}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.day}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
            {t("admin.overview.revenueSummary", lang)}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">
            {t("admin.overview.earningsSplit", lang)}
          </h3>
          <div className="mt-6 space-y-4">
            {[
              [t("admin.overview.gross", lang), data?.revenue?.gross ?? 0, "bg-slate-900"],
              [t("admin.overview.creatorShare", lang), data?.revenue?.creator ?? 0, "bg-emerald-500"],
              [t("admin.overview.platformShare", lang), data?.revenue?.platform ?? 0, "bg-violet-500"],
              [t("admin.overview.paidOut", lang), data?.revenue?.paidOut ?? 0, "bg-amber-500"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-100 bg-[var(--portal-surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">{label}</p>
                  <p className="text-lg font-bold text-slate-950">{formatCurrency(Number(value))}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div
                    className={`h-2 rounded-full ${tone}`}
                    style={{
                      width: `${Math.min(
                        100,
                        ((Number(value) || 0) / Math.max(1, data?.revenue?.gross ?? 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
          {t("admin.overview.categoryPerformance", lang)}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">
          {t("admin.overview.topCategoryUploads", lang)}
        </h3>
        <p className="mt-2 text-xs font-semibold text-slate-500 sm:hidden">
          Swipe sideways to see all columns.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-3 py-3">{t("admin.overview.category", lang)}</th>
                <th className="px-3 py-3">{t("admin.overview.uploads", lang)}</th>
                <th className="px-3 py-3">{t("admin.overview.approved", lang)}</th>
                <th className="px-3 py-3">{t("admin.overview.pending", lang)}</th>
                <th className="px-3 py-3">{t("admin.overview.rejected", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.categoryPerformance ?? []).map((item) => (
                <tr key={item.categoryId} className="border-t border-slate-100/80">
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    <CategoryLabelWithLogo id={item.categoryId} label={item.categoryLabel} />
                  </td>
                  <td className="px-3 py-3 text-slate-700">{item.totalUploads}</td>
                  <td className="px-3 py-3 text-emerald-700">{item.approvedCount}</td>
                  <td className="px-3 py-3 text-amber-700">{item.pendingCount}</td>
                  <td className="px-3 py-3 text-rose-700">{item.rejectedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
