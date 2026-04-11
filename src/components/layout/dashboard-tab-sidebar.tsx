"use client";

interface DashboardTab {
  id: string;
  label: string;
}

interface DashboardTabSidebarProps {
  title: string;
  subtitle: string;
  tabs: DashboardTab[];
  activeTab: string;
  onChangeTab: (tabId: string) => void;
}

export function DashboardTabSidebar({
  title,
  subtitle,
  tabs,
  activeTab,
  onChangeTab,
}: DashboardTabSidebarProps) {
  return (
    <aside className="lg:sticky lg:top-6 lg:h-fit">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
          {title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`min-w-max rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? "border-orange-300 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

