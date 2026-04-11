"use client";

import { useCallback, useEffect, useState } from "react";
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

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Managers</h2>
      <p className="mt-1 text-sm text-slate-600">
        Search managers, activate/deactivate, reset password and reset device lock.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search manager"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => void loadManagers()}
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
              <th className="w-[34%] px-3 py-3">Manager</th>
              <th className="w-[28%] px-3 py-3">Contact</th>
              <th className="w-[12%] px-3 py-3">Status</th>
              <th className="w-[26%] px-3 py-3">Actions</th>
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
                <tr key={row.uid} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="font-mono text-xs text-slate-600">
                      ID: {displayManagerId(row)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    <p className="break-all">{row.email}</p>
                    <p>{row.phone}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                      {row.managerStatus}
                    </span>
                    {passwordResult[row.uid] ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        Temp password copied
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() =>
                          void toggleStatus(
                            row.uid,
                            row.managerStatus === "active" ? "inactive" : "active"
                          )
                        }
                        className="w-full whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        {row.managerStatus === "active" ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => void resetPassword(row.uid)}
                        className="w-full whitespace-nowrap rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => void resetDevice(row.uid)}
                        className="w-full whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Reset device
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
