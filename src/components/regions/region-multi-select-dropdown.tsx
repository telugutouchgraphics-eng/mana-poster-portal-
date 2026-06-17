"use client";

import type { DashboardRegion } from "@/lib/dashboard-regions";

interface RegionMultiSelectDropdownProps {
  regions: DashboardRegion[];
  selectedRegionIds: string[];
  onChange: (regionIds: string[]) => void;
  label?: string;
}

export function RegionMultiSelectDropdown({
  regions,
  selectedRegionIds,
  onChange,
  label = "Select states / UTs",
}: RegionMultiSelectDropdownProps) {
  const selectedSet = new Set(selectedRegionIds);

  function addRegion(regionId: string) {
    if (!regionId || selectedSet.has(regionId)) {
      return;
    }
    onChange(Array.from(new Set([...selectedRegionIds, regionId])));
  }

  function removeRegion(regionId: string) {
    onChange(selectedRegionIds.filter((item) => item !== regionId));
  }

  return (
    <div className="space-y-2">
      <select
        value=""
        onChange={(event) => addRegion(event.target.value)}
        className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[var(--portal-border-strong)]"
      >
        <option value="">{label}</option>
        {regions.map((item) => (
          <option key={item.id} value={item.id} disabled={selectedSet.has(item.id)}>
            {item.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        {regions
          .filter((item) => selectedSet.has(item.id))
          .map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800"
            >
              {item.name}
              <button
                type="button"
                onClick={() => removeRegion(item.id)}
                className="rounded-full px-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Remove ${item.name}`}
              >
                x
              </button>
            </span>
          ))}
      </div>
    </div>
  );
}
