"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
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
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const end = new Date(item.endAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
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
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [iconAssetPath, setIconAssetPath] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [labelsByLanguage, setLabelsByLanguage] =
    useState<CategoryLabelsByLanguage>(() => emptyLabels());
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([
    region.id,
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lang = portalLanguage(language);
  const copy = {
    eyebrow: t("manualEventCategories.eyebrow", lang),
    title: t("manualEventCategories.title", lang),
    description: t("manualEventCategories.description", lang),
    categoryId: t("manualEventCategories.categoryId", lang),
    autoIdPlaceholder: t("manualEventCategories.autoIdPlaceholder", lang),
    autoIdHelp: t("manualEventCategories.autoIdHelp", lang),
    label: t("manualEventCategories.label", lang),
    labelPlaceholder: t("manualEventCategories.labelPlaceholder", lang),
    startDate: t("manualEventCategories.startDate", lang),
    endDate: t("manualEventCategories.endDate", lang),
    saving: t("manualEventCategories.saving", lang),
    update: t("manualEventCategories.update", lang),
    create: t("manualEventCategories.create", lang),
    clear: t("manualEventCategories.clear", lang),
    existingTitle: t("manualEventCategories.existingTitle", lang),
    loading: t("manualEventCategories.loading", lang),
    empty: t("manualEventCategories.empty", lang),
    edit: t("manualEventCategories.edit", lang),
    delete: t("manualEventCategories.delete", lang),
    unableLoad: t("manualEventCategories.unableLoad", lang),
    unableSave: t("manualEventCategories.unableSave", lang),
    created: t("manualEventCategories.created", lang),
    updated: t("manualEventCategories.updated", lang),
    unableDelete: t("manualEventCategories.unableDelete", lang),
    deleted: t("manualEventCategories.deleted", lang),
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

  async function loadItems() {
    setLoading(true);
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
      const visibleIds = new Set(nextItems.map((item) => item.id));
      setSelectedIds((prev) => {
        const next = new Set<string>();
        prev.forEach((itemId) => {
          if (visibleIds.has(itemId)) next.add(itemId);
        });
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region.id]);

  function resetForm() {
    setEditingId(null);
    setId("");
    setLabel("");
    setIconAssetPath("");
    setStartDate("");
    setEndDate("");
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

  return (
    <section className="space-y-5">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
          {copy.eyebrow}
        </p>
        <h3 className="mt-2 text-2xl font-black text-slate-950">
          {copy.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          {copy.description}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>{copy.categoryId}</span>
            <input
              value={id}
              onChange={(event) => setId(slugifyCategoryId(event.target.value))}
              disabled
              placeholder={copy.autoIdPlaceholder}
              className="w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 outline-none"
            />
            <p className="text-xs font-medium text-slate-500">
              {editingId
                ? copy.autoIdHelp
                : `${copy.autoIdHelp} Preview: ${previewCategoryId(region.id, label)}`}
            </p>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>{copy.label}</span>
            <input
              value={label}
              onChange={(event) => {
                const nextLabel = event.target.value;
                setLabel(nextLabel);
                if (!editingId) {
                  setId(slugifyCategoryId(nextLabel));
                }
              }}
              placeholder={copy.labelPlaceholder}
              className="w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 outline-none"
            />
          </label>
          <div className="space-y-2 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-2">
            <span>Category icon</span>
            <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-3">
              <div className="flex items-center gap-3">
                {selectedIconPreview(iconAssetPath) ? (
                  <img
                    src={selectedIconPreview(iconAssetPath)}
                    alt=""
                    className="h-11 w-11 rounded-2xl bg-slate-50 p-1"
                  />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xs font-black text-slate-400">
                    SVG
                  </div>
                )}
                <select
                  value={iconAssetPath}
                  onChange={(event) => setIconAssetPath(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--portal-border)] px-3 py-2 outline-none"
                >
                  <option value="">Default app icon</option>
                  {ADMIN_CATEGORY_ICON_OPTIONS.map((icon) => (
                    <option key={icon.id} value={icon.assetPath}>
                      {icon.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid max-h-48 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8 md:grid-cols-10">
                {ADMIN_CATEGORY_ICON_OPTIONS.map((icon) => {
                  const selected = iconAssetPath === icon.assetPath;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      title={icon.label}
                      onClick={() => setIconAssetPath(icon.assetPath)}
                      className={`rounded-2xl border p-1 transition ${
                        selected
                          ? "border-[var(--portal-purple)] bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <img
                        src={icon.previewPath}
                        alt={icon.label}
                        className="h-9 w-9"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[var(--portal-border)] bg-white p-4">
            <p className="text-sm font-bold text-slate-800">
              Visible states / UTs
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Select every state where this manual event category should appear
              in the app.
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
          <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[var(--portal-border)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  App language labels
                </p>
                <p className="text-xs text-slate-500">
                  Auto translation will fill blank fields after save; edit any
                  field for manual override.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLabelsByLanguage(emptyLabels())}
                className="rounded-xl border border-[var(--portal-border)] px-3 py-2 text-xs font-bold text-slate-600"
              >
                Clear overrides
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {CATEGORY_LABEL_LANGUAGES.map(([key, name]) => (
                <label
                  key={key}
                  className="space-y-1 text-xs font-semibold text-slate-600"
                >
                  <span>{name}</span>
                  <input
                    value={labelsByLanguage[key] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLabelsByLanguage((prev) => ({
                        ...prev,
                        [key]: value,
                      }));
                    }}
                    placeholder={`${name} label`}
                    className="w-full rounded-xl border border-[var(--portal-border)] px-3 py-2 text-sm outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>{copy.startDate}</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 outline-none"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>{copy.endDate}</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 outline-none"
            />
          </label>
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy || !label.trim() || !startDate}
              className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? copy.saving : editingId ? copy.update : copy.create}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-[var(--portal-border)] px-5 py-3 text-sm font-bold text-slate-700"
            >
              {copy.clear}
            </button>
          </div>
        </form>

        {message ? (
          <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </p>
        ) : null}
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h4 className="text-xl font-black text-slate-950">
          {copy.existingTitle}
        </h4>
        {items.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
              />
              Select all
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">
                {selectedCount} selected
              </span>
              <button
                type="button"
                disabled={busy || selectedCount === 0}
                onClick={() => void handleBulkDelete()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete selected
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-5 space-y-3">
          {loading && items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              {copy.loading}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              {copy.empty}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4"
              >
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    disabled={busy}
                    onChange={() => toggleSelection(item.id)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)] disabled:opacity-50"
                  />
                  Select category
                </label>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">
                      {categoryLabelWithIcon(item.id, item.label)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{item.id}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatRange(item)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      States:{" "}
                      {regions
                        .filter((candidate) =>
                          (item.regionIds?.length
                            ? item.regionIds
                            : item.regionId
                              ? [item.regionId]
                              : []
                          ).includes(candidate.id),
                        )
                        .map((candidate) => candidate.name)
                        .join(", ") || "All States / UTs"}
                    </p>
                    {item.iconAssetPath ? (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        {adminCategoryIconPreviewPath(item.iconAssetPath) ? (
                          <img
                            src={adminCategoryIconPreviewPath(
                              item.iconAssetPath,
                            )}
                            alt=""
                            className="h-7 w-7 rounded-lg bg-white p-0.5"
                          />
                        ) : null}
                        <span className="break-all">
                          Icon: {item.iconAssetPath}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      }}
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {copy.edit}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDelete(item.id)}
                      className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {copy.delete}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
