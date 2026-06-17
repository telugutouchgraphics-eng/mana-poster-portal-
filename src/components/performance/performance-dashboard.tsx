"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

interface PosterMetric {
  creatorPublicId: string;
  posterId: string;
  posterTitle: string;
  categoryId: string;
  categoryLabel: string;
  dateKey: string;
  shares: number;
  downloads: number;
  performancePercent: number;
}

interface CalendarMetric {
  dateKey: string;
  day: number;
  shares: number;
  downloads: number;
  performancePercent: number;
  posterCount: number;
  posters: PosterMetric[];
}

interface SummaryMetric {
  shares: number;
  downloads: number;
  activeDays: number;
  posterCount: number;
  performancePercent: number;
}

interface CreatorOption {
  creatorPublicId: string;
  name: string;
  email: string;
  status: string;
}

interface PerformanceResponse {
  ok: boolean;
  error?: string;
  year: number;
  month: number;
  selectedCreatorId?: string;
  creators?: CreatorOption[];
  profile?: {
    creatorPublicId: string;
    name: string;
    email: string;
  };
  summary?: SummaryMetric;
  calendar?: CalendarMetric[];
  recentPosters?: Array<{
    creatorPublicId: string;
    posterId: string;
    posterTitle: string;
    categoryId: string;
    categoryLabel: string;
    createdAt: number;
    publishAt: number;
    performanceWindowEndAt: number;
    shares: number;
    downloads: number;
    performancePercent: number;
  }>;
  recentSummary?: {
    posterCount: number;
    shares: number;
    downloads: number;
    performancePercent: number;
  };
}

interface PerformanceDashboardProps {
  mode: "manager" | "creator";
  showHistoryToggle?: boolean;
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toneClass(value: number): string {
  if (value >= 70) {
    return "border-emerald-200 bg-emerald-50";
  }
  if (value >= 35) {
    return "border-amber-200 bg-amber-50";
  }
  if (value > 0) {
    return "border-blue-200 bg-blue-50";
  }
  return "border-[var(--portal-border)] bg-white";
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function PerformanceDashboard({
  mode,
  showHistoryToggle = true,
}: PerformanceDashboardProps) {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [selectedCreatorId, setSelectedCreatorId] = useState("");
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [creatorQuery, setCreatorQuery] = useState("");
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedCreatorId = (searchParams.get("creatorPublicId") ?? "").trim();
  const asCreatorPreview = (searchParams.get("asCreator") ?? "").trim();
  const showHistory = searchParams.get("history") === "1";

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const endpoint =
        mode === "manager" ? "/api/manager/performance" : "/api/creator/performance";
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        regionId: region.id,
      });
      if (mode === "manager" && selectedCreatorId) {
        params.set("creatorPublicId", selectedCreatorId);
      }
      if (mode === "creator" && (requestedCreatorId || asCreatorPreview)) {
        params.set("creatorPublicId", requestedCreatorId || asCreatorPreview);
      }
      const response = await fetch(`${endpoint}?${params.toString()}`, {
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        cache: "no-store",
      });
      const next = (await response.json()) as PerformanceResponse;
      if (!response.ok || !next.ok) {
        throw new Error(next.error ?? "Unable to load performance.");
      }
      setData(next);
      if (mode === "manager") {
        setSelectedCreatorId(next.selectedCreatorId ?? "");
        setPerformanceExpanded(Boolean(next.selectedCreatorId));
      }
      const firstActiveDay = (next.calendar ?? []).find((item) => item.posterCount > 0);
      setSelectedDayKey((prev) => {
        if (prev && (next.calendar ?? []).some((item) => item.dateKey === prev)) {
          return prev;
        }
        return firstActiveDay?.dateKey ?? "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load performance.");
    } finally {
      setLoading(false);
    }
  }, [mode, month, region.id, requestedCreatorId, asCreatorPreview, selectedCreatorId, user, year]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadPerformance();
  }, [user, loadPerformance]);

  const calendar = useMemo(() => data?.calendar ?? [], [data?.calendar]);
  const summary = data?.summary;
  const activeDay = calendar.find((item) => item.dateKey === selectedDayKey) ?? null;
  const creators = useMemo(() => data?.creators ?? [], [data?.creators]);
  const filteredCreators = useMemo(() => {
    const query = creatorQuery.trim().toLowerCase();
    if (!query) {
      return creators;
    }
    return creators.filter((creator) =>
      [creator.name, creator.email, creator.creatorPublicId]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [creatorQuery, creators]);
  const selectedCreator =
    creators.find((item) => item.creatorPublicId === selectedCreatorId) ?? null;
  const recentPosters = data?.recentPosters ?? [];
  const recentSummary = data?.recentSummary;
  const calendarMap = useMemo(
    () => new Map(calendar.map((day) => [day.day, day])),
    [calendar],
  );
  const calendarWeeks = useMemo(() => {
    const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const cells: Array<number | null> = Array.from({ length: firstDay }, () => null);
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(day);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    const weeks: Array<Array<number | null>> = [];
    for (let index = 0; index < cells.length; index += 7) {
      weeks.push(cells.slice(index, index + 7));
    }
    return weeks;
  }, [month, year]);

  return (
    <section className="space-y-6">
      <div className="border-t border-[var(--portal-border)] px-1 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === "manager" ? "Creator Performance" : "Creator Performance"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {mode === "manager"
                ? "Search by creator name, email, or ID and open a creator to view performance."
                : "Performance for app posters live in the last 24 hours."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            {mode === "manager" ? null : (
              <>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {new Date(Date.UTC(2026, value - 1, 1)).toLocaleDateString("en-IN", {
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
                >
                  {[now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </>
            )}
            <button
              onClick={() => void loadPerformance()}
              className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            {mode === "creator" && showHistoryToggle ? (
              <Link
                href={
                  requestedCreatorId
                    ? `/creator/dashboard/performance?creatorPublicId=${encodeURIComponent(requestedCreatorId)}&history=${showHistory ? "0" : "1"}`
                    : `/creator/dashboard/performance?history=${showHistory ? "0" : "1"}`
                }
                className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {showHistory ? "Hide Previous Data" : "Previous Data"}
              </Link>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MetricCard
            label={mode === "manager" ? "Month" : "24 Hours"}
            value={
              mode === "manager"
                ? selectedCreator
                  ? monthLabel(year, month)
                  : `${creators.length} creators`
                : `${recentSummary?.posterCount ?? 0} posters`
            }
          />
          <MetricCard label="Shares" value={String(mode === "manager" ? summary?.shares ?? 0 : recentSummary?.shares ?? 0)} />
          <MetricCard label="Downloads" value={String(mode === "manager" ? summary?.downloads ?? 0 : recentSummary?.downloads ?? 0)} />
          <MetricCard
            label="Performance"
            value={`${mode === "manager" ? summary?.performancePercent ?? 0 : recentSummary?.performancePercent ?? 0}%`}
          />
        </div>
      </div>

      {mode === "manager" ? (
        <>
          <div className="border-t border-[var(--portal-border)] px-1 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Select Creator</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Search by creator name, email, or creator ID, then open the creator.
                </p>
              </div>
              <input
                value={creatorQuery}
                onChange={(event) => setCreatorQuery(event.target.value)}
                placeholder="Search creator"
                className="w-full max-w-sm rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </div>

            <div className="mt-5 space-y-3 lg:hidden">
              {filteredCreators.length === 0 ? (
                <div className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-6 text-center text-slate-500">
                  No matching creators found.
                </div>
              ) : (
                filteredCreators.map((creator) => {
                  const active = creator.creatorPublicId === selectedCreatorId;
                  return (
                    <button
                      key={`mobile-${creator.creatorPublicId}`}
                      type="button"
                      onClick={() => {
                        setSelectedCreatorId(creator.creatorPublicId);
                        setPerformanceExpanded(true);
                      }}
                      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                        active
                          ? "border-violet-300 bg-violet-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            data-no-auto-translate="true"
                            className="truncate text-base font-semibold text-slate-900"
                          >
                            {creator.name}
                          </p>
                          <p
                            data-no-auto-translate="true"
                            className="mt-1 break-all text-xs text-slate-600"
                          >
                            {creator.email}
                          </p>
                          <p
                            data-no-auto-translate="true"
                            className="mt-1 font-mono text-[11px] text-slate-500"
                          >
                            {creator.creatorPublicId}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {creator.status}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-[var(--portal-border)] lg:block">
              <table className="min-w-full bg-white text-sm">
                <thead className="bg-[var(--portal-surface-soft)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Open</th>
                    <th className="px-4 py-3">Creator</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Creator ID</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No matching creators found.
                      </td>
                    </tr>
                  ) : (
                    filteredCreators.map((creator) => {
                      const active = creator.creatorPublicId === selectedCreatorId;
                      return (
                        <tr
                          key={creator.creatorPublicId}
                          className={`border-t border-slate-100 ${active ? "bg-violet-50/50" : "bg-white"}`}
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCreatorId(creator.creatorPublicId);
                                setPerformanceExpanded(true);
                              }}
                              className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                active
                                  ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              }`}
                              aria-label={`Open creator ${creator.creatorPublicId}`}
                            >
                              <span className="text-[10px] leading-none">✓</span>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCreatorId(creator.creatorPublicId);
                                setPerformanceExpanded(true);
                              }}
                              data-no-auto-translate="true"
                              className="text-left font-semibold text-slate-900 hover:text-[var(--portal-purple)]"
                            >
                              {creator.name}
                            </button>
                          </td>
                          <td data-no-auto-translate="true" className="px-4 py-3 text-slate-700">{creator.email}</td>
                          <td data-no-auto-translate="true" className="px-4 py-3 text-slate-700">{creator.creatorPublicId}</td>
                          <td className="px-4 py-3 text-slate-700">{creator.status}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-[var(--portal-border)] px-1 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Performance Dashboard</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Real performance data appears after you open a creator.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      {new Date(Date.UTC(2026, value - 1, 1)).toLocaleDateString("en-IN", {
                        month: "long",
                        timeZone: "UTC",
                      })}
                    </option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
                >
                  {[now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
                <button
                  type="button"
                  disabled={!selectedCreatorId}
                  onClick={() => setPerformanceExpanded((value) => !value)}
                  className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {performanceExpanded ? "Collapse" : "Expand"}
                </button>
                {selectedCreatorId ? (
                  <Link
                    href={`/creator/dashboard/performance?creatorPublicId=${encodeURIComponent(selectedCreatorId)}`}
                    className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Open Creator Dashboard
                  </Link>
                ) : null}
              </div>
            </div>

            {!selectedCreator ? (
              <div className="mt-5 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                Select a creator to open performance.
              </div>
            ) : (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricCard label="Creator" value={<span data-no-auto-translate="true">{selectedCreator.name}</span>} />
                  <MetricCard label="Creator ID" value={<span data-no-auto-translate="true">{selectedCreator.creatorPublicId}</span>} />
                  <MetricCard label="Month" value={monthLabel(year, month)} />
                  <MetricCard label="Active Days" value={String(summary?.activeDays ?? 0)} />
                </div>

                {performanceExpanded ? (
                  <div className="mt-5 space-y-5">
                    <div className="overflow-x-auto rounded-[24px] border border-[var(--portal-border)]">
                      <table className="min-w-full border-collapse bg-white text-sm">
                        <thead>
                          <tr className="bg-[var(--portal-surface-soft)]">
                            {WEEKDAY_LABELS.map((label) => (
                              <th
                                key={label}
                                className="border-b border-r border-[var(--portal-border)] px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 last:border-r-0"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {calendarWeeks.map((week, weekIndex) => (
                            <tr key={`week-${weekIndex}`} className="align-top">
                              {week.map((dayNumber, dayIndex) => {
                                const day = dayNumber ? calendarMap.get(dayNumber) ?? null : null;
                                const active = day ? selectedDayKey === day.dateKey : false;
                                const hasUpload = Boolean(day && day.posterCount > 0);
                                return (
                                  <td
                                    key={`cell-${weekIndex}-${dayIndex}`}
                                    className={`h-16 w-[14.28%] border-r border-b border-[var(--portal-border)] p-0 last:border-r-0 ${
                                      hasUpload ? toneClass(day!.performancePercent) : "bg-white"
                                    }`}
                                  >
                                    {dayNumber ? (
                                      <button
                                        type="button"
                                        disabled={!hasUpload}
                                        onClick={() => day && setSelectedDayKey(day.dateKey)}
                                        className={`flex h-full w-full flex-col items-start justify-start px-2 py-2 text-left transition ${
                                          active ? "ring-2 ring-inset ring-[var(--portal-purple)]" : ""
                                        } ${!hasUpload ? "cursor-default" : ""}`}
                                      >
                                        <span className="text-xs font-bold text-slate-900">{dayNumber}</span>
                                        {hasUpload && day ? (
                                          <span className="mt-1 text-[11px] text-slate-700">
                                            {day.posterCount} posters
                                          </span>
                                        ) : null}
                                      </button>
                                    ) : (
                                      <div className="h-full w-full bg-white" />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
                      <h4 className="text-sm font-semibold text-slate-900">
                        {activeDay ? `${activeDay.dateKey} Details` : "Day Details"}
                      </h4>
                      <div className="mt-4 space-y-3">
                        {!activeDay || activeDay.posters.length === 0 ? (
                          <div className="rounded-2xl bg-white px-4 py-5 text-sm text-slate-600">
                            No performance data for the selected day.
                          </div>
                        ) : (
                          activeDay.posters.map((poster) => (
                            <div
                              key={`${poster.dateKey}-${poster.posterId}-${poster.posterTitle}`}
                              className="grid gap-3 rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_110px_110px_130px]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {poster.posterTitle || "Poster"}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  {poster.categoryLabel || poster.categoryId || "Uncategorized"}
                                </p>
                              </div>
                              <StatPill label="Shares" value={poster.shares} />
                              <StatPill label="Downloads" value={poster.downloads} />
                              <StatPill label="Performance" value={`${poster.performancePercent.toFixed(1)}%`} />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                    Click Expand to open the performance dashboard.
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : null}

      {mode === "creator" ? (
      <div className="border-t border-[var(--portal-border)] px-1 py-4">
        <h3 className="text-base font-semibold text-slate-900">
          Upload Performance - Last 24 Hours
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Only app posters live in the last 24 hours are shown here.
        </p>

        <div className="mt-5 space-y-3">
          {recentPosters.length === 0 ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              No active poster performance in the last 24 hours.
            </div>
          ) : null}
          {recentPosters.map((poster) => (
            <div
              key={`recent-${poster.posterId}`}
              className="grid gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4 sm:grid-cols-[minmax(0,1fr)_120px_120px_140px]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {poster.posterTitle || "Poster"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {poster.categoryLabel || poster.categoryId || "Uncategorized"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Live from: {new Date(poster.publishAt || poster.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <StatPill label="Shares" value={poster.shares} />
              <StatPill label="Downloads" value={poster.downloads} />
              <StatPill label="Performance" value={`${poster.performancePercent.toFixed(1)}%`} />
            </div>
          ))}
        </div>
      </div>
      ) : null}

      {mode === "creator" && showHistory ? (
        <div className="border-t border-[var(--portal-border)] px-1 py-4">
          <h3 className="text-base font-semibold text-slate-900">Previous Data</h3>
          <p className="mt-1 text-sm text-slate-600">
            Older daily performance history.
          </p>
          <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)]">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-[var(--portal-surface-soft)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Shares</th>
                  <th className="px-4 py-3">Downloads</th>
                  <th className="px-4 py-3">Performance</th>
                </tr>
              </thead>
              <tbody>
                {calendar.filter((day) => day.posterCount > 0).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                      No previous data.
                    </td>
                  </tr>
                ) : (
                  calendar
                    .filter((day) => day.posterCount > 0)
                    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
                    .map((day) => (
                      <tr key={`history-${day.dateKey}`} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold text-slate-900">{day.dateKey}</td>
                        <td className="px-4 py-3 text-slate-700">{day.shares}</td>
                        <td className="px-4 py-3 text-slate-700">{day.downloads}</td>
                        <td className="px-4 py-3 text-slate-700">{day.performancePercent.toFixed(1)}%</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  );
}

