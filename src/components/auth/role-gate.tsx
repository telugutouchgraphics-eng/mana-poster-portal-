"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppRole } from "@/lib/types/roles";
import { useAuth } from "@/components/auth/auth-provider";

interface RoleGateProps {
  allowed: AppRole[];
  children: React.ReactNode;
}

export function RoleGate({ allowed, children }: RoleGateProps) {
  const { user, loading, roles } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && !loading) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const isBusy = loading;
  const isAllowed = roles.length > 0 && allowed.some((role) => roles.includes(role));
  const reason = useMemo(() => {
    if (isBusy) return "Checking access...";
    if (!isAllowed) return "You do not have permission.";
    return null;
  }, [isBusy, isAllowed]);

  if (!isAllowed) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg rounded-[28px] border border-[var(--portal-border)] bg-white p-6 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
            Portal Access
          </p>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">Access required</h2>
          <p className="mt-2 text-sm text-slate-600">{reason}</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
