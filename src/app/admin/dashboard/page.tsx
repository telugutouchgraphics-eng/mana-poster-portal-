"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { ManagerTable } from "@/components/managers/manager-table";
import { CreatorAccessTable } from "@/components/creators/creator-access-table";
import { DashboardTabSidebar } from "@/components/layout/dashboard-tab-sidebar";

interface InviteResponse {
  ok: boolean;
  error?: string;
  creatorPublicId?: string;
  loginLink?: string;
  whatsappMessage?: string;
}

interface ManagerCreateResponse {
  ok: boolean;
  error?: string;
  managerUid?: string;
  managerPublicId?: string;
  email?: string;
  name?: string;
}

function AdminDashboardContent() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("create_manager");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [managerBusy, setManagerBusy] = useState(false);
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [managerResult, setManagerResult] = useState<ManagerCreateResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const response = await fetch("/api/manager/creators/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await response.json()) as InviteResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Invite generation failed.");
      }
      setResult(data);
      setName("");
      setEmail("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleManagerCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManagerBusy(true);
    setManagerError(null);
    setManagerResult(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const response = await fetch("/api/admin/managers/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: managerName.trim(),
          email: managerEmail.trim(),
          phone: managerPhone.trim(),
          password: managerPassword,
        }),
      });
      const data = (await response.json()) as ManagerCreateResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Manager creation failed.");
      }
      setManagerResult(data);
      setManagerName("");
      setManagerEmail("");
      setManagerPhone("");
      setManagerPassword("");
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : "Manager creation failed.");
    } finally {
      setManagerBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Admin Panel
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Super Admin Dashboard
          </h1>
        </div>
        <button
          onClick={() => void signOut()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Logout
        </button>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/manager/dashboard"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Open Manager Dashboard
        </Link>
        <Link
          href="/login?as=creator&next=%2Fcreator%2Fdashboard"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Open Creator Dashboard (Creator Login)
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <DashboardTabSidebar
          title="Admin Tabs"
          subtitle="ఏ పని చేయాలి అనేది left లో select చేస్తే UI clean గా ఉంటుంది."
          tabs={[
            { id: "create_manager", label: "Create Manager" },
            { id: "invite_creator", label: "Invite Creator" },
            { id: "manager_list", label: "Managers List" },
            { id: "creator_access", label: "Creator Access" },
          ]}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
        />

        <div className="min-w-0">
          {activeTab === "create_manager" ? (
            <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Create Manager Access</h2>
              <p className="mt-1 text-sm text-slate-600">
                Admin can create manager accounts and assign permanent manager role.
              </p>
              <form
                onSubmit={handleManagerCreate}
                className="mt-5 grid gap-4 md:grid-cols-4"
              >
                <input
                  placeholder="Manager name"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  placeholder="Manager email"
                  type="email"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  placeholder="Manager phone"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  placeholder="Temporary password"
                  type="password"
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <button
                  type="submit"
                  disabled={managerBusy}
                  className="md:col-span-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {managerBusy ? "Creating manager..." : "Create Manager"}
                </button>
              </form>

              {managerError ? (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {managerError}
                </p>
              ) : null}

              {managerResult?.ok && managerResult.email ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <p className="font-semibold text-emerald-900">
                    Manager ready: {managerResult.name}
                  </p>
                  <p className="mt-1 text-emerald-800">
                    Manager ID: {managerResult.managerPublicId ?? "-"}
                  </p>
                  <p className="mt-1 text-emerald-800">Login email: {managerResult.email}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "invite_creator" ? (
            <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Grant Creator Access (Admin)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Admin and manager both can create creator access links.
              </p>
              <form onSubmit={handleInvite} className="mt-5 grid gap-4 md:grid-cols-3">
                <input
                  placeholder="Creator name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <input
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-orange-400/30 focus:ring"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="md:col-span-3 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {busy ? "Generating..." : "Generate Creator Login Link"}
                </button>
              </form>

              {error ? (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              {result?.ok && result.creatorPublicId ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <p className="font-semibold text-emerald-900">
                    Creator created: {result.creatorPublicId}
                  </p>
                  <p className="mt-2 break-all text-emerald-800">
                    Login link: {result.loginLink}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-emerald-800">
                    WhatsApp message:
                    {"\n"}
                    {result.whatsappMessage}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "manager_list" ? <ManagerTable /> : null}

          {activeTab === "creator_access" ? (
            <CreatorAccessTable
              title="Creator Access Management"
              subtitle="Search creators, assign categories, and regenerate login links."
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <RoleGate allowed={["admin"]}>
      <AdminDashboardContent />
    </RoleGate>
  );
}
