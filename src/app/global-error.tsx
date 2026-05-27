"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--portal-bg)] text-[var(--portal-text)]">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <section className="w-full max-w-lg rounded-[28px] bg-white p-6 sm:p-8">
            <div className="mb-5 h-2 w-full rounded-full bg-[linear-gradient(90deg,#8b5cf6_0%,#ec4899_45%,#f59e0b_100%)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--portal-muted)]">
              Something went wrong
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              We hit an unexpected error.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The page did not load as expected. You can retry now or go back to login.
            </p>
            {error.digest ? (
              <p className="mt-3 text-xs text-slate-400">Ref: {error.digest}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-full bg-[var(--portal-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
              >
                Try again
              </button>
              <Link
                href="/login"
                className="rounded-full border border-[var(--portal-border-strong)] px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Go to login
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
