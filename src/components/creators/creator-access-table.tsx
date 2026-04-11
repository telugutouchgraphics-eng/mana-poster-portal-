"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface CreatorRow {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  assignedCategories: string[];
}

interface CategoryDef {
  id: string;
  label: string;
}

interface CreatorAccessTableProps {
  title: string;
  subtitle: string;
}

export function CreatorAccessTable({ title, subtitle }: CreatorAccessTableProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [linkResult, setLinkResult] = useState<Record<string, string>>({});

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

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID, email"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="pending_invite">Pending invite</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <button
          onClick={() => void loadCreators()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-[22%] px-3 py-3">Creator</th>
              <th className="w-[22%] px-3 py-3">Contact</th>
              <th className="w-[12%] px-3 py-3">Status</th>
              <th className="w-[30%] px-3 py-3">Assigned Categories</th>
              <th className="w-[14%] px-3 py-3">Actions</th>
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
                <tr key={row.creatorPublicId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="font-mono text-xs text-slate-600" title={row.creatorPublicId}>
                      ID: {row.creatorPublicId}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <p className="break-all">{row.email}</p>
                    <p>{row.phone}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                      {row.status}
                    </span>
                    {linkResult[row.creatorPublicId] ? (
                      <p className="mt-2 max-w-[220px] truncate text-xs text-emerald-700">
                        Link copied
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="grid grid-cols-2 gap-1">
                      {categories.map((category) => {
                        const selected = (selectedMap[row.creatorPublicId] ?? []).includes(
                          category.id
                        );
                        return (
                          <label key={category.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleCategory(row.creatorPublicId, category.id)}
                            />
                            <span>{category.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {(selectedMap[row.creatorPublicId] ?? []).length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Current:{" "}
                        {(selectedMap[row.creatorPublicId] ?? [])
                          .map((id) => categoryNameMap[id] ?? id)
                          .join(", ")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => void assignCategories(row.creatorPublicId)}
                        className="w-full whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        Save categories
                      </button>
                      <button
                        onClick={() => void regenerateLink(row.creatorPublicId)}
                        className="w-full whitespace-nowrap rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white"
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
                        className={`w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                          row.status === "blocked" ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                      >
                        {row.status === "blocked" ? "Enable access" : "Remove access"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
