"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

interface RegionOption {
  id: string;
  name: string;
}

interface AppUserRow {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  phoneDigits: string;
  selectedRegion: string;
  selectedRegionName: string;
  preferredLanguage: string;
  authProvider: string;
  subscribed: boolean;
  tokenCount: number;
  notificationsReachable: boolean;
  marketingReady: boolean;
  marketingStatusReason: string;
  lastActiveAt: number;
  lastLoginAt: number;
  updatedAt: number;
  createdAt: number;
}

interface AppUsersResponse {
  ok: boolean;
  error?: string;
  date?: string;
  regions?: RegionOption[];
  summary?: {
    total: number;
    subscribers: number;
    nonSubscribers: number;
    reachable: number;
    marketingReady: number;
  };
  users?: AppUserRow[];
}

function formatDateTime(value: number) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function humanLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

export function AppUsersReportBoard() {
  const { user } = useAuth();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [regionId, setRegionId] = useState("all");
  const [subscription, setSubscription] = useState("all");
  const [marketing, setMarketing] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AppUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summary, setSummary] = useState({
    total: 0,
    subscribers: 0,
    nonSubscribers: 0,
    reachable: 0,
    marketingReady: 0,
  });

  const loadUsers = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        regionId,
        subscription,
        marketing,
        search,
      });
      const response = await fetch(`/api/admin/app-users?${params.toString()}`, {
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        cache: "no-store",
      });
      const data = (await response.json()) as AppUsersResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to load app users.");
      }
      setRegions(data.regions ?? []);
      setRows(data.users ?? []);
      setSummary(
        data.summary ?? {
          total: 0,
          subscribers: 0,
          nonSubscribers: 0,
          reachable: 0,
          marketingReady: 0,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load app users.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [marketing, regionId, search, subscription, user]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const totalWithNotifications = useMemo(
    () => rows.filter((row) => row.notificationsReachable).length,
    [rows],
  );

  const exportCsv = useCallback(() => {
    const header = [
      "Name",
      "Email",
      "Phone Number",
      "State",
      "Language",
      "Auth Provider",
      "Subscriber",
      "Notifications Reachable",
      "Marketing Ready",
      "Last Login",
      "Last Active",
      "UID",
    ];
    const lines = rows.map((row) =>
      [
        row.name || "Unnamed user",
        row.email,
        row.phoneNumber,
        row.selectedRegionName,
        humanLabel(row.preferredLanguage),
        humanLabel(row.authProvider),
        row.subscribed ? "Yes" : "No",
        row.notificationsReachable ? "Yes" : "No",
        row.marketingReady ? "Yes" : "No",
        formatDateTime(row.lastLoginAt),
        formatDateTime(row.lastActiveAt),
        row.uid,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mana-poster-app-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">
              App Users
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Login users
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Account details, subscription status, notification reach, and recent activity.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(170px,1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(260px,1.4fr)_auto]">
            <label className="text-sm font-medium text-slate-700">
              State / UT
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
              >
                <option value="all">All assigned states</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Audience
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={subscription}
                onChange={(event) => setSubscription(event.target.value)}
              >
                <option value="all">All users</option>
                <option value="subscribers">Subscribers</option>
                <option value="non_subscribers">Non-subscribers</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Marketing
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                value={marketing}
                onChange={(event) => setMarketing(event.target.value)}
              >
                <option value="all">All users</option>
                <option value="ready">Marketing ready</option>
                <option value="not_ready">Not ready</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Search
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Email, phone, or name"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadUsers();
                  }
                }}
              />
            </label>
            <button
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={loading}
              onClick={() => void loadUsers()}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: "App Users", value: summary.total },
          { label: "Subscribers", value: summary.subscribers },
          { label: "Non-subscribers", value: summary.nonSubscribers },
          { label: "Push Reachable", value: totalWithNotifications || summary.reachable },
          { label: "Marketing Ready", value: summary.marketingReady },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Saved app users</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rows.length} users match current filters. Open details only when you need contact-level data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
              type="button"
              onClick={() => setDetailsOpen((value) => !value)}
            >
              {detailsOpen ? "Hide details" : `Show details (${rows.length})`}
            </button>
            <button
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              type="button"
              disabled={rows.length === 0}
              onClick={exportCsv}
            >
              Export CSV
            </button>
          </div>
        </div>
        {detailsOpen ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Language</th>
                <th className="px-4 py-3 font-semibold">Login</th>
                <th className="px-4 py-3 font-semibold">Subscription</th>
                <th className="px-4 py-3 font-semibold">Notifications</th>
                <th className="px-4 py-3 font-semibold">Marketing</th>
                <th className="px-4 py-3 font-semibold">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.uid} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">
                      {row.name || "Unnamed user"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{row.uid}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.email || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.phoneNumber || "-"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.selectedRegionName || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{humanLabel(row.preferredLanguage)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{humanLabel(row.authProvider)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.lastLoginAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        row.subscribed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.subscribed ? "Subscriber" : "Non-subscriber"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {row.notificationsReachable ? "Reachable" : "No token"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{row.tokenCount} device token(s)</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        row.marketingReady
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.marketingReady ? "Ready" : "Not ready"}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.marketingStatusReason}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatDateTime(row.lastActiveAt)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    No app users found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="p-5 text-sm text-slate-500">
            Details are hidden. Use filters/search above, then open details to inspect users.
          </div>
        )}
      </div>
    </section>
  );
}
