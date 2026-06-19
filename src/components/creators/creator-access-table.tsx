"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";

interface CreatorRow {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  managerUid?: string;
  managerEmail?: string;
  managerName?: string;
  assignedCategories: string[];
  assignedRegionIds: string[];
  createdAt?: number;
  totalUploads?: number;
  approvedCount?: number;
  pendingCount?: number;
  rejectedCount?: number;
  lastUploadAt?: number;
  payoutProfile?: {
    status: string;
    accountHolderName: string;
    bankName: string;
    branchName: string;
    ifscCode: string;
    accountNumberMasked: string;
    accountNumber?: string;
    submittedAt: number;
    reviewedAt: number;
    reviewComment: string;
    signatureName: string;
    agreementAcceptedAt: number;
    agreementText: string;
  } | null;
  payoutSummary?: {
    latestStatus: string;
    totalPaid: number;
    totalQueued: number;
    totalOnHold: number;
    lastPayoutAt: number;
  } | null;
}

interface CategoryDef {
  id: string;
  label: string;
  isBlinking?: boolean;
  isDynamic?: boolean;
  eventDateLabel?: string;
}

interface ManagerOption {
  uid: string;
  managerPublicId: string;
  email: string;
  name: string;
  managerStatus: string;
}

interface CreatorAccessTableProps {
  title: string;
  subtitle: string;
  showPayoutActions?: boolean;
}

export function CreatorAccessTable({
  title,
  subtitle,
  showPayoutActions = false,
}: CreatorAccessTableProps) {
  const { user, roles } = useAuth();
  const { region, regions } = useDashboardRegion();
  const isAdminViewer = showPayoutActions && roles.includes("admin");
  const [rows, setRows] = useState<CreatorRow[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [bankStatus, setBankStatus] = useState("all");
  const [payoutStatus, setPayoutStatus] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [regionMap, setRegionMap] = useState<Record<string, string[]>>({});
  const [linkResult, setLinkResult] = useState<Record<string, string>>({});
  const [setupLinkResult, setSetupLinkResult] = useState<Record<string, string>>({});
  const [passwordByCreator, setPasswordByCreator] = useState<Record<string, string>>({});
  const [payoutAmountMap, setPayoutAmountMap] = useState<Record<string, string>>({});
  const [payoutNoteMap, setPayoutNoteMap] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [bankReviewMap, setBankReviewMap] = useState<Record<string, string>>({});
  const [accessDropdownOpen, setAccessDropdownOpen] = useState<Record<string, boolean>>({});
  const [paymentsDropdownOpen, setPaymentsDropdownOpen] = useState<Record<string, boolean>>({});
  const [categoryModalFor, setCategoryModalFor] = useState<string | null>(null);
  const [transferManagerMap, setTransferManagerMap] = useState<Record<string, string>>({});
  const [transferBusyMap, setTransferBusyMap] = useState<Record<string, boolean>>({});

  function formatDate(epochMs?: number) {
    if (!epochMs) return "-";
    return new Date(epochMs).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function payoutTone(statusValue?: string) {
    if (statusValue === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (statusValue === "approved_for_payout") return "border-sky-200 bg-sky-50 text-sky-700";
    if (statusValue === "on_hold") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadCategories = useCallback(async () => {
    const headers = await authHeader();
    const response = await fetch(`/api/categories/list?regionId=${encodeURIComponent(region.id)}`, { headers });
    const data = (await response.json()) as {
      ok: boolean;
      categories?: CategoryDef[];
      error?: string;
    };
    if (!response.ok || !data.ok || !data.categories) {
      throw new Error(data.error ?? "Unable to load categories.");
    }
    setCategories(data.categories);
  }, [authHeader, region.id]);

  const loadCreators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const url = `/api/creators/list?status=${encodeURIComponent(status)}&q=${encodeURIComponent(
        query
      )}&bankStatus=${encodeURIComponent(bankStatus)}&payoutStatus=${encodeURIComponent(
        payoutStatus
      )}&regionId=${encodeURIComponent(region.id)}`;
      const response = await fetch(url, { headers });
      const data = (await response.json()) as {
        ok: boolean;
        creators?: CreatorRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.creators) {
        throw new Error(data.error ?? "Unable to load creators.");
      }
      setRows(data.creators);
      setSelectedMap(
        Object.fromEntries(
          data.creators.map((row) => [row.creatorPublicId, row.assignedCategories])
        )
      );
      setRegionMap(
        Object.fromEntries(
          data.creators.map((row) => [row.creatorPublicId, row.assignedRegionIds ?? []]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load creators.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, bankStatus, payoutStatus, query, status, region.id]);

  const loadManagers = useCallback(async () => {
    if (!isAdminViewer) {
      return;
    }
    const headers = await authHeader();
    const response = await fetch("/api/admin/managers/list?status=active", { headers });
    const data = (await response.json()) as {
      ok: boolean;
      managers?: ManagerOption[];
      error?: string;
    };
    if (!response.ok || !data.ok || !data.managers) {
      throw new Error(data.error ?? "Unable to load managers.");
    }
    setManagers(data.managers);
  }, [authHeader, isAdminViewer]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadCategories();
    void loadManagers();
  }, [user, loadCategories, loadManagers]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadCreators();
  }, [user, status, loadCreators]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((cat) => [cat.id, cat.label])),
    [categories]
  );
  const categoryMetaMap = useMemo(
    () => Object.fromEntries(categories.map((cat) => [cat.id, cat])),
    [categories],
  );
  const visibleCategoryIds = useMemo(() => new Set(categories.map((cat) => cat.id)), [categories]);

  useEffect(() => {
    if (visibleCategoryIds.size === 0) {
      return;
    }
    setSelectedMap((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([creatorPublicId, categoryIds]) => [
          creatorPublicId,
          categoryIds.filter((categoryId) => visibleCategoryIds.has(categoryId)),
        ]),
      ),
    );
  }, [visibleCategoryIds]);

  function toggleCategory(creatorPublicId: string, categoryId: string) {
    setSelectedMap((prev) => {
      const existing = prev[creatorPublicId] ?? [];
      const has = existing.includes(categoryId);
      const next = has
        ? existing.filter((item) => item !== categoryId)
        : [...existing, categoryId];
      return { ...prev, [creatorPublicId]: next };
    });
  }

  async function assignCategories(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const sanitizedCategoryIds = (selectedMap[creatorPublicId] ?? []).filter((categoryId) =>
        visibleCategoryIds.has(categoryId),
      );
      const response = await fetch(
        `/api/creators/${encodeURIComponent(creatorPublicId)}/assign-categories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            categoryIds: sanitizedCategoryIds,
            regionId: region.id,
          }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Category assignment failed.");
      }
      const nextCategories = sanitizedCategoryIds;
      setSelectedMap((prev) => ({ ...prev, [creatorPublicId]: nextCategories }));
      setRows((prev) =>
        prev.map((row) =>
          row.creatorPublicId === creatorPublicId
            ? { ...row, assignedCategories: nextCategories }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Category assignment failed.");
    }
  }

  async function assignRegions(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/creators/${encodeURIComponent(creatorPublicId)}/assign-regions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            regionIds: regionMap[creatorPublicId] ?? [],
          }),
        },
      );
      const data = (await response.json()) as {
        ok: boolean;
        assignedRegionIds?: string[];
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "State assignment failed.");
      }
      const nextRegionIds = data.assignedRegionIds ?? [];
      setRegionMap((prev) => ({ ...prev, [creatorPublicId]: nextRegionIds }));
      setRows((prev) =>
        prev.map((row) =>
          row.creatorPublicId === creatorPublicId
            ? { ...row, assignedRegionIds: nextRegionIds }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "State assignment failed.");
    }
  }

  async function regenerateLink(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(
          creatorPublicId
        )}/regenerate-link`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as {
        ok: boolean;
        loginLink?: string;
        setupLink?: string;
        initialPassword?: string;
        loginEmail?: string;
        whatsappMessage?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.loginLink) {
        throw new Error(data.error ?? "Unable to regenerate login link.");
      }
      setLinkResult((prev) => ({ ...prev, [creatorPublicId]: data.loginLink! }));
      if (data.setupLink) {
        setSetupLinkResult((prev) => ({ ...prev, [creatorPublicId]: data.setupLink! }));
      }
      if (data.initialPassword) {
        setPasswordByCreator((prev) => ({ ...prev, [creatorPublicId]: data.initialPassword! }));
      } else {
        setPasswordByCreator((prev) => {
          const next = { ...prev };
          delete next[creatorPublicId];
          return next;
        });
      }
      const clipLines: string[] = [];
      if (data.loginEmail) {
        clipLines.push(`Login email: ${data.loginEmail}`);
      }
      if (data.initialPassword) {
        clipLines.push(`System password: ${data.initialPassword}`);
      }
      clipLines.push(`Login URL: ${data.loginLink}`);
      if (data.setupLink) {
        clipLines.push(`Optional setup link: ${data.setupLink}`);
      }
      await navigator.clipboard.writeText(clipLines.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to regenerate link.");
    }
  }

  async function updateAccessStatus(
    creatorPublicId: string,
    nextStatus: "active" | "blocked"
  ) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(creatorPublicId)}/access-status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update creator access.");
      }
      setRows((prev) =>
        prev.map((row) =>
          row.creatorPublicId === creatorPublicId ? { ...row, status: nextStatus } : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update creator access.");
    }
  }

  async function resetDevice(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(creatorPublicId)}/reset-device`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to reset creator device.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset creator device.");
    }
  }

  async function resetPassword(creatorPublicId: string) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/creators/${encodeURIComponent(creatorPublicId)}/reset-password`,
        {
          method: "POST",
          headers,
        }
      );
      const data = (await response.json()) as {
        ok: boolean;
        setupLink?: string;
        initialPassword?: string;
        loginLink?: string;
        loginEmail?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.initialPassword) {
        throw new Error(data.error ?? "Unable to reset creator password.");
      }
      setPasswordByCreator((prev) => ({
        ...prev,
        [creatorPublicId]: data.initialPassword!,
      }));
      if (data.loginLink) {
        setLinkResult((prev) => ({ ...prev, [creatorPublicId]: data.loginLink! }));
      }
      const clipLines: string[] = [];
      if (data.loginEmail) {
        clipLines.push(`Login email: ${data.loginEmail}`);
      }
      clipLines.push(`System password: ${data.initialPassword}`);
      if (data.loginLink) {
        clipLines.push(`Login URL: ${data.loginLink}`);
      }
      await navigator.clipboard.writeText(clipLines.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset creator password.");
    }
  }

  async function updatePayout(
    creatorPublicId: string,
    action: "queue" | "hold" | "mark_paid"
  ) {
    const amount = Number(payoutAmountMap[creatorPublicId] ?? 0);
    if (action === "queue" && (!Number.isFinite(amount) || amount <= 0)) {
      setError("Enter valid payout amount first.");
      return;
    }
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/creators/${encodeURIComponent(creatorPublicId)}/payouts`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            action,
            amount: action === "queue" ? amount : undefined,
            note: payoutNoteMap[creatorPublicId] ?? "",
          }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update payout.");
      }
      setPayoutAmountMap((prev) => ({ ...prev, [creatorPublicId]: "" }));
      setPayoutNoteMap((prev) => ({ ...prev, [creatorPublicId]: "" }));
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update payout.");
    }
  }

  async function reviewBankProfile(
    creatorPublicId: string,
    nextStatus: "approved" | "changes_requested" | "rejected"
  ) {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/creators/${encodeURIComponent(creatorPublicId)}/bank-review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            status: nextStatus,
            reviewComment: bankReviewMap[creatorPublicId] ?? "",
          }),
        }
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to review bank profile.");
      }
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review bank profile.");
    }
  }

  async function transferCreatorToManager(creatorPublicId: string) {
    const managerUid = transferManagerMap[creatorPublicId] ?? "";
    if (!managerUid) {
      setError("Select a manager.");
      return;
    }
    try {
      setTransferBusyMap((prev) => ({ ...prev, [creatorPublicId]: true }));
      setError(null);
      const headers = await authHeader();
      const response = await fetch(
        `/api/admin/creators/${encodeURIComponent(creatorPublicId)}/transfer-manager`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ managerUid }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Creator transfer failed.");
      }
      setTransferManagerMap((prev) => ({ ...prev, [creatorPublicId]: "" }));
      await loadCreators();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creator transfer failed.");
    } finally {
      setTransferBusyMap((prev) => ({ ...prev, [creatorPublicId]: false }));
    }
  }

  function toggleExpanded(creatorPublicId: string) {
    setExpandedRows((prev) => ({
      ...prev,
      [creatorPublicId]: !prev[creatorPublicId],
    }));
  }

  function toggleAccessDropdown(creatorPublicId: string) {
    setAccessDropdownOpen((prev) => ({
      ...prev,
      [creatorPublicId]: !prev[creatorPublicId],
    }));
  }

  function togglePaymentsDropdown(creatorPublicId: string) {
    setPaymentsDropdownOpen((prev) => ({
      ...prev,
      [creatorPublicId]: !prev[creatorPublicId],
    }));
  }

  return (
    <section className="space-y-5 px-1 py-2">
      <div className="portal-control-panel rounded-[28px] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Creator Operations
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">{subtitle}</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
            {rows.length} creators
          </span>
        </div>

        <div className={`mt-5 grid gap-3 ${isAdminViewer ? "md:grid-cols-[minmax(0,1fr)_180px_180px_180px_160px]" : "md:grid-cols-[minmax(0,1fr)_220px_160px]"}`}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, email"
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="pending_invite">Pending invite</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
          {isAdminViewer ? (
            <select
              value={bankStatus}
              onChange={(e) => setBankStatus(e.target.value)}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="all">All bank</option>
              <option value="not_submitted">Bank not submitted</option>
              <option value="pending_review">Bank pending</option>
              <option value="approved">Bank approved</option>
              <option value="changes_requested">Changes requested</option>
              <option value="rejected">Bank rejected</option>
            </select>
          ) : null}
          {isAdminViewer ? (
            <select
              value={payoutStatus}
              onChange={(e) => setPayoutStatus(e.target.value)}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="all">All payouts</option>
              <option value="none">No payout</option>
              <option value="approved_for_payout">Queued</option>
              <option value="on_hold">On hold</option>
              <option value="paid">Paid</option>
            </select>
          ) : null}
          <button
            onClick={() => void loadCreators()}
            className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </p>
      ) : null}

        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Loading creators...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No creators found.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={`mobile-${row.creatorPublicId}`}
                className="portal-mobile-card rounded-3xl p-4"
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(row.creatorPublicId)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p data-no-auto-translate="true" className="truncate text-base font-semibold text-slate-900">{row.name}</p>
                    <p data-no-auto-translate="true" className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      ID: {row.creatorPublicId}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {expandedRows[row.creatorPublicId] ? "Close" : "Open"}
                  </span>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`portal-status-pill ${row.status === "active" ? "bg-emerald-100 text-emerald-700" : row.status === "blocked" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                    {row.status}
                  </span>
                  <span className="portal-status-pill bg-sky-100 text-sky-700">
                    {row.totalUploads ?? 0} uploads
                  </span>
                  <span className="portal-status-pill bg-violet-100 text-violet-700">
                    {(selectedMap[row.creatorPublicId] ?? []).length} categories
                  </span>
                </div>

                {expandedRows[row.creatorPublicId] ? (
                  <>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p data-no-auto-translate="true" className="break-all">{row.email}</p>
                      <p>{row.phone}</p>
                      <p>Status: {row.status}</p>
                      <p>
                        Uploads {row.totalUploads ?? 0} | Approved {row.approvedCount ?? 0} | Pending{" "}
                        {row.pendingCount ?? 0}
                      </p>
                      {isAdminViewer ? (
                        <p>Manager: {row.managerName || row.managerEmail || row.managerUid || "-"}</p>
                      ) : null}
                    </div>

                    {(selectedMap[row.creatorPublicId] ?? []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(selectedMap[row.creatorPublicId] ?? []).map((id) => {
                          const meta = categoryMetaMap[id];
                          return (
                            <span
                              key={`mobile-chip-${row.creatorPublicId}-${id}`}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                meta?.isDynamic
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {categoryNameMap[id] ?? id}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">No categories assigned.</p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCategoryModalFor(row.creatorPublicId)}
                        className="rounded-2xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        Categories
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAccessDropdown(row.creatorPublicId)}
                        className="rounded-2xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        Access
                      </button>
                      {showPayoutActions ? (
                        <button
                          type="button"
                          onClick={() => togglePaymentsDropdown(row.creatorPublicId)}
                          className="rounded-2xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                        >
                          Payments
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {expandedRows[row.creatorPublicId] && accessDropdownOpen[row.creatorPublicId] ? (
                  <div className="mt-3 space-y-2 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void regenerateLink(row.creatorPublicId)}
                        className="rounded-xl bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                      >
                        Share login
                      </button>
                      <button
                        onClick={() =>
                          void updateAccessStatus(
                            row.creatorPublicId,
                            row.status === "blocked" ? "active" : "blocked"
                          )
                        }
                        className={`rounded-xl px-3 py-2 text-xs font-semibold text-white ${
                          row.status === "blocked" ? "bg-[var(--portal-green-dark)]" : "bg-rose-600"
                        }`}
                      >
                        {row.status === "blocked" ? "Enable access" : "Remove access"}
                      </button>
                      <button
                        onClick={() => void resetDevice(row.creatorPublicId)}
                        className="rounded-xl bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                      >
                        Reset device
                      </button>
                      <button
                        onClick={() => void resetPassword(row.creatorPublicId)}
                        className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        Reset password
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <p data-no-auto-translate="true">Login email: {row.email}</p>
                      <p data-no-auto-translate="true" className="mt-1 break-all">
                        System password: {passwordByCreator[row.creatorPublicId] ?? "-"}
                      </p>
                      <p className="mt-1 break-all">
                        Login URL: {linkResult[row.creatorPublicId] ?? "-"}
                      </p>
                      <p className="mt-1 break-all text-slate-600">
                        Optional setup: {setupLinkResult[row.creatorPublicId] ?? "-"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="portal-data-table hidden overflow-x-auto lg:block">
          <table className="min-w-[1280px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned Categories</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Loading creators...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No creators found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.creatorPublicId}>
                  <tr className="border-t border-slate-100/80 align-top">
                    <td colSpan={5} className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(row.creatorPublicId)}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition hover:bg-[var(--portal-surface-soft)]"
                      >
                        <span>
                          <span data-no-auto-translate="true" className="block font-semibold text-slate-900">
                            {row.name}
                          </span>
                          <span data-no-auto-translate="true" className="mt-1 block font-mono text-xs text-slate-600" title={row.creatorPublicId}>
                            ID: {row.creatorPublicId}
                          </span>
                        </span>
                        <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {expandedRows[row.creatorPublicId] ? "Close" : "Open"}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {expandedRows[row.creatorPublicId] ? (
                    <tr className="border-t border-slate-100/80 bg-white">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="mb-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 md:grid-cols-4">
                          <p data-no-auto-translate="true" className="break-all">{row.email}</p>
                          <p>{row.phone || "-"}</p>
                          <p>Status: {row.status}</p>
                          <p>
                            Uploads {row.totalUploads ?? 0} | Approved {row.approvedCount ?? 0} | Pending{" "}
                            {row.pendingCount ?? 0}
                          </p>
                          {isAdminViewer ? (
                            <p className="md:col-span-4">
                              Manager: {row.managerName || row.managerEmail || row.managerUid || "-"}
                            </p>
                          ) : null}
                        </div>
                        <div className="mb-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setCategoryModalFor(row.creatorPublicId)}
                            className="whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                          >
                            Assign Categories
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAccessDropdown(row.creatorPublicId)}
                            className="whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                          >
                            Access
                          </button>
                          {showPayoutActions ? (
                            <button
                              type="button"
                              onClick={() => togglePaymentsDropdown(row.creatorPublicId)}
                              className="whitespace-nowrap rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                            >
                              Payments
                            </button>
                          ) : null}
                        </div>
                        <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Assigned Categories
                            </p>
                            <div className="mt-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Assigned States / UTs
                              </p>
                              <div className="mt-2">
                                <RegionMultiSelectDropdown
                                  regions={regions}
                                  selectedRegionIds={regionMap[row.creatorPublicId] ?? []}
                                  onChange={(nextRegionIds) =>
                                    setRegionMap((prev) => ({
                                      ...prev,
                                      [row.creatorPublicId]: nextRegionIds,
                                    }))
                                  }
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => void assignRegions(row.creatorPublicId)}
                                className="mt-3 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                              >
                                Save States
                              </button>
                            </div>
                            <p className="mt-3 text-xs text-slate-600">
                              Last upload: {formatDate(row.lastUploadAt)}
                            </p>
                            {(selectedMap[row.creatorPublicId] ?? []).length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(selectedMap[row.creatorPublicId] ?? []).map((id) => {
                                  const meta = categoryMetaMap[id];
                                  return (
                                    <span
                                      key={`${row.creatorPublicId}-${id}`}
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                        meta?.isDynamic
                                          ? "bg-sky-100 text-sky-800"
                                          : "bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      {categoryNameMap[id] ?? id}
                                      {meta?.eventDateLabel ? ` · ${meta.eventDateLabel}` : ""}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                          <div className="grid content-start gap-2">
                            {isAdminViewer ? (
                              <div className="rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Transfer Creator
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                  <select
                                    value={transferManagerMap[row.creatorPublicId] ?? ""}
                                    onChange={(event) =>
                                      setTransferManagerMap((prev) => ({
                                        ...prev,
                                        [row.creatorPublicId]: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-xs outline-none transition focus:border-[var(--portal-border-strong)]"
                                  >
                                    <option value="">Select manager</option>
                                    {managers.map((manager) => (
                                      <option key={manager.uid} value={manager.uid}>
                                        {manager.name || manager.email}{" "}
                                        {manager.managerPublicId ? `(${manager.managerPublicId})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={
                                      transferBusyMap[row.creatorPublicId] ||
                                      !(transferManagerMap[row.creatorPublicId] ?? "") ||
                                      transferManagerMap[row.creatorPublicId] === row.managerUid
                                    }
                                    onClick={() => void transferCreatorToManager(row.creatorPublicId)}
                                    className="rounded-lg bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {transferBusyMap[row.creatorPublicId] ? "Transferring..." : "Transfer"}
                                  </button>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                  After transfer, the selected manager will get full access to this creator.
                                </p>
                              </div>
                            ) : null}
                            {passwordByCreator[row.creatorPublicId] || linkResult[row.creatorPublicId] ? (
                              <p className="text-xs font-semibold text-emerald-700">
                                Login details copied to clipboard
                              </p>
                            ) : null}
                            {expandedRows[row.creatorPublicId] && accessDropdownOpen[row.creatorPublicId] ? (
                              <div className="space-y-2 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void regenerateLink(row.creatorPublicId)}
                                    className="rounded-lg bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                                  >
                                    Share login
                                  </button>
                                  <button
                                    onClick={() =>
                                      void updateAccessStatus(
                                        row.creatorPublicId,
                                        row.status === "blocked" ? "active" : "blocked"
                                      )
                                    }
                                    className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                                      row.status === "blocked" ? "bg-[var(--portal-green-dark)]" : "bg-rose-600"
                                    }`}
                                  >
                                    {row.status === "blocked" ? "Enable access" : "Remove access"}
                                  </button>
                                  <button
                                    onClick={() => void resetDevice(row.creatorPublicId)}
                                    className="rounded-lg bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
                                  >
                                    Reset device
                                  </button>
                                  <button
                                    onClick={() => void resetPassword(row.creatorPublicId)}
                                    className="rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
                                  >
                                    Reset password
                                  </button>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                                  <p data-no-auto-translate="true">Login email: {row.email}</p>
                                  <p data-no-auto-translate="true" className="mt-1 break-all">
                                    System password: {passwordByCreator[row.creatorPublicId] ?? "-"}
                                  </p>
                                  <p className="mt-1 break-all">
                                    Login URL: {linkResult[row.creatorPublicId] ?? "-"}
                                  </p>
                                  <p className="mt-1 break-all text-slate-600">
                                    Optional setup: {setupLinkResult[row.creatorPublicId] ?? "-"}
                                  </p>
                                </div>
                                {passwordByCreator[row.creatorPublicId] ||
                                setupLinkResult[row.creatorPublicId] ||
                                linkResult[row.creatorPublicId] ? (
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                    <p className="font-semibold">Latest handoff (also copied)</p>
                                    {passwordByCreator[row.creatorPublicId] ? (
                                      <p data-no-auto-translate="true" className="mt-1 break-all font-mono">
                                        Password: {passwordByCreator[row.creatorPublicId]}
                                      </p>
                                    ) : null}
                                    {setupLinkResult[row.creatorPublicId] ? (
                                      <p className="mt-1 break-all">
                                        Setup: {setupLinkResult[row.creatorPublicId]}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {expandedRows[row.creatorPublicId] && showPayoutActions && paymentsDropdownOpen[row.creatorPublicId] ? (
                              <div className="space-y-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    value={payoutAmountMap[row.creatorPublicId] ?? ""}
                                    onChange={(e) =>
                                      setPayoutAmountMap((prev) => ({
                                        ...prev,
                                        [row.creatorPublicId]: e.target.value,
                                      }))
                                    }
                                    placeholder="Payout amount"
                                    inputMode="decimal"
                                    className="w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-xs outline-none transition focus:border-[var(--portal-border-strong)]"
                                  />
                                  <input
                                    value={payoutNoteMap[row.creatorPublicId] ?? ""}
                                    onChange={(e) =>
                                      setPayoutNoteMap((prev) => ({
                                        ...prev,
                                        [row.creatorPublicId]: e.target.value,
                                      }))
                                    }
                                    placeholder="Payout note"
                                    className="w-full rounded-lg border border-[var(--portal-border)] bg-white px-3 py-2 text-xs outline-none transition focus:border-[var(--portal-border-strong)]"
                                  />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => void updatePayout(row.creatorPublicId, "queue")}
                                    className="rounded-lg bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                                  >
                                    Queue payout
                                  </button>
                                  <button
                                    onClick={() => void updatePayout(row.creatorPublicId, "hold")}
                                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Hold latest
                                  </button>
                                  <button
                                    onClick={() => void updatePayout(row.creatorPublicId, "mark_paid")}
                                    className="rounded-lg bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white"
                                  >
                                    Mark paid
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        {expandedRows[row.creatorPublicId] && showPayoutActions && isAdminViewer && paymentsDropdownOpen[row.creatorPublicId] ? (
                          <div className="mt-4 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
                            <div className="mb-3 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Latest payout</p>
                                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payoutTone(row.payoutSummary?.latestStatus)}`}>
                                  {(row.payoutSummary?.latestStatus ?? "none").replaceAll("_", " ")}
                                </span>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Queued</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">Rs.{row.payoutSummary?.totalQueued ?? 0}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">On hold</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">Rs.{row.payoutSummary?.totalOnHold ?? 0}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Paid</p>
                                <p className="mt-2 text-lg font-bold text-slate-900">Rs.{row.payoutSummary?.totalPaid ?? 0}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  Bank Review
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  Creator signed agreement and payout account review.
                                </p>
                              </div>
                              {row.payoutProfile ? (
                                <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-800">
                                  {row.payoutProfile.status.replaceAll("_", " ")}
                                </span>
                              ) : null}
                            </div>

                            {!row.payoutProfile ? (
                              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                The creator has not submitted a bank profile yet.
                              </div>
                            ) : (
                              <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
                                <div className="space-y-3">
                                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                    <p>Account holder: {row.payoutProfile.accountHolderName}</p>
                                    <p>Bank: {row.payoutProfile.bankName}</p>
                                    <p>Branch: {row.payoutProfile.branchName}</p>
                                    <p>IFSC: {row.payoutProfile.ifscCode}</p>
                                    <p>Masked account: {row.payoutProfile.accountNumberMasked}</p>
                                    <p>Account number: {row.payoutProfile.accountNumber ?? "-"}</p>
                                    <p>Signature: {row.payoutProfile.signatureName}</p>
                                    <p>Accepted: {formatDate(row.payoutProfile.agreementAcceptedAt)}</p>
                                    <p>Submitted: {formatDate(row.payoutProfile.submittedAt)}</p>
                                    {row.payoutProfile.reviewedAt ? (
                                      <p>Reviewed: {formatDate(row.payoutProfile.reviewedAt)}</p>
                                    ) : null}
                                  </div>
                                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-700 whitespace-pre-wrap">
                                    {row.payoutProfile.agreementText || "Agreement copy unavailable."}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <textarea
                                    value={bankReviewMap[row.creatorPublicId] ?? row.payoutProfile.reviewComment ?? ""}
                                    onChange={(e) =>
                                      setBankReviewMap((prev) => ({
                                        ...prev,
                                        [row.creatorPublicId]: e.target.value,
                                      }))
                                    }
                                    placeholder="Admin review comment"
                                    className="min-h-[120px] w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2.5 text-xs outline-none transition focus:border-[var(--portal-border-strong)]"
                                  />
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <button
                                      onClick={() => void reviewBankProfile(row.creatorPublicId, "approved")}
                                      className="rounded-xl bg-[var(--portal-green)] px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Approve bank
                                    </button>
                                    <button
                                      onClick={() => void reviewBankProfile(row.creatorPublicId, "changes_requested")}
                                      className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Ask changes
                                    </button>
                                    <button
                                      onClick={() => void reviewBankProfile(row.creatorPublicId, "rejected")}
                                      className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {categoryModalFor ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-2 sm:p-4">
          <div className="mx-auto my-2 w-full max-w-3xl rounded-2xl bg-white shadow-2xl sm:my-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Assign Categories
                </p>
                <p data-no-auto-translate="true" className="mt-1 text-base font-semibold text-slate-900">
                  {rows.find((item) => item.creatorPublicId === categoryModalFor)?.name ?? "Creator"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalFor(null)}
                className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
              >
                Close
              </button>
            </div>
            <div className="max-h-none overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-5">
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                {categories.map((category) => {
                  const selected = (selectedMap[categoryModalFor] ?? []).includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className={`grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center gap-3 px-3 py-3 text-sm transition first:rounded-t-2xl last:rounded-b-2xl ${
                        category.isDynamic
                          ? "bg-sky-50 text-sky-900 hover:bg-sky-100"
                          : "bg-white text-slate-700 hover:bg-slate-50"
                      } ${category.isBlinking ? "ring-inset ring-1 ring-emerald-300" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(categoryModalFor, category.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span
                          className={`min-w-0 flex-1 overflow-visible break-words text-left leading-5 ${
                            category.isDynamic ? "font-semibold text-sky-950" : "font-semibold text-slate-900"
                          }`}
                          title={category.label}
                        >
                          <CategoryLabelWithLogo id={category.id} label={category.label} />
                        </span>
                        {category.eventDateLabel ? (
                          <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-500">
                            {category.eventDateLabel}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5">
              <button
                type="button"
                onClick={() => setCategoryModalFor(null)}
                className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await assignCategories(categoryModalFor);
                  setCategoryModalFor(null);
                }}
                className="rounded-xl bg-[var(--portal-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
              >
                Save categories
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
