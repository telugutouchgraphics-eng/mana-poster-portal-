"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type Category = { id: string; name: string; active: boolean; sortOrder: number };
type Asset = { id: string; categoryId: string; name: string; kind?: "file" | "text"; value?: string; fileUrl: string; thumbnailUrl: string; contentType: string; extension?: string; byteSize: number; active: boolean; sortOrder: number };

const HOME_SECTIONS = [
  {
    key: "home_banner",
    label: "Top Banner",
    width: 1080,
    height: 420,
    description: "Carousel banner shown at top of home screen",
  },
  {
    key: "home_trending",
    label: "Trending Posters",
    width: 390,
    height: 560,
    description: "Portrait poster cards in Trending section",
  },
  {
    key: "home_festival",
    label: "Festival Templates",
    width: 400,
    height: 400,
    description: "PSD editable templates or square image tiles in Festival Templates section",
  },
] as const;

type HomeKey = (typeof HOME_SECTIONS)[number]["key"];

function normalizeCategories(value: unknown): Category[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? "Assets"),
      active: row.active !== false,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : Number(row.sortOrder ?? 0) || 0,
    };
  }).filter((item) => item.id.length > 0);
}

function normalizeAssets(value: unknown): Asset[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      id: String(row.id ?? ""),
      categoryId: String(row.categoryId ?? ""),
      name: String(row.name ?? "Asset"),
      kind: (row.kind === "text" ? "text" : "file") as Asset["kind"],
      value: String(row.value ?? ""),
      fileUrl: String(row.fileUrl ?? ""),
      thumbnailUrl: String(row.thumbnailUrl ?? row.fileUrl ?? ""),
      contentType: String(row.contentType ?? ""),
      extension: String(row.extension ?? "").toLowerCase(),
      byteSize: typeof row.byteSize === "number" ? row.byteSize : Number(row.byteSize ?? 0) || 0,
      active: row.active !== false,
      sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : Number(row.sortOrder ?? 0) || 0,
    };
  }).filter((item) => item.id.length > 0);
}

async function readApiJson(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as { ok: boolean; error?: string; categories?: Category[]; assets?: Asset[] };
  }
  const text = await response.text().catch(() => "");
  return {
    ok: false,
    error: text.trim().slice(0, 180) || fallback,
  };
}

function validateHomeAssetFile(sectionKey: HomeKey, file: File) {
  const extension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  const isPsd =
    sectionKey === "home_festival" &&
    (extension === "psd" ||
      ["image/vnd.adobe.photoshop", "application/photoshop", "application/psd", "application/octet-stream", ""].includes(file.type));
  if (!isImage && !isPsd) {
    throw new Error(sectionKey === "home_festival" ? `${file.name}: PNG, JPG, WEBP or PSD only.` : `${file.name}: PNG, JPG or WEBP only.`);
  }
  const maxBytes = isPsd ? 100 * 1024 * 1024 : 8 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(isPsd ? `${file.name}: PSD must be 100 MB or smaller.` : `${file.name}: Image must be 8 MB or smaller.`);
  }
}

export default function EditorAssetsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"editor" | "home">("editor");

  // -- Editor Assets state --------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [assetName, setAssetName] = useState("");
  const [symbolValue, setSymbolValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(() => new Set());

  // -- Home Screen Assets state ---------------------------------------------
  const [homeFiles, setHomeFiles] = useState<Partial<Record<HomeKey, File[]>>>({});
  const [homeAssetNames, setHomeAssetNames] = useState<Partial<Record<HomeKey, string>>>({});
  const [homeBusy, setHomeBusy] = useState<Partial<Record<HomeKey, boolean>>>({});

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Login required.");
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/admin/editor-assets", { headers: await authHeaders(), cache: "no-store" });
    const data = await readApiJson(response, "Unable to load assets.");
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to load assets.");
    const nextCategories = normalizeCategories(data.categories);
    setCategories(nextCategories);
    const nextAssets = normalizeAssets(data.assets);
    setAssets(nextAssets);
    const visibleIds = new Set(nextAssets.map((asset) => asset.id));
    setSelectedAssetIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
    setSelectedCategory((current) => current || nextCategories[0]?.id || "");
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
      const data = await readApiJson(response, "Unable to create category.");
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
        const data = await readApiJson(response, "Upload failed.");
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
      const data = await readApiJson(response, "Unable to add symbol.");
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to add symbol.");
      setSymbolValue(""); setAssetName(""); setMessage("Symbol added."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add symbol."); } finally { setBusy(false); }
  }

  async function patch(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(path, { method: "PATCH", headers: { ...(await authHeaders()), "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await readApiJson(response, "Update failed.");
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); } finally { setBusy(false); }
  }

  async function removeAsset(id: string) {
    if (!window.confirm("Delete this asset permanently?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editor-assets/${id}`, { method: "DELETE", headers: await authHeaders() });
      const data = await readApiJson(response, "Delete failed.");
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed.");
      setAssets((prev) => prev.filter((asset) => asset.id !== id));
      setSelectedAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); } finally { setBusy(false); }
  }

  const selectedCount = selectedAssetIds.size;
  const allVisibleSelected = visibleAssets.length > 0 && visibleAssets.every((asset) => selectedAssetIds.has(asset.id));

  function toggleAssetSelection(id: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisibleAssets() {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleAssets.forEach((asset) => next.delete(asset.id));
      else visibleAssets.forEach((asset) => next.add(asset.id));
      return next;
    });
  }

  async function removeSelectedAssets() {
    const ids = Array.from(selectedAssetIds).filter((id) =>
      visibleAssets.some((asset) => asset.id === id),
    );
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected asset(s) permanently?`)) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      for (const id of ids) {
        const response = await fetch(`/api/admin/editor-assets/${id}`, { method: "DELETE", headers });
        const data = await readApiJson(response, "Delete failed.");
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed.");
      }
      setAssets((prev) => prev.filter((asset) => !ids.includes(asset.id)));
      setSelectedAssetIds(new Set());
      setMessage(`${ids.length} asset(s) deleted.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); } finally { setBusy(false); }
  }

  // -- Home Screen upload ---------------------------------------------------
  async function uploadHomeAssets(sectionKey: HomeKey, categoryId: string) {
    const sectionFiles = homeFiles[sectionKey] ?? [];
    const sectionAssets = assets.filter((a) => a.categoryId === categoryId);
    if (sectionFiles.length === 0) return;
    setHomeBusy((prev) => ({ ...prev, [sectionKey]: true }));
    try {
      const headers = await authHeaders();
      for (let index = 0; index < sectionFiles.length; index += 1) {
        const file = sectionFiles[index];
        validateHomeAssetFile(sectionKey, file);
        const body = new FormData();
        body.set("kind", "asset");
        body.set("categoryId", categoryId);
        body.set("name", sectionFiles.length === 1 && (homeAssetNames[sectionKey] ?? "").trim() ? (homeAssetNames[sectionKey] ?? "").trim() : file.name.replace(/\.[^.]+$/, ""));
        body.set("sortOrder", String((sectionAssets.length + index) * 10));
        body.set("file", file);
        const response = await fetch("/api/admin/editor-assets", { method: "POST", headers, body });
        const data = await readApiJson(response, "Upload failed.");
        if (!response.ok || !data.ok) throw new Error(`${file.name}: ${data.error ?? "Upload failed."}`);
      }
      setHomeFiles((prev) => ({ ...prev, [sectionKey]: [] }));
      setHomeAssetNames((prev) => ({ ...prev, [sectionKey]: "" }));
      setMessage(`${sectionFiles.length} asset(s) uploaded to ${sectionKey}.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setHomeBusy((prev) => ({ ...prev, [sectionKey]: false })); }
  }

  async function removeHomeAsset(id: string) {
    if (!window.confirm("Delete this asset permanently?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editor-assets/${id}`, { method: "DELETE", headers: await authHeaders() });
      const data = await readApiJson(response, "Delete failed.");
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm text-amber-950">Notice: Moved to Dedicated Pixora Creator Dashboard</p>
          <p className="mt-0.5 text-amber-800">Pixora Creator editor assets and fonts are now managed separately on the dedicated portal to prevent confusion.</p>
        </div>
        <a
          href="https://mana-poster-editor.web.app"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--portal-purple)] px-4 py-2 font-bold text-white shadow-xs hover:bg-purple-800 shrink-0"
        >
          Open Pixora Dashboard →
        </a>
      </div>

      {/* -- Top-level tab bar -- */}
      <div className="flex gap-1 rounded-xl border border-[var(--portal-border)] bg-slate-50 p-1">
        <button
          onClick={() => setActiveTab("editor")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${activeTab === "editor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Editor Assets
        </button>
        <button
          onClick={() => setActiveTab("home")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${activeTab === "home" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          Home Screen Assets
        </button>
      </div>

      {/* -- Shared message banner -- */}
      {message ? <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p> : null}

      {/* ================================================================
          EDITOR ASSETS TAB
      ================================================================ */}
      {activeTab === "editor" && (
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
            {visibleAssets.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisibleAssets} className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]" />
                  Select all
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">{selectedCount} selected</span>
                  <button type="button" disabled={busy || selectedCount === 0} onClick={() => void removeSelectedAssets()} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Delete selected</button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {visibleAssets.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-[var(--portal-border)] bg-white">
                  <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                    <input type="checkbox" checked={selectedAssetIds.has(asset.id)} disabled={busy} onChange={() => toggleAssetSelection(asset.id)} className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)] disabled:opacity-50" />
                    Select
                  </label>
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
      )}

      {/* ================================================================
          HOME SCREEN ASSETS TAB
      ================================================================ */}
      {activeTab === "home" && (
        <div className="space-y-6">
          {HOME_SECTIONS.map((section) => {
            const sectionName = section.key.trim().toLowerCase();
            const category = categories.find(
              (c) =>
                c.name.trim().toLowerCase() === sectionName ||
                c.id.trim().toLowerCase() === sectionName,
            );
            const categoryId = category?.id ?? "";
            const sectionAssets = assets.filter((a) => a.categoryId.trim() === categoryId.trim());
            const isSectionBusy = homeBusy[section.key] ?? false;

            return (
              <div key={section.key} className="overflow-hidden rounded-xl border border-[var(--portal-border)] bg-white">
                {/* Section header */}
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <h2 className="text-base font-bold text-slate-900">{section.label}</h2>
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-700">
                    {section.width} x {section.height} px
                  </span>
                  <p className="text-sm text-slate-500">{section.description}</p>
                </div>

                <div className="space-y-4 p-5">
                  {/* Upload row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={homeAssetNames[section.key] ?? ""}
                      onChange={(e) => {
                        const nextValue = e.currentTarget.value;
                        setHomeAssetNames((prev) => ({ ...prev, [section.key]: nextValue }));
                      }}
                      placeholder="Asset name (optional)"
                      className="min-w-[160px] flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                    />
                    <input
                      type="file"
                      multiple
                      accept={
                        section.key === "home_festival"
                          ? "image/png,image/jpeg,image/webp,.psd,image/vnd.adobe.photoshop,application/octet-stream"
                          : "image/png,image/jpeg,image/webp"
                      }
                      onChange={(e) => {
                        const nextFiles = Array.from(e.currentTarget.files ?? []);
                        setHomeFiles((prev) => ({ ...prev, [section.key]: nextFiles }));
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-white"
                    />
                    <button
                      type="button"
                      disabled={isSectionBusy || !categoryId || (homeFiles[section.key] ?? []).length === 0}
                      onClick={() => void uploadHomeAssets(section.key, categoryId)}
                      className="rounded-lg bg-[var(--portal-purple)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {isSectionBusy ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    {section.key === "home_festival" ? "PNG, JPG, WEBP or PSD. PSD opens as editable layers in the app." : "PNG, JPG or WEBP only."}
                  </p>

                  {/* Asset grid */}
                  {sectionAssets.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
                      No assets yet. Upload the first one above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {sectionAssets.map((asset) => (
                        <article key={asset.id} className="overflow-hidden rounded-lg border border-[var(--portal-border)] bg-white">
                          {/* Aspect-ratio-correct preview */}
                          <div
                            className="w-full overflow-hidden bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%,transparent_75%,#f1f5f9_75%),linear-gradient(45deg,#f1f5f9_25%,white_25%,white_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]"
                            style={{ aspectRatio: `${section.width}/${section.height}` }}
                          >
                            {asset.extension === "psd" ? (
                              <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 text-white">
                                <span className="text-3xl font-black">PSD</span>
                                <span className="mt-2 max-w-[80%] truncate text-xs font-bold text-slate-300">{asset.name}</span>
                              </div>
                            ) : (
                              <img
                                src={asset.thumbnailUrl || asset.fileUrl}
                                alt={asset.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                          {/* Card footer */}
                          <div className="p-3">
                            <p className="truncate text-sm font-bold text-slate-900">{asset.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{Math.max(1, Math.round(asset.byteSize / 1024))} KB</p>
                            <div className="mt-3 flex gap-1">
                              <button
                                disabled={busy}
                                onClick={() => void patch(`/api/admin/editor-assets/${asset.id}`, { active: !asset.active })}
                                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${asset.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                              >
                                {asset.active ? "Active" : "Hidden"}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void removeHomeAsset(asset.id)}
                                className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
