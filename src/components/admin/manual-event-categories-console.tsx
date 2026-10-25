"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";
import {
  ADMIN_CATEGORY_ICON_OPTIONS,
  adminCategoryIconPreviewPath,
} from "@/lib/admin-category-icons";
import { categoryLabelWithIcon } from "@/lib/category-display";
import { portalLanguage, t } from "@/lib/i18n";

type ManualEventCategory = {
  id: string;
  label: string;
  labelsByLanguage?: CategoryLabelsByLanguage;
  iconAssetPath?: string;
  startAt: number;
  endAt: number;
  active: boolean;
  allowPoliticalProtocol?: boolean;
  regionId?: string;
  regionIds?: string[];
  regionName?: string;
};

type ResponseShape = {
  ok: boolean;
  error?: string;
  categories?: ManualEventCategory[];
};

const CATEGORY_LABEL_LANGUAGES = [
  ["telugu", "Telugu"],
  ["hindi", "Hindi"],
  ["english", "English"],
  ["tamil", "Tamil"],
  ["kannada", "Kannada"],
  ["malayalam", "Malayalam"],
  ["assamese", "Assamese"],
  ["konkani", "Konkani"],
  ["gujarati", "Gujarati"],
  ["marathi", "Marathi"],
  ["meitei", "Meitei"],
  ["mizo", "Mizo"],
  ["odia", "Odia"],
  ["punjabi", "Punjabi"],
  ["nepali", "Nepali"],
  ["bengali", "Bengali"],
  ["kashmiri", "Kashmiri"],
  ["ladakhi", "Ladakhi"],
] as const;

type CategoryLabelLanguage = (typeof CATEGORY_LABEL_LANGUAGES)[number][0];
type CategoryLabelsByLanguage = Partial<Record<CategoryLabelLanguage, string>>;

function emptyLabels(): CategoryLabelsByLanguage {
  return {};
}

function slugifyCategoryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function previewCategoryId(regionId: string, label: string): string {
  const slug = slugifyCategoryId(label);
  return slug ? `${regionId}_${slug}` : "auto-generated";
}

function toInputDate(epochMs: number): string {
  const date = new Date(epochMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRange(item: ManualEventCategory): string {
  const start = new Date(item.startAt).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const end = new Date(item.endAt).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return start === end ? start : `${start} - ${end}`;
}

function selectedIconPreview(iconAssetPath: string): string {
  return adminCategoryIconPreviewPath(iconAssetPath);
}

export function ManualEventCategoriesConsole() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region, regions } = useDashboardRegion();
  const [items, setItems] = useState<ManualEventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [iconAssetPath, setIconAssetPath] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allowPoliticalProtocol, setAllowPoliticalProtocol] = useState(false);
  const [labelsByLanguage, setLabelsByLanguage] =
    useState<CategoryLabelsByLanguage>(() => emptyLabels());
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([
    region.id,
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lang = portalLanguage(language);
  const copy = {
    eyebrow: "Event Categories",
    title: "Manage Festival & Event Categories",
    description:
      "Configure dynamic date-based festival categories, 3D vector realistic icons, regional visibility, and multi-language translations for the mobile app.",
    categoryId: "Category ID",
    autoIdPlaceholder: "Auto-generated from label",
    autoIdHelp: "System identifier.",
    label: "Event Name (Display Label)",
    labelPlaceholder: "e.g. Diwali, Sankranti, Independence Day",
    startDate: "Start Date",
    endDate: "End Date",
    saving: "Saving Category...",
    update: "Update Category",
    create: "Create Event Category",
    clear: "Cancel / Reset",
    existingTitle: "Configured Event Categories",
    loading: "Loading categories...",
    empty: "No event categories configured for this region yet.",
    edit: "Edit",
    delete: "Delete",
    unableLoad: "Unable to load categories",
    unableSave: "Unable to save category",
    created: "Category created successfully",
    updated: "Category updated successfully",
    unableDelete: "Unable to delete category",
    deleted: "Category deleted successfully",
  };

  async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const token = await user?.getIdToken();
    return fetch(input, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: token ? `Bearer ${token}` : "",
        ...(init?.headers ?? {}),
      },
    });
  }

  const SWR_EVENT_CATS_KEY = `mana_event_categories_${region.id}`;

  // Instant 0ms SWR hydration from localStorage
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(SWR_EVENT_CATS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ManualEventCategory[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          setLoading(false);
        }
      }
    } catch {
      // LocalStorage fallback
    }
  }, [SWR_EVENT_CATS_KEY]);

  async function loadItems() {
    if (items.length === 0) {
      setLoading(true);
    }
    setMessage(null);
    try {
      const response = await authorizedFetch(
        `/api/event-categories?regionId=${encodeURIComponent(region.id)}`,
      );
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableLoad);
      }
      const nextItems = data.categories ?? [];
      setItems(nextItems);
      try {
        window.localStorage.setItem(
          SWR_EVENT_CATS_KEY,
          JSON.stringify(nextItems),
        );
      } catch {
        // ignore
      }
      const visibleIds = new Set(nextItems.map((item) => item.id));
      setSelectedIds((prev) => {
        const next = new Set<string>();
        prev.forEach((itemId) => {
          if (visibleIds.has(itemId)) next.add(itemId);
        });
        return next;
      });
    } catch (error) {
      if (items.length === 0) {
        setMessage(error instanceof Error ? error.message : copy.unableLoad);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, [region.id]);

  function resetForm() {
    setEditingId(null);
    setId("");
    setLabel("");
    setIconAssetPath("");
    setStartDate("");
    setEndDate("");
    setAllowPoliticalProtocol(false);
    setLabelsByLanguage(emptyLabels());
    setSelectedRegionIds([region.id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        id,
        label,
        labelsByLanguage,
        iconAssetPath,
        startDate,
        endDate: endDate || startDate,
        allowPoliticalProtocol,
        regionId: region.id,
        regionIds:
          selectedRegionIds.length > 0 ? selectedRegionIds : [region.id],
      };
      const response = editingId
        ? await authorizedFetch(
            `/api/event-categories/${encodeURIComponent(editingId)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                label,
                labelsByLanguage,
                iconAssetPath,
                startDate,
                endDate: endDate || startDate,
                allowPoliticalProtocol,
                active: true,
                regionId: region.id,
                regionIds:
                  selectedRegionIds.length > 0
                    ? selectedRegionIds
                    : [region.id],
              }),
            },
          )
        : await authorizedFetch("/api/event-categories", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableSave);
      }
      setItems(data.categories ?? []);
      setMessage(editingId ? copy.updated : copy.created);
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.unableSave);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(targetId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await authorizedFetch(
        `/api/event-categories/${encodeURIComponent(targetId)}?regionId=${encodeURIComponent(region.id)}`,
        {
          method: "DELETE",
        },
      );
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableDelete);
      }
      setItems((prev) => prev.filter((item) => item.id !== targetId));
      setItems(data.categories ?? []);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      if (editingId === targetId) {
        resetForm();
      }
      setMessage(copy.deleted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.unableDelete);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));

  function toggleSelection(targetId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) {
        next.delete(targetId);
      } else {
        next.add(targetId);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        items.forEach((item) => next.delete(item.id));
      } else {
        items.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds).filter((itemId) =>
      items.some((item) => item.id === itemId),
    );
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} selected event category(s)?`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage(null);
    try {
      let nextItems = items;
      for (const targetId of ids) {
        const response = await authorizedFetch(
          `/api/event-categories/${encodeURIComponent(targetId)}?regionId=${encodeURIComponent(region.id)}`,
          { method: "DELETE" },
        );
        const data = (await response.json()) as ResponseShape;
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? copy.unableDelete);
        }
        nextItems =
          data.categories ?? nextItems.filter((item) => item.id !== targetId);
      }
      setItems(nextItems);
      setSelectedIds(new Set());
      if (editingId && ids.includes(editingId)) {
        resetForm();
      }
      setMessage(copy.deleted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.unableDelete);
    } finally {
      setBusy(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q),
    );
  }, [items, categorySearchQuery]);

  return (
    <section className="space-y-6">
      {/* Category Creation / Editing Card */}
      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-colors dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {copy.eyebrow}
              </span>
              {editingId ? (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  Editing: {editingId}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {editingId ? "Update Event Category" : copy.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {copy.description}
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Display Name */}
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{copy.label} *</span>
              <input
                value={label}
                required
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setLabel(nextLabel);
                  if (!editingId) {
                    setId(slugifyCategoryId(nextLabel));
                  }
                }}
                placeholder={copy.labelPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>

            {/* Category ID (Slug) */}
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{copy.categoryId}</span>
              <input
                value={id}
                onChange={(event) => setId(slugifyCategoryId(event.target.value))}
                disabled
                placeholder={copy.autoIdPlaceholder}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400"
              />
              <p className="text-[11px] font-medium text-slate-400">
                {editingId
                  ? copy.autoIdHelp
                  : `Preview ID: ${previewCategoryId(region.id, label)}`}
              </p>
            </label>
          </div>

          {/* Realistic Category Icon Picker */}
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Category 3D Vector Icon
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Pick a high-definition 3D realistic festival icon
              </span>
            </div>

            <div className="flex items-center gap-3">
              {selectedIconPreview(iconAssetPath) ? (
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={selectedIconPreview(iconAssetPath)}
                    alt=""
                    className="h-10 w-10 object-contain"
                  />
                </div>
              ) : (
                <div className="grid h-12 w-12 flex-none place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-100 text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                  ICON
                </div>
              )}
              <select
                value={iconAssetPath}
                onChange={(event) => setIconAssetPath(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">Default app icon</option>
                {ADMIN_CATEGORY_ICON_OPTIONS.map((icon) => (
                  <option key={icon.id} value={icon.assetPath}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Icon Grid */}
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-9">
              {ADMIN_CATEGORY_ICON_OPTIONS.map((icon) => {
                const selected = iconAssetPath === icon.assetPath;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    title={icon.label}
                    onClick={() => setIconAssetPath(icon.assetPath)}
                    className={`group relative flex flex-col items-center justify-center rounded-xl border p-2 transition-all ${
                      selected
                        ? "border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-600/30 dark:border-indigo-500 dark:bg-indigo-950/40"
                        : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-700"
                    }`}
                  >
                    <img
                      src={icon.previewPath}
                      alt={icon.label}
                      className="h-8 w-8 transition-transform group-hover:scale-110"
                    />
                    <span className="mt-1 max-w-[65px] truncate text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                      {icon.label.split("/")[0].trim()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates & Protocol */}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{copy.startDate} *</span>
              <input
                type="date"
                required
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{copy.endDate}</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div className="flex flex-col justify-end">
              <label className="flex h-10 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <span>Political protocol</span>
                <input
                  type="checkbox"
                  checked={allowPoliticalProtocol}
                  onChange={(event) =>
                    setAllowPoliticalProtocol(event.target.checked)
                  }
                  className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Visible States / UTs */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Visible States / UTs
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Choose regions where this category should be displayed in the app.
            </p>
            <div className="mt-3">
              <RegionMultiSelectDropdown
                regions={regions}
                selectedRegionIds={selectedRegionIds}
                onChange={(next) =>
                  setSelectedRegionIds(next.length > 0 ? next : [region.id])
                }
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={busy || !label.trim() || !startDate}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? copy.saving : editingId ? copy.update : copy.create}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {copy.clear}
            </button>
          </div>
        </form>

        {message ? (
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-xs font-semibold text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
            {message}
          </div>
        ) : null}
      </article>

      {/* Existing Categories Table & List */}
      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition-colors dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {copy.existingTitle} ({items.length})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active and upcoming festival event categories in {region.name}
            </p>
          </div>

          {/* Quick Filter */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              placeholder="Search category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-3 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            {categorySearchQuery ? (
              <button
                type="button"
                onClick={() => setCategorySearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Select all visible ({filteredItems.length})
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {selectedCount} selected
              </span>
              <button
                type="button"
                disabled={busy || selectedCount === 0}
                onClick={() => void handleBulkDelete()}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-rose-700 disabled:opacity-50"
              >
                Delete Selected
              </button>
            </div>
          </div>
        ) : null}

        {/* Categories List */}
        <div className="mt-4 space-y-2.5">
          {loading && items.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {copy.loading}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {categorySearchQuery
                ? `No categories matching "${categorySearchQuery}"`
                : copy.empty}
            </div>
          ) : (
            filteredItems.map((item) => {
              const preview = item.iconAssetPath
                ? adminCategoryIconPreviewPath(item.iconAssetPath)
                : "";
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-indigo-400 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20"
                      : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={busy}
                      onChange={() => toggleSelection(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />

                    {/* Realistic 3D Icon Preview */}
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">
                          SVG
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {categoryLabelWithIcon(item.id, item.label)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {item.id}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>📅 {formatRange(item)}</span>
                        <span>•</span>
                        <span>
                          {item.allowPoliticalProtocol
                            ? "🏛️ Protocol On"
                            : "Off"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setId(item.id);
                        setLabel(item.label);
                        setIconAssetPath(item.iconAssetPath ?? "");
                        setLabelsByLanguage(
                          item.labelsByLanguage ?? emptyLabels(),
                        );
                        setSelectedRegionIds(
                          item.regionIds?.length
                            ? item.regionIds
                            : item.regionId
                              ? [item.regionId]
                              : [region.id],
                        );
                        setStartDate(toInputDate(item.startAt));
                        setEndDate(toInputDate(item.endAt));
                        setAllowPoliticalProtocol(
                          item.allowPoliticalProtocol === true,
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {copy.edit}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(item.id)}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60 disabled:opacity-50"
                    >
                      {copy.delete}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
