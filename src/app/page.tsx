import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12">
      <header className="rounded-3xl border border-amber-200 bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
          Mana Poster Web
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          Creator Access Control + Invite Login Foundation
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-600 md:text-base">
          This portal now supports manager-created creator access, secure unique
          Creator IDs, one-time activation links, and single-device login policy.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Open Login
          </Link>
          <Link
            href="/admin/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Admin Dashboard
          </Link>
          <Link
            href="/manager/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Manager Dashboard
          </Link>
          <Link
            href="/login?as=creator&next=%2Fcreator%2Fdashboard"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Creator Dashboard (Creator Login)
          </Link>
        </div>
      </header>
    </main>
  );
}
