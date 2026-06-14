"use client";

import { ChangeEvent } from "react";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";

export function DashboardRegionSelect() {
  const { region, regions, setRegionId } = useDashboardRegion();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    setRegionId(event.target.value);
    window.dispatchEvent(new CustomEvent("mana-poster-region-change"));
  }

  return (
    <label className="flex min-w-[230px] flex-col gap-1 text-left">
      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
        State / UT
      </span>
      <select
        value={region.id}
        onChange={handleChange}
        className="min-h-11 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-50"
        aria-label="Select State or Union Territory"
      >
        {regions.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} - {item.primaryLanguage}
          </option>
        ))}
      </select>
    </label>
  );
}
