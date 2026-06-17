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
  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

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

  const rows = insights?.locations ?? [];
  const stateOptions = Array.from(new Set(rows.map((row) => row.state).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
  const districtOptions = Array.from(
    new Set(
      rows
        .filter((row) => !stateFilter || row.state === stateFilter)
        .map((row) => row.district)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const cityOptions = Array.from(
    new Set(
      rows
        .filter((row) => !stateFilter || row.state === stateFilter)
        .filter((row) => !districtFilter || row.district === districtFilter)
        .map((row) => row.city)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const filteredRows = rows.filter((row) => {
    return (
      (!stateFilter || row.state === stateFilter) &&
      (!districtFilter || row.district === districtFilter) &&
      (!cityFilter || row.city === cityFilter)
    );
  });
  const maxStatusCount = Math.max(1, ...filteredRows.map((row) => row.statusCount));
  const maxReportCount = Math.max(1, ...filteredRows.map((row) => row.reportCount));
  const topStatusRows = [...filteredRows]
    .sort((a, b) => b.statusCount - a.statusCount || b.latestActivityAt - a.latestActivityAt)
    .slice(0, 8);
  const reportHotspots = [...filteredRows]
    .filter((row) => row.reportCount > 0)
    .sort((a, b) => b.reportCount - a.reportCount || b.latestActivityAt - a.latestActivityAt)
    .slice(0, 8);

  return (
    <section className="space-y-5">
      <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">
              Privacy-safe user insights
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              User insights dashboard
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

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>State</span>
            <select
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value);
                setDistrictFilter("");
                setCityFilter("");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">All states</option>
              {stateOptions.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>District</span>
            <select
              value={districtFilter}
              onChange={(event) => {
                setDistrictFilter(event.target.value);
                setCityFilter("");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">All districts</option>
              {districtOptions.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>City</span>
            <select
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            >
              <option value="">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setStateFilter("");
                setDistrictFilter("");
                setCityFilter("");
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Top status areas</h2>
          <div className="mt-4 space-y-3">
            {topStatusRows.map((row) => (
              <div key={`status-${row.key}`}>
                <div className="flex justify-between gap-3 text-sm font-bold text-slate-700">
                  <span>{[row.city, row.district, row.state].filter(Boolean).join(", ")}</span>
                  <span>{row.statusCount}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(5, (row.statusCount / maxStatusCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {topStatusRows.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No status activity for selected filters.</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Report hotspots</h2>
          <div className="mt-4 space-y-3">
            {reportHotspots.map((row) => (
              <div key={`report-${row.key}`}>
                <div className="flex justify-between gap-3 text-sm font-bold text-slate-700">
                  <span>{[row.city, row.district, row.state].filter(Boolean).join(", ")}</span>
                  <span>{row.reportCount}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-500"
                    style={{ width: `${Math.max(5, (row.reportCount / maxReportCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {reportHotspots.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No reports for selected filters.</p>
            ) : null}
          </div>
        </div>
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
              {filteredRows.map((row) => (
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
              {!loading && filteredRows.length === 0 ? (
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
