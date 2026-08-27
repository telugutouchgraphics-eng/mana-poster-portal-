"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

interface RegionOption {
  id: string;
  name: string;
}

interface UsageScreenRow {
  screenKey: string;
  screenLabel: string;
  visitCount: number;
  uniqueUserCount: number;
  totalDurationMs: number;
  loginDropoffCount: number;
}

interface DailyUsageRow {
  dateKey: string;
  activeUserCount: number;
  visitCount: number;
  totalDurationMs: number;
  loginDropoffCount: number;
}

interface UsageResponse {
  ok: boolean;
  error?: string;
  regions?: RegionOption[];
  summary?: {
    activeUserCount: number;
    visitCount: number;
    totalDurationMs: number;
    loginDropoffCount: number;
  };
  screens?: UsageScreenRow[];
  daily?: DailyUsageRow[];
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultStartDate() {
  const value = new Date();
  value.setDate(value.getDate() - 6);
  return formatDate(value);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) {
    return restSeconds ? `${minutes}m ${restSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

function averageDuration(totalDurationMs: number, visits: number) {
  return visits > 0 ? Math.round(totalDurationMs / visits) : 0;
}

export function AppUsageReportBoard() {
  const { user } = useAuth();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [regionId, setRegionId] = useState("all");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [screens, setScreens] = useState<UsageScreenRow[]>([]);
  const [daily, setDaily] = useState<DailyUsageRow[]>([]);
  const [summary, setSummary] = useState({
    activeUserCount: 0,
    visitCount: 0,
    totalDurationMs: 0,
    loginDropoffCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const avgTime = useMemo(
    () => averageDuration(summary.totalDurationMs, summary.visitCount),
    [summary.totalDurationMs, summary.visitCount],
  );

  const loadUsage = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        regionId,
      });
      const response = await fetch(`/api/admin/app-usage?${params.toString()}`, {
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        cache: "no-store",
      });
      const data = (await response.json()) as UsageResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to load app usage.");
      }
      setRegions(data.regions ?? []);
      setScreens(data.screens ?? []);
      setDaily(data.daily ?? []);
      setSummary(
        data.summary ?? {
          activeUserCount: 0,
          visitCount: 0,
          totalDurationMs: 0,
          loginDropoffCount: 0,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load app usage.");
      setScreens([]);
      setDaily([]);
    } finally {
      setLoading(false);
    }
  }, [endDate, regionId, startDate, user]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">
              App Usage Analytics
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Screen time and login drop-offs
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              State / UT
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
              >
                <option value="all">All assigned states</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              From
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              To
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <button
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={loading}
              onClick={() => void loadUsage()}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Daily Active Users", value: summary.activeUserCount },
          { label: "Screen Visits", value: summary.visitCount },
          { label: "Avg Time", value: formatDuration(avgTime) },
          { label: "Login Drop-offs", value: summary.loginDropoffCount },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-bold text-slate-950">Screen performance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Users and time spent grouped by app screen.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Screen</th>
                <th className="px-5 py-3">Users</th>
                <th className="px-5 py-3">Visits</th>
                <th className="px-5 py-3">Avg Time</th>
                <th className="px-5 py-3">Total Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {screens.map((screen) => (
                <tr key={screen.screenKey}>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {screen.screenLabel}
                  </td>
                  <td className="px-5 py-4">{screen.uniqueUserCount}</td>
                  <td className="px-5 py-4">{screen.visitCount}</td>
                  <td className="px-5 py-4">
                    {formatDuration(averageDuration(screen.totalDurationMs, screen.visitCount))}
                  </td>
                  <td className="px-5 py-4">{formatDuration(screen.totalDurationMs)}</td>
                </tr>
              ))}
              {!loading && screens.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-500" colSpan={5}>
                    No app usage recorded for this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-bold text-slate-950">Daily activity</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {daily.map((row) => (
            <div key={row.dateKey} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-500">{row.dateKey}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {row.activeUserCount} users
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {row.visitCount} visits - {formatDuration(row.totalDurationMs)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
