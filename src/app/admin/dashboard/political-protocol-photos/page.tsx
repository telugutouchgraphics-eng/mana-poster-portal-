"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { politicalPartyCategoriesForRegion } from "@/lib/political-party-categories";

interface ProtocolPhoto {
  id: string;
  partyId: string;
  partyLabel: string;
  partyShortName: string;
  imageUrl: string;
  sortOrder: number;
}

const MAX_IMAGE_UPLOAD_BYTES = 700 * 1024;

export default function PoliticalProtocolPhotosPage() {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const parties = useMemo(
    () => politicalPartyCategoriesForRegion(region.id),
    [region.id],
  );
  const [partyId, setPartyId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<ProtocolPhoto[]>([]);
  const [dragPhotoId, setDragPhotoId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedPartyId = partyId || parties[0]?.partyId || "";

  useEffect(() => {
    if (!partyId && parties[0]?.partyId) {
      setPartyId(parties[0].partyId);
    }
  }, [parties, partyId]);

  async function loadPhotos(nextPartyId = selectedPartyId) {
    const token = await user?.getIdToken();
    if (!token || !nextPartyId) return;
    const params = new URLSearchParams({
      regionId: region.id,
      partyId: nextPartyId,
    });
    const response = await fetch(
      `/api/admin/political-protocol-photos?${params.toString()}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );
    const data = (await response.json()) as {
      ok: boolean;
      photos?: ProtocolPhoto[];
      error?: string;
    };
    if (response.ok && data.ok) {
      setPhotos(data.photos ?? []);
    } else {
      setMessage(data.error ?? "Unable to load protocol photos.");
    }
  }

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region.id, selectedPartyId]);

  function handleFileChange(input: HTMLInputElement) {
    const selected = input.files?.[0] ?? null;
    if (selected && selected.size > MAX_IMAGE_UPLOAD_BYTES) {
      setMessage("Image must be 700 KB or smaller.");
      input.value = "";
      setFile(null);
      return;
    }
    setMessage(null);
    setFile(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Select one leader photo.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const body = new FormData();
      body.set("regionId", region.id);
      body.set("partyId", selectedPartyId);
      body.set("sortOrder", String((photos.length + 1) * 10));
      body.set("image", file);
      const response = await fetch("/api/admin/political-protocol-photos", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok)
        throw new Error(data.error ?? "Unable to save photo.");
      setFile(null);
      setMessage("Protocol photo saved.");
      await loadPhotos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/admin/political-protocol-photos/${photoId}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok)
        throw new Error(data.error ?? "Unable to delete photo.");
      setMessage("Protocol photo deleted.");
      await loadPhotos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete photo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePhotoOrder(nextPhotos: ProtocolPhoto[]) {
    const token = await user?.getIdToken();
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/political-protocol-photos", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          regionId: region.id,
          partyId: selectedPartyId,
          orderedIds: nextPhotos.map((photo) => photo.id),
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok)
        throw new Error(data.error ?? "Unable to update order.");
      setMessage("Photo order updated. Top 2 photos will show by default.");
      await loadPhotos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update order.",
      );
      await loadPhotos();
    } finally {
      setBusy(false);
    }
  }

  function moveDraggedPhoto(targetPhotoId: string) {
    if (!dragPhotoId || dragPhotoId === targetPhotoId || busy) return;
    const fromIndex = photos.findIndex((photo) => photo.id === dragPhotoId);
    const toIndex = photos.findIndex((photo) => photo.id === targetPhotoId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextPhotos = [...photos];
    const [dragged] = nextPhotos.splice(fromIndex, 1);
    if (!dragged) return;
    nextPhotos.splice(toIndex, 0, dragged);
    setPhotos(nextPhotos);
    setDragPhotoId(null);
    void savePhotoOrder(nextPhotos);
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Political protocol
          </p>
          <h1 className="text-2xl font-bold text-slate-950">
            Default Leader Photos
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Upload up to 6 default round photos for each political party in{" "}
            {region.name}.
          </p>
        </div>

        <form
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={handleSubmit}
        >
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            Party
            <select
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
              value={selectedPartyId}
              onChange={(event) => setPartyId(event.target.value)}
            >
              {parties.map((party) => (
                <option key={party.partyId} value={party.partyId}>
                  {party.shortName} - {party.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            Photo
            <input
              className="block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => handleFileChange(event.currentTarget)}
            />
          </label>
          <button
            className="self-end rounded-lg bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            disabled={busy || !selectedPartyId}
            type="submit"
          >
            Save
          </button>
        </form>
        {message ? (
          <p className="mt-4 text-sm font-semibold text-slate-700">{message}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Current photos
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Drag the dots handle to choose default 1st and 2nd.
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-500">
            {photos.length}/6
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`rounded-xl border p-4 transition ${
                dragPhotoId === photo.id
                  ? "border-slate-950 bg-slate-50 opacity-70"
                  : "border-slate-200 bg-white"
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveDraggedPhoto(photo.id);
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  aria-label={`Drag photo ${index + 1}`}
                  className="grid h-10 w-8 shrink-0 cursor-grab grid-cols-2 place-items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-2 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy}
                  draggable={!busy}
                  onDragEnd={() => setDragPhotoId(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    setDragPhotoId(photo.id);
                  }}
                  type="button"
                >
                  {Array.from({ length: 6 }).map((_, dotIndex) => (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-slate-500"
                      key={dotIndex}
                    />
                  ))}
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-black text-slate-700">
                  {index + 1}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={photo.partyShortName}
                  className="h-16 w-16 rounded-full border-2 border-white object-cover shadow"
                  src={photo.imageUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950">
                    {photo.partyLabel}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {index < 2
                      ? `Default photo ${index + 1}`
                      : "Available in Add Political Photos"}
                  </p>
                </div>
              </div>
              <button
                className="mt-4 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                disabled={busy}
                onClick={() => void deletePhoto(photo.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
