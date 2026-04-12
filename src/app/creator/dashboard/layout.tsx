import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";

const creatorNavItems = [
  {
    href: "/creator/dashboard/upload",
    label: "Upload Studio",
    hint: "Upload poster, customize user placement, and review recent uploads.",
    shortLabel: "Upload",
  },
  {
    href: "/creator/dashboard/performance",
    label: "Performance",
    hint: "Assigned category performance, rankings, and momentum.",
    shortLabel: "Stats",
  },
] as const;

export default function CreatorDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowed={["creator", "admin"]}>
      <PortalDashboardShell
        badge="Creator Panel"
        title="Creator Dashboard"
        description="Premium workspace for uploads, approvals, earnings visibility, and category competition."
        navItems={[...creatorNavItems]}
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
