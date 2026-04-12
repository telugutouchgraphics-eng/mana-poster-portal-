import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";

const adminNavItems = [
  {
    href: "/admin/dashboard/managers",
    label: "Managers",
    hint: "Create manager accounts and control manager access.",
    shortLabel: "Managers",
  },
  {
    href: "/admin/dashboard/creators",
    label: "Creators",
    hint: "Create creator access, assign categories, and manage payouts.",
    shortLabel: "Creators",
  },
  {
    href: "/admin/dashboard/app-banners",
    label: "App Banners",
    hint: "Upload app home banners and control their visibility.",
    shortLabel: "Banners",
  },
  {
    href: "/admin/dashboard/announcements",
    label: "Creator Notices",
    hint: "Send upload instructions and campaign notices to creators.",
    shortLabel: "Notices",
  },
] as const;

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowed={["admin"]}>
      <PortalDashboardShell
        badge="Admin Panel"
        title="Admin Dashboard"
        description="Mana Poster app operations ni simple ga manage cheyyadaniki main admin working area."
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
