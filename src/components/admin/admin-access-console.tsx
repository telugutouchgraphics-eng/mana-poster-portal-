"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

function displayAdminEmail(email: string) {
  return email
    .trim()
    .toLowerCase()
    .replace("+manaposter-admin@", "@")
    .replace("+manaposter-landing@", "@");
}

interface AdminAccessRow {
  uid: string;
  adminLoginId?: string;
  email: string;
  name: string;
  phone: string;
  adminStatus: string;
  createdAt: number;
  updatedAt: number;
}

interface CreateAdminResponse {
  ok: boolean;
  error?: string;
  adminLoginId?: string;
  email?: string;
  name?: string;
  loginLink?: string;
  setupLink?: string;
  existingUser?: boolean;
}

export function AdminAccessConsole() {
  const { user } = useAuth();
  const [credentialEmail, setCredentialEmail] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createResult, setCreateResult] = useState<CreateAdminResponse | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [rows, setRows] = useState<AdminAccessRow[]>([]);
  const [rowsBusy, setRowsBusy] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  useEffect(() => {
    setCredentialEmail(displayAdminEmail(user?.email ?? ""));
  }, [user?.email]);

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadAdmins = useCallback(async () => {
    if (!user) {
      return;
    }
    setRowsBusy(true);
    setRowsError(null);
    try {
      const headers = await authHeader();
      const response = await fetch("/api/admin/access/list", { headers });
      const data = (await response.json()) as {
        ok: boolean;
        admins?: AdminAccessRow[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.admins) {
        throw new Error(data.error ?? "Unable to load admin access.");
      }
      setRows(data.admins);
    } catch (error) {
      setRowsError(error instanceof Error ? error.message : "Unable to load admin access.");
    } finally {
      setRowsBusy(false);
    }
  }, [authHeader, user]);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  async function handleCredentialUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialBusy(true);
    setCredentialMessage(null);
    setCredentialError(null);
    try {
      const headers = await authHeader();
      const response = await fetch("/api/admin/access/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          email: credentialEmail.trim(),
          password: credentialPassword,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to update admin login.");
      }
      setCredentialPassword("");
      setCredentialMessage("Landing admin login updated.");
      await loadAdmins();
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : "Unable to update admin login.");
    } finally {
      setCredentialBusy(false);
    }
  }

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateBusy(true);
    setCreateResult(null);
    setCreateError(null);
    try {
      const headers = await authHeader();
      const response = await fetch("/api/admin/access/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          name: adminName.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim(),
        }),
      });
      const data = (await response.json()) as CreateAdminResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to grant admin access.");
      }
      setCreateResult(data);
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      await loadAdmins();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to grant admin access.");
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleStatus(row: AdminAccessRow) {
    try {
      const headers = await authHeader();
      const nextStatus = row.adminStatus === "active" ? "inactive" : "active";
      const response = await fetch(
        `/api/admin/access/${encodeURIComponent(row.uid)}/toggle-status`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ adminStatus: nextStatus }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to change admin access.");
      }
      await loadAdmins();
    } catch (error) {
      setRowsError(error instanceof Error ? error.message : "Unable to change admin access.");
    }
  }

  const currentUid = user?.uid ?? "";
  const activeCount = useMemo(
    () => rows.filter((item) => item.adminStatus === "active").length,
    [rows],
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
            Landing Admin Login
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Change admin email and password</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Update the admin email and password used to sign in to `admin.manaposter.in`.
          </p>

          <form onSubmit={handleCredentialUpdate} className="mt-6 space-y-4">
            <input
              type="email"
              value={credentialEmail}
              onChange={(event) => setCredentialEmail(event.target.value)}
              placeholder="Admin email"
              required
              className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            />
            <div className="relative">
              <input
                type={showCredentialPassword ? "text" : "password"}
                value={credentialPassword}
                onChange={(event) => setCredentialPassword(event.target.value)}
                placeholder="New password"
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 pr-14 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowCredentialPassword((value) => !value)}
                aria-label={showCredentialPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-3 my-auto h-9 rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {showCredentialPassword ? "Hide" : "Show"}
              </button>
            </div>
            <button
              type="submit"
              disabled={credentialBusy}
              className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60"
            >
              {credentialBusy ? "Updating..." : "Update Admin Login"}
            </button>
          </form>

          {credentialError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {credentialError}
            </p>
          ) : null}

          {credentialMessage ? (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {credentialMessage}
            </p>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
            Admin Access
          </p>
          <h3 className="mt-2 text-2xl font-bold text-slate-950">Give landing page access to admins</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Enter admin details. A secure setup link will be generated instead of a shared password.
          </p>

          <form onSubmit={handleCreateAdmin} className="mt-6 grid gap-4 md:grid-cols-3">
            <input
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              placeholder="Admin name"
              required
              className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            />
            <input
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              placeholder="Admin email"
              required
              className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            />
            <input
              value={adminPhone}
              onChange={(event) => setAdminPhone(event.target.value)}
              placeholder="Admin phone"
              required
              className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
            />
            <button
              type="submit"
              disabled={createBusy}
              className="md:col-span-3 rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)] disabled:opacity-60"
            >
              {createBusy ? "Granting access..." : "Grant Admin Access"}
            </button>
          </form>

          {createError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {createError}
            </p>
          ) : null}

          {createResult?.ok ? (
            <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              <p className="font-semibold text-emerald-900">{createResult.name} access ready</p>
              <p className="mt-1">Admin ID: {createResult.adminLoginId}</p>
              <p className="mt-1">Login email: {createResult.email}</p>
              <p className="mt-1 break-all">Login link: {createResult.loginLink}</p>
              <p className="mt-1 break-all">Setup link: {createResult.setupLink}</p>
              <p className="mt-1 text-emerald-700">
                {createResult.existingUser
                  ? "Existing account access was refreshed. Use the setup link to set a new password."
                  : "New admin should use the setup link to set a password securely."}
              </p>
            </div>
          ) : null}
        </article>
      </div>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              Admin List
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Landing page admins</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Active admins: {activeCount}. Manage admin access from here.
            </p>
          </div>
          <button
            onClick={() => void loadAdmins()}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {rowsError ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {rowsError}
          </p>
        ) : null}

        <div className="mt-5 space-y-3 lg:hidden">
          {rowsBusy ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              Loading admin access...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No admin access records found.
            </div>
          ) : (
            rows.map((row) => {
              const selfRow = row.uid === currentUid;
              return (
                <div key={`mobile-${row.uid}`} className="rounded-[24px] border border-[var(--portal-border)] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-950">{row.name || "Admin user"}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{row.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${row.adminStatus === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {row.adminStatus}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <p>Admin ID: {row.adminLoginId || "-"}</p>
                    <p>Phone: {row.phone || "-"}</p>
                    <p>{selfRow ? "Current login" : "Managed admin"}</p>
                  </div>
                  <button
                    disabled={selfRow}
                    onClick={() => void toggleStatus(row)}
                    className="mt-4 w-full rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {row.adminStatus === "active" ? "Deactivate access" : "Activate access"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] lg:block">
          <table className="min-w-[840px] w-full text-sm">
            <thead className="bg-white text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Admin ID</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rowsBusy ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading admin access...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No admin access records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const selfRow = row.uid === currentUid;
                  return (
                    <tr key={row.uid} className="border-t border-slate-100/80 bg-white align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{row.name || "Admin user"}</p>
                        <p className="mt-1 text-xs text-slate-500">{selfRow ? "Current login" : "Managed admin"}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{row.adminLoginId || "-"}</td>
                      <td className="px-4 py-4 text-slate-700">{row.email}</td>
                      <td className="px-4 py-4 text-slate-700">{row.phone || "-"}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.adminStatus === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {row.adminStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          disabled={selfRow}
                          onClick={() => void toggleStatus(row)}
                          className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition hover:bg-[var(--portal-surface-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {row.adminStatus === "active" ? "Deactivate access" : "Activate access"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
