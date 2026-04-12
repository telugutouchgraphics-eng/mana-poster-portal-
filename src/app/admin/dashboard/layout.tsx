import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";

const adminNavItems = [
  {
    href: "/admin/dashboard/create-manager",
    label: "Create Manager",
    hint: "Create permanent manager accounts with controlled access.",
    shortLabel: "Manager",
  },
  {
    href: "/admin/dashboard/invite-creator",
    label: "Invite Creator",
    hint: "Generate creator access and direct login links.",
    shortLabel: "Invite",
  },
  {
    href: "/admin/dashboard/managers",
    label: "Managers",
    hint: "Activate, deactivate, reset passwords, and reset devices.",
    shortLabel: "Managers",
  },
  {
    href: "/admin/dashboard/creators",
    label: "Creators",
    hint: "Assign categories, manage access, and mark payouts.",
    shortLabel: "Creators",
  },
  {
    href: "/admin/dashboard/competitions",
    label: "Competitions",
    hint: "Create seasonal category contests and monitor active competition setup.",
    shortLabel: "Contest",
  },
  {
    href: "/admin/dashboard/app-banners",
    label: "App Banners",
    hint: "Manage app home banners and category-area visuals from admin panel.",
    shortLabel: "Banners",
  },
  {
    href: "/admin/dashboard/announcements",
    label: "Announcements",
    hint: "Send creator-focused updates, notices, and campaign instructions.",
    shortLabel: "Alerts",
  },
  {
    href: "/admin/dashboard/payouts",
    label: "Payouts",
    hint: "Review creator payout history, search entries, and export reports.",
    shortLabel: "Payouts",
  },
  {
    href: "/admin/dashboard/audit-logs",
    label: "Audit Logs",
    hint: "Track sensitive admin and manager actions before and after launch.",
    shortLabel: "Audit",
  },
] as const;

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowed={["admin"]}>
      <PortalDashboardShell
        badge="Admin Panel"
        title="Super Admin Dashboard"
        description="Platform-wide control center for managers, creators, payouts, banners, announcements, and review operations."
        navItems={[...adminNavItems]}
        actions={
          <DashboardSessionActions
            links={[{ href: "/manager/dashboard/invite-creator", label: "Manager View" }]}
          />
        }
      >
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
