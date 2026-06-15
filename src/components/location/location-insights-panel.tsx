"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

interface LocationInsightRow {
  key: string;
  state: string;
  district: string;
  city: string;
  userCount: number;
  statusCount: number;
  reportCount: number;
  latestActivityAt: number;
}

interface LocationInsights {
  generatedAt: number;
  totalLocationEnabledUsers: number;
  lastSevenDaysStatusCount: number;
  totalReportCountWithLocation: number;
  locations: LocationInsightRow[];
}

function formatDate(value: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

export function LocationInsightsPanel() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<LocationInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const response = await fetch("/api/admin/location-insights", {
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        insights?: LocationInsights;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.insights) {
        throw new Error(data.error ?? "Unable to load location insights.");
      }
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load location insights.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  return (
    <section className="space-y-5">
      <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">
              Privacy-safe area insights
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Location-based status dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
              Shows approximate city/district/state activity only. Exact GPS latitude and longitude are not stored or displayed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInsights()}
            disabled={loading}
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Location-enabled users" value={insights?.totalLocationEnabledUsers ?? 0} />
        <StatCard label="7-day statuses with area" value={insights?.lastSevenDaysStatusCount ?? 0} />
        <StatCard label="Reports with area" value={insights?.totalReportCountWithLocation ?? 0} />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">City/District activity</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Latest aggregate snapshot: {formatDate(insights?.generatedAt ?? 0)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">District</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3 text-right">Users</th>
                <th className="px-5 py-3 text-right">Statuses</th>
                <th className="px-5 py-3 text-right">Reports</th>
                <th className="px-5 py-3">Latest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(insights?.locations ?? []).map((row) => (
                <tr key={row.key} className="text-slate-700">
                  <td className="px-5 py-4 font-bold text-slate-950">{row.state}</td>
                  <td className="px-5 py-4">{row.district}</td>
                  <td className="px-5 py-4">{row.city}</td>
                  <td className="px-5 py-4 text-right font-bold">{row.userCount}</td>
                  <td className="px-5 py-4 text-right font-bold">{row.statusCount}</td>
                  <td className="px-5 py-4 text-right font-bold">{row.reportCount}</td>
                  <td className="px-5 py-4">{formatDate(row.latestActivityAt)}</td>
                </tr>
              ))}
              {!loading && (insights?.locations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center font-semibold text-slate-500">
                    No approximate location activity yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
