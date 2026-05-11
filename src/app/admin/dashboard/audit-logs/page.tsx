"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { portalLanguage, t } from "@/lib/i18n";

interface AuditLogItem {
  id: string;
  actorUid: string;
  actorRole: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  message: string;
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

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const lang = portalLanguage(language);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  async function load(page = 1, nextQuery = query, nextAction = action) {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/audit-logs?page=${page}&pageSize=${pagination.pageSize}&q=${encodeURIComponent(
          nextQuery,
        )}&action=${encodeURIComponent(nextAction)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        logs?: AuditLogItem[];
        pagination?: PaginationMeta;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.logs || !data.pagination) {
        throw new Error(data.error ?? t("audit.unableLoad", lang));
      }
      setItems(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("audit.unableLoad", lang));
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
    void load(1, query, action);
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              {t("audit.eyebrow", lang)}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{t("audit.title", lang)}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {t("audit.description", lang)}
            </p>
          </div>
          <button
            onClick={() => void load(pagination.page)}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("audit.refresh", lang)}
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_140px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("audit.searchPlaceholder", lang)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder={t("audit.actionPlaceholder", lang)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <button
            type="submit"
            className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
          >
            {t("audit.apply", lang)}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            {message}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("audit.action", lang)}</th>
                <th className="px-4 py-3">{t("audit.user", lang)}</th>
                <th className="px-4 py-3">{t("audit.role", lang)}</th>
                <th className="px-4 py-3">{t("audit.target", lang)}</th>
                <th className="px-4 py-3">{t("audit.message", lang)}</th>
                <th className="px-4 py-3">{t("audit.timestamp", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    {t("audit.loading", lang)}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    {t("audit.empty", lang)}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100/80 bg-white align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.action}</td>
                    <td className="px-4 py-4 text-slate-700">
                      <p>{item.actorEmail || "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.actorUid}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{item.actorRole}</td>
                    <td className="px-4 py-4 text-slate-700">
                      <p>{item.targetType}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.targetId}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{item.message}</td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {t("audit.showingPage", lang)} {pagination.page} / {pagination.totalPages} |{" "}
            {t("audit.totalLogs", lang)}: {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void load(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("audit.previous", lang)}
            </button>
            <button
              onClick={() => void load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("audit.next", lang)}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
