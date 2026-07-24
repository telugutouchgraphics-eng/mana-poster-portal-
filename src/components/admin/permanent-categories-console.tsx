"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";
import {
  ADMIN_CATEGORY_ICON_OPTIONS,
  adminCategoryIconPreviewPath,
} from "@/lib/admin-category-icons";
import { categoryLabelWithIcon } from "@/lib/category-display";

type PermanentCategory = {
  id: string;
  label: string;
  labelsByLanguage?: CategoryLabelsByLanguage;
  iconAssetPath?: string;
  regionIds?: string[];
  active: boolean;
  sortOrder: number;
};

type ResponseShape = {
  ok: boolean;
  error?: string;
  category?: PermanentCategory;
  categories?: PermanentCategory[];
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
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return slug ? `perm_${slug.replace(/^perm_/, "")}` : "";
}

export function PermanentCategoriesConsole() {
  const { user } = useAuth();
  const { regions } = useDashboardRegion();
  const [items, setItems] = useState<PermanentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [iconAssetPath, setIconAssetPath] = useState("");
  const [labelsByLanguage, setLabelsByLanguage] =
    useState<CategoryLabelsByLanguage>(() => emptyLabels());
  const [sortOrder, setSortOrder] = useState("0");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      const response = await authorizedFetch("/api/admin/permanent-categories");
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load permanent categories.");
      }
      setItems(data.categories ?? []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load permanent categories.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  function resetForm() {
    setEditingId(null);
    setLabel("");
    setIconAssetPath("");
    setLabelsByLanguage(emptyLabels());
    setSortOrder("0");
    setSelectedRegionIds([]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        label: label.trim(),
        labelsByLanguage,
        iconAssetPath,
        regionIds: selectedRegionIds,
        sortOrder: Number(sortOrder) || 0,
      };
      const endpoint = editingId
        ? `/api/admin/permanent-categories/${encodeURIComponent(editingId)}`
        : "/api/admin/permanent-categories";
      const response = await authorizedFetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(
          editingId
            ? payload
            : {
                ...payload,
                id: slugifyCategoryId(payload.label),
                active: true,
              },
        ),
      });
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save permanent category.");
      }
      resetForm();
      await loadItems();
      setMessage(
        editingId
          ? "Permanent category updated."
          : "Permanent category created.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save permanent category.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: PermanentCategory) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await authorizedFetch(
        `/api/admin/permanent-categories/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !item.active }),
        },
      );
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update category status.");
      }
      await loadItems();
      setMessage(
        !item.active
          ? "Category enabled for app."
          : "Category hidden from app.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update category status.",
      );
    } finally {
      setBusy(false);
    }
  }

  function edit(item: PermanentCategory) {
    setEditingId(item.id);
    setLabel(item.label);
    setIconAssetPath(item.iconAssetPath ?? "");
    setLabelsByLanguage(item.labelsByLanguage ?? emptyLabels());
    setSortOrder(String(item.sortOrder ?? 0));
    setSelectedRegionIds(item.regionIds ?? []);
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Admin only
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Permanent categories
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Create app categories that stay permanently under More. Managers can
          assign active categories to creators; disabled categories are hidden
          from the app and assignment lists.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_auto]"
      >
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Category label
          </span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Example: Special Offers"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            required
          />
          {!editingId && label.trim() ? (
            <span className="block text-xs text-slate-500">
              ID: {slugifyCategoryId(label) || "auto-generated"}
            </span>
          ) : null}
        </label>
        <div className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Category icon
          </span>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-3">
              {adminCategoryIconPreviewPath(iconAssetPath) ? (
                <img
                  src={adminCategoryIconPreviewPath(iconAssetPath)}
                  alt=""
                  className="h-11 w-11 rounded-xl bg-slate-50 p-1"
                />
              ) : (
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-400">
                  SVG
                </div>
              )}
              <select
                value={iconAssetPath}
                onChange={(event) => setIconAssetPath(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                    className={`rounded-xl border p-1 transition ${
                      selected
                        ? "border-indigo-600 bg-indigo-50"
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
        <div className="md:col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Visible states / UTs
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Leave empty for all states, or select only the states where this
            permanent category should appear.
          </p>
          <div className="mt-3">
            <RegionMultiSelectDropdown
              regions={regions}
              selectedRegionIds={selectedRegionIds}
              onChange={setSelectedRegionIds}
            />
          </div>
        </div>
        <div className="md:col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                App language labels
              </p>
              <p className="text-xs text-slate-500">
                Blank fields are auto-translated on save; filled fields are used
                as manual overrides.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLabelsByLanguage(emptyLabels())}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
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
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Sort order
          </span>
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {editingId ? "Update" : "Create"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {message ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">
            Existing permanent categories
          </h2>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading...</p>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No permanent categories yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {categoryLabelWithIcon(item.id, item.label)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.id} · sort {item.sortOrder ?? 0}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    States:{" "}
                    {item.regionIds?.length
                      ? regions
                          .filter((region) =>
                            item.regionIds?.includes(region.id),
                          )
                          .map((region) => region.name)
                          .join(", ")
                      : "All States / UTs"}
                  </p>
                  {item.iconAssetPath ? (
                    <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      {adminCategoryIconPreviewPath(item.iconAssetPath) ? (
                        <img
                          src={adminCategoryIconPreviewPath(item.iconAssetPath)}
                          alt=""
                          className="h-7 w-7 rounded-lg bg-slate-50 p-0.5"
                        />
                      ) : null}
                      <span className="break-all">
                        Icon: {item.iconAssetPath}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(item)}
                    disabled={busy}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.active ? "On in app" : "Off in app"}
                  </button>
                  <button
                    type="button"
                    onClick={() => edit(item)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
