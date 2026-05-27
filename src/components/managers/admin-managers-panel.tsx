"use client";

import { useState } from "react";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { ManagerCreateForm } from "@/components/admin/manager-create-form";
import { ManagerCreatorsTab } from "@/components/managers/manager-creators-tab";
import { ManagerTable } from "@/components/managers/manager-table";

type ManagersTab = "managers" | "creators";

export function AdminManagersPanel() {
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const [activeTab, setActiveTab] = useState<ManagersTab>("managers");

  const tabs: Array<{ id: ManagersTab; label: string; description: string }> = [
    {
      id: "managers",
      label: isTelugu ? "మేనేజర్స్ లిస్ట్" : "Managers List",
      description: isTelugu
        ? "మేనేజర్ అకౌంట్స్ manage చేయండి."
        : "Manage manager accounts.",
    },
    {
      id: "creators",
      label: isTelugu ? "మేనేజర్ క్రియేటర్స్" : "Manager Creators",
      description: isTelugu
        ? "ప్రతి మేనేజర్ కింద ఉన్న creators ని చూడండి."
        : "Review creators assigned under each manager.",
    },
  ];

  return (
    <section className="space-y-6">
      <ManagerCreateForm />

      <div className="rounded-[28px] border border-[var(--portal-border)] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-5">
        <div className="flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl px-4 py-3 text-left transition ${
                  isActive
                    ? "bg-[var(--portal-purple)] text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)]"
                    : "border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] text-slate-800 hover:bg-white"
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p className={`mt-1 text-xs ${isActive ? "text-white/80" : "text-slate-500"}`}>
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {activeTab === "managers" ? <ManagerTable /> : <ManagerCreatorsTab />}
        </div>
      </div>
    </section>
  );
}
