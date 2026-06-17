"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";
import { portalLanguage, t } from "@/lib/i18n";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const { name } = useAuth();
  const { language } = useDashboardLanguage();
  const lang = portalLanguage(language);
  const isTelugu = language === "telugu";

  const adminNavItems = [
    {
      href: "/admin/dashboard/overview",
      label: t("admin.nav.overview", lang),
      shortLabel: t("admin.nav.overview", lang),
    },
    {
      href: "/admin/dashboard/event-dates",
      label: t("admin.nav.eventDates", lang),
      shortLabel: t("admin.nav.events", lang),
    },
    {
      href: "/admin/dashboard/event-categories",
      label: isTelugu ? "ఈవెంట్ క్యాటగిరీలు" : "Event Categories",
      shortLabel: isTelugu ? "క్యాటగిరీలు" : "Categories",
    },
    {
      href: "/admin/dashboard/managers",
      label: t("admin.nav.managers", lang),
      shortLabel: t("admin.nav.managers", lang),
    },
    {
      href: "/admin/dashboard/creators",
      label: t("admin.nav.creators", lang),
      shortLabel: t("admin.nav.creators", lang),
    },
    {
      href: "/admin/dashboard/app-banners",
      label: t("admin.nav.appBanners", lang),
      shortLabel: t("admin.nav.banners", lang),
    },
    {
      href: "/admin/dashboard/app-posters",
      label: t("admin.nav.appPosters", lang),
      shortLabel: t("admin.nav.posters", lang),
    },
    {
      href: "/admin/dashboard/upload-posters",
      label: isTelugu ? "పోస్టర్స్ అప్లోడ్" : "Upload Posters",
      shortLabel: isTelugu ? "అప్లోడ్" : "Upload",
    },
    {
      href: "/admin/dashboard/competitions",
      label: t("admin.nav.competitions", lang),
      shortLabel: t("admin.nav.contests", lang),
    },
    {
      href: "/admin/dashboard/creator-banners",
      label: t("admin.nav.creatorBanners", lang),
      shortLabel: t("admin.nav.creatorAds", lang),
    },
    {
      href: "/admin/dashboard/announcements",
      label: t("admin.nav.announcements", lang),
      shortLabel: t("admin.nav.updates", lang),
    },
    {
      href: "/admin/dashboard/push-notifications",
      label: t("admin.nav.pushNotifications", lang),
      shortLabel: t("admin.nav.push", lang),
    },
    {
      href: "/admin/dashboard/reports",
      label: isTelugu ? "రిపోర్ట్స్" : "Reports",
      shortLabel: isTelugu ? "రిపోర్ట్స్" : "Reports",
    },
    {
      href: "/admin/dashboard/location-insights",
      label: isTelugu ? "యూజర్ ఇన్‌సైట్స్" : "User Insights",
      shortLabel: isTelugu ? "యూజర్స్" : "Users",
    },
    {
      href: "/admin/dashboard/dashboard-access",
      label: t("admin.nav.dashboardAccess", lang),
      shortLabel: t("admin.nav.access", lang),
    },
    {
      href: "/admin/dashboard/settings",
      label: t("admin.nav.settings", lang),
      shortLabel: t("admin.nav.settings", lang),
    },
  ] as const;

  return (
    <RoleGate allowed={["admin"]}>
      <PortalDashboardShell
        badge={t("admin.layout.badge", lang)}
        title={t("admin.layout.title", lang)}
        description=""
        welcomeName={name}
        navItems={[...adminNavItems]}
        actions={
          <DashboardSessionActions
            links={[
              {
                href: "/manager/dashboard/creators",
                label: t("admin.layout.openManagerDashboard", lang),
              },
            ]}
          />
        }
      >
        {children}
      </PortalDashboardShell>
    </RoleGate>
  );
}
