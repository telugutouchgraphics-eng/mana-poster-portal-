import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[36px] border border-[var(--portal-border)] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:p-12">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--portal-purple)]">
            Mana Poster Portal
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
            Admin, manager, and creator teams kosam complete operations dashboard.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Creator access, poster approvals, payouts, competitions, banners, and platform content ni easy ga manage cheyyadaniki ee portal use avuthundi.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/login"
            className="rounded-[24px] bg-[var(--portal-purple)] px-6 py-4 text-center text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
          >
            Open Login
          </Link>
          <Link
            href="/admin/dashboard"
            className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-6 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
          >
            Admin Dashboard
          </Link>
          <Link
            href="/manager/dashboard"
            className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-6 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
          >
            Manager Dashboard
          </Link>
          <Link
            href="/login?as=creator&next=%2Fcreator%2Fdashboard"
            className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-6 py-4 text-center text-sm font-semibold text-slate-800 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
          >
            Creator Login
          </Link>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">Full control</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Admin nundi platform-wide actions, manager nundi creator workflow, creator nundi upload flow clear ga handle cheyyachu.
            </p>
          </article>
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">App-connected workflow</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              App lo visible ayye creator posters, categories, and future content slots ki portal side management ready ga untundi.
            </p>
          </article>
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">Launch-ready roles</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Separate dashboards, clear side navigation, and role-based access with better day-to-day usability.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
