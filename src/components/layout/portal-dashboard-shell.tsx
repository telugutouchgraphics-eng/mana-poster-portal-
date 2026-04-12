"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface DashboardNavItem {
  href: string;
  label: string;
  hint?: string;
  shortLabel?: string;
}

interface PortalDashboardShellProps {
  badge: string;
  title: string;
  description: string;
  navItems: DashboardNavItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export function PortalDashboardShell({
  badge,
  title,
  description,
  navItems,
  actions,
  children,
}: PortalDashboardShellProps) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen w-full px-3 py-4 sm:px-5 lg:px-6 xl:px-8">
      <div className="grid min-h-[calc(100vh-2rem)] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-purple)] text-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <div className="border-b border-white/12 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="overflow-hidden rounded-2xl bg-white p-1.5">
                  <Image
                    src="/mana-poster-logo.png"
                    alt="Mana Poster"
                    width={42}
                    height={42}
                    className="h-10 w-10 object-contain"
                    priority
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-100">
                    {badge}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white/92">Mana Poster</p>
                </div>
              </div>
              <h1 className="mt-3 text-2xl font-bold leading-tight">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-violet-100/90">{description}</p>
            </div>

            <nav className="hidden flex-1 space-y-2 overflow-y-auto px-4 py-4 lg:block">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (pathname.startsWith(`${item.href}/`) && item.href !== "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group block rounded-2xl border px-4 py-3 transition ${
                      active
                        ? "border-white bg-white text-slate-900"
                        : "border-white/12 bg-transparent text-white/92 hover:border-white/24 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 flex-none rounded-full transition ${
                          active ? "bg-[var(--portal-green)]" : "bg-white/45 group-hover:bg-white/70"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{item.label}</p>
                        {item.hint ? (
                          <p
                            className={`mt-1 text-xs leading-5 ${
                              active ? "text-slate-600" : "text-violet-100/78"
                            }`}
                          >
                            {item.hint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="-mt-1 mb-4 overflow-x-auto lg:hidden">
            <div className="flex min-w-max gap-2 pb-2">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (pathname.startsWith(`${item.href}/`) && item.href !== "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                        : "border-[var(--portal-border)] bg-white text-slate-700"
                    }`}
                  >
                    {item.shortLabel ?? item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <header className="rounded-[28px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--portal-purple)]">
                  {badge}
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
              </div>
              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </header>

          <div className="mt-6 space-y-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

export function DashboardStatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneMap = {
    default: "text-slate-950",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
  } as const;

  const badgeMap = {
    default: "bg-violet-100 text-violet-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
  } as const;

  return (
    <article className="rounded-[24px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl text-sm font-bold ${badgeMap[tone]}`}>
          {label.slice(0, 1)}
        </span>
      </div>
      <p className={`mt-3 text-3xl font-bold ${toneMap[tone]}`}>{value}</p>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
    </article>
  );
}
