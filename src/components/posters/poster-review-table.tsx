"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
  type PhotoEdgeStyle,
  type PhotoFrameStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";

interface PosterPersonalization {
  photoShape: PhotoShape;
  photoRenderMode: "cutout" | "original";
  edgeStyle: PhotoEdgeStyle;
  photoFrameStyle?: PhotoFrameStyle;
  showSafeAreas: boolean;
  photoX: number;
  photoY: number;
  photoScale: number;
  nameX: number;
  nameY: number;
  showBottomStrip: boolean;
  stripHeight: number;
  showWhatsapp: boolean;
  sampleName: string;
}

interface PosterRow {
  id: string;
  creatorPublicId: string;
  creatorName: string;
  creatorEmail: string;
  creatorPhone: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string;
  status: string;
  reviewComment: string;
  duplicateStatus: string;
  duplicateCount: number;
  reviewHistory: Array<{
    type: string;
    actorRole: string;
    actorId: string;
    actorName: string;
    comment: string;
    createdAt: number;
  }>;
  saleCount: number;
  grossAmount: number;
  creatorEarnings: number;
  platformEarnings: number;
  personalizationConfig: PosterPersonalization;
  createdAt: number;
  updatedAt: number;
}

function formatDate(epochMs: number): string {
  if (!epochMs) {
    return "-";
  }
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function PosterReviewTable() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PosterRow[]>([]);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewCommentMap, setReviewCommentMap] = useState<Record<string, string>>({});
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [saleAmountMap, setSaleAmountMap] = useState<Record<string, string>>({});

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadPosters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/posters/list?status=${encodeURIComponent(
          status
        )}&q=${encodeURIComponent(query)}`,
        { headers }
      );
      const data = (await response.json()) as {
        ok: boolean;
        posters?: PosterRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.posters) {
        throw new Error(data.error ?? "Unable to load poster review list.");
      }
      setRows(data.posters);
      setReviewCommentMap(
        Object.fromEntries(
          data.posters.map((item) => [item.id, item.reviewComment ?? ""])
        )
      );
      const posterRows = data.posters;
      setSaleAmountMap((prev) => {
        const next = { ...prev };
        for (const item of posterRows) {
          if (!next[item.id]) {
            next[item.id] = "";
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load posters.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, status, query]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadPosters();
  }, [user, loadPosters]);

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "pending").length,
    [rows]
  );

  async function submitReview(
    posterId: string,
    nextStatus: "approved" | "rejected" | "archived" | "deleted"
  ) {
    setBusyMap((prev) => ({ ...prev, [posterId]: true }));
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/posters/${encodeURIComponent(posterId)}/review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            status: nextStatus,
            reviewComment: reviewCommentMap[posterId] ?? "",
          }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update poster status.");
      }
      await loadPosters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update poster.");
    } finally {
      setBusyMap((prev) => ({ ...prev, [posterId]: false }));
    }
  }

  async function recordSale(posterId: string) {
    const amount = Number(saleAmountMap[posterId] ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter valid sale amount first.");
      return;
    }
    setBusyMap((prev) => ({ ...prev, [posterId]: true }));
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/posters/${encodeURIComponent(posterId)}/record-sale`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ amount }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to record sale.");
      }
      setSaleAmountMap((prev) => ({ ...prev, [posterId]: "" }));
      await loadPosters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record sale.");
    } finally {
      setBusyMap((prev) => ({ ...prev, [posterId]: false }));
    }
  }

  return (
    <section className="px-1 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Poster Review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review creator photo/name placement before approving or rejecting.
          </p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          Pending in current list: {pendingCount}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creator / category / poster"
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={() => void loadPosters()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {loading ? (
          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-8 text-center text-sm text-slate-600">
            Loading poster reviews...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-8 text-center text-sm text-slate-600">
            No posters found for selected filters.
          </div>
        ) : (
          rows.map((row) => {
            const config = row.personalizationConfig;
            return (
              <article
                key={row.id}
                className="grid gap-4 rounded-[26px] border border-[var(--portal-border)] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)] sm:p-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"
              >
                <div className="mx-auto w-full max-w-[300px] rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-2 sm:max-w-none lg:mx-0">
                  <div className="w-full overflow-hidden rounded-lg">
                    <div className="relative max-h-[min(52vh,380px)] overflow-hidden bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.imageUrl}
                        alt={row.title}
                        className="mx-auto h-auto max-h-[min(52vh,380px)] w-full object-contain"
                      />
                      <div
                        className="absolute overflow-hidden"
                        style={{
                          left: `${config.photoX}%`,
                          top: `${config.photoY}%`,
                          width: `${config.photoScale}%`,
                          aspectRatio: photoShapeAspectRatio(config.photoShape),
                          ...photoShapeFrameStyle(config.photoShape),
                        }}
                      >
                        {renderPosterPhotoPreview({
                          shape: config.photoShape,
                          renderMode: config.photoRenderMode,
                          edgeStyle: config.edgeStyle,
                          frameStyle: config.photoFrameStyle ?? "none",
                          src: "/samples/default-avatar-v2.png",
                          alt: "Creator sample",
                        })}
                     </div>
                      {!config.showBottomStrip ? (
                        <div
                          className="absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${config.nameX}%`,
                            top: `${config.nameY}%`,
                          }}
                        >
                          <p
                            className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                            style={{
                              fontFamily:
                                "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                            }}
                          >
                            {config.sampleName || row.creatorName || "User Name"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {config.showBottomStrip ? (
                      <div className="-mt-px w-full bg-white px-3 py-1.5 text-center text-slate-900">
                        <p className="truncate text-sm font-bold">
                          {config.sampleName || row.creatorName || "User Name"}
                        </p>
                      </div>
                    ) : null}
                    {config.showWhatsapp && row.creatorPhone.trim().length > 0 ? (
                      <div className="-mt-px w-full bg-[#25D366] px-3 py-1.5 text-center text-white">
                        <p className="truncate text-xs font-semibold">
                          {row.creatorPhone}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={row.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-blue-700 underline"
                  >
                    Open original poster
                  </a>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {row.creatorPublicId}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Creator: {row.creatorName} ({row.creatorPublicId})
                      </p>
                      <p className="text-xs text-slate-600">
                        Category: {row.categoryLabel || row.categoryId}
                      </p>
                      <p className="text-xs text-slate-600">
                        Uploaded: {formatDate(row.createdAt)}
                      </p>
                      <p className="text-xs text-slate-600">
                        Sales {row.saleCount} | Gross Rs.{row.grossAmount} | Creator Rs.
                        {row.creatorEarnings} | Platform Rs.{row.platformEarnings}
                      </p>
                      <p className="text-xs text-slate-600">
                        Duplicate check:{" "}
                        {row.duplicateCount > 1 ? `${row.duplicateCount} similar uploads` : "Unique"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-1 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_auto_auto]">
                    <input
                      value={reviewCommentMap[row.id] ?? ""}
                      onChange={(e) =>
                        setReviewCommentMap((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      placeholder="Review comment (optional)"
                      className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)]"
                    />
                    <button
                      onClick={() => void submitReview(row.id, "approved")}
                      disabled={busyMap[row.id]}
                      className="rounded-xl bg-[var(--portal-green)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)] disabled:opacity-60"
                    >
                      {busyMap[row.id] ? "Updating..." : "Approve"}
                    </button>
                    <button
                      onClick={() => void submitReview(row.id, "rejected")}
                      disabled={busyMap[row.id]}
                      className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyMap[row.id] ? "Updating..." : "Reject"}
                    </button>
                  </div>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={() => void submitReview(row.id, "archived")}
                      disabled={busyMap[row.id]}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => void submitReview(row.id, "deleted")}
                      disabled={busyMap[row.id]}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

                  {row.reviewHistory.length > 0 ? (
                    <div className="mt-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Review History
                      </p>
                      <div className="mt-2 space-y-2">
                        {row.reviewHistory
                          .slice()
                          .reverse()
                          .slice(0, 5)
                          .map((entry, index) => (
                            <div
                              key={`${row.id}-${entry.createdAt}-${index}`}
                              className="rounded-xl bg-white px-3 py-2 text-xs text-slate-700"
                            >
                              <p className="font-semibold capitalize text-slate-900">
                                {entry.type.replaceAll("_", " ")} by {entry.actorName || entry.actorRole}
                              </p>
                              <p className="text-slate-500">{formatDate(entry.createdAt)}</p>
                              {entry.comment ? <p className="mt-1">{entry.comment}</p> : null}
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {row.status === "approved" ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        value={saleAmountMap[row.id] ?? ""}
                        onChange={(e) =>
                          setSaleAmountMap((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        placeholder="Record sale amount"
                        inputMode="decimal"
                        className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)]"
                      />
                      <button
                        onClick={() => void recordSale(row.id)}
                        disabled={busyMap[row.id]}
                        className="rounded-xl bg-[linear-gradient(135deg,var(--portal-purple-dark),var(--portal-purple))] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busyMap[row.id] ? "Saving..." : "Record Sale"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
