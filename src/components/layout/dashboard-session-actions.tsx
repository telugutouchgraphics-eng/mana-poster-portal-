"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DashboardNotifications } from "@/components/layout/dashboard-notifications";
import { useDashboardTheme } from "@/components/theme/dashboard-theme-provider";

export function DashboardSessionActions({
  links = [],
}: {
  links?: Array<{
    href: string;
    label: string;
  }>;
}) {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useDashboardTheme();
  const isDark = theme === "dark";

  return (
    <>
      <DashboardNotifications />
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
        aria-pressed={isDark}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
      >
        <span aria-hidden="true" className="text-sm">
          {isDark ? "☀️" : "🌙"}
        </span>
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </button>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-center text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
        >
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 sm:w-auto"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
        <span>Logout</span>
      </button>
    </>
  );
}
