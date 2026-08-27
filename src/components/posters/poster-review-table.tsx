"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import {
  AppStyleNameStrip,
  isPhotoInNameStripSafeZone,
  NameStripOverlapWarning,
  nameStripSafeZoneHeightPercent,
} from "@/components/posters/app-style-name-strip";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import {
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
  type PhotoEdgeStyle,
  type PhotoFrameStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

interface PosterPersonalization {
  photoShape: PhotoShape;
  photoRenderMode: "cutout" | "original";
  edgeStyle: PhotoEdgeStyle;
  photoFrameStyle?: PhotoFrameStyle;
  showSafeAreas: boolean;
  photoX: number;
  photoY: number;
  photoScale: number;
  showVideoExtraPhoto: boolean;
  videoExtraPhotoShape: PhotoShape;
  videoExtraPhotoRenderMode: "cutout" | "original";
  videoExtraPhotoEdgeStyle: PhotoEdgeStyle;
  videoExtraPhotoFrameStyle?: PhotoFrameStyle;
  videoExtraPhotoX: number;
  videoExtraPhotoY: number;
  videoExtraPhotoScale: number;
  nameX: number;
  nameY: number;
  showBottomStrip: boolean;
  stripHeight: number;
  stripWidth?: number;
  stripX?: number;
  stripBottom?: number;
  showPoliticalProtocol?: boolean;
  politicalProtocolSlots?: PoliticalProtocolSlot[];
  showWhatsapp: boolean;
  sampleName: string;
  sampleDesignation?: string;
}

interface PoliticalProtocolSlot {
  x: number;
  y: number;
  scale: number;
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
  mediaType: string;
  imageUrl: string;
  videoUrl: string;
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
  engagementCount: number;
  displayEngagementCount: number;
  viewCount: number;
  shareCount: number;
  downloadCount: number;
  displayViewCount: number;
  displayShareCount: number;
  displayDownloadCount: number;
  grossAmount: number;
  creatorEarnings: number;
  platformEarnings: number;
  personalizationConfig: PosterPersonalization;
  createdAt: number;
  updatedAt: number;
  approvedAt: number;
  dashboardVisibleUntil: number;
}

interface MediaDimensions {
  width: number;
  height: number;
}

const REVIEW_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

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

const SUPPORTED_UPLOAD_DIMENSIONS = [
  { label: "1:1", width: 1080, height: 1080 },
  { label: "4:5", width: 1080, height: 1350 },
  { label: "9:16", width: 1080, height: 1920 },
] as const;

const ASPECT_RATIO_TOLERANCE = 0.01;
const DEFAULT_POLITICAL_PROTOCOL_SLOTS: PoliticalProtocolSlot[] = [
  { x: 28, y: 8, scale: 85 },
  { x: 72, y: 8, scale: 85 },
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function protocolSlotSidePercent(scale: number): number {
  return 15 * (clampNumber(scale, 45, 135) / 100);
}

function protocolSlotCenterPercent(value: number, sidePercent: number): number {
  const half = sidePercent / 2;
  return clampNumber(value, half, 100 - half);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function reducedRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return "-";
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function dimensionStatus(dimensions?: MediaDimensions) {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return {
      label: "Reading dimensions",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }
  const exact = SUPPORTED_UPLOAD_DIMENSIONS.find(
    (item) =>
      item.width === dimensions.width && item.height === dimensions.height,
  );
  if (exact) {
    return {
      label: `GREEN ${exact.label} exact px`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  const actualAspect = dimensions.width / dimensions.height;
  const supportedRatio = SUPPORTED_UPLOAD_DIMENSIONS.find((item) => {
    const expectedAspect = item.width / item.height;
    return Math.abs(actualAspect - expectedAspect) <= ASPECT_RATIO_TOLERANCE;
  });
  if (supportedRatio) {
    return {
      label: `GREEN ${supportedRatio.label} ratio ok`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  const ratio = reducedRatio(dimensions.width, dimensions.height);
  return {
    label: `RED unsupported ${ratio}`,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

function PoliticalProtocolSlotPreview({
  config,
}: {
  config: PosterPersonalization;
}) {
  if (!config.showPoliticalProtocol) return null;
  const slots =
    config.politicalProtocolSlots && config.politicalProtocolSlots.length >= 2
      ? config.politicalProtocolSlots.slice(0, 2)
      : DEFAULT_POLITICAL_PROTOCOL_SLOTS;
  return (
    <>
      {slots.map((slot, index) => {
        const side = protocolSlotSidePercent(slot.scale ?? 100);
        return (
          <div
            key={index}
            className="pointer-events-none absolute z-[2] flex items-center justify-center rounded-full border border-white bg-emerald-500 text-sm font-bold text-white"
            style={{
              left: `${protocolSlotCenterPercent(slot.x, side)}%`,
              top: `${protocolSlotCenterPercent(slot.y, side)}%`,
              width: `${side}%`,
              aspectRatio: "1 / 1",
              transform: "translate(-50%, -50%)",
            }}
          >
            {index + 1}
          </div>
        );
      })}
    </>
  );
}

function recommendedDimensionsText(): string {
  return SUPPORTED_UPLOAD_DIMENSIONS.map(
    (item) => `${item.label} = ${item.width}x${item.height}px`,
  ).join(" | ");
}

export function PosterReviewTable() {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const [rows, setRows] = useState<PosterRow[]>([]);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewCommentMap, setReviewCommentMap] = useState<
    Record<string, string>
  >({});
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [saleAmountMap, setSaleAmountMap] = useState<Record<string, string>>(
    {},
  );
  const [previewPoster, setPreviewPoster] = useState<{
    mediaUrl: string;
    mediaType: string;
    title: string;
  } | null>(null);
  const [selectedPosterIds, setSelectedPosterIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [mediaDimensionsMap, setMediaDimensionsMap] = useState<
    Record<string, MediaDimensions>
  >({});
  const loadRequestIdRef = useRef(0);

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadPosters = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const headers = await authHeader();
        const response = await fetch(
          `/api/manager/posters/list?status=${encodeURIComponent(
            status,
          )}&q=${encodeURIComponent(query)}&regionId=${encodeURIComponent(region.id)}`,
          { headers, cache: "no-store" },
        );
        const data = (await response.json()) as {
          ok: boolean;
          posters?: PosterRow[];
          error?: string;
        };
        if (!response.ok || !data.ok || !data.posters) {
          throw new Error(data.error ?? "Unable to load poster review list.");
        }
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        const nextPosters =
          status === "all"
            ? data.posters
            : data.posters.filter((item) => item.status === status);
        setRows(nextPosters);
        setSelectedPosterIds((prev) => {
          const visibleIds = new Set(nextPosters.map((item) => item.id));
          return new Set([...prev].filter((id) => visibleIds.has(id)));
        });
        setReviewCommentMap(
          Object.fromEntries(
            nextPosters.map((item) => [item.id, item.reviewComment ?? ""]),
          ),
        );
        const posterRows = nextPosters;
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
        if (requestId !== loadRequestIdRef.current) {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Unable to load posters.",
        );
      } finally {
        if (requestId === loadRequestIdRef.current && !options?.silent) {
          setLoading(false);
        }
      }
    },
    [authHeader, status, query, region.id],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadPosters();
  }, [user, loadPosters]);

  const currentListCount = useMemo(() => rows.length, [rows]);
  const selectedCount = selectedPosterIds.size;
  const allVisibleSelected =
    rows.length > 0 && rows.every((row) => selectedPosterIds.has(row.id));

  function togglePosterSelection(posterId: string) {
    setSelectedPosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(posterId)) {
        next.delete(posterId);
      } else {
        next.add(posterId);
      }
      return next;
    });
  }

  function toggleAllVisiblePosters() {
    setSelectedPosterIds((prev) => {
      if (rows.length === 0) {
        return new Set();
      }
      if (rows.every((row) => prev.has(row.id))) {
        return new Set(
          [...prev].filter((id) => !rows.some((row) => row.id === id)),
        );
      }
      return new Set([...prev, ...rows.map((row) => row.id)]);
    });
  }

  async function deleteSelectedPosters() {
    const ids = [...selectedPosterIds].filter((id) =>
      rows.some((row) => row.id === id),
    );
    if (ids.length === 0) {
      return;
    }
    const confirmed = window.confirm(
      `Delete ${ids.length} selected poster(s) permanently?`,
    );
    if (!confirmed) {
      return;
    }
    setBusyMap((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));
    setError(null);
    try {
      const headers = await authHeader();
      for (const posterId of ids) {
        const response = await fetch(
          `/api/manager/posters/${encodeURIComponent(posterId)}/review`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...headers,
            },
            body: JSON.stringify({
              status: "deleted",
              reviewComment: reviewCommentMap[posterId] ?? "",
            }),
          },
        );
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to delete selected posters.");
        }
      }
      setRows((prev) => prev.filter((row) => !ids.includes(row.id)));
      setSelectedPosterIds(
        (prev) => new Set([...prev].filter((id) => !ids.includes(id))),
      );
      setReviewCommentMap((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      setSaleAmountMap((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      await loadPosters({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete selected posters.",
      );
    } finally {
      setBusyMap((prev) => ({
        ...prev,
        ...Object.fromEntries(ids.map((id) => [id, false])),
      }));
    }
  }

  async function submitReview(
    posterId: string,
    nextStatus: "approved" | "rejected" | "archived" | "deleted",
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
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update poster status.");
      }
      setRows((prev) => prev.filter((row) => row.id !== posterId));
      setSelectedPosterIds((prev) => {
        const next = new Set(prev);
        next.delete(posterId);
        return next;
      });
      setReviewCommentMap((prev) => {
        const next = { ...prev };
        delete next[posterId];
        return next;
      });
      setSaleAmountMap((prev) => {
        const next = { ...prev };
        delete next[posterId];
        return next;
      });
      await loadPosters({ silent: true });
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
          <h2 className="text-lg font-semibold text-slate-900">
            Poster Review
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review creator photo/name placement before approving or rejecting.
          </p>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          Current list: {currentListCount}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search creator / category / poster"
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <button
          onClick={() => void loadPosters()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {REVIEW_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                  : "border-[var(--portal-border)] bg-white text-slate-700 hover:bg-[var(--portal-surface-soft)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleAllVisiblePosters}
              className="h-4 w-4 accent-rose-600"
            />
            Select visible
          </label>
          <span className="text-xs font-semibold text-slate-500">
            {selectedCount} selected
          </span>
          <button
            type="button"
            onClick={() => void deleteSelectedPosters()}
            disabled={selectedCount === 0}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete selected
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {loading && rows.length === 0 ? (
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
            const approved = row.status === "approved";
            const isVideo =
              row.mediaType === "video" && row.videoUrl.trim().length > 0;
            const mediaUrl = isVideo ? row.videoUrl : row.imageUrl;
            const dimensions = mediaDimensionsMap[row.id];
            const dimensionsBadge = dimensionStatus(dimensions);
            const stripSafeZoneHeight = nameStripSafeZoneHeightPercent(config);
            const posterAspectRatio =
              dimensions && dimensions.width > 0 && dimensions.height > 0
                ? dimensions.width / dimensions.height
                : 1;
            const stripOverlapWarning = isPhotoInNameStripSafeZone({
              config,
              posterAspectRatio,
              photoY: config.photoY,
              photoScale: config.photoScale,
            });
            return (
              <article
                key={row.id}
                className="grid gap-5 rounded-[26px] border border-[var(--portal-border)] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)] sm:p-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
              >
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 lg:col-span-2">
                  <input
                    type="checkbox"
                    checked={selectedPosterIds.has(row.id)}
                    onChange={() => togglePosterSelection(row.id)}
                    className="h-4 w-4 accent-rose-600"
                  />
                  Select poster
                </label>
                <div className="mx-auto w-full max-w-[420px] rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-2 sm:max-w-none lg:mx-0">
                  <div className="w-full overflow-hidden rounded-lg">
                    <div className="relative max-h-[min(68vh,620px)] overflow-hidden bg-black">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPoster({
                            mediaUrl,
                            mediaType: isVideo ? "video" : "image",
                            title: row.title,
                          })
                        }
                        className="block w-full cursor-zoom-in"
                        aria-label="Open poster preview"
                      >
                        {isVideo ? (
                          <video
                            src={mediaUrl}
                            className="mx-auto h-auto max-h-[min(68vh,620px)] w-full object-contain"
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(event) => {
                              const video = event.currentTarget;
                              setMediaDimensionsMap((prev) => ({
                                ...prev,
                                [row.id]: {
                                  width: video.videoWidth,
                                  height: video.videoHeight,
                                },
                              }));
                            }}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl}
                            alt={row.title}
                            className="mx-auto h-auto max-h-[min(68vh,620px)] w-full object-contain"
                            onLoad={(event) => {
                              const image = event.currentTarget;
                              setMediaDimensionsMap((prev) => ({
                                ...prev,
                                [row.id]: {
                                  width: image.naturalWidth,
                                  height: image.naturalHeight,
                                },
                              }));
                            }}
                          />
                        )}
                      </button>
                      <div
                        className="absolute overflow-hidden"
                        style={{
                          left: `${config.photoX}%`,
                          top: `${config.photoY}%`,
                          width: `${config.photoScale}%`,
                          zIndex: 1,
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
                      {config.showVideoExtraPhoto ? (
                        <div
                          className="absolute overflow-hidden"
                          style={{
                            left: `${config.videoExtraPhotoX}%`,
                            top: `${config.videoExtraPhotoY}%`,
                            width: `${config.videoExtraPhotoScale}%`,
                            zIndex: 2,
                            aspectRatio: photoShapeAspectRatio(
                              config.videoExtraPhotoShape,
                            ),
                            ...photoShapeFrameStyle(
                              config.videoExtraPhotoShape,
                            ),
                          }}
                        >
                          {renderPosterPhotoPreview({
                            shape: config.videoExtraPhotoShape,
                            renderMode: config.videoExtraPhotoRenderMode,
                            edgeStyle: config.videoExtraPhotoEdgeStyle,
                            frameStyle:
                              config.videoExtraPhotoFrameStyle ?? "none",
                            src: "/samples/default-avatar-v2.png",
                            alt: "Creator second sample",
                          })}
                          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-950/82 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg">
                            Add Photo
                          </div>
                        </div>
                      ) : null}
                      <PoliticalProtocolSlotPreview config={config} />
                      {stripOverlapWarning ? (
                        <NameStripOverlapWarning
                          heightPercent={stripSafeZoneHeight}
                        />
                      ) : null}
                      {!config.showBottomStrip ? (
                        <div
                          className="absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${config.nameX}%`,
                            top: `${config.nameY}%`,
                            zIndex: 3,
                          }}
                        >
                          <p
                            className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                            style={{
                              fontFamily:
                                "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                            }}
                          >
                            {config.sampleName ||
                              row.creatorName ||
                              PERSONALIZATION_SAMPLE.name}
                          </p>
                          <p className="mt-1 truncate text-center text-xs font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                            {config.sampleDesignation ||
                              PERSONALIZATION_SAMPLE.designation}
                          </p>
                        </div>
                      ) : null}
                      {config.showBottomStrip ? (
                        <div
                          className="absolute z-[3]"
                          style={{
                            left: `${config.stripX ?? 50}%`,
                            bottom: `${config.stripBottom ?? 0}%`,
                            width: `${config.stripWidth ?? 100}%`,
                            height: `${Math.max(0.5, config.stripHeight * 0.5)}%`,
                            transform: "translateX(-50%)",
                          }}
                        >
                          <AppStyleNameStrip
                            config={config}
                            imageSeed={row.imageUrl || row.videoUrl || row.id}
                            sampleName={
                              config.sampleName ||
                              row.creatorName ||
                              PERSONALIZATION_SAMPLE.name
                            }
                            sampleDesignation={
                              config.sampleDesignation ||
                              PERSONALIZATION_SAMPLE.designation
                            }
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                    {config.showWhatsapp &&
                    row.creatorPhone.trim().length > 0 ? (
                      <div className="-mt-px w-full bg-[#25D366] px-3 py-1.5 text-center text-white">
                        <p className="truncate text-xs font-semibold">
                          {row.creatorPhone}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewPoster({
                        mediaUrl,
                        mediaType: isVideo ? "video" : "image",
                        title: row.title,
                      })
                    }
                    className="mt-3 inline-flex text-xs font-semibold text-blue-700 underline"
                  >
                    Open original poster
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-violet-600">
                            Creator Name
                          </p>
                          <p className="mt-1 truncate text-lg font-black text-violet-950">
                            {row.creatorName || "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-blue-600">
                            Creator ID
                          </p>
                          <p className="mt-1 truncate text-lg font-black text-blue-950">
                            {row.creatorPublicId || "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">
                            Category
                          </p>
                          <div className="mt-1 text-base font-black text-emerald-950">
                            <CategoryLabelWithLogo
                              id={row.categoryId}
                              label={row.categoryLabel || row.categoryId}
                            />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-wide text-orange-700">
                            Dimensions
                          </p>
                          <p className="mt-1 text-lg font-black text-orange-950">
                            {dimensions
                              ? `${dimensions.width}x${dimensions.height}px`
                              : "Reading..."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase ${dimensionsBadge.className}`}
                        >
                          {dimensionsBadge.label}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                          Required: {recommendedDimensionsText()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Uploaded: {formatDate(row.createdAt)}
                      </p>
                      {approved ? (
                        <p className="text-xs text-slate-600">
                          Approved: {formatDate(row.approvedAt)}
                          {row.dashboardVisibleUntil > 0
                            ? ` | Dashboard until ${formatDate(row.dashboardVisibleUntil)}`
                            : ""}
                        </p>
                      ) : null}
                      <p className="text-xs text-slate-600">
                        Sales {row.saleCount} | Gross Rs.{row.grossAmount} |
                        Creator Rs.
                        {row.creatorEarnings} | Platform Rs.
                        {row.platformEarnings}
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        Display: {row.displayViewCount} views | {row.displayShareCount} shares |{" "}
                        {row.displayDownloadCount} downloads
                      </p>
                      <p className="text-xs text-slate-500">
                        Real: {row.viewCount} views | {row.shareCount} shares | {row.downloadCount} downloads
                      </p>
                      <p className="text-xs text-slate-600">
                        Duplicate check:{" "}
                        {row.duplicateCount > 1
                          ? `${row.duplicateCount} similar uploads`
                          : "Unique"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        row.status,
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>

                  {!approved ? (
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
                  ) : null}

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {!approved ? (
                      <button
                        onClick={() => void submitReview(row.id, "archived")}
                        disabled={busyMap[row.id]}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      >
                        Archive
                      </button>
                    ) : null}
                    <button
                      onClick={() => void submitReview(row.id, "deleted")}
                      disabled={busyMap[row.id]}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>

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
      {previewPoster ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Poster preview"
          onClick={() => setPreviewPoster(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewPoster(null)}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white text-xl font-black text-slate-900 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-100"
              aria-label="Close poster preview"
            >
              X
            </button>
            <div className="max-h-[92vh] overflow-auto bg-black p-3">
              {previewPoster.mediaType === "video" ? (
                <video
                  src={previewPoster.mediaUrl}
                  className="mx-auto h-auto max-h-[88vh] w-auto max-w-full object-contain"
                  controls
                  playsInline
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewPoster.mediaUrl}
                  alt={previewPoster.title}
                  className="mx-auto h-auto max-h-[88vh] w-auto max-w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
