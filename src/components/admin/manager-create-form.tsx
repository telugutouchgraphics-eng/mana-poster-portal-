"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface ManagerCreateResponse {
  ok: boolean;
  error?: string;
  managerUid?: string;
  managerPublicId?: string;
  email?: string;
  name?: string;
}

export function ManagerCreateForm() {
  const { user } = useAuth();
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ManagerCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleManagerCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const response = await fetch("/api/admin/managers/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: managerName.trim(),
          email: managerEmail.trim(),
          phone: managerPhone.trim(),
          password: managerPassword,
        }),
      });
      const data = (await response.json()) as ManagerCreateResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Manager creation failed.");
      }
      setResult(data);
      setManagerName("");
      setManagerEmail("");
      setManagerPhone("");
      setManagerPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Manager creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h3 className="text-xl font-bold text-slate-950">Create Manager Access</h3>
      <p className="mt-2 text-sm text-slate-600">
        Admin permanent ga manager account create chesi operations access ivvachu.
      </p>
      <form onSubmit={handleManagerCreate} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input
          placeholder="Manager name"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder="Manager email"
          type="email"
          value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder="Manager phone"
          value={managerPhone}
          onChange={(e) => setManagerPhone(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder="Temporary password"
          type="password"
          value={managerPassword}
          onChange={(e) => setManagerPassword(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="md:col-span-2 xl:col-span-4 rounded-2xl bg-[var(--portal-purple)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60"
        >
          {busy ? "Creating manager..." : "Create Manager"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result?.ok && result.email ? (
        <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm shadow-sm">
          <p className="font-semibold text-emerald-900">Manager ready: {result.name}</p>
          <p className="mt-1 text-emerald-800">Manager ID: {result.managerPublicId ?? "-"}</p>
          <p className="mt-1 text-emerald-800">Login email: {result.email}</p>
        </div>
      ) : null}
    </section>
  );
}
