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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const token =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") ?? ""
      : "";
  const canSubmit = useMemo(() => token.length > 10 && password.length >= 8, [token, password]);

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
      <section className="w-full rounded-3xl border border-amber-200 bg-[var(--surface)] p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
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
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-600"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Create password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
            />
          </label>
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
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
