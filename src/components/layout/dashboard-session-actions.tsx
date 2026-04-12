"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";

export function DashboardSessionActions({
  links = [],
}: {
  links?: Array<{
    href: string;
    label: string;
  }>;
}) {
  const { signOut } = useAuth();

  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {link.label}
        </Link>
      ))}
      <button
        onClick={() => void signOut()}
        className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
      >
        Logout
      </button>
    </>
  );
}
