"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";

interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  imageUrl: string;
  route: string;
  audience: "area_users";
  targetState?: string;
  targetDistrict?: string;
  targetCity?: string;
  category: string;
  status: "scheduled" | "sent" | "failed" | "processing";
  targetCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledFor: number | null;
  errorMessage?: string;
  createdAt: number;
  sentAt: number | null;
  createdByEmail: string;
}

interface LocationInsightRow {
  key: string;
  state: string;
  district: string;
  city: string;
}

export default function AdminPushNotificationsPage() {
  const { user } = useAuth();
  const { region, regions } = useDashboardRegion();
  const [items, setItems] = useState<PushNotificationItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience] = useState<"area_users">("area_users");
  const [targetState, setTargetState] = useState(region.name);
  const [targetDistrict, setTargetDistrict] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [locationRows, setLocationRows] = useState<LocationInsightRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    const response = await fetch("/api/admin/push-notifications", {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as {
      ok: boolean;
      notifications?: PushNotificationItem[];
      error?: string;
    };
    if (response.ok && data.ok) {
      setItems(data.notifications ?? []);
    }
    if (!response.ok || !data.ok) {
      setStatusMessage(data.error ?? "Unable to load push notification history.");
    }
    const insightsResponse = await fetch("/api/admin/location-insights", {
      headers: { authorization: `Bearer ${token}` },
    });
    const insightsData = (await insightsResponse.json()) as {
      ok: boolean;
      insights?: { locations?: LocationInsightRow[] };
    };
    if (insightsResponse.ok && insightsData.ok) {
      setLocationRows(insightsData.insights?.locations ?? []);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }

    if (!title.trim() || !message.trim()) {
      setStatusMessage("Enter notification title and message.");
      return;
    }
    if (audience === "area_users" && !targetState.trim()) {
      setStatusMessage("Select State / UT for area targeting.");
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("message", message.trim());
      formData.set("route", "home");
      formData.set("audience", audience);
      formData.set("category", "");
      formData.set("targetState", audience === "area_users" ? targetState.trim() : "");
      formData.set("targetDistrict", audience === "area_users" ? targetDistrict.trim() : "");
      formData.set("targetCity", audience === "area_users" ? targetCity.trim() : "");
      if (imageFile) {
        formData.set("image", imageFile);
      }

      const response = await fetch("/api/admin/push-notifications", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatusMessage(data.error ?? "Unable to send push notification.");
        return;
      }

      setTitle("");
      setMessage("");
      setTargetState(region.name);
      setTargetDistrict("");
      setTargetCity("");
      setImageFile(null);
      const input = document.getElementById("push-image-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      setStatusMessage(
        "Push notification sent successfully.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  const stateOptions = Array.from(
    new Set(regions.map((region) => region.name).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const districtOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !targetState || row.state === targetState)
        .map((row) => row.district)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const cityOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !targetState || row.state === targetState)
        .filter((row) => !targetDistrict || row.district === targetDistrict)
        .map((row) => row.city)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (stateOptions.includes(targetState)) {
      return;
    }
    setTargetState(region.name);
    setTargetDistrict("");
    setTargetCity("");
  }, [region.name, stateOptions, targetState]);

  return (
    <section className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
          App Users Push
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Send app notification</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Send manual notification text with optional image and audience targeting.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Notification title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter notification title"
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Audience</span>
              <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-800">
                Selected State / UT users
              </div>
            </label>
          </div>

          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-bold text-emerald-900">Area targeting</p>
            <p className="mt-1 text-xs leading-6 text-emerald-700">
              Sends only to users who allowed location and match selected State/UT area. Exact GPS is not used.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">State / UT</span>
                <select
                  value={targetState}
                  onChange={(event) => {
                    setTargetState(event.target.value);
                    setTargetDistrict("");
                    setTargetCity("");
                  }}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">District</span>
                <select
                  value={targetDistrict}
                  onChange={(event) => {
                    setTargetDistrict(event.target.value);
                    setTargetCity("");
                  }}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">Any district</option>
                  {districtOptions.map((district) => (
                    <option key={district} value={district}>{district}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">City</span>
                <select
                  value={targetCity}
                  onChange={(event) => setTargetCity(event.target.value)}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">Any city</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold">Notification message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type your notification message"
              rows={4}
              className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            />
          </label>

          <div className="rounded-[24px] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <p className="text-sm font-semibold text-slate-800">Notification image</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              Optional. If uploaded, the mobile app shows it as a big notification image.
            </p>
            <input
              id="push-image-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-2xl file:border-0 file:bg-[var(--portal-purple)] file:px-4 file:py-2.5 file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs text-slate-500">
              Route:{" "}
              <span className="font-semibold text-slate-700">
                home
              </span>
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send Push Notification"}
          </button>
          {statusMessage ? (
            <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              {statusMessage}
            </p>
          ) : null}
        </form>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-2xl font-bold text-slate-950">Push history</h3>
        <p className="mt-2 text-sm text-slate-600">
          Sent, scheduled, failed, and processing notifications are listed here. Sent and failed history is auto-deleted after 24 hours.
        </p>
        <div className="mt-5 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              No push notification history yet.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {item.imageUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-slate-950">
                        {item.title}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : item.status === "scheduled"
                              ? "bg-amber-100 text-amber-700"
                              : item.status === "processing"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Route: {item.route} | Audience: {item.audience}
                      {item.category ? ` | Category: ${item.category}` : ""}
                    </p>
                    {item.audience === "area_users" ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Area: {[item.targetCity, item.targetDistrict, item.targetState]
                          .filter(Boolean)
                          .join(", ") || "Selected area"}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Targets: {item.targetCount} | Delivered: {item.deliveredCount} | Failed: {item.failedCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      By: {item.createdByEmail || "Admin"} |{" "}
                      {new Date(item.createdAt).toLocaleString("en-IN")}
                    </p>
                    {item.scheduledFor ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Scheduled for: {new Date(item.scheduledFor).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                    {item.sentAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Sent at: {new Date(item.sentAt).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                    {item.errorMessage ? (
                      <p className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {item.errorMessage}
                      </p>
                    ) : null}
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
