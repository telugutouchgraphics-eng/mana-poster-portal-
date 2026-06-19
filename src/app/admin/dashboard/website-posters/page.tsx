"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { portalLanguage, t } from "@/lib/i18n";

interface WebsitePosterItem {
  id: string;
  category: string;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
  updatedAt: number;
  regionName?: string;
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

export default function AdminWebsitePostersPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
  const lang = portalLanguage(language);
  const [items, setItems] = useState<WebsitePosterItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(page = pagination.page) {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/website-posters?page=${page}&pageSize=${pagination.pageSize}&regionId=${encodeURIComponent(region.id)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        posters?: WebsitePosterItem[];
        pagination?: PaginationMeta;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.posters || !data.pagination) {
        throw new Error(data.error ?? t("websitePosters.unableLoad", lang));
      }
      setItems(data.posters);
      setPagination(data.pagination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("websitePosters.unableLoad", lang));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang, region.id]);

  async function removePoster(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    const confirmed = window.confirm(t("websitePosters.confirmDelete", lang));
    if (!confirmed) return;
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/website-posters/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? t("websitePosters.unableDelete", lang));
      }
      setMessage(t("websitePosters.deleted", lang));
      const nextPage =
        items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      await load(nextPage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("websitePosters.unableDelete", lang));
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              {t("websitePosters.eyebrow", lang)}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              {t("websitePosters.title", lang)}
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {t("websitePosters.description", lang)} Current State/UT: {region.name}.
            </p>
          </div>
          <button
            onClick={() => void load(pagination.page)}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("websitePosters.refresh", lang)}
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            {message}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("websitePosters.preview", lang)}</th>
                <th className="px-4 py-3">{t("websitePosters.category", lang)}</th>
                <th className="px-4 py-3">State/UT</th>
                <th className="px-4 py-3">{t("websitePosters.sortOrder", lang)}</th>
                <th className="px-4 py-3">{t("websitePosters.status", lang)}</th>
                <th className="px-4 py-3">{t("websitePosters.updated", lang)}</th>
                <th className="px-4 py-3">{t("websitePosters.action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    {t("websitePosters.loading", lang)}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    {t("websitePosters.empty", lang)}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100/80 bg-white align-top">
                    <td className="px-4 py-4">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.category}
                          className="h-20 w-36 object-cover"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.category}</td>
                    <td className="px-4 py-4 text-slate-700">{item.regionName || region.name}</td>
                    <td className="px-4 py-4 text-slate-700">{item.sortOrder}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {item.active
                          ? t("websitePosters.active", lang)
                          : t("websitePosters.inactive", lang)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.updatedAt)}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => void removePoster(item.id)}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                      >
                        {t("websitePosters.delete", lang)}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {t("websitePosters.showingPage", lang)} {pagination.page} / {pagination.totalPages} |{" "}
            {t("websitePosters.totalPosters", lang)}: {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => void load(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("websitePosters.previous", lang)}
            </button>
            <button
              onClick={() => void load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("websitePosters.next", lang)}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
