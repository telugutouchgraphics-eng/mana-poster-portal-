"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface AppBannerItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTarget: string;
  placement: string;
  active: boolean;
  sortOrder: number;
}

const BANNER_POSITION_OPTIONS = [
  { value: "10", label: "1st Banner" },
  { value: "20", label: "2nd Banner" },
  { value: "30", label: "3rd Banner" },
] as const;

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";

function bannerPositionLabel(sortOrder: number) {
  return (
    BANNER_POSITION_OPTIONS.find((option) => Number(option.value) === sortOrder)?.label ??
    `${sortOrder}`
  );
}

export default function AdminAppBannersPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppBannerItem[]>([]);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaTarget, setCtaTarget] = useState("");
  const [sortOrder, setSortOrder] = useState("10");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch("/api/admin/banners", {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ok: boolean; banners?: AppBannerItem[]; error?: string };
    if (response.ok && data.ok) {
      setItems((data.banners ?? []).filter((item) => item.placement === "home_category_banner"));
    } else {
      setMessage(data.error ?? "Unable to load banners.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function resetForm() {
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setCtaTarget("");
    setSortOrder("10");
    setFile(null);
    setEditingId(null);
    setCurrentPreview(null);
  }

  function startEdit(item: AppBannerItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setSubtitle(item.subtitle);
    setCtaLabel(item.ctaLabel);
    setCtaTarget(item.ctaTarget);
    setSortOrder(String(item.sortOrder));
    setFile(null);
    setCurrentPreview(item.imageUrl);
    setMessage(null);
  }

  function handleFileChange(fileInput: HTMLInputElement) {
    const selectedFile = fileInput.files?.[0] ?? null;
    if (selectedFile && selectedFile.size > MAX_IMAGE_UPLOAD_BYTES) {
      const warning = `Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
      alert(warning);
      setMessage(warning);
      setFile(null);
      fileInput.value = "";
      return;
    }
    setFile(selectedFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file && !editingId) {
      setMessage("Upload a banner image.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const body = new FormData();
      body.set("title", title);
      body.set("subtitle", subtitle);
      body.set("ctaLabel", ctaLabel);
      body.set("ctaTarget", ctaTarget);
      body.set("sortOrder", sortOrder);
      body.set("active", "true");
      body.set("placement", "home_category_banner");
      if (file) {
        body.set("image", file);
      }
      const response = await fetch(
        editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { authorization: `Bearer ${token}` },
          body,
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to save banner.");
      resetForm();
      setMessage(editingId ? "App banner updated." : "App banner saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save banner.");
    } finally {
      setBusy(false);
    }
  }

  async function updateBanner(id: string, active: boolean, sortOrder: number) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ active, sortOrder }),
    });
    await load();
  }

  async function deleteBanner(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    await fetch(`/api/admin/banners/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (editingId === id) {
      resetForm();
    }
    await load();
  }

  const previewImage = previewUrl ?? currentPreview;

  return (
    <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">App Banner Upload</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">Manage app banners</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Upload and manage mobile app home banners from here.
        </p>
        <p className="mt-2 text-xs font-semibold text-slate-500">Recommended size: 1080 x 300 px</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Banner title" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Banner subtitle" className="min-h-28 w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          <div className="grid gap-4 md:grid-cols-2">
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Button label (optional)" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
            <input value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value)} placeholder="Button target path/url" className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white" />
          </div>
          <div className="grid gap-4">
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white">
              {BANNER_POSITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFileChange(e.currentTarget)} className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--portal-purple)] file:px-3 file:py-2 file:text-white" />
          </div>
          <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <p className="text-xs text-slate-500">Fit check</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white" style={{ aspectRatio: "1080 / 300" }}>
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImage} alt="App banner preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">Banner preview</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} type="submit" className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60">
              {busy ? "Saving..." : editingId ? "Update Banner" : "Upload Banner"}
            </button>
            {editingId ? (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                Cancel Edit
              </button>
            ) : null}
          </div>
          {message ? <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">{message}</p> : null}
        </form>
      </article>

      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-2xl font-bold text-slate-950">Banner List</h3>
        <p className="mt-2 text-sm text-slate-600">Active and inactive app banners.</p>
        <div className="mt-5 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-5 py-7 text-sm text-slate-600">No app banners yet.</div>
          ) : items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.title} className="h-32 w-full rounded-2xl object-cover" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.subtitle || "No subtitle"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Placement: App Home Banner | Position: {bannerPositionLabel(item.sortOrder)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {item.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => startEdit(item)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                      Edit
                    </button>
                    <button onClick={() => void updateBanner(item.id, !item.active, item.sortOrder)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[var(--portal-surface-soft)]">
                      {item.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => void deleteBanner(item.id)} className="rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
