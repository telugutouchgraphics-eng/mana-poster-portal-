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

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fixed = CSV_FIXED_DYNAMIC_EVENT_CATEGORIES.map((item) => {
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

  const lunar = CSV_LUNAR_PLACEHOLDER_CATEGORIES.flatMap((item) => {
    const resolved = RESOLVED_LUNAR_EVENT_DATES[year]?.[item.id];
    if (!resolved) {
      return [];
    }
    const startDate = toDate(year, resolved.month, resolved.day);
    const endDate =
      resolved.endMonth != null && resolved.endDay != null
        ? toDate(year, resolved.endMonth, resolved.endDay)
        : new Date(
            year,
            resolved.month - 1,
            resolved.day + Math.max(1, resolved.durationDays ?? 1) - 1,
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
    <section className="space-y-5">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              Event Dates Calendar
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">Month-wise dynamic event schedule</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              These events are visible in the portal 5 days early. The app shows dynamic events only on the event day.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none"
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-5">
            <p className="text-sm font-bold text-slate-950">Currently visible in portal</p>
            <p className="mt-1 text-xs text-slate-500">Today + next 5-day visibility window.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {visibleNow.length === 0 ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                  No active event window
                </span>
              ) : (
                visibleNow.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700"
                  >
                    {categoryLabelWithIcon(item.id, item.label)}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{year}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Month</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{MONTHS[month - 1]}</p>
              </div>
              <div className="rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Events</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{filtered.length}</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h4 className="text-xl font-black text-slate-950">
          {MONTHS[month - 1]} {year} events
        </h4>
        <p className="mt-2 text-sm text-slate-600">
          Clear date-wise list. Multi-day events show the full range.
        </p>
        <div className="mt-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              No events this month.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={`${item.id}-${item.startMonth}-${item.startDay}`}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-950">
                      {categoryLabelWithIcon(item.id, item.label)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{formatRange(item)}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.source === "lunar" ? "Variable-date / yearly update" : "Fixed-date event"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.visible ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Visible
                      </span>
                    ) : null}
                    {item.startsSoon ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        5-day window
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {item.durationDays > 1 ? `${item.durationDays} days` : "1 day"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}
