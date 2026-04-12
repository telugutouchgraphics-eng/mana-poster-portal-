"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  audience: string;
  priority: string;
  active: boolean;
}

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("important");
  const [audience, setAudience] = useState("creator");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch("/api/admin/announcements", {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ok: boolean; announcements?: AnnouncementItem[]; error?: string };
    if (response.ok && data.ok) {
      setItems(data.announcements ?? []);
    } else {
      setStatusMessage(data.error ?? "Unable to load announcements.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title,
        message,
        priority,
        audience,
      }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setStatusMessage(data.error ?? "Unable to create announcement.");
      return;
    }
    setTitle("");
    setMessage("");
    setPriority("important");
    setAudience("creator");
    setStatusMessage("Announcement saved.");
    await load();
  }

  async function toggleActive(id: string, active: boolean) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ active: !active }),
    });
    await load();
  }

  async function remove(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/announcements/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    await load();
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">Creator Announcements</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Manage creator notices</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Creators ki reminders, deadline alerts, campaign notes, and urgent updates ivvadam kosam.
        </p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement message" className="min-h-36 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <div className="grid gap-4 md:grid-cols-2">
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white">
              <option value="normal">Normal</option>
              <option value="important">Important</option>
              <option value="urgent">Urgent</option>
            </select>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white">
              <option value="creator">Creators</option>
              <option value="manager_creator">Managers + Creators</option>
              <option value="all">All Roles</option>
            </select>
          </div>
          <button type="submit" className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]">
            Save Announcement
          </button>
          {statusMessage ? <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">{statusMessage}</p> : null}
        </form>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-2xl font-bold text-slate-950">Announcement List</h3>
        <p className="mt-2 text-sm text-slate-600">Creators and teams ki visible avvalsina active notices.</p>
        <div className="mt-5 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">Inka announcements create cheyyaledu.</div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-500">Audience: {item.audience} | Priority: {item.priority}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {item.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => void toggleActive(item.id, item.active)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                  {item.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => void remove(item.id)} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
