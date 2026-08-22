"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";

type PushAudience = "area_users" | "all_users";

interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  imageUrl: string;
  route: string;
  audience: PushAudience;
  audienceSegment?: AudienceSegment;
  targetState?: string;
  targetRegionIds?: string[];
  targetDistrict?: string;
  targetCity?: string;
  targetReligion?: "all" | "hindu" | "muslim" | "christian";
  category: string;
  status: "scheduled" | "sent" | "failed" | "processing";
  matchedUserCount?: number;
  targetCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledFor: number | null;
  errorMessage?: string;
  createdAt: number;
  sentAt: number | null;
  createdByEmail: string;
}

type AudienceSegment =
  | "all_area_users"
  | "daily_active_users"
  | "active_users"
  | "monthly_active_users"
  | "inactive_users"
  | "subscribers"
  | "non_subscribers";

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
  const [audience, setAudience] = useState<PushAudience>("area_users");
  const [audiences, setAudiences] = useState<PushAudience[]>(["area_users"]);
  const [audienceSegment, setAudienceSegment] = useState<AudienceSegment>("all_area_users");
  const [targetRegionIds, setTargetRegionIds] = useState<string[]>([region.id]);
  const [targetDistrict, setTargetDistrict] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetReligion, setTargetReligion] =
    useState<"all" | "hindu" | "muslim" | "christian">("all");
  const [audienceCounts, setAudienceCounts] = useState<Partial<Record<AudienceSegment, number>>>({});
  const [locationRows, setLocationRows] = useState<LocationInsightRow[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      audiences?: PushAudience[];
      error?: string;
    };
    if (response.ok && data.ok) {
      setItems(data.notifications ?? []);
      setAudiences(data.audiences?.length ? data.audiences : ["area_users"]);
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

  async function loadAudienceCounts() {
    const token = await user?.getIdToken();
    if (!token || audience !== "area_users") {
      setAudienceCounts({});
      return;
    }
    const params = new URLSearchParams();
    targetRegionIds.forEach((regionId) => params.append("targetRegionIds", regionId));
    if (targetDistrict.trim()) {
      params.set("targetDistrict", targetDistrict.trim());
    }
    if (targetCity.trim()) {
      params.set("targetCity", targetCity.trim());
    }
    params.set("targetReligion", targetReligion);
    const response = await fetch(`/api/admin/push-notifications?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as {
      ok: boolean;
      audienceCounts?: Partial<Record<AudienceSegment, number>> | null;
    };
    if (response.ok && data.ok) {
      setAudienceCounts(data.audienceCounts ?? {});
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    void loadAudienceCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, audience, targetRegionIds.join(","), targetDistrict, targetCity, targetReligion]);

  useEffect(() => {
    if (!items.some((item) => item.status === "processing")) {
      return;
    }
    const interval = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
    if (audience === "area_users" && targetRegionIds.length === 0) {
      setStatusMessage("Select at least one State / UT for area targeting.");
      return;
    }
    if (audience === "area_users" && targetRegionIds.length > 1 && (targetDistrict.trim() || targetCity.trim())) {
      setStatusMessage("District and city targeting is available only when one State / UT is selected.");
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const selectedRegionNames = regions
        .filter((item) => targetRegionIds.includes(item.id))
        .map((item) => item.name);
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("message", message.trim());
      formData.set("route", "home");
      formData.set("audience", audience);
      formData.set("audienceSegment", audienceSegment);
      formData.set("category", "");
      formData.set("targetState", audience === "area_users" ? selectedRegionNames.join(", ") : "");
      targetRegionIds.forEach((regionId) => {
        formData.append("targetRegionIds", regionId);
      });
      formData.set("targetDistrict", audience === "area_users" ? targetDistrict.trim() : "");
      formData.set("targetCity", audience === "area_users" ? targetCity.trim() : "");
      formData.set("targetReligion", targetReligion);
      if (imageFile) {
        formData.set("image", imageFile);
      }

      const endpoint = editingId
        ? `/api/admin/push-notifications/${encodeURIComponent(editingId)}`
        : "/api/admin/push-notifications";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        delivery?: { targetCount: number; deliveredCount: number; failedCount: number } | null;
      };
      if (!response.ok || !data.ok) {
        setStatusMessage(data.error ?? "Unable to send push notification.");
        return;
      }

      setTitle("");
      setMessage("");
      setAudience("area_users");
      setTargetRegionIds([region.id]);
      setAudienceSegment("all_area_users");
      setTargetDistrict("");
      setTargetCity("");
      setTargetReligion("all");
      setImageFile(null);
      const input = document.getElementById("push-image-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      setEditingId(null);
      const deliveryMessage = data.delivery
        ? `Delivered ${data.delivery.deliveredCount}/${data.delivery.targetCount}. Failed ${data.delivery.failedCount}.`
        : "";
      setStatusMessage(
        editingId
          ? "Push notification history updated."
          : deliveryMessage || "Push notification sent.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  function clearForm() {
    setTitle("");
    setMessage("");
    setAudience("area_users");
    setTargetRegionIds([region.id]);
    setAudienceSegment("all_area_users");
    setTargetDistrict("");
    setTargetCity("");
    setTargetReligion("all");
    setImageFile(null);
    setEditingId(null);
    const input = document.getElementById("push-image-input") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  }

  function startEdit(item: PushNotificationItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setAudience(item.audience ?? "area_users");
    setAudienceSegment(item.audienceSegment ?? "all_area_users");
    setTargetRegionIds(item.targetRegionIds?.length ? item.targetRegionIds : [region.id]);
    setTargetDistrict(item.targetDistrict ?? "");
    setTargetCity(item.targetCity ?? "");
    setTargetReligion(item.targetReligion ?? "all");
    setImageFile(null);
    const input = document.getElementById("push-image-input") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
    setStatusMessage("Editing selected push history. Save changes before resend.");
  }

  async function resendNotification(item: PushNotificationItem) {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    setActionBusyId(item.id);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/admin/push-notifications/${encodeURIComponent(item.id)}/resend`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        delivery?: { targetCount: number; deliveredCount: number; failedCount: number };
      };
      if (!response.ok || !data.ok) {
        setStatusMessage(data.error ?? "Unable to resend push notification.");
        return;
      }
      setStatusMessage(
        data.delivery
          ? `Delivered ${data.delivery.deliveredCount}/${data.delivery.targetCount}. Failed ${data.delivery.failedCount}.`
          : "Push notification sent again.",
      );
      await load();
    } finally {
      setActionBusyId(null);
    }
  }

  async function deleteNotification(item: PushNotificationItem) {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    const confirmed = window.confirm(`Delete push notification history: ${item.title}?`);
    if (!confirmed) {
      return;
    }
    setActionBusyId(item.id);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/admin/push-notifications/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatusMessage(data.error ?? "Unable to delete push notification.");
        return;
      }
      if (editingId === item.id) {
        clearForm();
      }
      setStatusMessage("Push notification history deleted.");
      await load();
    } finally {
      setActionBusyId(null);
    }
  }

  const selectedRegions = regions.filter((item) => targetRegionIds.includes(item.id));
  const singleSelectedRegion = selectedRegions.length === 1 ? selectedRegions[0] : null;
  const selectedStateName = singleSelectedRegion?.name ?? "";
  const districtOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !selectedStateName || row.state === selectedStateName)
        .map((row) => row.district)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const cityOptions = Array.from(
    new Set(
      locationRows
        .filter((row) => !selectedStateName || row.state === selectedStateName)
        .filter((row) => !targetDistrict || row.district === targetDistrict)
        .map((row) => row.city)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (audience !== "area_users") {
      return;
    }
    if (targetRegionIds.length > 0) {
      return;
    }
    setTargetRegionIds([region.id]);
    setTargetDistrict("");
    setTargetCity("");
  }, [audience, region.id, targetRegionIds.length]);

  useEffect(() => {
    if (targetRegionIds.length <= 1) {
      return;
    }
    setTargetDistrict("");
    setTargetCity("");
  }, [targetRegionIds.length]);

  function displayTargetStates(item: PushNotificationItem) {
    const regionIds = item.targetRegionIds ?? [];
    if (regionIds.length > 0) {
      const names = regions
        .filter((regionItem) => regionIds.includes(regionItem.id))
        .map((regionItem) => regionItem.name);
      return names.length > 0 ? names.join(", ") : regionIds.join(", ");
    }
    return item.targetState ?? "";
  }

  function audienceSegmentLabel(segment?: AudienceSegment, itemAudience: PushAudience = "area_users") {
    if (itemAudience === "all_users") {
      return "All installed app devices";
    }
    switch (segment) {
      case "daily_active_users":
        return "Daily active users";
      case "active_users":
        return "Weekly active users";
      case "monthly_active_users":
        return "Monthly active users";
      case "inactive_users":
        return "Non-active users";
      case "subscribers":
        return "Subscribers";
      case "non_subscribers":
        return "Non-subscribers";
      default:
        return "All selected users";
    }
  }

  function audienceOptionLabel(segment: AudienceSegment, label: string) {
    if (audience === "all_users" && segment === "all_area_users") {
      return "All installed app devices";
    }
    const count = audienceCounts[segment];
    return `${label}${typeof count === "number" ? ` (${count})` : ""}`;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
          App Users Push
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">
          {editingId ? "Edit push notification" : "Send app notification"}
        </h3>
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
              <span className="font-semibold">Send to</span>
              <select
                value={audience}
                onChange={(event) => {
                  const nextAudience = event.target.value as PushAudience;
                  setAudience(nextAudience);
                  if (nextAudience === "all_users") {
                    setAudienceSegment("all_area_users");
                  }
                  setTargetDistrict("");
                  setTargetCity("");
                }}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              >
                <option value="area_users">Selected State / UT users</option>
                {audiences.includes("all_users") ? (
                  <option value="all_users">All installed app devices</option>
                ) : null}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Segment</span>
              <select
                value={audienceSegment}
                onChange={(event) => setAudienceSegment(event.target.value as AudienceSegment)}
                disabled={audience === "all_users"}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              >
                <option value="all_area_users">{audienceOptionLabel("all_area_users", "All selected State / UT devices")}</option>
                {audience === "area_users" ? (
                  <>
                    <option value="daily_active_users">{audienceOptionLabel("daily_active_users", "Daily active users - last 24 hours")}</option>
                    <option value="active_users">{audienceOptionLabel("active_users", "Weekly active users - last 7 days")}</option>
                    <option value="monthly_active_users">{audienceOptionLabel("monthly_active_users", "Monthly active users - last 30 days")}</option>
                    <option value="inactive_users">{audienceOptionLabel("inactive_users", "Non-active users - not active in last 7 days")}</option>
                    <option value="subscribers">{audienceOptionLabel("subscribers", "Subscribers only")}</option>
                    <option value="non_subscribers">{audienceOptionLabel("non_subscribers", "Non-subscribers only")}</option>
                  </>
                ) : null}
              </select>
            </label>
          </div>

          {audience === "area_users" ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-bold text-emerald-900">State and local area targeting</p>
            <p className="mt-1 text-xs leading-6 text-emerald-700">
              State targeting uses the user&apos;s selected app state. District and city filters use saved local area when available.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">States / UTs</span>
                <RegionMultiSelectDropdown
                  regions={regions}
                  selectedRegionIds={targetRegionIds}
                  onChange={(nextRegionIds) => {
                    setTargetRegionIds(nextRegionIds);
                    setTargetDistrict("");
                    setTargetCity("");
                  }}
                  label="Add State / UT"
                />
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">District</span>
                <select
                  value={targetDistrict}
                  onChange={(event) => {
                    setTargetDistrict(event.target.value);
                    setTargetCity("");
                  }}
                  disabled={targetRegionIds.length !== 1}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">{targetRegionIds.length === 1 ? "Any district" : "Single state only"}</option>
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
                  disabled={targetRegionIds.length !== 1}
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="">{targetRegionIds.length === 1 ? "Any city" : "Single state only"}</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-emerald-950">
                <span className="font-semibold">Religion</span>
                <select
                  value={targetReligion}
                  onChange={(event) =>
                    setTargetReligion(event.target.value as "all" | "hindu" | "muslim" | "christian")
                  }
                  className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none"
                >
                  <option value="all">All religions</option>
                  <option value="hindu">Hindu only</option>
                  <option value="muslim">Muslim only</option>
                  <option value="christian">Christian only</option>
                </select>
              </label>
            </div>
          </div>
          ) : null}

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
            {busy ? (editingId ? "Saving..." : "Queueing...") : editingId ? "Save Changes" : "Send Push Notification"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="ml-3 rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel edit
            </button>
          ) : null}
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
          Sent, failed, and processing notifications stay here until an admin deletes them.
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
                      Route: {item.route} | Audience: {audienceSegmentLabel(item.audienceSegment, item.audience)}
                      {item.category ? ` | Category: ${item.category}` : ""}
                    </p>
                    {item.audience === "area_users" ? (
                      <p className="mt-1 text-xs font-semibold text-emerald-700">
                        Area: {[item.targetCity, item.targetDistrict, displayTargetStates(item)]
                          .filter(Boolean)
                          .join(", ") || "Selected area"}
                        {" "}
                        | Religion: {item.targetReligion && item.targetReligion !== "all"
                          ? item.targetReligion
                          : "All"}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Matched Users: {item.matchedUserCount ?? "-"} | Target Tokens: {item.targetCount} | Delivered: {item.deliveredCount} | Failed: {item.failedCount}
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
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={actionBusyId === item.id}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void resendNotification(item)}
                        disabled={actionBusyId === item.id || item.status === "processing"}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {actionBusyId === item.id ? "Working..." : "Resend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteNotification(item)}
                        disabled={actionBusyId === item.id}
                        className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
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
