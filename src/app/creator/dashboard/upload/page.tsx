"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

interface CreatorCategory {
  id: string;
  label: string;
}

interface CreatorPoster {
  id: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string;
  status: string;
  reviewComment?: string;
  createdAt: number;
}

type PhotoShape = "circle" | "rounded" | "square" | "hexagon" | "pill";

interface PersonalizationConfig {
  photoShape: PhotoShape;
  photoRenderMode: "cutout" | "original";
  edgeStyle: "soft_fade" | "sharp";
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

interface CreatorDashboardResponse {
  ok: boolean;
  error?: string;
  previewOnly?: boolean;
  profile?: {
    creatorPublicId: string;
    name: string;
    email: string;
  } | null;
  assignedCategories?: CreatorCategory[];
  announcements?: Array<{
    id: string;
    title: string;
    message: string;
    priority: "normal" | "important" | "urgent";
    endAt: number;
  }>;
  posters?: CreatorPoster[];
}

const defaultPersonalization: PersonalizationConfig = {
  photoShape: "circle",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  showSafeAreas: false,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  showWhatsapp: true,
  sampleName: PERSONALIZATION_SAMPLE.name,
};

function shapeClass(shape: PhotoShape): string {
  if (shape === "circle") return "rounded-full";
  if (shape === "rounded") return "rounded-[28px]";
  if (shape === "pill") return "rounded-[42px]";
  return "rounded-none";
}

function edgeMaskStyle(config: PersonalizationConfig): CSSProperties {
  if (config.edgeStyle === "sharp") {
    return {};
  }
  return {
    WebkitMaskImage:
      "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 68%, rgba(255,255,255,0.92) 84%, rgba(255,255,255,0) 100%)",
    maskImage:
      "linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 68%, rgba(255,255,255,0.92) 84%, rgba(255,255,255,0) 100%)",
  };
}

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
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
  return "border-violet-200 bg-violet-50 text-violet-700";
}

export default function CreatorUploadStudioPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CreatorDashboardResponse | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [personalization, setPersonalization] =
    useState<PersonalizationConfig>(defaultPersonalization);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    target: "photo" | "name" | null;
    dragging: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({
    target: null,
    dragging: false,
    startX: 0,
    startY: 0,
    initialX: 50,
    initialY: 45,
  });

  async function loadDashboard(withRefreshState = false) {
    if (withRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const response = await fetch("/api/creator/dashboard", {
        headers: { authorization: `Bearer ${token}` },
      });
      const next = (await response.json()) as CreatorDashboardResponse;
      if (!response.ok || !next.ok) {
        throw new Error(next.error ?? "Unable to load creator workspace.");
      }
      setDashboard(next);
      if (!categoryId && next.assignedCategories && next.assignedCategories.length > 0) {
        setCategoryId(next.assignedCategories[0]!.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load creator workspace.");
    } finally {
      if (withRefreshState) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setFilePreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCustomizeOpen(false);
      }
    }
    if (customizeOpen) {
      window.addEventListener("keydown", closeOnEscape);
    }
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [customizeOpen]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!dragRef.current.dragging) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const deltaXPercent = ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaYPercent = ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(0, Math.min(100, dragRef.current.initialX + deltaXPercent));
      const nextY = Math.max(0, Math.min(100, dragRef.current.initialY + deltaYPercent));
      if (dragRef.current.target === "photo") {
        setPersonalization((prev) => ({ ...prev, photoX: nextX, photoY: nextY }));
      } else if (dragRef.current.target === "name") {
        setPersonalization((prev) => ({ ...prev, nameX: nextX, nameY: nextY }));
      }
    }

    function onMouseUp() {
      dragRef.current.dragging = false;
      dragRef.current.target = null;
      setIsPhotoDragging(false);
      setIsNameDragging(false);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function startPhotoDrag(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = {
      target: "photo",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.photoX,
      initialY: personalization.photoY,
    };
    setIsPhotoDragging(true);
  }

  function startNameDrag(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = {
      target: "name",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.nameX,
      initialY: personalization.nameY,
    };
    setIsNameDragging(true);
  }

  function onPhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalization((prev) => ({
      ...prev,
      photoScale: Math.max(10, Math.min(100, prev.photoScale + direction * 2)),
    }));
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setUploadMessage("Poster image select cheyyali.");
      return;
    }
    if (!categoryId) {
      setUploadMessage("Assigned category select cheyyali.");
      return;
    }
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const body = new FormData();
      body.set("categoryId", categoryId);
      body.set("image", file);
      body.set("personalizationConfig", JSON.stringify(personalization));
      const response = await fetch("/api/creator/posters", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }
      setUploadMessage("Poster uploaded. Manager review kosam pending lo poyindi.");
      setFile(null);
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  const assignedCategories = dashboard?.assignedCategories ?? [];
  const announcements = dashboard?.announcements ?? [];
  const posters = useMemo(() => dashboard?.posters ?? [], [dashboard]);

  return (
    <>
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="mb-6 rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
              Creator Instructions
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Latest campaign notes and upload reminders
            </h3>
          </div>
          {refreshing ? (
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              Refreshing
            </span>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {announcements.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              Active instructions levu. New campaign or urgent update vaste ikkada kanipisthundi.
            </div>
          ) : (
            announcements.slice(0, 4).map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {item.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">Till {formatDate(item.endAt)}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                Upload Studio
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">Create and Submit Poster</h3>
            </div>
            <button
              onClick={() => void loadDashboard(true)}
              className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <form onSubmit={handleUpload} className="mt-5 grid gap-4">
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Select Category
              </p>
              {assignedCategories.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No assigned categories.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {assignedCategories.map((category) => {
                    const active = category.id === categoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryId(category.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                            : "border-[var(--portal-border)] bg-white text-slate-700 hover:border-[var(--portal-purple)]/40"
                        }`}
                      >
                        {category.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="rounded-2xl border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <p className="text-sm font-semibold text-slate-900">Poster Image</p>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPG, WEBP upload cheyyachu. Poster full preview kindha vastundi.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--portal-purple)] file:px-4 file:py-2 file:font-semibold file:text-white"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                disabled={!filePreviewUrl}
                className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Customize Preview
              </button>
              <button
                type="submit"
                disabled={uploadBusy || !file}
                className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadBusy ? "Uploading..." : "Upload Poster"}
              </button>
            </div>

            {uploadMessage ? (
              <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                {uploadMessage}
              </p>
            ) : null}

            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current Personalization
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Photo Shape</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{personalization.photoShape}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Photo Mode</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {personalization.photoRenderMode === "cutout" ? "BG Removed" : "Original"}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <h3 className="text-xl font-bold text-slate-950">Recent Uploads</h3>
          <p className="mt-2 text-sm text-slate-600">
            Latest poster submissions and manager status updates.
          </p>
          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                Loading uploads...
              </div>
            ) : posters.length === 0 ? (
              <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                Inka posters upload cheyyaledu.
              </div>
            ) : (
              posters.map((poster) => (
                <div
                  key={poster.id}
                  className="grid gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3 sm:grid-cols-[96px_minmax(0,1fr)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={poster.imageUrl}
                    alt={poster.categoryLabel || poster.categoryId}
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {dashboard?.profile?.creatorPublicId ?? "Creator"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Category: {poster.categoryLabel || poster.categoryId}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(poster.createdAt)}</p>
                        {poster.reviewComment ? (
                          <p className="mt-1 text-xs text-rose-600">
                            Review: {poster.reviewComment}
                          </p>
                        ) : null}
                        {poster.status === "rejected" ? (
                          <p className="mt-1 text-xs font-semibold text-violet-700">
                            Fix chesi same category lo malli upload cheyochu.
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(
                          poster.status
                        )}`}
                      >
                        {poster.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {customizeOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/82 p-4 backdrop-blur-sm">
          <div className="mx-auto grid h-full max-w-7xl gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="overflow-y-auto rounded-[28px] border border-white/10 bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.4)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                    Customize
                  </p>
                  <h4 className="mt-2 text-lg font-bold">Preview Placement</h4>
                </div>
                <button
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Name</span>
                  <input
                    value={personalization.sampleName}
                    onChange={(event) =>
                      setPersonalization((prev) => ({ ...prev, sampleName: event.target.value }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-300"
                  />
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Photo Shape</span>
                  <select
                    value={personalization.photoShape}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        photoShape: event.target.value as PhotoShape,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                    <option value="hexagon">Hexagon</option>
                    <option value="pill">Pill</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Photo Mode</span>
                  <select
                    value={personalization.photoRenderMode}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        photoRenderMode: event.target.value as "cutout" | "original",
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="cutout">BG Removed</option>
                    <option value="original">Original Photo</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Edge Finish</span>
                  <select
                    value={personalization.edgeStyle}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        edgeStyle: event.target.value as "soft_fade" | "sharp",
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="soft_fade">Soft Bottom Fade</option>
                    <option value="sharp">Sharp Cut</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Photo Size ({Math.round(personalization.photoScale)}%)
                  </span>
                  <input
                    type="range"
                    min={12}
                    max={90}
                    value={personalization.photoScale}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        photoScale: Number(event.target.value),
                      }))
                    }
                    className="mt-3 w-full accent-[var(--portal-green)]"
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-slate-300">
                  Photo and name ni direct ga mouse tho drag cheyochu. Mouse wheel use chesi photo
                  size fast ga adjust cheyochu.
                </div>

                <label className="flex items-center gap-2 text-sm text-white/90">
                  <input
                    type="checkbox"
                    checked={personalization.showBottomStrip}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        showBottomStrip: event.target.checked,
                      }))
                    }
                  />
                  Show white strip
                </label>

                <label className="flex items-center gap-2 text-sm text-white/90">
                  <input
                    type="checkbox"
                    checked={personalization.showWhatsapp}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        showWhatsapp: event.target.checked,
                      }))
                    }
                  />
                  Show WhatsApp number
                </label>
              </div>
            </section>

            <section className="flex min-w-0 items-center justify-center rounded-[28px] border border-white/10 bg-slate-950/96 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.4)]">
              {filePreviewUrl ? (
                <div className="flex w-full max-w-4xl flex-col items-center gap-4">
                  <div className="w-full overflow-auto rounded-[24px] bg-[#050816] p-4">
                    <div className="mx-auto inline-block max-w-full align-top leading-none">
                      <div
                        ref={previewFrameRef}
                        className="relative overflow-hidden rounded-[22px] bg-black align-top"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filePreviewUrl}
                          alt="Poster preview"
                          className="block h-auto max-h-[72vh] w-auto max-w-full object-contain align-top"
                        />

                        <div
                          onMouseDown={startPhotoDrag}
                          onWheel={onPhotoWheel}
                          className={`absolute ${isPhotoDragging ? "cursor-grabbing" : "cursor-grab"}`}
                          style={{
                            left: `${personalization.photoX}%`,
                            top: `${personalization.photoY}%`,
                            width: `${personalization.photoScale}%`,
                            aspectRatio: "1 / 1",
                            transform: "translate(-50%, -50%)",
                            clipPath:
                              personalization.photoShape === "hexagon"
                                ? "polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%)"
                                : undefined,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={PERSONALIZATION_SAMPLE.photoUrl}
                            alt="Sample user"
                            className={`h-full w-full object-contain object-top ${shapeClass(
                              personalization.photoShape
                            )}`}
                            style={{
                              ...edgeMaskStyle(personalization),
                              objectPosition:
                                personalization.photoRenderMode === "cutout"
                                  ? "center 18%"
                                  : "center center",
                              transform:
                                personalization.photoRenderMode === "cutout"
                                  ? "scale(1.03)"
                                  : undefined,
                              transformOrigin: "top center",
                            }}
                          />
                        </div>

                        {!personalization.showBottomStrip ? (
                          <div
                            onMouseDown={startNameDrag}
                            className={`absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 select-none ${
                              isNameDragging ? "cursor-grabbing" : "cursor-grab"
                            }`}
                            style={{
                              left: `${personalization.nameX}%`,
                              top: `${personalization.nameY}%`,
                            }}
                          >
                            <p
                              className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                              style={{
                                fontFamily:
                                  "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                              }}
                            >
                              {personalization.sampleName || PERSONALIZATION_SAMPLE.name}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {personalization.showBottomStrip ? (
                        <div className="-mt-px w-full bg-white px-4 py-2 text-center text-slate-900">
                          <p
                            className="truncate text-xl font-semibold leading-tight tracking-wide"
                            style={{
                              fontFamily:
                                "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                            }}
                          >
                            {personalization.sampleName || PERSONALIZATION_SAMPLE.name}
                          </p>
                        </div>
                      ) : null}

                      {personalization.showWhatsapp ? (
                        <div className="-mt-px w-full bg-[#25D366] px-4 py-2 text-center text-white">
                          <p className="truncate text-sm font-semibold leading-tight">
                            {PERSONALIZATION_SAMPLE.whatsappNumber || "User WhatsApp Number"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex w-full justify-end">
                    <button
                      onClick={() => {
                        setCustomizeOpen(false);
                        setUploadMessage(
                          "Customization applied. Upload Poster click chesthe configuration save avtundi.",
                        );
                      }}
                      className="rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-[60vh] w-full max-w-4xl items-center justify-center rounded-[24px] bg-[#050816] text-sm text-slate-400">
                  Select a poster image first to open the full preview.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
