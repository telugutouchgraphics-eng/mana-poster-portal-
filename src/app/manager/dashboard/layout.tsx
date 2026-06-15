"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";

export default function ManagerDashboardLayout({ children }: { children: ReactNode }) {
  const { roles, name } = useAuth();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const managerNavItems = [
    {
      href: "/manager/dashboard/overview",
      label: isTelugu ? "ఓవర్వ్యూ" : "Overview",
      shortLabel: isTelugu ? "ఓవర్వ్యూ" : "Overview",
    },
    {
      href: "/manager/dashboard/event-categories",
      label: isTelugu ? "ఈవెంట్ క్యాటగిరీలు" : "Event Categories",
      shortLabel: isTelugu ? "ఈవెంట్స్" : "Events",
    },
    {
      href: "/manager/dashboard/creators",
      label: isTelugu ? "క్రియేటర్స్" : "Creators",
      shortLabel: isTelugu ? "క్రియేటర్స్" : "Creators",
    },
    {
      href: "/manager/dashboard/reviews",
      label: isTelugu ? "పోస్టర్ రివ్యూ" : "Poster Review",
      shortLabel: isTelugu ? "రివ్యూ" : "Review",
    },
    {
      href: "/manager/dashboard/user-uploads",
      label: isTelugu ? "యూజర్ అప్‌లోడ్స్" : "User Uploads",
      shortLabel: isTelugu ? "అప్‌లోడ్స్" : "Uploads",
    },
    {
      href: "/manager/dashboard/reports",
      label: isTelugu ? "రిపోర్ట్స్" : "Reports",
      shortLabel: isTelugu ? "రిపోర్ట్స్" : "Reports",
    },
    {
      href: "/manager/dashboard/performance",
      label: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
      shortLabel: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
    },
  ] as const;
  const quickLinks: Array<{ href: string; label: string }> = [];

  if (roles.includes("admin")) {
    quickLinks.push({
      href: "/admin/dashboard/managers",
      label: isTelugu ? "ఓపెన్ అడ్మిన్ డాష్‌బోర్డ్" : "Open Admin Dashboard",
    });
  }

  if (roles.includes("creator")) {
    quickLinks.push({
      href: "/creator/dashboard/upload",
      label: isTelugu ? "ఓపెన్ క్రియేటర్ డాష్‌బోర్డ్" : "Open Creator Dashboard",
    });
  }

  return (
    <RoleGate allowed={["admin", "manager"]}>
      <PortalDashboardShell
        badge={isTelugu ? "మేనేజర్ ప్యానెల్" : "Manager Panel"}
        title={isTelugu ? "మేనేజర్ డాష్‌బోర్డ్" : "Manager Dashboard"}
        description=""
        welcomeName={name}
        navItems={[...managerNavItems]}
        actions={<DashboardSessionActions links={quickLinks} />}
      >
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
