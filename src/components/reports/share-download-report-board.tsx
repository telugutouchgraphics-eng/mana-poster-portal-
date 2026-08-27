"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

type ReportMode = "admin" | "manager" | "creator";

interface CreatorOption {
  creatorPublicId: string;
  name: string;
  email: string;
}

interface HistoryItem {
  dateKey: string;
  shares: number;
  downloads: number;
  subscriberShares: number;
  nonSubscriberShares: number;
  subscriberDownloads: number;
  nonSubscriberDownloads: number;
  displayShares: number;
  displayDownloads: number;
  total: number;
  displayTotal: number;
}

interface ReportRow {
  posterId: string;
  posterTitle: string;
  categoryId: string;
  categoryLabel: string;
  regionId: string;
  creatorPublicId: string;
  creatorName: string;
  imageUrl: string;
  thumbnailUrl: string;
  videoUrl: string;
  mediaType: string;
  shareCount: number;
  downloadCount: number;
  subscriberShareCount: number;
  nonSubscriberShareCount: number;
  subscriberDownloadCount: number;
  nonSubscriberDownloadCount: number;
  displayShareCount: number;
  displayDownloadCount: number;
  totalEngagement: number;
  displayTotalEngagement: number;
  firstDateKey: string;
  lastDateKey: string;
  history: HistoryItem[];
}

interface ReportResponse {
  ok: boolean;
  error?: string;
  creators?: CreatorOption[];
  selectedCreatorId?: string;
  rows?: ReportRow[];
  summary?: {
    posterCount: number;
    shareCount: number;
    downloadCount: number;
    subscriberShareCount: number;
    nonSubscriberShareCount: number;
    subscriberDownloadCount: number;
    nonSubscriberDownloadCount: number;
    displayShareCount: number;
    displayDownloadCount: number;
    totalEngagement: number;
    displayTotalEngagement: number;
  };
}

interface CategoryGroup {
  key: string;
  label: string;
  posterCount: number;
  shareCount: number;
  downloadCount: number;
  subscriberShareCount: number;
  nonSubscriberShareCount: number;
  subscriberDownloadCount: number;
  nonSubscriberDownloadCount: number;
  displayShareCount: number;
  displayDownloadCount: number;
  totalEngagement: number;
  displayTotalEngagement: number;
  rows: ReportRow[];
}

function formatLocalDate(value: Date) {
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

function defaultSelectedDate() {
  return formatLocalDate(new Date());
}

function endpointForMode(mode: ReportMode) {
  return `/api/${mode}/share-downloads`;
}

export function ShareDownloadReportBoard({ mode }: { mode: ReportMode }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [creators, setCreators] = useState<CreatorOption[]>([]);
  const [creatorPublicId, setCreatorPublicId] = useState("");
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(
    () => ({
      posterCount: rows.length,
      shareCount: rows.reduce((sum, row) => sum + row.shareCount, 0),
      downloadCount: rows.reduce((sum, row) => sum + row.downloadCount, 0),
      subscriberShareCount: rows.reduce((sum, row) => sum + row.subscriberShareCount, 0),
      nonSubscriberShareCount: rows.reduce((sum, row) => sum + row.nonSubscriberShareCount, 0),
      subscriberDownloadCount: rows.reduce((sum, row) => sum + row.subscriberDownloadCount, 0),
      nonSubscriberDownloadCount: rows.reduce((sum, row) => sum + row.nonSubscriberDownloadCount, 0),
      displayShareCount: rows.reduce((sum, row) => sum + row.displayShareCount, 0),
      displayDownloadCount: rows.reduce((sum, row) => sum + row.displayDownloadCount, 0),
      totalEngagement: rows.reduce((sum, row) => sum + row.totalEngagement, 0),
      displayTotalEngagement: rows.reduce((sum, row) => sum + row.displayTotalEngagement, 0),
    }),
    [rows],
  );

  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groups = new Map<string, CategoryGroup>();
    for (const row of rows) {
      const key = row.categoryId || row.categoryLabel || "uncategorized";
      const existing =
        groups.get(key) ??
        {
          key,
          label: row.categoryLabel || row.categoryId || "Uncategorized",
          posterCount: 0,
          shareCount: 0,
          downloadCount: 0,
          subscriberShareCount: 0,
          nonSubscriberShareCount: 0,
          subscriberDownloadCount: 0,
          nonSubscriberDownloadCount: 0,
          displayShareCount: 0,
          displayDownloadCount: 0,
          totalEngagement: 0,
          displayTotalEngagement: 0,
          rows: [],
        };
      existing.posterCount += 1;
      existing.shareCount += row.shareCount;
      existing.downloadCount += row.downloadCount;
      existing.subscriberShareCount += row.subscriberShareCount;
      existing.nonSubscriberShareCount += row.nonSubscriberShareCount;
      existing.subscriberDownloadCount += row.subscriberDownloadCount;
      existing.nonSubscriberDownloadCount += row.nonSubscriberDownloadCount;
      existing.displayShareCount += row.displayShareCount;
      existing.displayDownloadCount += row.displayDownloadCount;
      existing.totalEngagement += row.totalEngagement;
      existing.displayTotalEngagement += row.displayTotalEngagement;
      existing.rows.push(row);
      groups.set(key, existing);
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (b.displayTotalEngagement !== a.displayTotalEngagement) {
        return b.displayTotalEngagement - a.displayTotalEngagement;
      }
      return a.label.localeCompare(b.label);
    });
  }, [rows]);

  const loadReport = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate,
        search,
      });
      if (creatorPublicId) {
        params.set("creatorPublicId", creatorPublicId);
      }
      const response = await fetch(`${endpointForMode(mode)}?${params.toString()}`, {
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        cache: "no-store",
      });
      const data = (await response.json()) as ReportResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to load report.");
      }
      setRows(data.rows ?? []);
      setCreators(data.creators ?? []);
      if (mode === "manager" && data.selectedCreatorId !== undefined) {
        setCreatorPublicId(data.selectedCreatorId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [creatorPublicId, mode, search, selectedDate, user]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">
              Share / Download Report
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Poster engagement history
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">
              Date
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>
            {mode !== "creator" ? (
              <label className="text-sm font-medium text-slate-700">
                Creator
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={creatorPublicId}
                  onChange={(event) => setCreatorPublicId(event.target.value)}
                >
                  <option value="">All creators</option>
                  {creators.map((creator) => (
                    <option key={creator.creatorPublicId} value={creator.creatorPublicId}>
                      {creator.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-sm font-medium text-slate-700 lg:col-span-2">
              Search
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Poster, category, creator"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Posters", displayValue: summary.posterCount },
          {
            label: "Display Shares",
            displayValue: summary.displayShareCount,
            realValue: summary.shareCount,
          },
          {
            label: "Display Downloads",
            displayValue: summary.displayDownloadCount,
            realValue: summary.downloadCount,
          },
          {
            label: "Display Total",
            displayValue: summary.displayTotalEngagement,
            realValue: summary.totalEngagement,
          },
          {
            label: "Subscriber Total",
            displayValue: summary.subscriberShareCount + summary.subscriberDownloadCount,
          },
          {
            label: "Non-subscriber Total",
            displayValue: summary.nonSubscriberShareCount + summary.nonSubscriberDownloadCount,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{item.displayValue}</p>
            {typeof item.realValue === "number" ? (
              <p className="mt-1 text-xs font-semibold text-slate-500">Real {item.realValue}</p>
            ) : null}
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div>
            <p className="font-semibold text-slate-900">Categories</p>
            <p className="text-sm text-slate-500">
              Share/download totals grouped by poster category
            </p>
          </div>
          <button
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="space-y-5 p-4">
          {categoryGroups.map((group) => (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-950">{group.label}</h2>
                  <p className="text-sm font-medium text-slate-500">
                    {group.posterCount} posters in this category
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5 sm:min-w-[38rem]">
                  <div className="rounded-xl bg-purple-100 px-3 py-2">
                    <p className="text-xs font-semibold text-purple-700">Display Shares</p>
                    <p className="text-xl font-black text-purple-950">{group.displayShareCount}</p>
                    <p className="text-[11px] font-semibold text-purple-700">Real {group.shareCount}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700">Display Downloads</p>
                    <p className="text-xl font-black text-emerald-950">{group.displayDownloadCount}</p>
                    <p className="text-[11px] font-semibold text-emerald-700">Real {group.downloadCount}</p>
                  </div>
                  <div className="rounded-xl bg-amber-100 px-3 py-2">
                    <p className="text-xs font-semibold text-amber-700">Display Total</p>
                    <p className="text-xl font-black text-amber-950">{group.displayTotalEngagement}</p>
                    <p className="text-[11px] font-semibold text-amber-700">Real {group.totalEngagement}</p>
                  </div>
                  <div className="rounded-xl bg-blue-100 px-3 py-2">
                    <p className="text-xs font-semibold text-blue-700">Subscribers</p>
                    <p className="text-xl font-black text-blue-950">
                      {group.subscriberShareCount + group.subscriberDownloadCount}
                    </p>
                    <p className="text-[11px] font-semibold text-blue-700">
                      S {group.subscriberShareCount} / D {group.subscriberDownloadCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-200 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-700">Non-subscribers</p>
                    <p className="text-xl font-black text-slate-950">
                      {group.nonSubscriberShareCount + group.nonSubscriberDownloadCount}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-700">
                      S {group.nonSubscriberShareCount} / D {group.nonSubscriberDownloadCount}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.rows.map((row) => {
                  const previewUrl = row.thumbnailUrl || row.imageUrl;
                  return (
                    <article
                      key={row.posterId}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="relative aspect-[4/5] bg-slate-100">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={row.posterTitle}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                            {row.mediaType === "video" ? "Video" : "Poster"}
                          </div>
                        )}
                        <img
                          src="/mana-poster-logo.png"
                          alt=""
                          className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-white/85 p-1 shadow-sm"
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-base font-bold leading-snug text-slate-950">
                            {row.posterTitle || "Untitled poster"}
                          </h2>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {row.regionId || "Region"}
                          </p>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            Creator: {row.creatorName || row.creatorPublicId || "Admin upload"}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-400">
                            {row.firstDateKey === row.lastDateKey
                              ? row.firstDateKey || selectedDate
                              : `${row.firstDateKey} to ${row.lastDateKey}`}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-xl bg-purple-50 p-3">
                            <p className="text-xs font-semibold text-purple-700">Display Shares</p>
                            <p className="mt-1 text-xl font-black text-purple-950">
                              {row.displayShareCount}
                            </p>
                            <p className="text-[11px] font-semibold text-purple-700">Real {row.shareCount}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-xs font-semibold text-emerald-700">Display Downloads</p>
                            <p className="mt-1 text-xl font-black text-emerald-950">
                              {row.displayDownloadCount}
                            </p>
                            <p className="text-[11px] font-semibold text-emerald-700">Real {row.downloadCount}</p>
                          </div>
                          <div className="rounded-xl bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-700">Display Total</p>
                            <p className="mt-1 text-xl font-black text-amber-950">
                              {row.displayTotalEngagement}
                            </p>
                            <p className="text-[11px] font-semibold text-amber-700">Real {row.totalEngagement}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-xs font-semibold text-blue-700">Subscriber</p>
                            <p className="mt-1 text-xl font-black text-blue-950">
                              {row.subscriberShareCount + row.subscriberDownloadCount}
                            </p>
                            <p className="text-[11px] font-semibold text-blue-700">
                              Shares {row.subscriberShareCount} | Downloads {row.subscriberDownloadCount}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-100 p-3">
                            <p className="text-xs font-semibold text-slate-700">Non-subscriber</p>
                            <p className="mt-1 text-xl font-black text-slate-950">
                              {row.nonSubscriberShareCount + row.nonSubscriberDownloadCount}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-700">
                              Shares {row.nonSubscriberShareCount} | Downloads {row.nonSubscriberDownloadCount}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {!loading && rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No share/download history found for this date.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
