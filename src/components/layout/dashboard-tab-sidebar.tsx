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
    <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
      <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-950">
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
                className={`min-h-11 min-w-max rounded-2xl border px-3 py-2 text-left text-sm font-bold transition lg:w-full ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:text-slate-950"
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
