"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import { DashboardAutoTranslate } from "@/components/i18n/dashboard-auto-translate";
import { DashboardRegionSelect } from "@/components/regions/dashboard-region-select";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";

export interface DashboardNavItem {
  href: string;
  label: string;
  group?: string;
  icon?: string;
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

function NavIcon({ name, label }: { name?: string; label: string }) {
  const key = (name || label).toLowerCase();

  // 📊 Overview & Analytics
  if (key.includes("overview")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1.5" />
        <rect width="7" height="5" x="14" y="3" rx="1.5" />
        <rect width="7" height="9" x="14" y="12" rx="1.5" />
        <rect width="7" height="5" x="3" y="16" rx="1.5" />
      </svg>
    );
  }
  if (key.includes("insight") || key.includes("location") || key.includes("trend")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  if (key.includes("report")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    );
  }
  if (key.includes("download") || key.includes("share")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    );
  }
  if (key.includes("audit") || key.includes("log") || key.includes("history")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }

  // 📅 Events & Categories
  if (key.includes("date") || key.includes("calendar")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    );
  }
  if (key.includes("event") || key.includes("category")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
        <circle cx="7" cy="7" r=".75" fill="currentColor" />
      </svg>
    );
  }
  if (key.includes("folder") || key.includes("permanent")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      </svg>
    );
  }

  // 🎨 Posters & Assets
  if (key.includes("clock") || key.includes("scheduled")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (key.includes("upload")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m16 16-4-4-4 4" />
      </svg>
    );
  }
  if (key.includes("protocol") || key.includes("photo") || key.includes("poster")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  }
  if (key.includes("asset") || key.includes("palette")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".75" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r=".75" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r=".75" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r=".75" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
      </svg>
    );
  }
  if (key.includes("font")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" x2="15" y1="20" y2="20" />
        <line x1="12" x2="12" y1="4" y2="20" />
      </svg>
    );
  }

  // 👥 Team & Creators
  if (key.includes("manager") || key.includes("shield")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (key.includes("creator") || key.includes("user")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (key.includes("competition") || key.includes("contest") || key.includes("trophy")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    );
  }
  if (key.includes("payout") || key.includes("earning") || key.includes("currency") || key.includes("₹")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" x2="18" y1="4" y2="4" />
        <line x1="6" x2="18" y1="9" y2="9" />
        <path d="M6 14h5a4 4 0 0 0 0-8" />
        <path d="m10 14 6 6" />
      </svg>
    );
  }

  // 📢 Marketing & Growth
  if (key.includes("banner")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" x2="4" y1="22" y2="15" />
      </svg>
    );
  }
  if (key.includes("push") || key.includes("bell") || key.includes("notification")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    );
  }
  if (key.includes("announcement") || key.includes("megaphone")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    );
  }
  if (key.includes("trial") || key.includes("gift") || key.includes("promo")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect width="20" height="5" x="2" y="7" />
        <line x1="12" x2="12" y1="22" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    );
  }
  if (key.includes("survey") || key.includes("clipboard")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    );
  }

  // ⚙️ Settings & System
  if (key.includes("access") || key.includes("key") || key.includes("security")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m21 2-9.6 9.6" />
        <path d="m15.5 7.5 3 3L22 7l-3-3" />
      </svg>
    );
  }
  if (key.includes("setting")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="20" y1="21" y2="21" />
        <line x1="4" x2="20" y1="14" y2="14" />
        <line x1="4" x2="20" y1="7" y2="7" />
        <circle cx="8" cy="21" r="2" />
        <circle cx="16" cy="14" r="2" />
        <circle cx="10" cy="7" r="2" />
      </svg>
    );
  }

  // Fallback icon
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const homeHref = badge.toLowerCase().includes("manager")
    ? "/manager/dashboard/overview"
    : badge.toLowerCase().includes("creator")
      ? "/creator/dashboard/overview"
      : "/admin/dashboard/overview";

  const activeHref =
    navItems
      .filter(
        (item) =>
          pathname === item.href ||
          (item.href !== "/" && pathname.startsWith(`${item.href}/`)),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
  const activeItem = navItems.find((item) => item.href === activeHref);

  // Grouped Navigation Filter
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint && item.hint.toLowerCase().includes(q)) ||
        (item.group && item.group.toLowerCase().includes(q)) ||
        (item.shortLabel && item.shortLabel.toLowerCase().includes(q)),
    );
  }, [navItems, searchQuery]);

  // Group mapping
  const groupedSections = useMemo(() => {
    const map = new Map<string, DashboardNavItem[]>();
    for (const item of filteredItems) {
      const g = item.group || "General";
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(item);
    }
    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
    }));
  }, [filteredItems]);

  return (
    <DashboardAutoTranslate>
      <main className="portal-dashboard-root min-h-screen w-full bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#090d16] dark:text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-[1720px]">
          {/* Mobile Overlay */}
          {mobileNavOpen ? (
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
            />
          ) : null}

          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 ease-in-out dark:border-slate-800/80 dark:bg-[#0f172a] lg:static lg:h-screen lg:translate-x-0 ${
              mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Sidebar Header */}
            <div className="flex flex-col border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={homeHref}
                  className="flex items-center gap-3 transition hover:opacity-85"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                    <Image
                      src="/mana-poster-logo.png"
                      alt="Mana Poster"
                      width={36}
                      height={36}
                      className="h-8 w-8 object-contain"
                      priority
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-black tracking-tight text-slate-900 dark:text-white">
                        Mana Poster
                      </span>
                      <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                        {badge}
                      </span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Console Management
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                >
                  ✕
                </button>
              </div>

              {/* Instant Search in Sidebar */}
              <div className="relative mt-3.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" x2="16.65" y1="21" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick find..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-1.5 pr-7 pl-8 text-xs font-medium text-slate-800 placeholder-slate-400 outline-hidden transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:border-indigo-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            {/* Navigation Sections */}
            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3 text-xs font-medium">
              {groupedSections.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-500">
                  No matching sections found.
                </div>
              ) : (
                groupedSections.map((sec) => (
                  <div key={sec.name} className="space-y-1">
                    {groupedSections.length > 1 || sec.name !== "General" ? (
                      <div className="px-2 pt-1 pb-1">
                        <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                          {sec.name}
                        </span>
                      </div>
                    ) : null}
                    {sec.items.map((item) => {
                      const active = activeHref === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150 ${
                            active
                              ? "bg-indigo-600 font-semibold text-white shadow-xs shadow-indigo-600/20"
                              : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg transition ${
                              active
                                ? "text-white"
                                : "text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-400"
                            }`}
                          >
                            <NavIcon name={item.icon} label={item.label} />
                          </span>
                          <span className="truncate text-xs font-semibold">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </nav>

            {/* Sidebar Footer */}
            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/60 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <span className="text-[11px] font-semibold">Region:</span>
                <span className="truncate text-[11px] font-bold text-slate-900 dark:text-white">
                  {region.name}
                </span>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <section className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
            {/* Top Bar Header */}
            <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-[#0f172a]/80 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Mobile Toggle & Breadcrumb */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Open menu"
                    aria-expanded={mobileNavOpen}
                    onClick={() => setMobileNavOpen(true)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
                  >
                    ☰
                  </button>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span className="hidden sm:inline">{badge}</span>
                    <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
                    {activeItem?.group ? (
                      <>
                        <span className="hidden sm:inline">{activeItem.group}</span>
                        <span className="hidden sm:inline text-slate-300 dark:text-slate-600">/</span>
                      </>
                    ) : null}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activeItem?.label ?? title}
                    </span>
                  </div>
                </div>

                {/* Right: Region Switcher & Session Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <DashboardRegionSelect />
                  {actions}
                </div>
              </div>
            </header>

            {/* Content Body */}
            <div key={region.id} className="portal-dashboard-content flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
    default: "text-slate-900 dark:text-white",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
  } as const;

  const badgeMap = {
    default: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
  } as const;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {label}
        </p>
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${badgeMap[tone]}`}
        >
          {label.slice(0, 1)}
        </span>
      </div>
      <p className={`mt-3 text-2xl font-black tracking-tight ${toneMap[tone]}`}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </article>
  );
}
