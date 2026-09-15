"use client";

export default function EditorAssetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-lg border border-rose-200 bg-white p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">
        Editor assets error
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">
        Assets page failed to load.
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {error.message || "Unexpected error."}
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-slate-400">Ref: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-5 rounded-lg bg-[var(--portal-purple)] px-4 py-2 text-sm font-bold text-white"
      >
        Try again
      </button>
    </section>
  );
}
