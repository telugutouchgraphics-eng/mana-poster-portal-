import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen w-full px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[36px] border border-[var(--portal-border)] bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:p-12">
        <div className="max-w-4xl">
          <div className="flex items-center gap-4">
            <div className="overflow-hidden rounded-[22px] border border-[var(--portal-border)] bg-white p-2">
              <Image
                src="/mana-poster-logo.png"
                alt="Mana Poster"
                width={60}
                height={60}
                className="h-[52px] w-[52px] object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--portal-purple)]">
                Mana Poster Portal
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                Admin, manager, creator access
              </p>
            </div>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
            Mana Poster app content, creators, and approvals ni manage cheyadaniki single portal.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
            Creator access, poster approvals, payouts, competitions, banners, and app content ni daily operations lo handle cheyyadaniki ee portal use avuthundi.
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
            <p className="text-sm font-semibold text-slate-900">Admin control</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Managers, creators, payouts, banners, and approvals anni admin side nundi control cheyyachu.
            </p>
          </article>
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">Manager workflow</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Creator invite, category assign, review, and approval work manager dashboard nundi smooth ga handle cheyyachu.
            </p>
          </article>
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-5">
            <p className="text-sm font-semibold text-slate-900">Creator uploads</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Creator posters upload ayyi, review complete ayyaka app lo publish ayye flow ki portal direct ga connect ayyindi.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
