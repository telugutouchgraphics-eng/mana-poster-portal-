"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { useAuth } from "@/components/auth/auth-provider";

const managerNavItems = [
  {
    href: "/manager/dashboard/creators",
    label: "Creators",
    hint: "Create creator access, assign categories, and control login access.",
    shortLabel: "Creators",
  },
  {
    href: "/manager/dashboard/reviews",
    label: "Poster Review",
    hint: "Approve or reject uploaded posters.",
    shortLabel: "Review",
  },
  {
    href: "/manager/dashboard/performance",
    label: "Performance",
    hint: "See creator activity and category-wise performance.",
    shortLabel: "Stats",
  },
] as const;

export default function ManagerDashboardLayout({ children }: { children: ReactNode }) {
  const { roles } = useAuth();
  const quickLinks: Array<{ href: string; label: string }> = [];

  if (roles.includes("admin")) {
    quickLinks.push({
      href: "/admin/dashboard/create-manager",
      label: "Admin View",
    });
  }

  if (roles.includes("creator")) {
    quickLinks.push({
      href: "/creator/dashboard/upload",
      label: "Creator View",
    });
  }

  return (
    <RoleGate allowed={["admin", "manager"]}>
      <PortalDashboardShell
        badge="Manager Panel"
        title="Creator Access Desk"
        description="Daily creator work ni handle cheyyadaniki simple manager dashboard."
        navItems={[...managerNavItems]}
        actions={<DashboardSessionActions links={quickLinks} />}
      >
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
