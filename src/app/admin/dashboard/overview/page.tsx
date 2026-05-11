"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
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
  const lang = portalLanguage(language);
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/overview", {
        headers: { authorization: `Bearer ${token}` },
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
  }, [user, lang]);

  const trendMax = useMemo(
    () => Math.max(1, ...(data?.uploadsTrend?.map((item) => item.uploads) ?? [1])),
    [data?.uploadsTrend],
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
                  <td className="px-3 py-3 font-semibold text-slate-900">{item.categoryLabel}</td>
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
