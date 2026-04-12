"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface PayoutRow {
  id: string;
  creatorPublicId: string;
  amount: number;
  status: string;
  note: string;
  createdAt: number;
}

function formatDate(epochMs: number) {
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminPayoutsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const token = await user?.getIdToken();
      if (!token) return;
      const response = await fetch(
        `/api/admin/payouts?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        payouts?: PayoutRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.payouts) {
        throw new Error(data.error ?? "Unable to load payouts.");
      }
      setRows(data.payouts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payouts.");
    }
  }, [query, status, user]);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load]);

  const totalPaid = useMemo(
    () => rows.reduce((sum, item) => sum + item.amount, 0),
    [rows],
  );

  async function exportCsv() {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch(
      `/api/admin/payouts?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&format=csv`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creator-payouts.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Payout Reports</h3>
            <p className="mt-2 text-sm text-slate-600">
              Creator payout history, filters, and CSV export.
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-900">
            Total shown paid: Rs.{totalPaid}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_180px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creator ID / note"
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
          </select>
          <button
            onClick={() => void exportCsv()}
            className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
          >
            Export CSV
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Payout records levu.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                      {item.creatorPublicId}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">Rs.{item.amount}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3 text-slate-600">{item.note || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
