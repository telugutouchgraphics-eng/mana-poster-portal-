"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { getOrCreateDeviceId } from "@/lib/client/device-id";

interface ActivationResponse {
  ok: boolean;
  error?: string;
  email?: string;
  creatorPublicId?: string;
}

export default function CreatorAccessPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") ?? ""
      : "";
  const canSubmit = useMemo(() => token.length > 10 && password.length >= 6, [token, password]);

  async function registerDevice() {
    const auth = getClientAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error("Missing auth token.");
    }
    const response = await fetch("/api/auth/register-device", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        deviceId: getOrCreateDeviceId(),
        platform: "web",
      }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Device registration failed.");
    }
  }

  async function onActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/creator/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as ActivationResponse;
      if (!response.ok || !data.ok || !data.email) {
        throw new Error(data.error ?? "Activation failed.");
      }

      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, data.email, password);
      await registerDevice();
      setDone(`Creator account activated. ID: ${data.creatorPublicId}`);
      router.replace("/creator/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-[var(--portal-border)] bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--portal-purple)]">
          Creator Access
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Activate account</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set password once. After activation, same account works only on one
          device at a time.
        </p>
        <form onSubmit={onActivate} className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Access token
            <input
              value={token}
              readOnly
              className="mt-1 w-full rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2.5 text-xs text-slate-600"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Create password
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                required
                className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 pr-12 text-sm outline-none transition focus:border-[var(--portal-border-strong)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.4 5.5A10.7 10.7 0 0 1 12 5c5 0 9.3 3 11 7-1 2.1-2.6 3.8-4.5 5" />
                    <path d="M6.2 6.2C4.3 7.5 2.8 9.4 2 12c1.7 4 6 7 10 7 1.6 0 3.1-.4 4.5-1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full rounded-xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Activating..." : "Activate & Login"}
          </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {done}
          </p>
        ) : null}
      </section>
    </main>
  );
}
