"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { useAuth } from "@/components/auth/auth-provider";

const managerNavItems = [
  {
    href: "/manager/dashboard/invite-creator",
    label: "Invite Creator",
    hint: "Create creator access and generate login links.",
    shortLabel: "Invite",
  },
  {
    href: "/manager/dashboard/creators",
    label: "Creator Access",
    hint: "Assign categories, reset links, and control access.",
    shortLabel: "Access",
  },
  {
    href: "/manager/dashboard/reviews",
    label: "Poster Review",
    hint: "Approve, reject, and now record poster sales.",
    shortLabel: "Review",
  },
  {
    href: "/manager/dashboard/performance",
    label: "Performance",
    hint: "Category-wise creator rankings and momentum view.",
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
        description="Daily working area for invites, category assignment, poster review, and creator performance tracking."
        navItems={[...managerNavItems]}
        actions={<DashboardSessionActions links={quickLinks} />}
      >
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
