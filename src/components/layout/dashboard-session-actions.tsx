"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { DashboardLanguageSwitch } from "@/components/i18n/dashboard-language-switch";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";

export function DashboardSessionActions({
  links = [],
}: {
  links?: Array<{
    href: string;
    label: string;
  }>;
}) {
  const { signOut } = useAuth();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";

  return (
    <>
      <DashboardLanguageSwitch />
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
        {isTelugu ? "లాగౌట్" : "Logout"}
      </button>
    </>
  );
}
