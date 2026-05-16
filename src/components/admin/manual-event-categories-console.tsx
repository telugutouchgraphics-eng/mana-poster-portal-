"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { portalLanguage, t } from "@/lib/i18n";

type ManualEventCategory = {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
  active: boolean;
};

type ResponseShape = {
  ok: boolean;
  error?: string;
  categories?: ManualEventCategory[];
};

function slugifyCategoryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
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

export function ManualEventCategoriesConsole() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const [items, setItems] = useState<ManualEventCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
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
      const response = await authorizedFetch("/api/event-categories");
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableLoad);
      }
      setItems(data.categories ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function resetForm() {
    setEditingId(null);
    setId("");
    setLabel("");
    setStartDate("");
    setEndDate("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        id,
        label,
        startDate,
        endDate: endDate || startDate,
      };
      const response = editingId
        ? await authorizedFetch(`/api/event-categories/${encodeURIComponent(editingId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              label,
              startDate,
              endDate: endDate || startDate,
              active: true,
            }),
          })
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
      const response = await authorizedFetch(`/api/event-categories/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ResponseShape;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableDelete);
      }
      setItems(data.categories ?? []);
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

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            <span>{copy.categoryId}</span>
            <input
              value={id}
              onChange={(event) => setId(slugifyCategoryId(event.target.value))}
              disabled
              placeholder={copy.autoIdPlaceholder}
              className="w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 outline-none"
            />
            <p className="text-xs font-medium text-slate-500">{copy.autoIdHelp}</p>
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
              disabled={busy || !id || !label || !startDate}
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
          <p className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p>
        ) : null}
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h4 className="text-xl font-black text-slate-950">{copy.existingTitle}</h4>
        <div className="mt-5 space-y-3">
          {loading ? (
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.id}</p>
                    <p className="mt-2 text-sm text-slate-500">{formatRange(item)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setId(item.id);
                        setLabel(item.label);
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
