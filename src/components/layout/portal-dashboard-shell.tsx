"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { DashboardAutoTranslate } from "@/components/i18n/dashboard-auto-translate";
import { DashboardRegionSelect } from "@/components/regions/dashboard-region-select";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";

const BRAND_TAGLINE_EN = "Your Daily Telugu Poster App";

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
  const { region } = useDashboardRegion();
  const brandTagline = BRAND_TAGLINE_EN;
  const menuLabel = "Menu";
  const openNavLabel = "Open navigation menu";
  const closeNavLabel = "Close navigation menu";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeHref =
    navItems
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  const activeItem = navItems.find((item) => item.href === activeHref);

  function navIcon(label: string) {
    const normalized = label.toLowerCase();
    if (normalized.includes("overview")) return "OV";
    if (normalized.includes("upload") || normalized.includes("poster") || normalized.includes("spot")) return "UP";
    if (normalized.includes("manager")) return "MG";
    if (normalized.includes("creator")) return "CR";
    if (normalized.includes("report")) return "RP";
    if (normalized.includes("banner")) return "BN";
    if (normalized.includes("event") || normalized.includes("category")) return "EV";
    if (normalized.includes("performance")) return "PF";
    if (normalized.includes("earning") || normalized.includes("payout")) return "₹";
    if (normalized.includes("setting")) return "ST";
    return label.slice(0, 2).toUpperCase();
  }

  return (
    <DashboardAutoTranslate>
      <main className="portal-dashboard-root min-h-screen w-full overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.11),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] px-3 py-3 sm:px-4 lg:px-6 xl:px-8">
        <div className="portal-dashboard-frame grid min-h-[calc(100vh-1.5rem)] gap-4 lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">
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
            <div className="flex h-full flex-col overflow-hidden rounded-r-[30px] border border-white/80 bg-white/95 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:rounded-[30px] lg:shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-100 px-4 py-4 sm:px-4 sm:py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
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
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    Viewing
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-emerald-950">
                    {region.name}
                  </p>
                </div>
              </div>

              <nav className="portal-sidebar-scroll flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
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
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.22)]"
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-2xl text-[11px] font-black transition ${
                            active
                              ? "bg-white text-slate-950"
                              : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-900"
                          }`}
                        >
                          {navIcon(item.label)}
                        </span>
                        <div className="min-w-0">
                          <p className={`break-words text-sm font-bold leading-5 ${active ? "text-white" : "text-slate-700 group-hover:text-slate-950"}`}>
                            {item.label}
                          </p>
                          {item.hint ? (
                            <p className={active ? "mt-0.5 text-xs font-semibold text-white/80" : "mt-0.5 text-xs text-slate-500"}>
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

          <section className="mx-auto w-full max-w-[1440px] min-w-0 overflow-x-hidden">
            <header className="portal-dashboard-header sticky top-3 z-30 rounded-[28px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5 sm:py-5">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                <button
                  type="button"
                  aria-label={openNavLabel}
                  aria-expanded={mobileNavOpen}
                  onClick={() => setMobileNavOpen(true)}
                  className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm"
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ☰
                  </span>
                  <span>{menuLabel}</span>
                </button>
                <p className="max-w-[45vw] truncate text-right text-sm font-bold text-slate-700">
                  {activeItem?.shortLabel ?? activeItem?.label ?? badge}
                </p>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[var(--portal-purple)]">
                    {badge} / {region.name}
                  </p>
                  <h2
                    data-no-auto-translate={welcomeName ? "true" : undefined}
                    className="mt-2 break-words text-2xl font-black leading-tight text-slate-950 sm:text-3xl"
                  >
                    {welcomeName ? welcomeName : title}
                  </h2>
                  <p className="mt-2 break-words text-base font-bold text-slate-800 sm:text-lg">
                    {activeItem?.label ?? title}
                  </p>
                  {description ? (
                    <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  ) : null}
                </div>
                {actions ? (
                  <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                    <DashboardRegionSelect />
                    {actions}
                  </div>
                ) : null}
              </div>
              <nav className="portal-mobile-top-nav -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
                {navItems.map((item) => {
                  const active = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`portal-mobile-top-nav-link min-h-10 min-w-max rounded-full border px-3 py-2 text-xs font-black transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-950 bg-slate-900 text-white hover:bg-slate-950"
                      }`}
                    >
                      {item.shortLabel ?? item.label}
                    </Link>
                  );
                })}
              </nav>
            </header>

            <div
              key={region.id}
              className="portal-dashboard-content mt-5 space-y-5 pb-6 sm:mt-6 sm:space-y-6"
            >
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
    <article className="rounded-[24px] border border-white/80 bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.10)]">
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
