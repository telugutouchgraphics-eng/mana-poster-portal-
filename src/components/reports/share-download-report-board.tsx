"use client";

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
  total: number;
}

interface ReportRow {
  posterId: string;
  posterTitle: string;
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
  totalEngagement: number;
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
    totalEngagement: number;
  };
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
  const [expandedPosterId, setExpandedPosterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summary = useMemo(
    () => ({
      posterCount: rows.length,
      shareCount: rows.reduce((sum, row) => sum + row.shareCount, 0),
      downloadCount: rows.reduce((sum, row) => sum + row.downloadCount, 0),
      totalEngagement: rows.reduce((sum, row) => sum + row.totalEngagement, 0),
    }),
    [rows],
  );

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
          ["Posters", summary.posterCount],
          ["Shares", summary.shareCount],
          ["Downloads", summary.downloadCount],
          ["Total", summary.totalEngagement],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
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
          <p className="font-semibold text-slate-900">Posters</p>
          <button
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            type="button"
            onClick={() => void loadReport()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((row) => {
            const previewUrl = row.thumbnailUrl || row.imageUrl;
            const expanded = expandedPosterId === row.posterId;
            return (
              <article key={row.posterId} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[160px_1fr_auto] lg:items-center">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt={row.posterTitle}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        {row.mediaType === "video" ? "Video" : "Poster"}
                      </div>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/mana-poster-logo.png"
                      alt=""
                      className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-white/80 p-1"
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-950">{row.posterTitle}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.categoryLabel || "Category"} | {row.regionId || "Region"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Creator: {row.creatorName || row.creatorPublicId || "Admin upload"}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {row.firstDateKey} to {row.lastDateKey}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center lg:w-72">
                    <div className="rounded-xl bg-purple-50 p-3">
                      <p className="text-xs text-purple-700">Shares</p>
                      <p className="text-lg font-bold text-purple-950">{row.shareCount}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700">Downloads</p>
                      <p className="text-lg font-bold text-emerald-950">{row.downloadCount}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-xs text-amber-700">Total</p>
                      <p className="text-lg font-bold text-amber-950">{row.totalEngagement}</p>
                    </div>
                  </div>
                </div>
                <button
                  className="mt-3 text-sm font-semibold text-purple-700"
                  type="button"
                  onClick={() => setExpandedPosterId(expanded ? "" : row.posterId)}
                >
                  {expanded ? "Hide history" : "Show history"}
                </button>
                {expanded ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Shares</th>
                          <th className="px-3 py-2">Downloads</th>
                          <th className="px-3 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.history.map((item) => (
                          <tr key={`${row.posterId}-${item.dateKey}`}>
                            <td className="px-3 py-2">{item.dateKey}</td>
                            <td className="px-3 py-2">{item.shares}</td>
                            <td className="px-3 py-2">{item.downloads}</td>
                            <td className="px-3 py-2">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            );
          })}
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
