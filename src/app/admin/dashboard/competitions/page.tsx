"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface CompetitionRecord {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  startAt: number;
  endAt: number;
  status: string;
  rewardNote: string;
}

interface CategoryItem {
  id: string;
  label: string;
}

export default function AdminCompetitionsPage() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const headers = await authHeaders();
      const [compRes, catRes] = await Promise.all([
        fetch("/api/admin/competitions", { headers }),
        fetch("/api/categories/list", { headers }),
      ]);
      const compData = (await compRes.json()) as {
        ok: boolean;
        competitions?: CompetitionRecord[];
        error?: string;
      };
      const catData = (await catRes.json()) as {
        ok: boolean;
        categories?: CategoryItem[];
        error?: string;
      };
      if (!compRes.ok || !compData.ok) {
        throw new Error(compData.error ?? "Unable to load competitions.");
      }
      if (!catRes.ok || !catData.ok || !catData.categories) {
        throw new Error(catData.error ?? "Unable to load categories.");
      }
      setCompetitions(compData.competitions ?? []);
      setCategories(catData.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load competition panel.");
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!user) return;
    void loadData();
  }, [user, loadData]);

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((item) => item !== categoryId)
        : [...prev, categoryId],
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    try {
      setError(null);
      setMessage(null);
      const headers = await authHeaders();
      const response = await fetch("/api/admin/competitions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          title,
          description,
          rewardNote,
          categoryIds: selectedCategories,
          startAt: new Date(startDate).getTime(),
          endAt: new Date(endDate).getTime(),
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to create competition.");
      }
      setMessage("Competition created.");
      setTitle("");
      setDescription("");
      setRewardNote("");
      setStartDate("");
      setEndDate("");
      setSelectedCategories([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create competition.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-xl font-bold text-slate-950">Create Competition</h3>
        <p className="mt-2 text-sm text-slate-600">
          Assigned categories ki competitions create cheyyachu.
        </p>
        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Competition title" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="min-h-[96px] w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <input value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} placeholder="Reward note" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          </div>
          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Categories
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = selectedCategories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                        : "border-[var(--portal-border)] bg-white text-slate-700"
                    }`}
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p> : null}
          {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          <button className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]">
            Save Competition
          </button>
        </form>
      </section>

      <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-xl font-bold text-slate-950">Competitions</h3>
        <div className="mt-5 space-y-3">
          {competitions.length === 0 ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              Competitions levu.
            </div>
          ) : (
            competitions.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.description || "-"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {new Date(item.startAt).toLocaleDateString("en-IN")} to{" "}
                  {new Date(item.endAt).toLocaleDateString("en-IN")}
                </p>
                <p className="mt-2 text-xs text-slate-500">Reward: {item.rewardNote || "-"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.categoryIds.map((categoryId) => (
                    <span key={categoryId} className="rounded-full bg-white px-3 py-1 text-[11px] text-slate-600">
                      {categoryId}
                    </span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
