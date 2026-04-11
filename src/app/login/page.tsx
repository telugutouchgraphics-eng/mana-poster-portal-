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
  const firebaseReady = isFirebaseClientConfigured();
  const requiredRole = (searchParams.get("as") ?? "").trim();
  const nextPath = (searchParams.get("next") ?? "").trim();

  const canSubmit = useMemo(
    () => firebaseReady && email.trim().length > 3 && password.trim().length >= 8 && !busy,
    [email, password, busy, firebaseReady]
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
      throw new Error(
        `Please login with ${requiredRole} account. Current account roles: ${roles.join(", ")}.`
      );
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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-amber-200 bg-[var(--surface)] p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
          Mana Poster
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Portal Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Single-device policy is enabled for creator accounts.
        </p>
        {!firebaseReady ? (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Firebase config missing. Fill `.env.local` before login.
          </p>
        ) : null}

        <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
            />
          </label>
          <button
            disabled={!canSubmit}
            type="submit"
            className="w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            {busy ? "Signing in..." : "Login with Email"}
          </button>
        </form>

        <div className="my-5 h-px bg-slate-200" />
        <button
          disabled={busy || !firebaseReady}
          onClick={handleGoogleLogin}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Please wait..." : "Continue with Google"}
        </button>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
          <section className="w-full rounded-3xl border border-amber-200 bg-[var(--surface)] p-7 shadow-sm">
            <p className="text-sm text-slate-600">Loading login...</p>
          </section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
