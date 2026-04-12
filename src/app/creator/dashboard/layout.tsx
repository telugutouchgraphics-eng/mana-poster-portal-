import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";

const creatorNavItems = [
  {
    href: "/creator/dashboard/upload",
    label: "Upload Posters",
    hint: "Upload posters and set user photo and name placement.",
    shortLabel: "Upload",
  },
] as const;

export default function CreatorDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowed={["creator", "admin"]}>
      <PortalDashboardShell
        badge="Creator Panel"
        title="Creator Dashboard"
        description="Poster upload and approval tracking kosam simple creator working area."
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
