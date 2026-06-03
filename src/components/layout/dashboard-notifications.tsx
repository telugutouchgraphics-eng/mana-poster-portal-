"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

interface DashboardNotificationItem {
  id: string;
  title: string;
  message: string;
  priority: "normal" | "important" | "urgent";
  audience: string;
  createdAt: number;
  source?: "announcement" | "push";
}

interface NotificationsResponse {
  ok: boolean;
  notifications?: DashboardNotificationItem[];
  error?: string;
}

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function priorityClass(priority: DashboardNotificationItem["priority"]): string {
  if (priority === "urgent") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "important") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function DashboardNotifications() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DashboardNotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenCreatedAt, setLastSeenCreatedAt] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const storageKey = useMemo(
    () => `dashboard_notifications_last_seen_${user?.uid ?? "guest"}`,
    [user?.uid],
  );

  const load = useCallback(
    async (silent = false) => {
      const token = await user?.getIdToken();
      if (!token) return;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch("/api/dashboard/notifications", {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        });
        const data = (await response.json()) as NotificationsResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to load notifications.");
        }
        setItems(data.notifications ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load notifications.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    setLastSeenCreatedAt(stored ? Number.parseInt(stored, 10) || 0 : 0);
  }, [storageKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", onOutsideClick);
    }
    return () => window.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const latestCreatedAt = items[0]?.createdAt ?? 0;
  const unreadCount = items.filter((item) => item.createdAt > lastSeenCreatedAt).length;

  function markAllRead() {
    const nextSeen = Math.max(lastSeenCreatedAt, latestCreatedAt);
    setLastSeenCreatedAt(nextSeen);
    window.localStorage.setItem(storageKey, String(nextSeen));
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            markAllRead();
          }
        }}
        className="relative inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <span aria-hidden="true">🔔</span>
        <span>{isTelugu ? "నోటిఫికేషన్స్" : "Notifications"}</span>
        {unreadCount > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-2xl border border-[var(--portal-border)] bg-white p-3 shadow-[0_20px_40px_rgba(15,23,42,0.14)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">
              {isTelugu ? "తాజా అప్‌డేట్స్" : "Latest updates"}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[var(--portal-border)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {isTelugu ? "రిఫ్రెష్" : "Refresh"}
            </button>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="px-1 py-4 text-xs text-slate-500">
              {isTelugu ? "లోడ్ అవుతోంది..." : "Loading..."}
            </p>
          ) : items.length === 0 ? (
            <p className="px-1 py-4 text-xs text-slate-500">
              {isTelugu ? "నోటిఫికేషన్స్ లేవు." : "No notifications yet."}
            </p>
          ) : (
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-600">
                        {item.source === "push" ? "push" : "update"}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase ${priorityClass(item.priority)}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                  <p className="mt-2 text-[11px] text-slate-500">{formatDate(item.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
