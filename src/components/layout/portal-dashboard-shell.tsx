"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { DashboardAutoTranslate } from "@/components/i18n/dashboard-auto-translate";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";

const BRAND_TAGLINE_EN = "Your Daily Telugu Poster App";
const BRAND_TAGLINE_TE = "మీ దైనందిన తెలుగు పోస్టర్ యాప్";

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
  welcomeName?: string | null;
  navItems: DashboardNavItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export function PortalDashboardShell({
  badge,
  title,
  description,
  welcomeName,
  navItems,
  actions,
  children,
}: PortalDashboardShellProps) {
  const pathname = usePathname();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const brandTagline = isTelugu ? BRAND_TAGLINE_TE : BRAND_TAGLINE_EN;
  const menuLabel = isTelugu ? "మెనూ" : "Menu";
  const openNavLabel = isTelugu ? "నావిగేషన్ మెనూ తెరవండి" : "Open navigation menu";
  const closeNavLabel = isTelugu ? "నావిగేషన్ మెనూ మూసివేయండి" : "Close navigation menu";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeHref =
    navItems
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <DashboardAutoTranslate>
      <main className="min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(109,40,217,0.10),transparent_34%),radial-gradient(circle_at_top_right,rgba(37,211,102,0.08),transparent_28%)] px-3 py-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="grid min-h-[calc(100vh-1.5rem)] gap-4 lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-6">
          {mobileNavOpen ? (
            <button
              type="button"
              aria-label={closeNavLabel}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
            />
          ) : null}

          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[min(88vw,340px)] -translate-x-full transition-transform duration-200 lg:static lg:sticky lg:top-4 lg:z-auto lg:h-[calc(100vh-2rem)] lg:w-auto lg:translate-x-0 ${
              mobileNavOpen ? "translate-x-0" : ""
            }`}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-r-[30px] border border-[var(--portal-border)] bg-white/96 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur lg:rounded-[30px] lg:shadow-sm">
              <div className="px-4 py-4 sm:px-4 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white p-1 shadow-sm">
                      <Image
                        src="/mana-poster-logo.png"
                        alt="Mana Poster Ai"
                        width={42}
                        height={42}
                        className="h-10 w-10 object-contain"
                        priority
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black uppercase tracking-[0.28em] text-[var(--portal-purple)]">
                        {badge}
                      </p>
                      <p className="mt-1 truncate text-sm font-black text-slate-950">
                        Mana Poster Ai
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {brandTagline}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={closeNavLabel}
                    onClick={() => setMobileNavOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white text-lg font-semibold text-slate-700 shadow-sm lg:hidden"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
                <h1 className="mt-4 break-words text-xl font-black leading-tight text-slate-950 sm:text-2xl">
                  {title}
                </h1>
              </div>

              <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
                {navItems.map((item) => {
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group block rounded-2xl border px-3 py-3 transition ${
                        active
                          ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white shadow-[0_10px_24px_rgba(109,40,217,0.20)]"
                          : "border-transparent text-slate-700 hover:border-[var(--portal-border)] hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-2.5 w-2.5 flex-none rounded-full transition ${
                            active
                              ? "bg-white"
                              : "bg-slate-300 group-hover:bg-slate-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold leading-5">
                            {item.label}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0 overflow-x-hidden">
            <header className="rounded-[28px] border border-[var(--portal-border)] bg-white/92 px-4 py-4 shadow-sm backdrop-blur sm:px-5 sm:py-5">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                <button
                  type="button"
                  aria-label={openNavLabel}
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen(true)}
                  className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ☰
                  </span>
                  <span>{menuLabel}</span>
                </button>
                <p className="max-w-[45vw] truncate text-right text-sm font-semibold text-slate-600">
                  {badge}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[var(--portal-purple)]">
                    {badge}
                  </p>
                  <h2
                    data-no-auto-translate={welcomeName ? "true" : undefined}
                    className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 sm:text-3xl"
                  >
                    {welcomeName ? welcomeName : title}
                  </h2>
                  <p className="mt-2 break-words text-base font-bold text-slate-800 sm:text-lg">
                    {title}
                  </p>
                  {description ? (
                    <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  ) : null}
                </div>
                {actions ? (
                  <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
              <nav className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                {navItems.map((item) => {
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`min-h-10 min-w-max rounded-full border px-3 py-2 text-xs font-bold transition ${
                        active
                          ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                          : "border-[var(--portal-border)] bg-white text-slate-700"
                      }`}
                    >
                      {item.shortLabel ?? item.label}
                    </Link>
                  );
                })}
              </nav>
            </header>

            <div className="mt-5 space-y-5 pb-6 sm:mt-6 sm:space-y-6">
              {children}
            </div>
          </section>
        </div>
      </main>
    </DashboardAutoTranslate>
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
    <article className="rounded-[24px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${badgeMap[tone]}`}
        >
          {label.slice(0, 1)}
        </span>
      </div>
      <p className={`mt-3 break-words text-3xl font-black ${toneMap[tone]}`}>
        {value}
      </p>
      <p className="mt-2 break-words text-sm text-slate-600">{hint}</p>
    </article>
  );
}
