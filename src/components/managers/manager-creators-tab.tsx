"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";

interface CreatorDetailRow {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  assignedCategoriesCount: number;
  createdAt: number;
  updatedAt: number;
}

interface ManagerCreatorSummaryRow {
  uid: string;
  managerPublicId?: string;
  email: string;
  name: string;
  phone: string;
  managerStatus: string;
  creatorCount: number;
  creators: CreatorDetailRow[];
}

function displayManagerId(row: ManagerCreatorSummaryRow): string {
  if (row.managerPublicId && row.managerPublicId.trim().length > 0) {
    return row.managerPublicId;
  }
  return `Mana-MGR-${row.uid.slice(0, 4).toUpperCase()}`;
}

function formatDate(epochMs?: number) {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ManagerCreatorsTab() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const isTelugu = language === "telugu";
  const [rows, setRows] = useState<ManagerCreatorSummaryRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const copy = {
    title: isTelugu ? "మేనేజర్ వారీగా క్రియేటర్స్" : "Manager-wise Creators",
    subtitle: isTelugu
      ? "ప్రతి మేనేజర్‌కు ఎన్ని మంది creators ఉన్నారో, వాళ్ల details ఇక్కడ చూడండి."
      : "See creator counts and creator details under each manager.",
    search: isTelugu ? "మేనేజర్ / క్రియేటర్ సెర్చ్" : "Search manager / creator",
    allStatuses: isTelugu ? "ఆల్ స్టేటసెస్" : "All statuses",
    active: isTelugu ? "యాక్టివ్" : "Active",
    inactive: isTelugu ? "ఇనాక్టివ్" : "Inactive",
    refresh: isTelugu ? "రిఫ్రెష్" : "Refresh",
    loading: isTelugu ? "మేనేజర్ creators లోడ్ అవుతున్నాయి..." : "Loading manager creators...",
    empty: isTelugu ? "డేటా దొరకలేదు." : "No manager creator data found.",
    loginRequired: isTelugu ? "లాగిన్ రిక్వైర్డ్." : "Login required.",
    unableLoad: isTelugu
      ? "మేనేజర్ creators summary లోడ్ చేయలేకపోయాం."
      : "Unable to load manager creator summary.",
    manager: isTelugu ? "మేనేజర్" : "Manager",
    contact: isTelugu ? "కాంటాక్ట్" : "Contact",
    creatorCount: isTelugu ? "క్రియేటర్స్ కౌంట్" : "Creator Count",
    creatorDetails: isTelugu ? "క్రియేటర్ డీటైల్స్" : "Creator Details",
    creatorId: isTelugu ? "క్రియేటర్ ఐడి" : "Creator ID",
    creatorName: isTelugu ? "క్రియేటర్ పేరు" : "Creator Name",
    creatorContact: isTelugu ? "క్రియేటర్ కాంటాక్ట్" : "Creator Contact",
    creatorStatus: isTelugu ? "స్టేటస్" : "Status",
    categories: isTelugu ? "క్యాటగిరీలు" : "Categories",
    joinedAt: isTelugu ? "జాయిన్ డేట్" : "Joined At",
    open: isTelugu ? "ఓపెన్" : "Open",
    close: isTelugu ? "క్లోజ్" : "Close",
    noCreators: isTelugu ? "ఈ మేనేజర్‌కు creators లేరు." : "No creators assigned to this manager.",
  };

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error(copy.loginRequired);
    }
    return { authorization: `Bearer ${token}` };
  }, [copy.loginRequired, user]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/creator-summary?status=${encodeURIComponent(
          status,
        )}&q=${encodeURIComponent(query)}`,
        { headers },
      );
      const data = (await response.json()) as {
        ok: boolean;
        managers?: ManagerCreatorSummaryRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.managers) {
        throw new Error(data.error ?? copy.unableLoad);
      }
      setRows(data.managers);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableLoad);
    } finally {
      setLoading(false);
    }
  }, [authHeader, copy.unableLoad, query, status]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadSummary();
  }, [loadSummary, user]);

  function toggleExpanded(managerUid: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [managerUid]: !prev[managerUid],
    }));
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{copy.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{copy.subtitle}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        >
          <option value="all">{copy.allStatuses}</option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
        <button
          onClick={() => void loadSummary()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
        >
          {copy.refresh}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            {copy.loading}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            {copy.empty}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.uid} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p data-no-auto-translate="true" className="truncate text-base font-semibold text-slate-900">
                    {row.name}
                  </p>
                  <p data-no-auto-translate="true" className="mt-1 truncate font-mono text-[11px] text-slate-500">
                    ID: {displayManagerId(row)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold">
                  {row.creatorCount}
                </span>
              </div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p data-no-auto-translate="true" className="break-all">
                  {row.email}
                </p>
                <p className="mt-1">{row.phone}</p>
                <p className="mt-1">
                  {copy.creatorCount}: {row.creatorCount}
                </p>
              </div>
              <button
                onClick={() => toggleExpanded(row.uid)}
                className="mt-3 w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
              >
                {expandedRows[row.uid] ? copy.close : copy.open}
              </button>
              {expandedRows[row.uid] ? (
                <div className="mt-3 space-y-3">
                  {row.creators.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                      {copy.noCreators}
                    </div>
                  ) : (
                    row.creators.map((creator) => (
                      <div
                        key={`${row.uid}-${creator.creatorPublicId}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                      >
                        <p data-no-auto-translate="true" className="font-semibold text-slate-900">
                          {creator.name}
                        </p>
                        <p data-no-auto-translate="true" className="mt-1 font-mono text-[11px] text-slate-500">
                          {copy.creatorId}: {creator.creatorPublicId}
                        </p>
                        <p data-no-auto-translate="true" className="mt-2 break-all">
                          {creator.email}
                        </p>
                        <p className="mt-1">{creator.phone}</p>
                        <p className="mt-1">
                          {copy.creatorStatus}: {creator.status}
                        </p>
                        <p className="mt-1">
                          {copy.categories}: {creator.assignedCategoriesCount}
                        </p>
                        <p className="mt-1">
                          {copy.joinedAt}: {formatDate(creator.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1180px] w-full text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">{copy.manager}</th>
              <th className="px-4 py-3">{copy.contact}</th>
              <th className="px-4 py-3">{copy.creatorCount}</th>
              <th className="px-4 py-3">{copy.creatorDetails}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  {copy.loading}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  {copy.empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.uid}>
                  <tr className="border-t border-slate-100/80 align-top">
                    <td className="px-4 py-4">
                      <p data-no-auto-translate="true" className="font-semibold text-slate-900">
                        {row.name}
                      </p>
                      <p data-no-auto-translate="true" className="font-mono text-xs text-slate-600">
                        ID: {displayManagerId(row)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{row.managerStatus}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <p data-no-auto-translate="true" className="break-all">
                        {row.email}
                      </p>
                      <p>{row.phone}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold">
                        {row.creatorCount}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleExpanded(row.uid)}
                        className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        {expandedRows[row.uid] ? copy.close : copy.open}
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.uid] ? (
                    <tr className="border-t border-slate-100/80 bg-white">
                      <td colSpan={4} className="px-4 py-4">
                        {row.creators.length === 0 ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                            {copy.noCreators}
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-[920px] w-full text-sm">
                              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                <tr>
                                  <th className="px-4 py-3">{copy.creatorId}</th>
                                  <th className="px-4 py-3">{copy.creatorName}</th>
                                  <th className="px-4 py-3">{copy.creatorContact}</th>
                                  <th className="px-4 py-3">{copy.creatorStatus}</th>
                                  <th className="px-4 py-3">{copy.categories}</th>
                                  <th className="px-4 py-3">{copy.joinedAt}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.creators.map((creator) => (
                                  <tr
                                    key={`${row.uid}-${creator.creatorPublicId}`}
                                    className="border-t border-slate-100/80 align-top"
                                  >
                                    <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                      {creator.creatorPublicId}
                                    </td>
                                    <td className="px-4 py-3 text-slate-900">{creator.name}</td>
                                    <td className="px-4 py-3 text-slate-700">
                                      <p data-no-auto-translate="true" className="break-all">
                                        {creator.email}
                                      </p>
                                      <p className="mt-1">{creator.phone}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{creator.status}</td>
                                    <td className="px-4 py-3 text-slate-700">
                                      {creator.assignedCategoriesCount}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                      {formatDate(creator.createdAt)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
