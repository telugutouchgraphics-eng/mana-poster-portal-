"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface AuditLogRow {
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

function formatDate(epochMs: number) {
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await user?.getIdToken();
      if (!token) return;
      const response = await fetch(
        `/api/admin/audit-logs?q=${encodeURIComponent(query)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        logs?: AuditLogRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.logs) {
        throw new Error(data.error ?? "Unable to load audit logs.");
      }
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit logs.");
    }
  }, [query, user]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-950">Audit Logs</h3>
          <p className="mt-2 text-sm text-slate-600">
            Sensitive admin and manager actions trace cheyyadaniki.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Refresh
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search actor / action / target"
        className="mt-5 w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 text-sm"
      />

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
        <table className="w-full text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit logs yet.
                </td>
              </tr>
            ) : (
              logs.map((item) => (
                <tr key={item.id} className="border-t border-slate-100/80">
                  <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-slate-900">{item.actorRole}</p>
                    <p className="font-mono text-[11px] text-slate-500">{item.actorEmail || item.actorUid}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{item.action}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-slate-700">{item.targetType}</p>
                    <p className="font-mono text-[11px] text-slate-500">{item.targetId}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
