"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface ManagerRow {
  uid: string;
  managerPublicId?: string;
  email: string;
  name: string;
  phone: string;
  managerStatus: string;
}

function displayManagerId(row: ManagerRow): string {
  if (row.managerPublicId && row.managerPublicId.trim().length > 0) {
    return row.managerPublicId;
  }
  return `Mana-MGR-${row.uid.slice(0, 4).toUpperCase()}`;
}

export function ManagerTable() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordResult, setPasswordResult] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadManagers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const url = `/api/admin/managers/list?status=${encodeURIComponent(
        status
      )}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers });
      const data = (await response.json()) as {
        ok: boolean;
        managers?: ManagerRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.managers) {
        throw new Error(data.error ?? "Unable to load managers.");
      }
      setRows(data.managers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load managers.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, query, status]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadManagers();
  }, [user, status, loadManagers]);

  async function toggleStatus(managerUid: string, managerStatus: "active" | "inactive") {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/toggle-status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ managerStatus }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to change manager status.");
      }
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change manager status.");
    }
  }

  async function resetPassword(managerUid: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/reset-password`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as {
        ok: boolean;
        temporaryPassword?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.temporaryPassword) {
        throw new Error(data.error ?? "Unable to reset password.");
      }
      setPasswordResult((prev) => ({
        ...prev,
        [managerUid]: data.temporaryPassword!,
      }));
      await navigator.clipboard.writeText(data.temporaryPassword);
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    }
  }

  async function resetDevice(managerUid: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/reset-device`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to reset device.");
      }
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset device.");
    }
  }

  function toggleExpanded(managerUid: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [managerUid]: !prev[managerUid],
    }));
  }

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h2 className="text-lg font-semibold text-slate-900">Managers</h2>
      <p className="mt-1 text-sm text-slate-600">
        Search managers, activate/deactivate, reset password and reset device lock.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search manager"
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => void loadManagers()}
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
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  Loading managers...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No managers found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.uid}>
                  <tr key={`${row.uid}-summary`} className="border-t border-slate-100/80 align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="font-mono text-xs text-slate-600">
                        ID: {displayManagerId(row)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <p className="break-all">{row.email}</p>
                      <p>{row.phone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold">
                        {row.managerStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpanded(row.uid)}
                        className="w-full whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        {expandedRows[row.uid] ? "Close" : "Open"}
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.uid] ? (
                    <tr key={`${row.uid}-details`} className="border-t border-slate-100/80 bg-white">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              void toggleStatus(
                                row.uid,
                                row.managerStatus === "active" ? "inactive" : "active"
                              )
                            }
                            className="whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                          >
                            {row.managerStatus === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => void resetPassword(row.uid)}
                            className="whitespace-nowrap rounded-xl bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                          >
                            Reset password
                          </button>
                          <button
                            onClick={() => void resetDevice(row.uid)}
                            className="whitespace-nowrap rounded-xl bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                          >
                            Reset device
                          </button>
                        </div>
                        {passwordResult[row.uid] ? (
                          <p className="mt-3 text-xs font-semibold text-emerald-700">
                            Temp password copied
                          </p>
                        ) : null}
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
