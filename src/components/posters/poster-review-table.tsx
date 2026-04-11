"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface PosterPersonalization {
  photoShape: "circle" | "rounded" | "square" | "hexagon" | "pill";
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
  personalizationConfig: PosterPersonalization;
  createdAt: number;
  updatedAt: number;
}

function photoShapeClass(shape: PosterPersonalization["photoShape"]): string {
  if (shape === "circle") {
    return "rounded-full";
  }
  if (shape === "rounded") {
    return "rounded-2xl";
  }
  if (shape === "pill") {
    return "rounded-[40px]";
  }
  return "rounded-none";
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

  async function submitReview(posterId: string, nextStatus: "approved" | "rejected") {
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

  return (
    <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Poster Review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Creator photo/name placement preview చూసి approve/reject చేయండి.
          </p>
        </div>
        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Pending in current list: {pendingCount}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creator / category / poster"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button
          onClick={() => void loadPosters()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
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
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
            Loading poster reviews...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
            No posters found for selected filters.
          </div>
        ) : (
          rows.map((row) => {
            const config = row.personalizationConfig;
            return (
              <article
                key={row.id}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[380px_minmax(0,1fr)]"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="w-full overflow-hidden rounded-lg">
                    <div className="relative overflow-hidden bg-black">
                      <img
                        src={row.imageUrl}
                        alt={row.title}
                        className="h-auto w-full object-contain"
                      />
                      <div
                        className="absolute"
                        style={{
                          left: `${config.photoX}%`,
                          top: `${config.photoY}%`,
                          width: `${config.photoScale}%`,
                          aspectRatio: "1 / 1",
                          transform: "translate(-50%, -50%)",
                          clipPath:
                            config.photoShape === "hexagon"
                              ? "polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)"
                              : undefined,
                        }}
                      >
                        <img
                          src="/samples/default-avatar.png"
                          alt="Creator sample"
                          className={`h-full w-full object-cover ${photoShapeClass(config.photoShape)}`}
                        />
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
                            {config.sampleName || row.creatorName || "Creator Name"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {config.showBottomStrip ? (
                      <div className="w-full bg-white px-3 py-1.5 text-center text-slate-900">
                        <p className="truncate text-sm font-bold">
                          {config.sampleName || row.creatorName || "Creator Name"}
                        </p>
                      </div>
                    ) : null}
                    {config.showWhatsapp && row.creatorPhone.trim().length > 0 ? (
                      <div className="w-full bg-[#25D366] px-3 py-1.5 text-center text-white">
                        <p className="truncate text-xs font-semibold">
                          WhatsApp {row.creatorPhone}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <a
                    href={row.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline"
                  >
                    Open original poster
                  </a>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">
                        {row.title}
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
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    <input
                      value={reviewCommentMap[row.id] ?? ""}
                      onChange={(e) =>
                        setReviewCommentMap((prev) => ({
                          ...prev,
                          [row.id]: e.target.value,
                        }))
                      }
                      placeholder="Review comment (optional)"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => void submitReview(row.id, "approved")}
                      disabled={busyMap[row.id]}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyMap[row.id] ? "Updating..." : "Approve"}
                    </button>
                    <button
                      onClick={() => void submitReview(row.id, "rejected")}
                      disabled={busyMap[row.id]}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busyMap[row.id] ? "Updating..." : "Reject"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
