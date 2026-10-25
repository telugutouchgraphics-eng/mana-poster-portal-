"use client";

import { useState } from "react";
import {
  CSV_FIXED_DYNAMIC_EVENT_CATEGORIES,
  CSV_LUNAR_PLACEHOLDER_CATEGORIES,
} from "@/lib/server/dynamic-event-catalog";
import { categoryLabelWithIcon } from "@/lib/category-display";
import { RESOLVED_LUNAR_EVENT_DATES } from "@/lib/server/dynamic-lunar-event-dates";

type ScheduleItem = {
  id: string;
  label: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  durationDays: number;
  visible: boolean;
  startsSoon: boolean;
  source: "fixed" | "lunar";
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function toDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

function sameOrAfter(left: Date, right: Date) {
  return left.getTime() >= right.getTime();
}

function sameOrBefore(left: Date, right: Date) {
  return left.getTime() <= right.getTime();
}

function formatRange(item: ScheduleItem) {
  const start = `${item.startDay} ${MONTHS[item.startMonth - 1]}`;
  if (item.startMonth === item.endMonth && item.startDay === item.endDay) {
    return start;
  }
  return `${start} - ${item.endDay} ${MONTHS[item.endMonth - 1]}`;
}

export function EventDatesConsole() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const today = toDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const fixed: ScheduleItem[] = CSV_FIXED_DYNAMIC_EVENT_CATEGORIES.map((item) => {
    const startDate = toDate(year, item.month, item.day);
    const durationDays = Math.max(1, item.durationDays ?? 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays - 1);
    const visibleStart = new Date(startDate);
    visibleStart.setDate(visibleStart.getDate() - 5);
    return {
      id: item.id,
      label: item.label,
      startMonth: item.month,
      startDay: item.day,
      endMonth: endDate.getMonth() + 1,
      endDay: endDate.getDate(),
      durationDays,
      visible: sameOrAfter(today, visibleStart) && sameOrBefore(today, endDate),
      startsSoon: sameOrAfter(today, visibleStart) && sameOrBefore(today, startDate),
      source: "fixed" as const,
    };
  });

  const lunarYearTable = RESOLVED_LUNAR_EVENT_DATES[year] ?? {};
  const lunar: ScheduleItem[] = CSV_LUNAR_PLACEHOLDER_CATEGORIES.flatMap((item) => {
    const resolved = lunarYearTable[item.id];
    if (!resolved) return [];
    const startDate = toDate(year, resolved.month, resolved.day);
    const endDate =
      resolved.endMonth && resolved.endDay
        ? toDate(year, resolved.endMonth, resolved.endDay)
        : toDate(
            year,
            resolved.month,
            resolved.day + Math.max(0, (resolved.durationDays ?? 1) - 1),
          );
    const visibleStart = new Date(startDate);
    visibleStart.setDate(visibleStart.getDate() - 5);
    return [
      {
        id: item.id,
        label: item.label,
        startMonth: resolved.month,
        startDay: resolved.day,
        endMonth: resolved.endMonth ?? endDate.getMonth() + 1,
        endDay: resolved.endDay ?? endDate.getDate(),
        durationDays: Math.max(1, resolved.durationDays ?? 1),
        visible: sameOrAfter(today, visibleStart) && sameOrBefore(today, endDate),
        startsSoon: sameOrAfter(today, visibleStart) && sameOrBefore(today, startDate),
        source: "lunar" as const,
      },
    ];
  });

  const schedules: ScheduleItem[] = [...fixed, ...lunar].sort((left, right) => {
    if (left.startMonth !== right.startMonth) return left.startMonth - right.startMonth;
    if (left.startDay !== right.startDay) return left.startDay - right.startDay;
    return left.label.localeCompare(right.label);
  });

  const visibleNow = schedules.filter((item) => item.visible);
  const filtered = schedules.filter(
    (item) =>
      item.startMonth === month ||
      item.endMonth === month,
  );

  const years = Object.keys(RESOLVED_LUNAR_EVENT_DATES)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <section className="space-y-6">
      {/* Calendar Overview Card */}
      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Event Dates Calendar
            </span>
            <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Month-wise Dynamic Event Schedule
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Events become visible in the portal 5 days early for poster planning. Mobile app shows dynamic events on event day.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  Year {item}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Currently Visible in Portal (5-Day Window)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {visibleNow.length === 0 ? (
                <span className="rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  No active events right now
                </span>
              ) : (
                visibleNow.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-400"
                  >
                    <span>{categoryLabelWithIcon(item.id, item.label)}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selected
              </p>
              <p className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                {MONTHS[month - 1]} {year}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Events
              </p>
              <p className="mt-1 text-base font-bold text-indigo-600 dark:text-indigo-400">
                {filtered.length} Events
              </p>
            </div>
          </div>
        </div>
      </article>

      {/* Events List for Month */}
      <article className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <h4 className="text-base font-bold text-slate-900 dark:text-white">
            {MONTHS[month - 1]} {year} Events Schedule
          </h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Chronological date list for selected month
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No festival events scheduled for {MONTHS[month - 1]} {year}.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={`${item.id}-${item.startMonth}-${item.startDay}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {categoryLabelWithIcon(item.id, item.label)}
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {item.source === "lunar" ? "Lunar / Variable" : "Fixed Date"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    📅 {formatRange(item)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {item.visible ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      Active Visible
                    </span>
                  ) : null}
                  {item.startsSoon ? (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                      5-Day Window
                    </span>
                  ) : null}
                  <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400">
                    {item.durationDays > 1 ? `${item.durationDays} Days` : "1 Day"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
