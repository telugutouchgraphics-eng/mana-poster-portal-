"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

type EditorFontLanguage = "telugu" | "english" | "hindi";

type EditorFont = {
  id: string;
  family: string;
  displayName: string;
  language: EditorFontLanguage;
  fileUrl: string;
  extension: "ttf" | "otf";
  byteSize: number;
  sha256: string;
  active: boolean;
  sortOrder: number;
};

const uploadLanguageOptions: EditorFontLanguage[] = ["english", "hindi"];

function fileSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fontOptionLabel(font: EditorFont) {
  const status = font.active ? "Published" : "Hidden";
  return `${font.displayName} - ${font.language.toUpperCase()} - ${status}`;
}

export default function EditorFontsPage() {
  const { user } = useAuth();
  const [fonts, setFonts] = useState<EditorFont[]>([]);
  const [family, setFamily] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<EditorFontLanguage>("english");
  const [sortOrder, setSortOrder] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedFontId, setSelectedFontId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFontIds, setSelectedFontIds] = useState<Set<string>>(() => new Set());

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Login required.");
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    const response = await fetch("/api/admin/editor-fonts", {
      headers: await authHeaders(),
      cache: "no-store",
    });
    const data = (await response.json()) as { ok: boolean; fonts?: EditorFont[]; error?: string };
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to load fonts.");
    const nextFonts = data.fonts ?? [];
    setFonts(nextFonts);
    const visibleIds = new Set(nextFonts.map((font) => font.id));
    setSelectedFontIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [authHeaders, user]);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load fonts."));
  }, [load]);

  const sortedFonts = useMemo(
    () =>
      [...fonts].sort(
        (a, b) =>
          a.language.localeCompare(b.language) ||
          a.sortOrder - b.sortOrder ||
          a.displayName.localeCompare(b.displayName),
      ),
    [fonts],
  );

  const selectedFont = useMemo(
    () => sortedFonts.find((font) => font.id === selectedFontId) ?? sortedFonts[0],
    [selectedFontId, sortedFonts],
  );

  useEffect(() => {
    if (sortedFonts.length === 0) {
      if (selectedFontId) setSelectedFontId("");
      return;
    }
    if (!selectedFontId || !sortedFonts.some((font) => font.id === selectedFontId)) {
      setSelectedFontId(sortedFonts[0].id);
    }
  }, [selectedFontId, sortedFonts]);

  async function uploadFont(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a TTF or OTF font file.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("family", family.trim() || file.name.replace(/\.[^.]+$/, ""));
      body.set("displayName", displayName.trim() || family.trim() || file.name.replace(/\.[^.]+$/, ""));
      body.set("language", language);
      body.set("sortOrder", sortOrder || String(fonts.length * 10));
      body.set("file", file);
      const response = await fetch("/api/admin/editor-fonts", {
        method: "POST",
        headers: await authHeaders(),
        body,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Unable to upload font.");
      setFamily("");
      setDisplayName("");
      setSortOrder("");
      setFile(null);
      setMessage("Font uploaded.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload font.");
    } finally {
      setBusy(false);
    }
  }

  async function patchFont(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editor-fonts/${id}`, {
        method: "PATCH",
        headers: { ...(await authHeaders()), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Update failed.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFont(id: string) {
    if (!window.confirm("Delete this font permanently?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/editor-fonts/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed.");
      setMessage("Font deleted.");
      if (selectedFontId === id) setSelectedFontId("");
      setSelectedFontIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setFonts((prev) => prev.filter((font) => font.id !== id));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = selectedFontIds.size;
  const allVisibleSelected =
    sortedFonts.length > 0 && sortedFonts.every((font) => selectedFontIds.has(font.id));

  function toggleFontSelection(id: string) {
    setSelectedFontIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFonts() {
    setSelectedFontIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) sortedFonts.forEach((font) => next.delete(font.id));
      else sortedFonts.forEach((font) => next.add(font.id));
      return next;
    });
  }

  async function deleteSelectedFonts() {
    const ids = Array.from(selectedFontIds).filter((id) =>
      sortedFonts.some((font) => font.id === id),
    );
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected font(s) permanently?`)) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      for (const id of ids) {
        const response = await fetch(`/api/admin/editor-fonts/${id}`, {
          method: "DELETE",
          headers,
        });
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Delete failed.");
      }
      setMessage(`${ids.length} font(s) deleted.`);
      if (selectedFontId && ids.includes(selectedFontId)) setSelectedFontId("");
      setFonts((prev) => prev.filter((font) => !ids.includes(font.id)));
      setSelectedFontIds(new Set());
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portal-purple)]">Editor library</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">App Fonts</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload English and Hindi editor fonts here. Telugu legacy fonts stay bundled inside the mobile app.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold text-sm text-amber-950">Notice: Moved to Dedicated Pixora Creator Dashboard</p>
          <p className="mt-0.5 text-amber-800">Pixora Creator typography and fonts are now managed separately on the dedicated portal to prevent confusion.</p>
        </div>
        <a
          href="https://mana-poster-editor.web.app/fonts"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--portal-purple)] px-4 py-2 font-bold text-white shadow-xs hover:bg-purple-800 shrink-0"
        >
          Open Pixora Dashboard →
        </a>
      </div>

      <form onSubmit={uploadFont} className="rounded-lg border border-[var(--portal-border)] bg-white p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={family}
            onChange={(event) => setFamily(event.target.value)}
            placeholder="Font family used by app"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Display name"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as EditorFontLanguage)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          >
            {uploadLanguageOptions.map((item) => (
              <option key={item} value={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]">
          <input
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            inputMode="numeric"
            placeholder="Sort order"
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
          <input
            type="file"
            accept=".ttf,.otf,font/ttf,font/otf,application/octet-stream"
            onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-white"
          />
          <button
            disabled={busy || !file}
            className="rounded-lg bg-[var(--portal-purple)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Working..." : "Upload font"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          TTF or OTF only. Maximum 12 MB. Upload the exact font family name used by the app preview.
        </p>
      </form>

      {message ? <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">{message}</p> : null}

      <section className="rounded-lg border border-[var(--portal-border)] bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">Uploaded fonts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a font from the dropdown to manage publishing, sort order, or deletion.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {sortedFonts.length} fonts
          </span>
        </div>

        {sortedFonts.length === 0 ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">No fonts uploaded.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllFonts}
                  className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
                />
                Select all fonts
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-500">{selectedCount} selected</span>
                <button
                  type="button"
                  disabled={busy || selectedCount === 0}
                  onClick={() => void deleteSelectedFonts()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete selected
                </button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {sortedFonts.map((font) => (
                <label
                  key={font.id}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedFontIds.has(font.id)}
                    disabled={busy}
                    onChange={() => toggleFontSelection(font.id)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)] disabled:opacity-50"
                  />
                  <span className="truncate">{fontOptionLabel(font)}</span>
                </label>
              ))}
            </div>
            <select
              value={selectedFont?.id ?? ""}
              onChange={(event) => setSelectedFontId(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-violet-500"
            >
              {sortedFonts.map((font) => (
                <option key={font.id} value={font.id}>
                  {fontOptionLabel(font)}
                </option>
              ))}
            </select>

            {selectedFont ? (
              <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_150px_120px_200px] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{selectedFont.displayName}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedFont.family} / {selectedFont.language.toUpperCase()} /{" "}
                    {selectedFont.extension.toUpperCase()} / {fileSizeLabel(selectedFont.byteSize)} /{" "}
                    {selectedFont.sha256.slice(0, 10)}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Sort order
                  </label>
                  <input
                    key={`${selectedFont.id}-${selectedFont.sortOrder}`}
                    defaultValue={selectedFont.sortOrder}
                    onBlur={(event) => void patchFont(selectedFont.id, { sortOrder: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  disabled={busy}
                  onClick={() => void patchFont(selectedFont.id, { active: !selectedFont.active })}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${
                    selectedFont.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {selectedFont.active ? "Published" : "Hidden"}
                </button>
                <div className="flex gap-2">
                  <a
                    href={selectedFont.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700"
                  >
                    Open
                  </a>
                  <button
                    disabled={busy}
                    onClick={() => void deleteFont(selectedFont.id)}
                    className="flex-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </section>
  );
}
