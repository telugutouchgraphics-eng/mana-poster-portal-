"use client";

import { FormEvent, useState } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { CreatorAccessTable } from "@/components/creators/creator-access-table";
import { DashboardTabSidebar } from "@/components/layout/dashboard-tab-sidebar";
import { PosterReviewTable } from "@/components/posters/poster-review-table";

interface InviteResponse {
  ok: boolean;
  error?: string;
  creatorPublicId?: string;
  loginLink?: string;
  whatsappMessage?: string;
}

function ManagerDashboardContent() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("invite_creator");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
            Manager Panel
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Creator Access Desk</h1>
        </div>
        <button
          onClick={() => void signOut()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
        >
          Logout
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <DashboardTabSidebar
          title="Manager Tabs"
          subtitle="Sidebar tabs తో flow చాలా clear గా ఉంటుంది."
          tabs={[
            { id: "invite_creator", label: "Invite Creator" },
            { id: "creator_access", label: "Creator Access List" },
            { id: "poster_review", label: "Poster Review" },
          ]}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
        />

        <div className="min-w-0">
          {activeTab === "invite_creator" ? (
            <section className="rounded-2xl border border-amber-200 bg-[var(--surface)] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Add Creator + Generate Login Link
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                System automatically creates unique `Mana-XXXXXX` Creator ID.
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
                  {busy ? "Generating..." : "Generate Login Link"}
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

          {activeTab === "creator_access" ? (
            <CreatorAccessTable
              title="Creator Access List"
              subtitle="Filter creators, assign allowed categories, and regenerate login links."
            />
          ) : null}

          {activeTab === "poster_review" ? <PosterReviewTable /> : null}
        </div>
      </div>
    </main>
  );
}

export default function ManagerDashboardPage() {
  return (
    <RoleGate allowed={["admin", "manager"]}>
      <ManagerDashboardContent />
    </RoleGate>
  );
}
