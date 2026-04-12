"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface PushNotificationItem {
  id: string;
  title: string;
  message: string;
  imageUrl: string;
  route: string;
  audience: string;
  status: "sent" | "failed";
  errorMessage?: string;
  sentAt: number;
  createdByEmail: string;
}

export default function AdminPushNotificationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PushNotificationItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [route] = useState("home");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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
      error?: string;
    };
    if (response.ok && data.ok) {
      setItems(data.notifications ?? []);
      return;
    }
    setStatusMessage(data.error ?? "Unable to load push notification history.");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) {
      setStatusMessage("Notification image upload cheyyali.");
      return;
    }

    const token = await user?.getIdToken();
    if (!token) {
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("message", message);
      formData.set("route", route);
      formData.set("image", imageFile);

      const response = await fetch("/api/admin/push-notifications", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatusMessage(data.error ?? "Unable to send push notification.");
        return;
      }

      setTitle("");
      setMessage("");
      setImageFile(null);
      const input = document.getElementById("push-image-input") as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
      setStatusMessage("Push notification app users andariki send ayyindi.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
          App Users Push
        </p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Send manual app notification</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Admin side nundi direct ga app users andariki image tho push notification pampadaniki.
          Notification click chesthe app home screen open avuthundi.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Notification title"
            className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Notification message"
            className="min-h-32 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <div className="rounded-[24px] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <p className="text-sm font-semibold text-slate-800">Notification image</p>
            <p className="mt-1 text-xs leading-6 text-slate-500">
              App lo visible notification preview kosam image compulsory.
            </p>
            <input
              id="push-image-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-2xl file:border-0 file:bg-[var(--portal-purple)] file:px-4 file:py-2.5 file:font-semibold file:text-white"
            />
            <p className="mt-2 text-xs text-slate-500">
              Target route: <span className="font-semibold text-slate-700">Home screen</span>
            </p>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send Push Notification"}
          </button>
          {statusMessage ? (
            <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              {statusMessage}
            </p>
          ) : null}
        </form>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-2xl font-bold text-slate-950">Recent push history</h3>
        <p className="mt-2 text-sm text-slate-600">
          Recent ga send chesina app notifications ikkada history ga kanipisthai.
        </p>
        <div className="mt-5 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">
              Push notification history ledu.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "sent"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {item.status === "sent" ? "Sent" : "Failed"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Route: {item.route} | Audience: {item.audience}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sent by: {item.createdByEmail || "Admin"} |{" "}
                      {new Date(item.sentAt).toLocaleString("en-IN")}
                    </p>
                    {item.errorMessage ? (
                      <p className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {item.errorMessage}
                      </p>
                    ) : null}
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
