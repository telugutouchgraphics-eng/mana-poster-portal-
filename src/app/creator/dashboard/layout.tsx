"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminCreatorPreviewBar } from "@/components/creators/admin-creator-preview-bar";
import { CreatorLoginAgreementGuard } from "@/components/creators/creator-login-agreement-guard";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";

export default function CreatorDashboardLayout({ children }: { children: ReactNode }) {
  const { name } = useAuth();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const creatorNavItems = [
    {
      href: "/creator/dashboard/overview",
      label: isTelugu ? "ఓవర్వ్యూ" : "Overview",
      shortLabel: isTelugu ? "ఓవర్వ్యూ" : "Overview",
    },
    {
      href: "/creator/dashboard/upload",
      label: isTelugu ? "అప్లోడ్ & రివ్యూ" : "Upload & Review",
      shortLabel: isTelugu ? "అప్లోడ్" : "Upload",
    },
    {
      href: "/creator/dashboard/performance",
      label: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
      shortLabel: isTelugu ? "పెర్ఫార్మెన్స్" : "Performance",
    },
    {
      href: "/creator/dashboard/leaderboard",
      label: isTelugu ? "లీడర్‌బోర్డ్" : "Leaderboard",
      shortLabel: isTelugu ? "లీడర్‌బోర్డ్" : "Leaderboard",
    },
    {
      href: "/creator/dashboard/earnings",
      label: isTelugu ? "ఎర్నింగ్స్" : "Earnings",
      shortLabel: isTelugu ? "ఎర్నింగ్స్" : "Earnings",
    },
  ] as const;
  return (
    <RoleGate allowed={["creator", "admin"]}>
      <PortalDashboardShell
        badge={isTelugu ? "క్రియేటర్ ప్యానెల్" : "Creator Panel"}
        title={isTelugu ? "క్రియేటర్ డాష్‌బోర్డ్" : "Creator Dashboard"}
        description=""
        welcomeName={name}
        navItems={[...creatorNavItems]}
        actions={<DashboardSessionActions />}
      >
        <CreatorLoginAgreementGuard />
        <AdminCreatorPreviewBar />
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
