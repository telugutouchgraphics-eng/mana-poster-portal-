"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppRole } from "@/lib/types/roles";
import { useAuth } from "@/components/auth/auth-provider";

interface RoleGateProps {
  allowed: AppRole[];
  children: React.ReactNode;
}

export function RoleGate({ allowed, children }: RoleGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user) {
        if (!loading) {
          router.replace("/login");
        }
        return;
      }
      setVerifying(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/auth/me", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          role?: AppRole;
          roles?: AppRole[];
          error?: string;
        };
        const fetchedRoles =
          Array.isArray(data.roles) && data.roles.length > 0
            ? data.roles
            : data.role
            ? [data.role]
            : [];
        if (!response.ok || fetchedRoles.length === 0) {
          throw new Error(data.error ?? "Unable to fetch role.");
        }
        if (cancelled) {
          return;
        }
        setRoles(fetchedRoles);
        if (!allowed.some((role) => fetchedRoles.includes(role))) {
          setError("Access denied for this role.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Access check failed.");
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, allowed]);

  const isBusy = loading || verifying;
  const isAllowed = roles.length > 0 && allowed.some((role) => roles.includes(role));
  const reason = useMemo(() => {
    if (isBusy) return "Checking access...";
    if (error) return error;
    if (!isAllowed) return "You do not have permission.";
    return null;
  }, [isBusy, error, isAllowed]);

  if (!isAllowed) {
    return (
      <div className="mx-auto mt-20 w-full max-w-md rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-orange-900">Access Guard</h2>
        <p className="mt-2 text-sm text-orange-700">{reason}</p>
      </div>
    );
  }
  return <>{children}</>;
}
