"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type Category = { id: string; name: string; active: boolean; sortOrder: number };
type Asset = { id: string; categoryId: string; name: string; kind?: "file" | "text"; value?: string; fileUrl: string; thumbnailUrl: string; contentType: string; byteSize: number; active: boolean; sortOrder: number };

export default function EditorAssetsPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [assetName, setAssetName] = useState("");
  const [symbolValue, setSymbolValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Login required.");
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/admin/editor-assets", { headers: await authHeaders(), cache: "no-store" });
    const data = await response.json() as { ok: boolean; categories?: Category[]; assets?: Asset[]; error?: string };
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to load assets.");
    setCategories(data.categories ?? []);
    setAssets(data.assets ?? []);
    setSelectedCategory((current) => current || data.categories?.[0]?.id || "");
  }, [authHeaders, user]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load assets.")); }, [load]);

  const visibleAssets = useMemo(() => assets.filter((item) => item.categoryId === selectedCategory), [assets, selectedCategory]);

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("kind", "category");
      body.set("name", categoryName.trim());
      body.set("sortOrder", String(categories.length * 10));
      const response = await fetch("/api/admin/editor-assets", { method: "POST", headers: await authHeaders(), body });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to create category.");
      setCategoryName("");
      setMessage("Category created.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create category."); } finally { setBusy(false); }
  }

  async function uploadAssets(event: FormEvent) {
    event.preventDefault();
    if (!selectedCategory || files.length === 0) { setMessage("Choose a category and one or more files."); return; }
    setBusy(true);
    try {
      const headers = await authHeaders();
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const body = new FormData();
        body.set("kind", "asset");
        body.set("categoryId", selectedCategory);
        body.set("name", files.length === 1 && assetName.trim() ? assetName.trim() : file.name.replace(/\.[^.]+$/, ""));
        body.set("sortOrder", String((visibleAssets.length + index) * 10));
        body.set("file", file);
        const response = await fetch("/api/admin/editor-assets", { method: "POST", headers, body });
        const data = await response.json() as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(`${file.name}: ${data.error ?? "Upload failed."}`);
      }
      setFiles([]);
      setAssetName("");
      setMessage(`${files.length} asset(s) uploaded.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to upload assets."); } finally { setBusy(false); }
  }

  async function addSymbol() {
    if (!selectedCategory || !symbolValue.trim()) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("kind", "text");
      body.set("categoryId", selectedCategory);
      body.set("name", assetName.trim() || symbolValue.trim());
      body.set("value", symbolValue.trim());
      body.set("sortOrder", String(visibleAssets.length * 10));
      const response = await fetch("/api/admin/editor-assets", { method: "POST", headers: await authHeaders(), body });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to add symbol.");
      setSymbolValue(""); setAssetName(""); setMessage("Symbol added."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add symbol."); } finally { setBusy(false); }
  }

  async function patch(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(path, { method: "PATCH", headers: { ...(await authHeaders()), "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); } finally { setBusy(false); }
  }

  async function removeAsset(id: string) {
    if (!window.confirm("Delete this asset permanently?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editor-assets/${id}`, { method: "DELETE", headers: await authHeaders() });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portal-purple)]">Editor library</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">App Assets</h1>
        <p className="mt-2 text-sm text-slate-600">Create categories and publish downloadable editor assets to the mobile app.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <form onSubmit={createCategory} className="rounded-lg border border-[var(--portal-border)] bg-white p-4">
            <label className="text-sm font-bold text-slate-900">New category</label>
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} maxLength={80} placeholder="Flowers, Frames, Festivals..." className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
            <button disabled={busy || !categoryName.trim()} className="mt-3 w-full rounded-lg bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create category</button>
          </form>
          <div className="rounded-lg border border-[var(--portal-border)] bg-white p-3">
            <p className="px-2 py-1 text-sm font-bold text-slate-900">Categories</p>
            <div className="mt-2 space-y-1">
              {categories.map((category) => (
                <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${selectedCategory === category.id ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  <span className="truncate">{category.name}</span><span className="text-xs opacity-70">{assets.filter((item) => item.categoryId === category.id).length}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <main className="space-y-4">
          <form onSubmit={uploadAssets} className="rounded-lg border border-[var(--portal-border)] bg-white p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Asset name (single upload only)" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" />
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-white" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">PNG, JPG, WEBP or SVG. Maximum 8 MB each.</p><button disabled={busy || !selectedCategory || files.length === 0} className="rounded-lg bg-[var(--portal-purple)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Working..." : "Upload"}</button></div>
            <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4"><input value={symbolValue} onChange={(e) => setSymbolValue(e.target.value)} maxLength={16} placeholder="Emoji or symbol" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500" /><button type="button" onClick={() => void addSymbol()} disabled={busy || !selectedCategory || !symbolValue.trim()} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 disabled:opacity-50">Add symbol</button></div>
          </form>
          {message ? <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {visibleAssets.map((asset) => (
              <article key={asset.id} className="overflow-hidden rounded-lg border border-[var(--portal-border)] bg-white">
                <div className="aspect-square bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,white_25%,white_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px] p-2">
                  {asset.kind === "text" ? <div className="flex h-full items-center justify-center text-5xl">{asset.value}</div> : <img src={asset.thumbnailUrl || asset.fileUrl} alt={asset.name} className="h-full w-full object-contain" />}
                </div>
                <div className="p-3"><p className="truncate text-sm font-bold text-slate-900">{asset.name}</p><p className="mt-1 text-xs text-slate-500">{Math.max(1, Math.round(asset.byteSize / 1024))} KB</p>
                  <div className="mt-3 flex gap-1"><button disabled={busy} onClick={() => void patch(`/api/admin/editor-assets/${asset.id}`, { active: !asset.active })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${asset.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{asset.active ? "Published" : "Hidden"}</button><button disabled={busy} onClick={() => void removeAsset(asset.id)} className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">Delete</button></div>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </section>
  );
}
