"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface CreatorRow {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  assignedCategories: string[];
  createdAt?: number;
  totalUploads?: number;
  approvedCount?: number;
  pendingCount?: number;
  rejectedCount?: number;
  lastUploadAt?: number;
}

interface CategoryDef {
  id: string;
  label: string;
  isBlinking?: boolean;
}

interface CreatorAccessTableProps {
  title: string;
  subtitle: string;
  showPayoutActions?: boolean;
}

export function CreatorAccessTable({
  title,
  subtitle,
  showPayoutActions = false,
}: CreatorAccessTableProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [linkResult, setLinkResult] = useState<Record<string, string>>({});
  const [payoutAmountMap, setPayoutAmountMap] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  function formatDate(epochMs?: number) {
    if (!epochMs) return "-";
    return new Date(epochMs).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadCategories = useCallback(async () => {
    const headers = await authHeader();
    const response = await fetch("/api/categories/list", { headers });
    const data = (await response.json()) as {
      ok: boolean;
      categories?: CategoryDef[];
      error?: string;
    };
    if (!response.ok || !data.ok || !data.categories) {
      throw new Error(data.error ?? "Unable to load categories.");
    }
    setCategories(data.categories);
  }, [authHeader]);

  const loadCreators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const url = `/api/creators/list?status=${encodeURIComponent(
        status
      )}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers });
      const data = (await response.json()) as {
        ok: boolean;
        creators?: CreatorRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.creators) {
        throw new Error(data.error ?? "Unable to load creators.");
      }
      setRows(data.creators);
      setSelectedMap(
        Object.fromEntries(
          data.creators.map((row) => [row.creatorPublicId, row.assignedCategories])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load creators.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, query, status]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadCategories();
  }, [user, loadCategories]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadCreators();
  }, [user, status, loadCreators]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((cat) => [cat.id, cat.label])),
    [categories]
  );

  function toggleCategory(creatorPublicId: string, categoryId: string) {
    setSelectedMap((prev) => {
      const existing = prev[creatorPublicId] ?? [];
      const has = existing.includes(categoryId);
      const next = has
        ? existing.filter((item) => item !== categoryId)
        : [...existing, categoryId];
      return { ...prev, [creatorPublicId]: next };
    });
  }

  async function assignCategories(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/creators/${encodeURIComponent(creatorPublicId)}/assign-categories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            categoryIds: selectedMap[creatorPublicId] ?? [],
          }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Category assignment failed.");
      }
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Category assignment failed.");
    }
  }

  async function regenerateLink(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(
          creatorPublicId
        )}/regenerate-link`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as {
        ok: boolean;
        loginLink?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.loginLink) {
        throw new Error(data.error ?? "Unable to regenerate login link.");
      }
      setLinkResult((prev) => ({ ...prev, [creatorPublicId]: data.loginLink! }));
      await navigator.clipboard.writeText(data.loginLink);
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to regenerate link.");
    }
  }

  async function updateAccessStatus(
    creatorPublicId: string,
    nextStatus: "active" | "blocked"
  ) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(creatorPublicId)}/access-status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update creator access.");
      }
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update creator access.");
    }
  }

  async function resetDevice(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(creatorPublicId)}/reset-device`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to reset creator device.");
      }
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset creator device.");
    }
  }

  async function markPayout(creatorPublicId: string) {
    const amount = Number(payoutAmountMap[creatorPublicId] ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter valid payout amount first.");
      return;
    }
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/creators/${encodeURIComponent(creatorPublicId)}/payouts`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ amount }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to mark payout.");
      }
      setPayoutAmountMap((prev) => ({ ...prev, [creatorPublicId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark payout.");
    }
  }

  function toggleExpanded(creatorPublicId: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [creatorPublicId]: !prev[creatorPublicId],
    }));
  }

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID, email"
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        >
          <option value="all">All statuses</option>
          <option value="pending_invite">Pending invite</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <button
          onClick={() => void loadCreators()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
        <table className="min-w-[1280px] w-full text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned Categories</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Loading creators...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No creators found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.creatorPublicId}>
                  <tr className="border-t border-slate-100/80 align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="font-mono text-xs text-slate-600" title={row.creatorPublicId}>
                        ID: {row.creatorPublicId}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Uploads {row.totalUploads ?? 0} | Approved {row.approvedCount ?? 0} | Pending{" "}
                        {row.pendingCount ?? 0}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <p className="break-all">{row.email}</p>
                      <p>{row.phone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {(selectedMap[row.creatorPublicId] ?? []).length} selected
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpanded(row.creatorPublicId)}
                        className="w-full whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        {expandedRows[row.creatorPublicId] ? "Close" : "Open"}
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.creatorPublicId] ? (
                    <tr className="border-t border-slate-100/80 bg-white">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Assigned Categories
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {categories.map((category) => {
                                const selected = (selectedMap[row.creatorPublicId] ?? []).includes(
                                  category.id
                                );
                                return (
                                  <label
                                    key={category.id}
                                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                                      category.isBlinking
                                        ? "animate-pulse border-emerald-300 bg-emerald-50 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                        : "border-transparent bg-[var(--portal-surface-soft)] text-slate-700"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => toggleCategory(row.creatorPublicId, category.id)}
                                    />
                                    <span className={category.isBlinking ? "font-semibold" : undefined}>
                                      {category.label}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="mt-3 text-xs text-slate-600">
                              Last upload: {formatDate(row.lastUploadAt)}
                            </p>
                            {(selectedMap[row.creatorPublicId] ?? []).length > 0 ? (
                              <p className="mt-1 text-xs text-slate-600">
                                Current:{" "}
                                {(selectedMap[row.creatorPublicId] ?? [])
                                  .map((id) => categoryNameMap[id] ?? id)
                                  .join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid gap-2">
                            <button
                              onClick={() => void assignCategories(row.creatorPublicId)}
                              className="w-full whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                            >
                              Save categories
                            </button>
                            <button
                              onClick={() => void regenerateLink(row.creatorPublicId)}
                              className="w-full whitespace-nowrap rounded-xl bg-[var(--portal-green)] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                            >
                              New link
                            </button>
                            <button
                              onClick={() =>
                                void updateAccessStatus(
                                  row.creatorPublicId,
                                  row.status === "blocked" ? "active" : "blocked"
                                )
                              }
                              className={`w-full whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold text-white ${
                                row.status === "blocked" ? "bg-[var(--portal-green-dark)]" : "bg-rose-600"
                              }`}
                            >
                              {row.status === "blocked" ? "Enable access" : "Remove access"}
                            </button>
                            <button
                              onClick={() => void resetDevice(row.creatorPublicId)}
                              className="w-full whitespace-nowrap rounded-xl bg-[var(--portal-purple)] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                            >
                              Reset device
                            </button>
                            {linkResult[row.creatorPublicId] ? (
                              <p className="text-xs font-semibold text-emerald-700">Link copied</p>
                            ) : null}
                            {showPayoutActions ? (
                              <>
                                <input
                                  value={payoutAmountMap[row.creatorPublicId] ?? ""}
                                  onChange={(e) =>
                                    setPayoutAmountMap((prev) => ({
                                      ...prev,
                                      [row.creatorPublicId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Payout amount"
                                  inputMode="decimal"
                                  className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs outline-none transition focus:border-[var(--portal-border-strong)]"
                                />
                                <button
                                  onClick={() => void markPayout(row.creatorPublicId)}
                                  className="w-full whitespace-nowrap rounded-xl bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                                >
                                  Mark payout
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
