"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { withDeviceHeader } from "@/lib/client/device-id";

type ReportStatus = "open" | "closed" | "all";
type PortalRole = "admin" | "manager";

interface CommunityReportRow {
  id: string;
  contentType: string;
  statusId: string;
  commentId: string;
  reportedUserId: string;
  reportedUserName: string;
  reporterUserId: string;
  reporterName: string;
  reporterEmail: string;
  reason: string;
  details: string;
  statusTextPreview: string;
  commentTextPreview: string;
  statusImagePath: string;
  regionName: string;
  religionPreference: string;
  locationState: string;
  locationDistrict: string;
  locationCity: string;
  statusCreatedAt: number;
  reportedAt: number;
  reviewStatus: "open" | "closed";
  actionNote: string;
  actionByEmail: string;
  actionAt: number;
  reopenedAt: number;
  reopenedByEmail: string;
  userMailSentAt: number;
  userMailError: string;
}

function formatDate(value: number) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function contentPreview(row: CommunityReportRow) {
  if (row.contentType === "comment") {
    return row.commentTextPreview || row.statusTextPreview || "-";
  }
  return row.statusTextPreview || (row.statusImagePath ? "Image status" : "-");
}

export function CommunityReportsTable({ role }: { role: PortalRole }) {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const [rows, setRows] = useState<CommunityReportRow[]>([]);
  const [status, setStatus] = useState<ReportStatus>("open");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [mailMap, setMailMap] = useState<Record<string, boolean>>({});
  const basePath = `/api/${role}/community-reports`;

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Login required.");
    return withDeviceHeader({ authorization: `Bearer ${token}` });
  }, [user]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `${basePath}?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}&regionId=${encodeURIComponent(region.id)}`,
        { headers, cache: "no-store" },
      );
      const data = (await response.json()) as {
        ok: boolean;
        reports?: CommunityReportRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.reports) {
        throw new Error(data.error ?? "Unable to load reports.");
      }
      setRows(data.reports);
      setNoteMap((prev) => {
        const next = { ...prev };
        data.reports?.forEach((item) => {
          next[item.id] = next[item.id] ?? item.actionNote ?? "";
        });
        return next;
      });
      setMailMap((prev) => {
        const next = { ...prev };
        data.reports?.forEach((item) => {
          next[item.id] = next[item.id] ?? Boolean(item.reporterEmail);
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, basePath, query, region.id, status]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  async function updateReport(row: CommunityReportRow, nextStatus: "open" | "closed") {
    setBusyId(row.id);
    setNotice(null);
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(`${basePath}/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: nextStatus,
          actionNote: noteMap[row.id] ?? "",
          sendUserEmail: mailMap[row.id] ?? true,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        report?: CommunityReportRow;
        userMailSent?: boolean;
        userMailError?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.report) {
        throw new Error(data.error ?? "Unable to update report.");
      }
      setRows((prev) => prev.map((item) => (item.id === row.id ? data.report! : item)));
      setNotice(
        data.userMailError
          ? `Report updated, but mail failed: ${data.userMailError}`
          : data.userMailSent
            ? "Report updated and user email sent."
            : "Report updated.",
      );
      if (status !== "all" && data.report.reviewStatus !== status) {
        setRows((prev) => prev.filter((item) => item.id !== row.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update report.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">
              Safety Reports
            </p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">
              Community status reports
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-600">
              Review status/reply reports, update the user by email, and close or re-open reports after action.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadReports()}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[180px_1fr]">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ReportStatus)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reason, user, region, content"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Report</th>
                <th className="px-4 py-3">Reporter</th>
                <th className="px-4 py-3">Reported user</th>
                <th className="px-4 py-3">Content</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center font-bold text-slate-500" colSpan={5}>
                    Loading reports...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center font-bold text-slate-500" colSpan={5}>
                    No reports found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                          row.reviewStatus === "closed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {row.reviewStatus.toUpperCase()}
                      </span>
                      <p className="mt-2 font-black text-slate-950">{row.reason || "-"}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {row.contentType || "status"} · {formatDate(row.reportedAt)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {row.regionName || "-"} · {row.religionPreference || "-"}
                      </p>
                      {row.locationState || row.locationDistrict || row.locationCity ? (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {[row.locationCity, row.locationDistrict, row.locationState]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      ) : null}
                      {row.details ? (
                        <p className="mt-2 max-w-xs rounded-2xl bg-slate-50 p-3 font-medium text-slate-700">
                          {row.details}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{row.reporterName || "User"}</p>
                      <p className="break-all text-xs font-semibold text-slate-500">
                        {row.reporterEmail || "No email on report"}
                      </p>
                      <p className="mt-2 break-all text-xs text-slate-400">{row.reporterUserId}</p>
                      {row.userMailSentAt ? (
                        <p className="mt-2 text-xs font-bold text-emerald-700">
                          Mail sent {formatDate(row.userMailSentAt)}
                        </p>
                      ) : null}
                      {row.userMailError ? (
                        <p className="mt-2 text-xs font-bold text-red-600">{row.userMailError}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{row.reportedUserName || "User"}</p>
                      <p className="mt-2 break-all text-xs text-slate-400">{row.reportedUserId}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="max-w-sm whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 font-semibold text-slate-700">
                        {contentPreview(row)}
                      </p>
                      <p className="mt-2 break-all text-xs text-slate-400">Status: {row.statusId}</p>
                      {row.commentId ? (
                        <p className="break-all text-xs text-slate-400">Reply: {row.commentId}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <textarea
                        value={noteMap[row.id] ?? ""}
                        onChange={(event) =>
                          setNoteMap((prev) => ({ ...prev, [row.id]: event.target.value }))
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="Action note for user and audit"
                        className="w-72 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none"
                      />
                      <label className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={mailMap[row.id] ?? true}
                          disabled={!row.reporterEmail}
                          onChange={(event) =>
                            setMailMap((prev) => ({ ...prev, [row.id]: event.target.checked }))
                          }
                        />
                        Email update to reporter
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {row.reviewStatus === "closed" ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void updateReport(row, "open")}
                            className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                          >
                            Re-open
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void updateReport(row, "closed")}
                            className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
                          >
                            Close report
                          </button>
                        )}
                      </div>
                      {row.actionNote || row.actionByEmail ? (
                        <p className="mt-3 max-w-xs text-xs font-semibold text-slate-500">
                          Last action: {row.actionNote || "-"} {row.actionByEmail ? `by ${row.actionByEmail}` : ""}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
