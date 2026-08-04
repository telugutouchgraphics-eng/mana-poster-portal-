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
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
      >
        <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
        <span>{isDark ? "Day" : "Night"}</span>
      </button>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
        >
          {link.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => void signOut()}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(109,40,217,0.18)] transition hover:bg-[var(--portal-purple-dark)] sm:w-auto"
      >
        Logout
      </button>
    </>
  );
}
