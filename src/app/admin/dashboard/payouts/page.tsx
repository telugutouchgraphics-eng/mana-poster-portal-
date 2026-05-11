"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { portalLanguage, t } from "@/lib/i18n";

interface PayoutItem {
  id: string;
  creatorPublicId: string;
  amount: number;
  status: string;
  note: string;
  createdAt: number;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function formatDate(epochMs?: number) {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AdminPayoutsPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const lang = portalLanguage(language);
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  });

  async function load(page = 1, nextQuery = query, nextStatus = status) {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/payouts?page=${page}&pageSize=${pagination.pageSize}&q=${encodeURIComponent(
          nextQuery,
        )}&status=${encodeURIComponent(nextStatus)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        payouts?: PayoutItem[];
        pagination?: PaginationMeta;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.payouts || !data.pagination) {
        throw new Error(data.error ?? t("payouts.unableLoad", lang));
      }
      setItems(data.payouts);
      setPagination(data.pagination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("payouts.unableLoad", lang));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(1, query, status);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              {t("payouts.eyebrow", lang)}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {t("payouts.title", lang)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {t("payouts.description", lang)}
            </p>
          </div>
          <button
            onClick={() => void load(pagination.page)}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("payouts.refresh", lang)}
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_140px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("payouts.searchPlaceholder", lang)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          >
            <option value="all">{t("payouts.allStatuses", lang)}</option>
            <option value="paid">{t("payouts.paid", lang)}</option>
            <option value="queued">{t("payouts.queued", lang)}</option>
            <option value="on_hold">{t("payouts.onHold", lang)}</option>
            <option value="approved_for_payout">{t("payouts.approved", lang)}</option>
          </select>
          <button
            type="submit"
            className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
          >
            {t("payouts.apply", lang)}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            {message}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("payouts.creator", lang)}</th>
                <th className="px-4 py-3">{t("payouts.amount", lang)}</th>
                <th className="px-4 py-3">{t("payouts.status", lang)}</th>
                <th className="px-4 py-3">{t("payouts.note", lang)}</th>
                <th className="px-4 py-3">{t("payouts.date", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    {t("payouts.loading", lang)}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    {t("payouts.empty", lang)}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100/80 bg-white align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.creatorPublicId}</td>
                    <td className="px-4 py-4 text-slate-700">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{item.note || "-"}</td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {t("payouts.showingPage", lang)} {pagination.page} / {pagination.totalPages} |{" "}
            {t("payouts.totalPayouts", lang)}: {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void load(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("payouts.previous", lang)}
            </button>
            <button
              onClick={() => void load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("payouts.next", lang)}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
