"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

interface CreatorCategory {
  id: string;
  label: string;
}

interface CreatorPoster {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  imageUrl: string;
  status: string;
  createdAt: number;
}

type PhotoShape = "circle" | "rounded" | "square" | "hexagon" | "pill";

interface PersonalizationConfig {
  photoShape: PhotoShape;
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
  };
  assignedCategories?: CreatorCategory[];
  stats?: {
    totalUploads: number;
    todayUploads: number;
    approvedCount: number;
    rejectedCount: number;
    todayEarnings: number;
  };
  posters?: CreatorPoster[];
}

function statusClass(status: string): string {
  if (status === "approved") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }
  return "border-amber-300 bg-amber-50 text-amber-700";
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

function shapeClass(shape: PhotoShape): string {
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

const defaultPersonalization: PersonalizationConfig = {
  photoShape: "circle",
  photoX: 50,
  photoY: 45,
  photoScale: 36,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  showWhatsapp: true,
  sampleName: PERSONALIZATION_SAMPLE.name,
};

function CreatorDashboardContent() {
  const { user, signOut } = useAuth();
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

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
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
      if (!dragRef.current.dragging) {
        return;
      }
      const frame = previewFrameRef.current;
      if (!frame) {
        return;
      }
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      const deltaXPercent =
        ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaYPercent =
        ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(0, Math.min(100, dragRef.current.initialX + deltaXPercent));
      const nextY = Math.max(0, Math.min(100, dragRef.current.initialY + deltaYPercent));
      if (dragRef.current.target === "photo") {
        setPersonalization((prev) => ({
          ...prev,
          photoX: nextX,
          photoY: nextY,
        }));
      } else if (dragRef.current.target === "name") {
        setPersonalization((prev) => ({
          ...prev,
          nameX: nextX,
          nameY: nextY,
        }));
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

  function onPhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalization((prev) => ({
      ...prev,
      photoScale: Math.max(10, Math.min(100, prev.photoScale + direction * 2)),
    }));
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

  function applyCustomizationAndClose() {
    setCustomizeOpen(false);
    setUploadMessage("Customization applied. Click Upload Poster to save permanently.");
  }

  const loadDashboard = useCallback(
    async (withRefreshState: boolean) => {
      if (withRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const token = await user?.getIdToken();
        if (!token) {
          return;
        }
        const response = await fetch("/api/creator/dashboard", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as CreatorDashboardResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to load creator dashboard.");
        }
        setDashboard(data);
        if (!categoryId && data.assignedCategories && data.assignedCategories.length > 0) {
          setCategoryId(data.assignedCategories[0]!.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      } finally {
        if (withRefreshState) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [user, categoryId]
  );

  useEffect(() => {
    let disposed = false;
    async function run() {
      if (disposed || !user) {
        return;
      }
      await loadDashboard(false);
    }
    void run();
    return () => {
      disposed = true;
    };
  }, [user, loadDashboard]);

  const assignedCategories = useMemo(
    () => dashboard?.assignedCategories ?? [],
    [dashboard]
  );
  const posters = useMemo(() => dashboard?.posters ?? [], [dashboard]);
  const stats = dashboard?.stats;
  const previewOnly = dashboard?.previewOnly ?? false;

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setUploadMessage("Select poster image first.");
      return;
    }
    if (!categoryId) {
      setUploadMessage("Select assigned category.");
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
      setUploadMessage("Poster uploaded. Status set to pending review.");
      setFile(null);
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Creator Panel
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Creator Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadDashboard(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => void signOut()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {previewOnly ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Admin preview mode. Real creator dashboard data చూడాలంటే creator accountతో login అవ్వాలి.
        </p>
      ) : null}

      <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Loading creator profile...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Creator ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                {dashboard?.profile?.creatorPublicId ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {dashboard?.profile?.name ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                {dashboard?.profile?.email ?? "-"}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total uploads</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.totalUploads ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today uploads</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats?.todayUploads ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats?.approvedCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Rejected</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{stats?.rejectedCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today earnings</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">₹{stats?.todayEarnings ?? 0}</p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Upload Poster</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload only in your assigned categories.
          </p>
          <form onSubmit={handleUpload} className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-300 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Select Category
              </p>
              {assignedCategories.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">No assigned categories</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {assignedCategories.map((category) => {
                    const isSelected = category.id === categoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setCategoryId(category.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-orange-300 bg-orange-50 text-orange-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {category.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <div className="rounded-xl border border-slate-300 bg-white p-2">
              {filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt="Poster preview"
                  className="h-auto max-h-[420px] w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-500">
                  Poster preview will appear here
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              disabled={!filePreviewUrl}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Customize Full Preview
            </button>
            <button
              type="submit"
              disabled={uploadBusy || assignedCategories.length === 0 || !categoryId}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {uploadBusy ? "Uploading..." : "Upload Poster"}
            </button>
          </form>
          {uploadMessage ? (
            <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              {uploadMessage}
            </p>
          ) : null}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Assigned Categories
            </p>
            {assignedCategories.length === 0 ? (
              <p className="mt-2 text-xs text-slate-600">
                Manager ఇంకా categories assign చేయలేదు.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {assignedCategories.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My Posters</h2>
          <p className="mt-1 text-sm text-slate-600">
            Recent posters with status tracking.
          </p>
          <div className="mt-4 space-y-3">
            {posters.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                No posters uploaded yet.
              </div>
            ) : (
              posters.map((poster) => (
                <article
                  key={poster.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[100px_minmax(0,1fr)]"
                >
                  <img
                    src={poster.imageUrl}
                    alt={poster.title}
                    className="h-[100px] w-[100px] rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {poster.title}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(
                          poster.status
                        )}`}
                      >
                        {poster.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Category: {poster.categoryLabel || poster.categoryId}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Uploaded: {formatDate(poster.createdAt)}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {customizeOpen ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-4">
          <div className="mx-auto grid h-full max-w-7xl gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Customize</p>
                <button
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3 text-xs">
                <label className="block">
                  Name
                  <input
                    value={personalization.sampleName}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        sampleName: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm"
                  />
                </label>
                <p className="rounded-md border border-slate-700 bg-slate-800 p-2 text-[11px] text-slate-300">
                  WhatsApp number manual ga ivvalsina avasaram ledu. User profile lo unna number auto apply avtundi.
                </p>
                <label className="block">
                  Photo Shape
                  <select
                    value={personalization.photoShape}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        photoShape: event.target.value as PhotoShape,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm"
                  >
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                    <option value="square">Square</option>
                    <option value="hexagon">Hexagon</option>
                    <option value="pill">Pill</option>
                  </select>
                </label>
                <label className="block">
                  Photo Size ({Math.round(personalization.photoScale)}%)
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
                    className="mt-1 w-full accent-orange-500"
                  />
                </label>
                <p className="rounded-md border border-slate-700 bg-slate-800 p-2 text-[11px] text-slate-300">
                  Strip off chesthe name ni poster meeda direct drag cheyochu.
                </p>
                <label className="flex items-center gap-2">
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
                  Show White Strip
                </label>
                <label className="flex items-center gap-2">
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
                  Show WhatsApp (if number exists)
                </label>
              </div>
            </section>

            <section className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 p-4">
              {filePreviewUrl ? (
                <div className="flex w-full max-w-3xl flex-col items-center gap-3">
                  <div className="w-full overflow-hidden rounded-xl">
                    <div
                      ref={previewFrameRef}
                      className="relative w-full overflow-hidden bg-black"
                    >
                      <img
                        src={filePreviewUrl}
                        alt="Full poster preview"
                        className="h-auto max-h-[76vh] w-full object-contain"
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
                        <img
                          src={PERSONALIZATION_SAMPLE.photoUrl}
                          alt="Sample user"
                          className={`h-full w-full object-cover ${shapeClass(
                            personalization.photoShape
                          )} border-0 ring-0 shadow-none`}
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
                            {personalization.sampleName || "Bommidi Naga Gopi"}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {personalization.showBottomStrip ? (
                      <div className="w-full bg-white px-4 py-2 text-center text-slate-900">
                        <p
                          className="truncate text-xl font-semibold leading-tight tracking-wide"
                          style={{
                            fontFamily:
                              "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                          }}
                        >
                          {personalization.sampleName || "Bommidi Naga Gopi"}
                        </p>
                      </div>
                    ) : null}
                    {personalization.showWhatsapp ? (
                      <div className="w-full bg-[#25D366] px-4 py-2 text-center text-white">
                        <p className="truncate text-sm font-semibold leading-tight">
                          WhatsApp {PERSONALIZATION_SAMPLE.whatsappNumber}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex w-full justify-end">
                    <button
                      onClick={applyCustomizationAndClose}
                      className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-[60vh] w-full max-w-3xl items-center justify-center rounded-xl bg-black text-sm text-slate-400">
                  Select a poster to preview customization.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function CreatorDashboardPage() {
  return (
    <RoleGate allowed={["creator"]}>
      <CreatorDashboardContent />
    </RoleGate>
  );
}
