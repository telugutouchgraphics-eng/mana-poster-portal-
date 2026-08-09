"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface First150Config {
  exists: boolean;
  enabled: boolean;
  limit: number;
  usedCount: number;
  days: number;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  updatedByEmail: string;
}

interface First150Response {
  ok: boolean;
  config?: First150Config;
  error?: string;
}

const defaultConfig: First150Config = {
  exists: false,
  enabled: false,
  limit: 150,
  usedCount: 0,
  days: 30,
  startsAt: "",
  endsAt: "",
  updatedAt: "",
  updatedByEmail: "",
};

export default function First150TrialPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<First150Config>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetUsedCount, setResetUsedCount] = useState(false);
  const [message, setMessage] = useState("");

  const loadConfig = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/first150-trial", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as First150Response;
      if (!response.ok || !data.ok || !data.config) {
        throw new Error(data.error ?? "Unable to load promo config.");
      }
      setConfig(data.config);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load promo config.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function saveConfig() {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/first150-trial", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: config.enabled,
          limit: config.limit,
          days: config.days,
          startsAt: config.startsAt,
          endsAt: config.endsAt,
          resetUsedCount,
        }),
      });
      const data = (await response.json()) as First150Response;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save promo config.");
      }
      setResetUsedCount(false);
      setMessage("Free trial promo config saved.");
      await loadConfig();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save promo config.");
    } finally {
      setSaving(false);
    }
  }

  const remaining = Math.max(0, Number(config.limit || 0) - Number(config.usedCount || 0));

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">
          Subscription Promo
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-950">First 150 Free Trial</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Control the free premium trial campaign from one place. New eligible users get premium access only when this promo is enabled, inside the date window, and under the claim limit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Used claims" value={config.usedCount} />
        <MetricCard label="Claim limit" value={config.limit} />
        <MetricCard label="Remaining" value={remaining} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Campaign Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Use start/end dates for the campaign window. Validity days controls how long each claimed user gets access.
            </p>
          </div>
          <label className="flex items-center gap-3 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-800">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => setConfig((current) => ({ ...current, enabled: event.target.checked }))}
              className="h-5 w-5 accent-emerald-600"
            />
            Promo enabled
          </label>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Field label="Claim limit">
            <input
              type="number"
              min={1}
              max={10000}
              value={config.limit}
              onChange={(event) => setConfig((current) => ({ ...current, limit: Number(event.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </Field>
          <Field label="Validity days per user">
            <input
              type="number"
              min={1}
              max={365}
              value={config.days}
              onChange={(event) => setConfig((current) => ({ ...current, days: Number(event.target.value) }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </Field>
          <Field label="Start date">
            <input
              type="date"
              value={config.startsAt}
              onChange={(event) => setConfig((current) => ({ ...current, startsAt: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              value={config.endsAt}
              onChange={(event) => setConfig((current) => ({ ...current, endsAt: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
            />
          </Field>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={resetUsedCount}
            onChange={(event) => setResetUsedCount(event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-amber-600"
          />
          <span>
            <strong>Reset used claims to 0.</strong> Use this only when starting a fresh campaign. Existing claimed users are not removed.
          </span>
        </label>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {config.updatedAt ? `Last updated: ${new Date(config.updatedAt).toLocaleString()}` : "Not saved yet"}
            {config.updatedByEmail ? ` by ${config.updatedByEmail}` : ""}
          </div>
          <button
            type="button"
            onClick={() => void saveConfig()}
            disabled={saving || loading}
            className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? "Saving..." : "Save Promo"}
          </button>
        </div>
        {message ? <p className="mt-4 text-sm font-bold text-slate-700">{message}</p> : null}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-800">{label}</span>
      {children}
    </label>
  );
}
