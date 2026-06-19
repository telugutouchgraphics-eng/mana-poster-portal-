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

interface ManagerOverviewResponse {
  ok: boolean;
  error?: string;
  headline?: {
    assignedCreatorsCount: number;
    pendingReviews: number;
    todayUploads: number;
    totalUploads: number;
  };
  performanceSummary?: {
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
  };
  uploadsTrend?: UploadTrendItem[];
  categoryPerformance?: CategoryPerformanceItem[];
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

export default function ManagerOverviewPage() {
  const { user, name } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
  const lang = portalLanguage(language);
  const [data, setData] = useState<ManagerOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/manager/overview?regionId=${encodeURIComponent(region.id)}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as ManagerOverviewResponse;
      if (!response.ok || !payload.ok || !payload.headline) {
        throw new Error(payload.error ?? t("manager.overview.unableLoad", lang));
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("manager.overview.unableLoad", lang));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang, region.id]);

  const trendMax = useMemo(
    () => Math.max(1, ...(data?.uploadsTrend?.map((item) => item.uploads) ?? [1])),
    [data?.uploadsTrend],
  );

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_46%,#7c3aed_100%)] px-6 py-8 text-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/75">
          {t("manager.overview.eyebrow", lang)}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">
          {name || t("manager.overview.defaultName", lang)}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/90">
          {t("manager.overview.description", lang)}
        </p>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("manager.overview.assignedCreators", lang)}
          value={loading ? "..." : String(data?.headline?.assignedCreatorsCount ?? 0)}
          tone="border-sky-200 bg-sky-50 text-sky-900"
        />
        <MetricCard
          label={t("manager.overview.pendingReviews", lang)}
          value={loading ? "..." : String(data?.headline?.pendingReviews ?? 0)}
          tone="border-amber-200 bg-amber-50 text-amber-900"
        />
        <MetricCard
          label={t("manager.overview.todayUploads", lang)}
          value={loading ? "..." : String(data?.headline?.todayUploads ?? 0)}
          tone="border-emerald-200 bg-emerald-50 text-emerald-900"
        />
        <MetricCard
          label={t("manager.overview.approvalRate", lang)}
          value={loading ? "..." : `${data?.performanceSummary?.approvalRate ?? 0}%`}
          tone="border-violet-200 bg-violet-50 text-violet-900"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                {t("manager.overview.uploadTrend", lang)}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">
                {t("manager.overview.last7DaysUploads", lang)}
              </h3>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t("manager.overview.refresh", lang)}
            </button>
          </div>
          <div className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-7 sm:gap-4 sm:overflow-visible sm:pb-0">
            {(data?.uploadsTrend ?? []).map((item) => (
              <div
                key={item.day}
                className="flex min-h-44 min-w-[92px] flex-col justify-end rounded-[22px] border border-slate-100 bg-[var(--portal-surface-soft)] p-3 sm:min-h-48 sm:min-w-0"
              >
                <div className="flex flex-1 items-end">
                  <div
                    className="w-full rounded-2xl bg-[linear-gradient(180deg,#06b6d4_0%,#2563eb_100%)]"
                    style={{ height: `${Math.max(14, (item.uploads / trendMax) * 150)}px` }}
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
            {t("manager.overview.performanceSummary", lang)}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">
            {t("manager.overview.reviewOutcome", lang)}
          </h3>
          <div className="mt-6 space-y-4">
            {[
              [t("manager.overview.approved", lang), data?.performanceSummary?.approvedCount ?? 0, "bg-emerald-500"],
              [t("manager.overview.rejected", lang), data?.performanceSummary?.rejectedCount ?? 0, "bg-rose-500"],
              [t("manager.overview.totalUploads", lang), data?.headline?.totalUploads ?? 0, "bg-sky-500"],
              [t("manager.overview.pendingReviews", lang), data?.headline?.pendingReviews ?? 0, "bg-amber-500"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-100 bg-[var(--portal-surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">{label}</p>
                  <p className="text-lg font-bold text-slate-950">{value}</p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white">
                  <div
                    className={`h-2 rounded-full ${tone}`}
                    style={{
                      width: `${Math.min(
                        100,
                        ((Number(value) || 0) / Math.max(1, data?.headline?.totalUploads ?? 1)) * 100,
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
          {t("manager.overview.categoryBreakdown", lang)}
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">
          {t("manager.overview.assignedCategories", lang)}
        </h3>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-3 py-3">{t("manager.overview.category", lang)}</th>
                <th className="px-3 py-3">{t("manager.overview.uploads", lang)}</th>
                <th className="px-3 py-3">{t("manager.overview.approved", lang)}</th>
                <th className="px-3 py-3">{t("manager.overview.pending", lang)}</th>
                <th className="px-3 py-3">{t("manager.overview.rejected", lang)}</th>
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
