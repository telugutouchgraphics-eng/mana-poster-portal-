"use client";

import { ReactNode } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { DashboardSessionActions } from "@/components/layout/dashboard-session-actions";
import { PortalDashboardShell } from "@/components/layout/portal-dashboard-shell";

export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { name } = useAuth();

  const adminNavItems = [
    // 📊 Analytics & Overview
    {
      group: "Analytics",
      href: "/admin/dashboard/overview",
      label: "Overview",
      shortLabel: "Overview",
      icon: "overview",
      hint: "KPIs, stats & growth metrics",
    },
    {
      group: "Analytics",
      href: "/admin/dashboard/location-insights",
      label: "Location Insights",
      shortLabel: "Insights",
      icon: "insights",
      hint: "State & district performance",
    },
    {
      group: "Analytics",
      href: "/admin/dashboard/reports",
      label: "Community Reports",
      shortLabel: "Reports",
      icon: "reports",
      hint: "User issues & feedback",
    },
    {
      group: "Analytics",
      href: "/admin/dashboard/share-downloads",
      label: "Share & Downloads",
      shortLabel: "Downloads",
      icon: "downloads",
      hint: "Viral shares & download tracking",
    },
    {
      group: "Analytics",
      href: "/admin/dashboard/audit-logs",
      label: "Audit Logs",
      shortLabel: "Audit",
      icon: "audit",
      hint: "Admin action history",
    },

    // 📅 Events & Categories
    {
      group: "Events & Categories",
      href: "/admin/dashboard/event-dates",
      label: "Event Dates",
      shortLabel: "Dates",
      icon: "calendar",
      hint: "Upcoming festival schedule",
    },
    {
      group: "Events & Categories",
      href: "/admin/dashboard/event-categories",
      label: "Event Categories",
      shortLabel: "Categories",
      icon: "category",
      hint: "Manage festival categories & icons",
    },
    {
      group: "Events & Categories",
      href: "/admin/dashboard/permanent-categories",
      label: "Permanent Categories",
      shortLabel: "Permanent",
      icon: "folder",
      hint: "Fixed categories & daily greetings",
    },

    // 🎨 Posters & Assets
    {
      group: "Posters & Assets",
      href: "/admin/dashboard/app-posters",
      label: "Scheduled Posters",
      shortLabel: "Scheduled",
      icon: "clock",
      hint: "Queue date-based posters",
    },
    {
      group: "Posters & Assets",
      href: "/admin/dashboard/upload-posters",
      label: "Instant Upload",
      shortLabel: "Upload",
      icon: "upload",
      hint: "Publish posters live immediately",
    },
    {
      group: "Posters & Assets",
      href: "/admin/dashboard/political-protocol-photos",
      label: "Protocol Photos",
      shortLabel: "Protocol",
      icon: "photo",
      hint: "Political leaders & party assets",
    },


    // 👥 Team & Creators
    {
      group: "Team & Creators",
      href: "/admin/dashboard/managers",
      label: "Managers",
      shortLabel: "Managers",
      icon: "shield",
      hint: "State manager accounts & approvals",
    },
    {
      group: "Team & Creators",
      href: "/admin/dashboard/creators",
      label: "Creators",
      shortLabel: "Creators",
      icon: "users",
      hint: "Designer roster & permissions",
    },
    {
      group: "Team & Creators",
      href: "/admin/dashboard/competitions",
      label: "Competitions",
      shortLabel: "Contests",
      icon: "trophy",
      hint: "Creator challenges & prizes",
    },
    {
      group: "Team & Creators",
      href: "/admin/dashboard/payouts",
      label: "Payouts",
      shortLabel: "Payouts",
      icon: "currency",
      hint: "Earnings & bank transfers",
    },

    // 📢 Marketing & Growth
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/app-banners",
      label: "App Banners",
      shortLabel: "Banners",
      icon: "megaphone",
      hint: "Home screen carousel banners",
    },
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/creator-banners",
      label: "Creator Banners",
      shortLabel: "Creator Ads",
      icon: "banner",
      hint: "Promotions for creator community",
    },
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/push-notifications",
      label: "Push Notifications",
      shortLabel: "Push",
      icon: "bell",
      hint: "Send instant & scheduled FCM alerts",
    },
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/announcements",
      label: "Announcements",
      shortLabel: "Updates",
      icon: "announcement",
      hint: "Broadcast notices to app users",
    },
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/first150-trial",
      label: "Free Trial Promo",
      shortLabel: "Promo",
      icon: "gift",
      hint: "First 150 users promotional offer",
    },
    {
      group: "Marketing & Growth",
      href: "/admin/dashboard/surveys",
      label: "User Surveys",
      shortLabel: "Surveys",
      icon: "clipboard",
      hint: "Collect user feedback & polls",
    },

    // ⚙️ Administration
    {
      group: "Settings & System",
      href: "/admin/dashboard/dashboard-access",
      label: "Dashboard Access",
      shortLabel: "Access",
      icon: "key",
      hint: "Super-admin & admin permissions",
    },
    {
      group: "Settings & System",
      href: "/admin/dashboard/settings",
      label: "Settings",
      shortLabel: "Settings",
      icon: "settings",
      hint: "App config, ads & subscription rules",
    },
  ];

  return (
    <RoleGate allowed={["admin"]}>
      <PortalDashboardShell
        badge="ADMIN"
        title="Admin Dashboard"
        description=""
        welcomeName={name}
        navItems={adminNavItems}
        actions={
          <DashboardSessionActions
            links={[
              {
                href: "/manager/dashboard/creators",
                label: "Manager Portal",
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
