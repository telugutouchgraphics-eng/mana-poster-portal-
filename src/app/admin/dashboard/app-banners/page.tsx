"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";

interface AppBannerItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTarget: string;
  placement: string;
  targetRegionIds?: string[];
  targetReligions?: string[];
  promoCardGroup?: number;
  targetState?: string;
  targetDistrict?: string;
  targetCity?: string;
  active: boolean;
  sortOrder: number;
  viewCount?: number;
}

interface LocationInsightRow {
  key: string;
  state: string;
  district: string;
  city: string;
}

interface PromoUploadDraft {
  id: string;
  file: File;
  ctaTarget: string;
}

const BANNER_POSITION_OPTIONS = [
  { value: "10", label: "1st Banner" },
  { value: "20", label: "2nd Banner" },
  { value: "30", label: "3rd Banner" },
] as const;

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";
const HOME_BANNER_WIDTH = 1080;
const HOME_BANNER_HEIGHT = 190;
const HOME_BANNER_SIZE_LABEL = `${HOME_BANNER_WIDTH} x ${HOME_BANNER_HEIGHT} px`;
const PROMO_CARD_WIDTH = 1080;
const PROMO_CARD_HEIGHT = 560;
const PROMO_CARD_SIZE_LABEL = `${PROMO_CARD_WIDTH} x ${PROMO_CARD_HEIGHT} px`;
const FULLSCREEN_POPUP_WIDTH = 1080;
const FULLSCREEN_POPUP_HEIGHT = 1920;
const FULLSCREEN_POPUP_SIZE_LABEL = `${FULLSCREEN_POPUP_WIDTH} x ${FULLSCREEN_POPUP_HEIGHT} px`;
const BANNER_PLACEMENTS = [
  { value: "home_category_banner", label: "Home top banner", sizeLabel: HOME_BANNER_SIZE_LABEL, aspectRatio: "1080 / 190" },
  { value: "home_promo_card_carousel", label: "Promo card carousel", sizeLabel: PROMO_CARD_SIZE_LABEL, aspectRatio: "1080 / 560" },
  { value: "home_fullscreen_popup", label: "Home full screen popup", sizeLabel: FULLSCREEN_POPUP_SIZE_LABEL, aspectRatio: "1080 / 1920" },
] as const;
const RELIGION_OPTIONS = [
  { value: "all", label: "All religions" },
  { value: "hindu", label: "Hindu" },
  { value: "muslim", label: "Muslim" },
  { value: "christian", label: "Christian" },
] as const;

function bannerPositionLabel(sortOrder: number) {
  return (
    BANNER_POSITION_OPTIONS.find((option) => Number(option.value) === sortOrder)?.label ??
    `${sortOrder}`
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read banner image dimensions."));
    };
    image.src = objectUrl;
  });
}

function placementSize(placement: string) {
  if (placement === "home_promo_card_carousel") {
    return { width: PROMO_CARD_WIDTH, height: PROMO_CARD_HEIGHT, label: PROMO_CARD_SIZE_LABEL };
  }
  if (placement === "home_fullscreen_popup") {
    return { width: FULLSCREEN_POPUP_WIDTH, height: FULLSCREEN_POPUP_HEIGHT, label: FULLSCREEN_POPUP_SIZE_LABEL };
  }
  return { width: HOME_BANNER_WIDTH, height: HOME_BANNER_HEIGHT, label: HOME_BANNER_SIZE_LABEL };
}

export default function AdminAppBannersPage() {
  const { user } = useAuth();
  const { region, regions } = useDashboardRegion();
  const [items, setItems] = useState<AppBannerItem[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaTarget, setCtaTarget] = useState("");
  const [placement, setPlacement] = useState("home_category_banner");
  const [targetState, setTargetState] = useState("");
  const [targetRegionIds, setTargetRegionIds] = useState<string[]>([]);
  const [targetReligions, setTargetReligions] = useState<string[]>(["all"]);
  const [promoCardGroup, setPromoCardGroup] = useState("1");
  const [targetDistrict, setTargetDistrict] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [locationRows, setLocationRows] = useState<LocationInsightRow[]>([]);
  const [sortOrder, setSortOrder] = useState("10");
  const [file, setFile] = useState<File | null>(null);
  const [promoFiles, setPromoFiles] = useState<PromoUploadDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [regionMenuOpen, setRegionMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch(`/api/admin/banners?regionId=${encodeURIComponent(region.id)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ok: boolean; banners?: AppBannerItem[]; error?: string };
    if (response.ok && data.ok) {
      const nextItems = (data.banners ?? []).filter((item) =>
        BANNER_PLACEMENTS.some((placement) => placement.value === item.placement),
      );
      setItems(nextItems);
      setSelectedIds((prev) => {
        const visibleIds = new Set(nextItems.map((item) => item.id));
        return new Set([...prev].filter((id) => visibleIds.has(id)));
      });
    } else {
      setMessage(data.error ?? "Unable to load banners.");
    }
    const insightsResponse = await fetch("/api/admin/location-insights", {
      headers: { authorization: `Bearer ${token}` },
    });
    const insightsData = (await insightsResponse.json()) as {
      ok: boolean;
      insights?: { locations?: LocationInsightRow[] };
    };
    if (insightsResponse.ok && insightsData.ok) {
      setLocationRows(insightsData.insights?.locations ?? []);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region.id]);

  function resetForm() {
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setCtaTarget("");
    setPlacement("home_category_banner");
    setTargetState(defaultTargetState);
    setTargetRegionIds([region.id]);
    setTargetReligions(["all"]);
    setPromoCardGroup("1");
    setTargetDistrict("");
    setTargetCity("");
    setSortOrder("10");
    setFile(null);
    setPromoFiles([]);
    setEditingId(null);
    setCurrentPreview(null);
  }

  function startEdit(item: AppBannerItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setSubtitle(item.subtitle);
    setCtaLabel(item.ctaLabel);
    setCtaTarget(item.ctaTarget);
    setPlacement(item.placement || "home_category_banner");
    const nextRegionIds = item.targetRegionIds?.length
      ? item.targetRegionIds
      : regions.filter((candidate) => candidate.name === item.targetState).map((candidate) => candidate.id);
    setTargetRegionIds(nextRegionIds.length ? nextRegionIds : [region.id]);
    setTargetReligions(item.targetReligions?.length ? item.targetReligions : ["all"]);
    setPromoCardGroup(String(item.promoCardGroup ?? 1));
    setTargetState(item.targetState ?? regions.find((candidate) => candidate.id === nextRegionIds[0])?.name ?? region.name);
    setTargetDistrict(item.targetDistrict ?? "");
    setTargetCity(item.targetCity ?? "");
    setSortOrder(String(item.sortOrder));
    setFile(null);
    setPromoFiles([]);
    setCurrentPreview(item.imageUrl);
    setMessage(null);
  }

  async function handleFileChange(fileInput: HTMLInputElement) {
    const selectedFiles = Array.from(fileInput.files ?? []);
    const allowPromoBatch = placement === "home_promo_card_carousel" && !editingId;
    if (allowPromoBatch && selectedFiles.length > 1) {
      for (const selectedFile of selectedFiles) {
        if (selectedFile.size > MAX_IMAGE_UPLOAD_BYTES) {
          const warning = `Each image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
          alert(warning);
          setMessage(warning);
          setPromoFiles([]);
          fileInput.value = "";
          return;
        }
        try {
          const dimensions = await readImageDimensions(selectedFile);
          if (dimensions.width !== PROMO_CARD_WIDTH || dimensions.height !== PROMO_CARD_HEIGHT) {
            setMessage(`Recommended size is ${PROMO_CARD_SIZE_LABEL}. Some selected images use a different size; preview below shows the app fit.`);
          }
        } catch (error) {
          const warning = error instanceof Error ? error.message : "Unable to read banner image dimensions.";
          alert(warning);
          setMessage(warning);
          setPromoFiles([]);
          fileInput.value = "";
          return;
        }
      }
      setFile(null);
      setPromoFiles(
        selectedFiles.map((selectedFile, index) => ({
          id: `${selectedFile.name}-${selectedFile.lastModified}-${index}`,
          file: selectedFile,
          ctaTarget: "",
        })),
      );
      if (!message) {
        setMessage(`${selectedFiles.length} promo images ready. Add a separate URL for each image.`);
      }
      return;
    }

    const selectedFile = selectedFiles[0] ?? null;
    if (selectedFile && selectedFile.size > MAX_IMAGE_UPLOAD_BYTES) {
      const warning = `Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
      alert(warning);
      setMessage(warning);
      setFile(null);
      setPromoFiles([]);
      fileInput.value = "";
      return;
    }
    if (selectedFile) {
      try {
        const dimensions = await readImageDimensions(selectedFile);
        const expected = placementSize(placement);
        if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
          const warning = `Recommended size is ${expected.label}. Selected image is ${dimensions.width} x ${dimensions.height} px; preview below shows the app fit.`;
          setMessage(warning);
          setFile(selectedFile);
          return;
        }
      } catch (error) {
        const warning = error instanceof Error ? error.message : "Unable to read banner image dimensions.";
          alert(warning);
          setMessage(warning);
          setFile(null);
          setPromoFiles([]);
          fileInput.value = "";
          return;
        }
    }
    setMessage(selectedFile ? "Banner image ready." : null);
    setFile(selectedFile);
    setPromoFiles([]);
  }

  function updatePromoTarget(id: string, value: string) {
    setPromoFiles((current) =>
      current.map((item) => (item.id === id ? { ...item, ctaTarget: value } : item)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isPromoBatchUpload =
      placement === "home_promo_card_carousel" && !editingId && promoFiles.length > 0;
    if (!file && !editingId && !isPromoBatchUpload) {
      setMessage("Upload a banner image.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const preciseTargetEnabled = targetRegionIds.length === 1;
      const buildBody = (imageFile: File | null, target: string, order: number, index = 0) => {
        const body = new FormData();
        body.set("title", title.trim() || `Promo card ${index + 1}`);
        body.set("subtitle", subtitle);
        body.set("ctaLabel", ctaLabel);
        body.set("ctaTarget", target);
        body.set("placement", placement);
        body.set("sortOrder", String(order));
        body.set("targetRegionIds", JSON.stringify(targetRegionIds));
        body.set("targetReligions", JSON.stringify(targetReligions));
        body.set("promoCardGroup", promoCardGroup);
        body.set("targetState", preciseTargetEnabled ? targetState.trim() : "");
        body.set("targetDistrict", preciseTargetEnabled ? targetDistrict.trim() : "");
        body.set("targetCity", preciseTargetEnabled ? targetCity.trim() : "");
        body.set("active", "true");
        if (imageFile) {
          body.set("image", imageFile);
        }
        return body;
      };

      if (isPromoBatchUpload) {
        const baseOrder = Number(sortOrder);
        const safeBaseOrder = Number.isFinite(baseOrder) ? baseOrder : 10;
        for (let index = 0; index < promoFiles.length; index += 1) {
          const item = promoFiles[index];
          const response = await fetch("/api/admin/banners", {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            body: buildBody(item.file, item.ctaTarget, safeBaseOrder + index, index),
          });
          const data = (await response.json()) as { ok: boolean; error?: string };
          if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save promo image.");
        }
      } else {
        const response = await fetch(
          editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners",
          {
            method: editingId ? "PATCH" : "POST",
            headers: { authorization: `Bearer ${token}` },
            body: buildBody(file, ctaTarget, Number(sortOrder)),
          },
        );
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save banner.");
      }
      resetForm();
      setMessage(isPromoBatchUpload ? "Promo card images saved." : editingId ? "App banner updated." : "App banner saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save banner.");
    } finally {
      setBusy(false);
    }
  }

  async function updateBanner(id: string, active: boolean, sortOrder: number) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ active, sortOrder }),
    });
    await load();
  }

  async function deleteBanner(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/banners/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (editingId === id) {
      resetForm();
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await load();
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((prev) =>
      items.length > 0 && items.every((item) => prev.has(item.id))
        ? new Set([...prev].filter((id) => !items.some((item) => item.id === id)))
        : new Set([...prev, ...items.map((item) => item.id)]),
    );
  }

  async function deleteSelected() {
    const ids = items.map((item) => item.id).filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected app banner(s)?`)) return;
    const token = await user?.getIdToken();
    if (!token) return;
    for (const id of ids) {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    }
    if (editingId && ids.includes(editingId)) resetForm();
    setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
    setSelectedIds((prev) => new Set([...prev].filter((id) => !ids.includes(id))));
    await load();
  }

  const previewImage = previewUrl ?? currentPreview;
  const defaultTargetState = region.name;
  const selectedPlacement = BANNER_PLACEMENTS.find((item) => item.value === placement) ?? BANNER_PLACEMENTS[0];
  const selectedTargetRegions = regions.filter((item) => targetRegionIds.includes(item.id));
  const hasSingleTargetRegion = targetRegionIds.length === 1;
  const targetRegionSummary =
    selectedTargetRegions.length === 0
      ? "Select State / UT"
      : selectedTargetRegions.length === 1
        ? selectedTargetRegions[0].name
        : `${selectedTargetRegions.length} State / UTs selected`;
  const districtOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !targetState || row.state === targetState)
        .map((row) => row.district)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const cityOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !targetState || row.state === targetState)
        .filter((row) => !targetDistrict || row.district === targetDistrict)
        .map((row) => row.city)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (targetRegionIds.length === 0) {
      setTargetRegionIds([region.id]);
      setTargetState(region.name);
    }
  }, [region.id, region.name, targetRegionIds.length]);

  useEffect(() => {
    if (targetRegionIds.length !== 1) {
      setTargetDistrict("");
      setTargetCity("");
      return;
    }
    const selected = regions.find((item) => item.id === targetRegionIds[0]);
    if (selected && targetState !== selected.name) {
      setTargetState(selected.name);
      setTargetDistrict("");
      setTargetCity("");
    }
  }, [regions, targetRegionIds, targetState]);

  function toggleTargetRegion(regionId: string) {
    setTargetRegionIds((current) => {
      const next = current.includes(regionId)
        ? current.filter((item) => item !== regionId)
        : [...current, regionId];
      const safeNext = next.length > 0 ? next : [region.id];
      const firstSelected = regions.find((item) => item.id === safeNext[0]) ?? region;
      setTargetState(safeNext.length === 1 ? firstSelected.name : "");
      setTargetDistrict("");
      setTargetCity("");
      return safeNext;
    });
  }

  function toggleTargetReligion(religion: string) {
    setTargetReligions((current) => {
      if (religion === "all") {
        return ["all"];
      }
      const withoutAll = current.filter((item) => item !== "all");
      const next = withoutAll.includes(religion)
        ? withoutAll.filter((item) => item !== religion)
        : [...withoutAll, religion];
      return next.length > 0 ? next : ["all"];
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">App Banner Upload</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Manage app banners</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Upload and manage mobile app home banners and promo card carousel images from here.
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          Home top banner: {HOME_BANNER_SIZE_LABEL}. Promo card carousel: {PROMO_CARD_SIZE_LABEL}. Full screen popup: {FULLSCREEN_POPUP_SIZE_LABEL} vertical. Other image sizes are allowed; use the preview to confirm the app fit.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm font-semibold text-slate-800">
            <span>Placement</span>
            <select
              value={placement}
              onChange={(event) => setPlacement(event.target.value)}
              className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            >
              {BANNER_PLACEMENTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} - {item.sizeLabel}
                </option>
              ))}
            </select>
          </label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Banner title" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Banner subtitle" className="min-h-28 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <div className="grid gap-4 md:grid-cols-2">
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Button label (optional)" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
            <input value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value)} placeholder="Button target path/url" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          </div>
          {placement === "home_promo_card_carousel" ? (
            <label className="block space-y-2 text-sm font-semibold text-slate-800">
              <span>Promo card group</span>
              <select
                value={promoCardGroup}
                onChange={(event) => setPromoCardGroup(event.target.value)}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              >
                <option value="1">Promo Card 1</option>
                <option value="2">Promo Card 2</option>
                <option value="3">Promo Card 3</option>
              </select>
              <span className="block text-xs font-medium leading-5 text-slate-500">
                Multiple selected images are saved as carousel slides inside the selected promo card. Add each card separately.
              </span>
            </label>
          ) : null}
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-bold text-emerald-900">Area targeting</p>
            <p className="mt-1 text-xs leading-6 text-emerald-700">
              Select the State/UTs where this banner should appear in the app.
            </p>
            <div className="relative mt-4 space-y-2 text-sm text-emerald-950">
              <span className="font-semibold">State / UT</span>
              <button
                type="button"
                onClick={() => setRegionMenuOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-950 outline-none transition hover:border-emerald-300 focus:border-emerald-400"
              >
                <span className="min-w-0 flex-1 truncate">{targetRegionSummary}</span>
                <span className="shrink-0 text-xs text-emerald-700">{regionMenuOpen ? "^" : "v"}</span>
              </button>
              {regionMenuOpen ? (
                <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 w-full max-w-full overflow-y-auto overflow-x-hidden rounded-2xl border border-emerald-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                  {regions.map((item) => (
                    <label
                      key={item.id}
                      className="grid w-full cursor-pointer grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50"
                    >
                      <input
                        type="checkbox"
                        checked={targetRegionIds.includes(item.id)}
                        onChange={() => toggleTargetRegion(item.id)}
                        className="h-4 w-4 accent-emerald-700"
                      />
                      <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left text-slate-950">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-emerald-700">{item.kind}</span>
                    </label>
                  ))}
                  <div className="sticky bottom-0 mt-2 border-t border-emerald-100 bg-white pt-2">
                    <button
                      type="button"
                      onClick={() => setRegionMenuOpen(false)}
                      className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-700">
              {selectedTargetRegions.map((item) => item.name).join(", ")}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">State</span>
                <select
                  value={targetState}
                  onChange={(event) => {
                    const selected = regions.find((item) => item.name === event.target.value);
                    if (selected) {
                      setTargetRegionIds([selected.id]);
                    }
                    setTargetState(event.target.value);
                    setTargetDistrict("");
                    setTargetCity("");
                  }}
                  disabled={!hasSingleTargetRegion}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  {regions.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">District</span>
                <select
                  value={targetDistrict}
                  onChange={(event) => {
                    setTargetDistrict(event.target.value);
                    setTargetCity("");
                  }}
                  disabled={!hasSingleTargetRegion}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">All districts</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">City</span>
                <select
                  value={targetCity}
                  onChange={(event) => setTargetCity(event.target.value)}
                  disabled={!hasSingleTargetRegion}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">All cities</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="rounded-[24px] border border-violet-200 bg-violet-50/70 p-4">
            <p className="text-sm font-bold text-violet-950">Religion targeting</p>
            <p className="mt-1 text-xs leading-6 text-violet-700">
              Select who should see this image. Choose All religions for a common promo.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {RELIGION_OPTIONS.map((item) => (
                <label key={item.value} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950">
                  <input
                    type="checkbox"
                    checked={targetReligions.includes(item.value)}
                    onChange={() => toggleTargetReligion(item.value)}
                    className="h-4 w-4 accent-violet-700"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white">
              {BANNER_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              multiple={placement === "home_promo_card_carousel" && !editingId}
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void handleFileChange(e.currentTarget)}
              className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--portal-purple)] file:px-3 file:py-2 file:text-white"
            />
          </div>
          {placement === "home_promo_card_carousel" && !editingId && promoFiles.length > 0 ? (
            <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
              <p className="text-sm font-bold text-sky-950">Promo image URLs</p>
              <p className="mt-1 text-xs leading-6 text-sky-700">
                Each selected promo image can open a separate URL in the app. Use full links like https://example.com.
              </p>
              <div className="mt-4 space-y-3">
                {promoFiles.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-sky-200 bg-white p-3">
                    <p className="text-xs font-bold text-slate-600">
                      {index + 1}. {item.file.name}
                    </p>
                    <input
                      value={item.ctaTarget}
                      onChange={(event) => updatePromoTarget(item.id, event.target.value)}
                      placeholder="https://example.com"
                      className="mt-2 w-full rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <p className="text-xs text-slate-500">{selectedPlacement.sizeLabel} fit check</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white" style={{ aspectRatio: selectedPlacement.aspectRatio }}>
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImage} alt="App banner preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">Banner preview</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} type="submit" className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60">
              {busy ? "Saving..." : editingId ? "Update Banner" : "Upload Banner"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                Cancel Edit
              </button>
            ) : null}
          </div>
          {message ? <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">{message}</p> : null}
        </form>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-2xl font-bold text-slate-950">Banner List</h3>
        <p className="mt-2 text-sm text-slate-600">Active and inactive app banners.</p>
        {items.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={items.every((item) => selectedIds.has(item.id))} onChange={toggleAllVisible} className="h-4 w-4 accent-rose-600" />
              Select visible
            </label>
            <span className="text-xs font-semibold text-slate-500">{selectedIds.size} selected</span>
            <button type="button" onClick={() => void deleteSelected()} disabled={selectedIds.size === 0} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Delete selected</button>
          </div>
        ) : null}
        <div className="mt-5 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">No app banners yet.</div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} className="h-4 w-4 accent-rose-600" />
                Select
              </label>
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} className="h-32 w-full rounded-2xl object-cover" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.subtitle || "No subtitle"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Placement: {BANNER_PLACEMENTS.find((placement) => placement.value === item.placement)?.label ?? item.placement} | Position: {bannerPositionLabel(item.sortOrder)}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-600 px-5 py-3 text-white shadow-[0_10px_22px_rgba(5,150,105,0.18)]">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">Views</span>
                        <span className="text-2xl font-black leading-none">{item.viewCount ?? 0}</span>
                      </div>
                      {item.placement === "home_promo_card_carousel" ? (
                        <p className="mt-1 text-xs font-semibold text-sky-700">
                          Promo Card: {item.promoCardGroup ?? 1}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Area: {item.targetRegionIds?.length === regions.length
                          ? "All India"
                          : item.targetRegionIds?.length
                            ? item.targetRegionIds.length > 3
                              ? `${item.targetRegionIds.length} States / UTs`
                              : regions
                                  .filter((candidate) => item.targetRegionIds?.includes(candidate.id))
                                  .map((candidate) => candidate.name)
                                  .join(", ")
                            : [item.targetCity, item.targetDistrict, item.targetState].filter(Boolean).join(", ") || "All areas"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-violet-700">
                        Religion: {item.targetReligions?.length
                          ? item.targetReligions.includes("all")
                            ? "All religions"
                            : item.targetReligions.join(", ")
                          : "All religions"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => startEdit(item)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                      Edit
                    </button>
                    <button onClick={() => void updateBanner(item.id, !item.active, item.sortOrder)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => void deleteBanner(item.id)} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
