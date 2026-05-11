"use client";

import { ChangeEvent } from "react";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { isDashboardLanguage } from "@/lib/i18n/dashboard-languages";

export function DashboardLanguageSwitch() {
  const { language, setLanguage, languages } = useDashboardLanguage();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isDashboardLanguage(next)) {
      return;
    }
    setLanguage(next);
  }

  return (
    <select
      value={language}
      onChange={handleChange}
      data-no-auto-translate="true"
      className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition hover:bg-slate-50"
      aria-label="Dashboard language"
    >
      {languages.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
