"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { getOrCreateDeviceId } from "@/lib/client/device-id";

async function registerDevice(idToken: string) {
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
  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    role?: string;
    roles?: string[];
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Device lock failed.");
  }
  return {
    role: data.role ?? "user",
    roles: Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [data.role ?? "user"],
  };
}

async function logoutDevice(idToken: string) {
  await fetch("/api/auth/logout-device", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
    }),
  });
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const firebaseReady = isFirebaseClientConfigured() || process.env.NODE_ENV === "production";
  const requiredRole = (searchParams.get("as") ?? "").trim();
  const nextPath = (searchParams.get("next") ?? "").trim();

  const canSubmit = useMemo(
    () => firebaseReady && email.trim().length > 3 && password.trim().length >= 8 && !busy,
    [email, password, busy, firebaseReady],
  );

  async function finishLogin() {
    const auth = getClientAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error("Login succeeded but token is missing.");
    }
    const authResult = await registerDevice(idToken);
    const role = authResult.role;
    const roles = authResult.roles;

    if (requiredRole.length > 0 && !roles.includes(requiredRole)) {
      await logoutDevice(idToken);
      await firebaseSignOut(auth);
      throw new Error(`Please login with ${requiredRole} account. Current account roles: ${roles.join(", ")}.`);
    }

    if (nextPath.startsWith("/")) {
      router.replace(nextPath);
      return;
    }

    if (role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    if (role === "manager") {
      router.replace("/manager/dashboard");
      return;
    }
    if (role === "creator") {
      router.replace("/creator/dashboard");
      return;
    }
    router.replace("/");
  }

  async function handleEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishLogin();
    } catch (err) {
      try {
        await firebaseSignOut(getClientAuth());
      } catch {}
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError(null);
    try {
      const auth = getClientAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
      await finishLogin();
    } catch (err) {
      try {
        await firebaseSignOut(getClientAuth());
      } catch {}
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid w-full overflow-hidden rounded-[36px] border border-[var(--portal-border)] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)] lg:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="bg-[var(--portal-purple)] px-8 py-10 text-white md:px-10 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-violet-100">
            Mana Poster
          </p>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-5xl">
            Secure login for admin, manager, and creator dashboards.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-violet-100/92 md:text-base">
            Role-based access, creator device control, and production-ready dashboard entry flow ikkada nundi handle avuthundi.
          </p>

          <div className="mt-8 space-y-3">
            <div className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4">
              <p className="text-sm font-semibold">Role-based access</p>
              <p className="mt-1 text-sm text-violet-100/90">
                Admin, manager, and creator ki vallaki assign ayina view maatrame open avuthundi.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4">
              <p className="text-sm font-semibold">Creator security</p>
              <p className="mt-1 text-sm text-violet-100/90">
                Creator accounts can stay restricted to one active device session.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-10 md:px-10 md:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
            Sign In
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950">Login to continue</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Assigned access unna email leda Google account tho login avvandi.
          </p>

          {!firebaseReady && process.env.NODE_ENV !== "production" ? (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Firebase config missing. Fill `.env.local` before login.
            </p>
          ) : null}

          <form onSubmit={handleEmailLogin} className="mt-7 space-y-4">
            <label className="block text-sm font-semibold text-slate-800">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none ring-0 transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>
            <button
              disabled={!canSubmit}
              type="submit"
              className="w-full rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Login with Email"}
            </button>
          </form>

          <div className="my-6 h-px bg-slate-200" />
          <button
            disabled={busy || !firebaseReady}
            onClick={handleGoogleLogin}
            className="w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Please wait..." : "Continue with Google"}
          </button>

          {error ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center px-6 py-12">
          <section className="w-full rounded-[28px] border border-[var(--portal-border)] bg-white p-7 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-600">Loading login...</p>
          </section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
