"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";
import { portalLanguage, t } from "@/lib/i18n";

interface ManagerRow {
  uid: string;
  managerPublicId?: string;
  email: string;
  name: string;
  phone: string;
  managerStatus: string;
  assignedRegionIds: string[];
}

interface ManagerCredentialReveal {
  initialPassword: string;
  loginLink: string;
  recoveryResetLink?: string;
}

function displayManagerId(row: ManagerRow): string {
  if (row.managerPublicId && row.managerPublicId.trim().length > 0) {
    return row.managerPublicId;
  }
  return `Mana-MGR-${row.uid.slice(0, 4).toUpperCase()}`;
}

export function ManagerTable() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { regions } = useDashboardRegion();
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialResult, setCredentialResult] = useState<Record<string, ManagerCredentialReveal>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [regionMap, setRegionMap] = useState<Record<string, string[]>>({});
  const isTelugu = language === "telugu";
  const copy = {
    loginRequired: isTelugu ? "లాగిన్ రిక్వైర్డ్." : "Login required.",
    unableLoad: isTelugu ? "మేనేజర్స్ లోడ్ చేయలేకపోయాం." : "Unable to load managers.",
    unableStatus: isTelugu ? "మేనేజర్ స్టేటస్ చేంజ్ చేయలేకపోయాం." : "Unable to change manager status.",
    unablePassword: isTelugu ? "పాస్‌వర్డ్ రీసెట్ చేయలేకపోయాం." : "Unable to reset password.",
    unableDevice: isTelugu ? "డివైస్ రీసెట్ చేయలేకపోయాం." : "Unable to reset device.",
    unableDelete: isTelugu ? "మేనేజర్‌ను డిలీట్ చేయలేకపోయాం." : "Unable to delete manager.",
    title: isTelugu ? "మేనేజర్స్" : "Managers",
    search: isTelugu ? "సెర్చ్ మేనేజర్" : "Search manager",
    allStatuses: isTelugu ? "ఆల్ స్టేటసెస్" : "All statuses",
    active: isTelugu ? "యాక్టివ్" : "Active",
    inactive: isTelugu ? "ఇనాక్టివ్" : "Inactive",
    refresh: isTelugu ? "రిఫ్రెష్" : "Refresh",
    loading: isTelugu ? "లోడింగ్ మేనేజర్స్..." : "Loading managers...",
    empty: isTelugu ? "మేనేజర్స్ దొరకలేదు." : "No managers found.",
    open: isTelugu ? "ఓపెన్" : "Open",
    close: isTelugu ? "క్లోజ్" : "Close",
    deactivate: isTelugu ? "డియాక్టివేట్" : "Deactivate",
    activate: isTelugu ? "యాక్టివేట్" : "Activate",
    resetPassword: isTelugu ? "రీసెట్ పాస్‌వర్డ్" : "Reset password",
    resetDevice: isTelugu ? "రీసెట్ డివైస్" : "Reset device",
    delete: isTelugu ? "డిలీట్" : "Delete",
    confirmDelete: isTelugu
      ? "ఈ మేనేజర్ యాక్సెస్‌ను డిలీట్ చేయాలా? ముందు transfer చేయని creators లేనేలేని నిర్ధారించండి."
      : "Delete this manager access? Ensure there are no untransferred creators first.",
    loginEmail: isTelugu ? "లాగిన్ ఇమెయిల్" : "Login email",
    initialPassword: isTelugu ? "సిస్టమ్ పాస్వర్డ్" : "System password",
    loginUrl: isTelugu ? "లాగిన్ URL" : "Login URL",
    recoveryLink: isTelugu ? "ఇమెయిల్ రికవరీ లింక్" : "Email recovery link",
    credentialsCopied: isTelugu ? "లాగిన్ వివరాలు కాపీ అయ్యాయి" : "Login details copied to clipboard",
    manager: isTelugu ? "మేనేజర్" : "Manager",
    contact: isTelugu ? "కాంటాక్ట్" : "Contact",
    status: isTelugu ? "స్టేటస్" : "Status",
    actions: isTelugu ? "యాక్షన్స్" : "Actions",
  };

  const lang = portalLanguage(language);
  Object.assign(copy, {
    loginRequired: t("manager.table.loginRequired", lang),
    unableLoad: t("manager.table.unableLoad", lang),
    unableStatus: t("manager.table.unableStatus", lang),
    unablePassword: t("manager.table.unablePassword", lang),
    unableDevice: t("manager.table.unableDevice", lang),
    unableDelete: t("manager.table.unableDelete", lang),
    title: t("manager.table.title", lang),
    search: t("manager.table.search", lang),
    allStatuses: t("manager.table.allStatuses", lang),
    active: t("manager.table.active", lang),
    inactive: t("manager.table.inactive", lang),
    refresh: t("manager.table.refresh", lang),
    loading: t("manager.table.loading", lang),
    empty: t("manager.table.empty", lang),
    open: t("manager.table.open", lang),
    close: t("manager.table.close", lang),
    deactivate: t("manager.table.deactivate", lang),
    activate: t("manager.table.activate", lang),
    resetPassword: t("manager.table.resetPassword", lang),
    resetDevice: t("manager.table.resetDevice", lang),
    delete: t("manager.table.delete", lang),
    confirmDelete: t("manager.table.confirmDelete", lang),
    loginEmail: t("manager.table.loginEmail", lang),
    initialPassword: t("manager.table.initialPassword", lang),
    loginUrl: t("manager.table.loginUrl", lang),
    recoveryLink: t("manager.table.recoveryLink", lang),
    credentialsCopied: t("manager.table.credentialsCopied", lang),
    manager: t("manager.table.manager", lang),
    contact: t("manager.table.contact", lang),
    status: t("manager.table.status", lang),
    actions: t("manager.table.actions", lang),
  });

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error(copy.loginRequired);
    }
    return { authorization: `Bearer ${token}` };
  }, [copy.loginRequired, user]);

  const loadManagers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const url = `/api/admin/managers/list?status=${encodeURIComponent(
        status
      )}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url, { headers });
      const data = (await response.json()) as {
        ok: boolean;
        managers?: ManagerRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.managers) {
        throw new Error(data.error ?? copy.unableLoad);
      }
      setRows(data.managers);
      setRegionMap(
        Object.fromEntries(data.managers.map((row) => [row.uid, row.assignedRegionIds ?? []])),
      );
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
    void loadManagers();
  }, [user, status, loadManagers]);

  async function toggleStatus(managerUid: string, managerStatus: "active" | "inactive") {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/toggle-status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ managerStatus }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableStatus);
      }
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableStatus);
    }
  }

  async function saveManagerRegions(managerUid: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(`/api/admin/managers/${encodeURIComponent(managerUid)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ regionIds: regionMap[managerUid] ?? [] }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        assignedRegionIds?: string[];
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update manager states.");
      }
      const nextRegions = data.assignedRegionIds ?? [];
      setRows((prev) =>
        prev.map((row) => (row.uid === managerUid ? { ...row, assignedRegionIds: nextRegions } : row)),
      );
      setRegionMap((prev) => ({ ...prev, [managerUid]: nextRegions }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update manager states.");
    }
  }

  async function resetPassword(managerUid: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/reset-password`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as {
        ok: boolean;
        initialPassword?: string;
        loginLink?: string;
        recoveryResetLink?: string;
        resetLink?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.initialPassword) {
        throw new Error(data.error ?? copy.unablePassword);
      }
      const newPassword = data.initialPassword;
      const loginLink = data.loginLink ?? "";
      const recoveryResetLink = data.recoveryResetLink ?? data.resetLink;
      setCredentialResult((prev) => ({
        ...prev,
        [managerUid]: {
          initialPassword: newPassword,
          loginLink,
          recoveryResetLink,
        },
      }));
      const row = rows.find((r) => r.uid === managerUid);
      const clipLines = [
        `${copy.loginEmail}: ${row?.email ?? ""}`,
        `${copy.initialPassword}: ${newPassword}`,
        `${copy.loginUrl}: ${loginLink}`,
      ];
      if (recoveryResetLink) {
        clipLines.push(`${copy.recoveryLink}: ${recoveryResetLink}`);
      }
      await navigator.clipboard.writeText(clipLines.join("\n"));
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unablePassword);
    }
  }

  async function resetDevice(managerUid: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}/reset-device`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableDevice);
      }
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableDevice);
    }
  }

  async function deleteManager(managerUid: string) {
    try {
      const confirmed = window.confirm(copy.confirmDelete);
      if (!confirmed) {
        return;
      }
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/managers/${encodeURIComponent(managerUid)}`,
        {
          method: "DELETE",
          headers,
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.unableDelete);
      }
      setCredentialResult((prev) => {
        const next = { ...prev };
        delete next[managerUid];
        return next;
      });
      setExpandedRows((prev) => {
        const next = { ...prev };
        delete next[managerUid];
        return next;
      });
      await loadManagers();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.unableDelete);
    }
  }

  function toggleExpanded(managerUid: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [managerUid]: !prev[managerUid],
    }));
  }

  return (
    <section className="px-1 py-2">
      <h2 className="text-lg font-semibold text-slate-900">{copy.title}</h2>

      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.search}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        >
          <option value="all">{copy.allStatuses}</option>
          <option value="active">{copy.active}</option>
          <option value="inactive">{copy.inactive}</option>
        </select>
        <button
          onClick={() => void loadManagers()}
          className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
        >
          {copy.refresh}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3 lg:hidden">
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
            <div
              key={`mobile-${row.uid}`}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleExpanded(row.uid)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p data-no-auto-translate="true" className="truncate text-base font-semibold text-slate-900">
                    {row.name}
                  </p>
                  <p data-no-auto-translate="true" className="mt-1 truncate font-mono text-[11px] text-slate-500">
                    ID: {displayManagerId(row)}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-xs font-semibold">
                  {expandedRows[row.uid] ? copy.close : copy.open}
                </span>
              </button>
              {expandedRows[row.uid] ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p data-no-auto-translate="true" className="break-all">
                    {row.email}
                  </p>
                  <p className="mt-1">{row.phone}</p>
                  <p className="mt-1">Status: {row.managerStatus}</p>
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2">
                {expandedRows[row.uid] ? (
                  <>
                    <button
                      onClick={() =>
                        void toggleStatus(
                          row.uid,
                          row.managerStatus === "active" ? "inactive" : "active"
                        )
                      }
                      className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                    >
                      {row.managerStatus === "active" ? copy.deactivate : copy.activate}
                    </button>
                    <button
                      onClick={() => void resetPassword(row.uid)}
                      className="w-full rounded-xl bg-[var(--portal-green)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                    >
                      {copy.resetPassword}
                    </button>
                    <button
                      onClick={() => void resetDevice(row.uid)}
                      className="w-full rounded-xl bg-[var(--portal-purple)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                    >
                      {copy.resetDevice}
                    </button>
                    <button
                      onClick={() => void deleteManager(row.uid)}
                      className="w-full rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                      {copy.delete}
                    </button>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
                      <p data-no-auto-translate="true">{copy.loginEmail}: {row.email}</p>
                      <p data-no-auto-translate="true" className="mt-1 break-all">
                        {copy.initialPassword}:{" "}
                        {credentialResult[row.uid]?.initialPassword ?? "-"}
                      </p>
                      <p className="mt-1 break-all">
                        {copy.loginUrl}: {credentialResult[row.uid]?.loginLink ?? "-"}
                      </p>
                      <p className="mt-1 break-all">
                        {copy.recoveryLink}:{" "}
                        {credentialResult[row.uid]?.recoveryResetLink ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Assigned States / UTs
                      </p>
                      <div className="mt-2">
                        <RegionMultiSelectDropdown
                          regions={regions}
                          selectedRegionIds={regionMap[row.uid] ?? []}
                          onChange={(nextRegionIds) =>
                            setRegionMap((prev) => ({ ...prev, [row.uid]: nextRegionIds }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveManagerRegions(row.uid)}
                        className="mt-3 w-full rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Save States
                      </button>
                    </div>
                    {credentialResult[row.uid] ? (
                      <p className="text-xs font-semibold text-emerald-700">
                        {copy.credentialsCopied}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-x-auto lg:block">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">{copy.manager}</th>
              <th className="px-4 py-3">{copy.contact}</th>
              <th className="px-4 py-3">{copy.status}</th>
              <th className="px-4 py-3">{copy.actions}</th>
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
                  <tr key={`${row.uid}-summary`} className="border-t border-slate-100/80 align-top">
                    <td colSpan={4} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.uid)}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        <span>
                          <span data-no-auto-translate="true" className="block font-semibold text-slate-900">
                            {row.name}
                          </span>
                          <span data-no-auto-translate="true" className="mt-1 block font-mono text-xs text-slate-600">
                            ID: {displayManagerId(row)}
                          </span>
                        </span>
                        <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {expandedRows[row.uid] ? copy.close : copy.open}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.uid] ? (
                    <tr key={`${row.uid}-details`} className="border-t border-slate-100/80 bg-white">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 md:grid-cols-3">
                          <p data-no-auto-translate="true" className="break-all">
                            {copy.loginEmail}: {row.email}
                          </p>
                          <p>Phone: {row.phone || "-"}</p>
                          <p>Status: {row.managerStatus}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() =>
                              void toggleStatus(
                                row.uid,
                                row.managerStatus === "active" ? "inactive" : "active"
                              )
                            }
                            className="whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                          >
                            {row.managerStatus === "active" ? copy.deactivate : copy.activate}
                          </button>
                          <button
                            onClick={() => void resetPassword(row.uid)}
                            className="whitespace-nowrap rounded-xl bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                          >
                            {copy.resetPassword}
                          </button>
                          <button
                            onClick={() => void resetDevice(row.uid)}
                            className="whitespace-nowrap rounded-xl bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                          >
                            {copy.resetDevice}
                          </button>
                          <button
                            onClick={() => void deleteManager(row.uid)}
                            className="whitespace-nowrap rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                          >
                            {copy.delete}
                          </button>
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <p data-no-auto-translate="true">{copy.loginEmail}: {row.email}</p>
                          <p data-no-auto-translate="true" className="mt-1 break-all">
                            {copy.initialPassword}:{" "}
                            {credentialResult[row.uid]?.initialPassword ?? "-"}
                          </p>
                          <p className="mt-1 break-all">
                            {copy.loginUrl}: {credentialResult[row.uid]?.loginLink ?? "-"}
                          </p>
                          <p className="mt-1 break-all">
                            {copy.recoveryLink}:{" "}
                            {credentialResult[row.uid]?.recoveryResetLink ?? "-"}
                          </p>
                        </div>
                        {credentialResult[row.uid] ? (
                          <p className="mt-3 text-xs font-semibold text-emerald-700">
                            {copy.credentialsCopied}
                          </p>
                        ) : null}
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                            Assigned States / UTs
                          </p>
                          <div className="mt-2 max-w-md">
                            <RegionMultiSelectDropdown
                              regions={regions}
                              selectedRegionIds={regionMap[row.uid] ?? []}
                              onChange={(nextRegionIds) =>
                                setRegionMap((prev) => ({ ...prev, [row.uid]: nextRegionIds }))
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void saveManagerRegions(row.uid)}
                            className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save States
                          </button>
                        </div>
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
