"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type {
  LandingFaqItem,
  LandingFeatureItem,
  LandingImageItem,
  LandingPageRecord,
  LandingTestimonialItem,
} from "@/lib/types/landing-page";
import {
  canonicalWebsiteCategoryLabel,
  findWebsiteCategory,
  normalizeWebsiteCategoryKey,
  UPLOADABLE_WEBSITE_CATEGORIES,
} from "@/lib/website-category-catalog";

interface WebsitePosterItem {
  id?: string;
  category: string;
  imageUrl: string;
  imagePath?: string;
  active: boolean;
  sortOrder: number;
}

type MessageTone = "success" | "error";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";

function sortByOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function postersForCategory(items: WebsitePosterItem[], categoryLabel: string) {
  const targetKey = normalizeWebsiteCategoryKey(categoryLabel);
  return sortByOrder(
    items.filter((item) => {
      const canonical = canonicalWebsiteCategoryLabel(item.category);
      return normalizeWebsiteCategoryKey(canonical) === targetKey;
    }),
  );
}

function EditableText({
  label,
  value,
  multiline = false,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const baseClass =
    "w-full cursor-text rounded-xl border border-transparent bg-transparent px-1 py-1 text-inherit outline-none transition hover:border-white/70 hover:bg-white/25 focus:border-violet-400 focus:bg-white/95 focus:text-slate-950";

  if (multiline) {
    return (
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${baseClass} min-h-20 resize-y leading-relaxed`}
      />
    );
  }

  return (
    <input
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={baseClass}
    />
  );
}

function ImageUploadButton({
  label,
  onSelect,
  busy = false,
}: {
  label: string;
  onSelect: (file: File) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onSelect(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-inset ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Uploading..." : label}
      </button>
    </>
  );
}

function SquareUploadBox({
  label,
  busy = false,
  onSelect,
}: {
  label: string;
  busy?: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="aspect-square overflow-hidden rounded-[24px] border-2 border-dashed border-slate-300 bg-white">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onSelect(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center text-slate-600 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-3xl font-light text-white">
          +
        </span>
        <span className="text-sm font-black text-slate-950">
          {busy ? "Uploading..." : label}
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          1080 x 1080
        </span>
      </button>
    </div>
  );
}

function PosterImage({
  src,
  alt,
  fallback,
  className,
}: {
  src?: string;
  alt: string;
  fallback: string;
  className: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center bg-[linear-gradient(135deg,#fdba74,#f9a8d4,#c4b5fd)] text-sm font-bold uppercase tracking-[0.2em] text-slate-700`}
    >
      {fallback}
    </div>
  );
}

export function LandingPageInlineEditor() {
  const { user } = useAuth();
  const [data, setData] = useState<LandingPageRecord | null>(null);
  const [savedData, setSavedData] = useState<LandingPageRecord | null>(null);
  const [websitePosters, setWebsitePosters] = useState<WebsitePosterItem[]>([]);
  const [savedWebsitePosters, setSavedWebsitePosters] = useState<WebsitePosterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [dragPosterId, setDragPosterId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    UPLOADABLE_WEBSITE_CATEGORIES[0]?.id ?? "",
  );

  const isDirty = useMemo(
    () =>
      JSON.stringify(data) !== JSON.stringify(savedData) ||
      JSON.stringify(websitePosters) !== JSON.stringify(savedWebsitePosters),
    [data, savedData, websitePosters, savedWebsitePosters],
  );

  useEffect(() => {
    async function load() {
      const token = await user?.getIdToken();
      if (!token) return;
      setLoading(true);
      const [landingResponse, postersResponse] = await Promise.all([
        fetch("/api/admin/landing-page", {
          headers: { authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/website-posters", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ]);

      const landingPayload = (await landingResponse.json()) as {
        ok: boolean;
        landingPage?: LandingPageRecord;
        error?: string;
      };
      const postersPayload = (await postersResponse.json()) as {
        ok: boolean;
        posters?: WebsitePosterItem[];
        error?: string;
      };

      if (!landingResponse.ok || !landingPayload.ok || !landingPayload.landingPage) {
        setMessageTone("error");
        setMessage(landingPayload.error ?? "Unable to load landing page.");
        setLoading(false);
        return;
      }

      const posters = sortByOrder(postersPayload.posters ?? []).map((item) => ({
        ...item,
        category: canonicalWebsiteCategoryLabel(item.category),
      }));
      setData(landingPayload.landingPage);
      setSavedData(landingPayload.landingPage);
      setWebsitePosters(posters);
      setSavedWebsitePosters(posters);
      setMessage(null);
      setLoading(false);
    }

    void load();
  }, [user]);

  async function uploadLandingAsset(
    section: string,
    itemId: string,
    file: File,
    onApply: (result: { imageUrl: string; imagePath: string }) => void,
    previousImagePath = "",
  ) {
    const token = await user?.getIdToken();
    if (!token) return;
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      const message = `Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
      alert(message);
      setMessageTone("error");
      setMessage(message);
      return;
    }
    const key = `${section}:${itemId}`;
    setUploadingKey(key);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("section", section);
      body.set("itemId", itemId);
      body.set("image", file);
      const response = await fetch("/api/admin/landing-page/assets", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        imageUrl?: string;
        imagePath?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.imageUrl || !payload.imagePath) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }
      onApply({ imageUrl: payload.imageUrl, imagePath: payload.imagePath });

      if (previousImagePath && previousImagePath !== payload.imagePath) {
        await fetch("/api/admin/landing-page/assets", {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ section, itemId, imagePath: previousImagePath }),
        });
      }

      setMessageTone("success");
      setMessage("Image uploaded. Save all changes to publish it on the public site.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function uploadPosterAtIndex(index: number, file: File) {
    const token = await user?.getIdToken();
    if (!token || !data) return;
    const item = websitePosters[index];
    const category = data.categories.items[index]?.title || item?.category || `Category ${index + 1}`;
    const key = `poster:${index}`;
    setUploadingKey(key);
    setMessage(null);
    try {
      if (item?.id) {
        await updateWebsitePoster({
          ...item,
          category: canonicalWebsiteCategoryLabel(category),
        }, file);
      } else {
        await createWebsitePoster(
          canonicalWebsiteCategoryLabel(category),
          (index + 1) * 10,
          file,
        );
      }
      setMessageTone("success");
      setMessage("Poster uploaded. Public landing page categories will use this image.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to upload poster.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function refreshWebsitePosters(token?: string) {
    const authToken = token ?? await user?.getIdToken();
    if (!authToken) return;
    const response = await fetch("/api/admin/website-posters", {
      headers: { authorization: `Bearer ${authToken}` },
    });
    const payload = (await response.json()) as {
      ok: boolean;
      posters?: WebsitePosterItem[];
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to refresh website posters.");
    }
    const posters = sortByOrder(payload.posters ?? []).map((item) => ({
      ...item,
      category: canonicalWebsiteCategoryLabel(item.category),
    }));
    setWebsitePosters(posters);
    setSavedWebsitePosters(posters);
  }

  async function createWebsitePoster(category: string, sortOrder: number, file: File) {
    const token = await user?.getIdToken();
    if (!token) return;
    const form = new FormData();
    form.set("category", canonicalWebsiteCategoryLabel(category));
    form.set("sortOrder", String(sortOrder));
    form.set("active", "true");
    form.set("image", file);
    const response = await fetch("/api/admin/website-posters", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to create website poster.");
    }
    await refreshWebsitePosters(token);
  }

  async function updateWebsitePoster(item: WebsitePosterItem, imageFile?: File | null) {
    const token = await user?.getIdToken();
    if (!token || !item.id) return;
    const hasImageFile = imageFile instanceof File;
    const response = await fetch(`/api/admin/website-posters/${item.id}`, {
      method: "PATCH",
      headers: hasImageFile
        ? { authorization: `Bearer ${token}` }
        : {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
      body: hasImageFile
        ? (() => {
            const form = new FormData();
            form.set("category", canonicalWebsiteCategoryLabel(item.category));
            form.set("active", String(item.active));
            form.set("sortOrder", String(item.sortOrder));
            form.set("imagePath", item.imagePath ?? "");
            form.set("image", imageFile);
            return form;
          })()
        : JSON.stringify({
            category: canonicalWebsiteCategoryLabel(item.category),
            active: item.active,
            sortOrder: item.sortOrder,
          }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to update website poster.");
    }
    await refreshWebsitePosters(token);
  }

  async function deleteWebsitePoster(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch(`/api/admin/website-posters/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to delete website poster.");
    }
    await refreshWebsitePosters(token);
  }

  async function saveAll() {
    if (!data) return;
    const token = await user?.getIdToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/landing-page", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        landingPage?: LandingPageRecord;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.landingPage) {
        throw new Error(payload.error ?? "Unable to save landing page.");
      }
      setData(payload.landingPage);
      setSavedData(payload.landingPage);
      setMessageTone("success");
      setMessage("Saved. Public landing page updates are now visible. Hard refresh to verify.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to save landing page.");
    } finally {
      setSaving(false);
    }
  }

  function patchFeature(index: number, updater: (item: LandingFeatureItem) => LandingFeatureItem) {
    setData((current) => {
      if (!current) return current;
      const items = current.features.items.map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      );
      return { ...current, features: { ...current.features, items } };
    });
  }

  function addFeature() {
    setData((current) => {
      if (!current) return current;
      const now = Date.now();
      const items = [
        ...current.features.items,
        {
          id: `feature-${now}`,
          title: "New feature",
          subtitle: "",
          description: "Edit this feature description.",
          icon: "+",
          sortOrder: (current.features.items.length + 1) * 10,
          visible: true,
          published: true,
        },
      ];
      return { ...current, features: { ...current.features, items } };
    });
  }

  function removeFeature(index: number) {
    setData((current) => {
      if (!current) return current;
      const items = current.features.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, features: { ...current.features, items } };
    });
  }

  function moveFeature(index: number, direction: -1 | 1) {
    setData((current) => {
      if (!current) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.features.items.length) return current;
      const items = [...current.features.items];
      const [moved] = items.splice(index, 1);
      items.splice(nextIndex, 0, moved);
      const ordered = items.map((item, itemIndex) => ({ ...item, sortOrder: (itemIndex + 1) * 10 }));
      return { ...current, features: { ...current.features, items: ordered } };
    });
  }

  function patchFaq(index: number, updater: (item: LandingFaqItem) => LandingFaqItem) {
    setData((current) => {
      if (!current) return current;
      const items = current.faq.items.map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      );
      return { ...current, faq: { ...current.faq, items } };
    });
  }

  function patchTestimonial(
    index: number,
    updater: (item: LandingTestimonialItem) => LandingTestimonialItem,
  ) {
    setData((current) => {
      if (!current) return current;
      const items = current.testimonials.items.map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      );
      return { ...current, testimonials: { ...current.testimonials, items } };
    });
  }

  function patchImageList(
    section: "hero" | "appPreview" | "finalCta",
    field: "previewImages" | "screenshots",
    index: number,
    updater: (item: LandingImageItem) => LandingImageItem,
  ) {
    setData((current) => {
      if (!current) return current;
      const target = current[section] as {
        previewImages?: LandingImageItem[];
        screenshots?: LandingImageItem[];
      };
      const items = (target[field] ?? []).map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      );
      return {
        ...current,
        [section]: {
          ...current[section],
          [field]: items,
        },
      };
    });
  }

  function reorderPosterInCategory(categoryLabel: string, targetPosterId?: string) {
    if (!dragPosterId || !targetPosterId || dragPosterId === targetPosterId) return;
    const targetKey = normalizeWebsiteCategoryKey(categoryLabel);
    setWebsitePosters((current) => {
      const sameCategory = sortByOrder(
        current.filter(
          (item) =>
            normalizeWebsiteCategoryKey(canonicalWebsiteCategoryLabel(item.category)) === targetKey,
        ),
      );
      const fromIndex = sameCategory.findIndex((item) => item.id === dragPosterId);
      const toIndex = sameCategory.findIndex((item) => item.id === targetPosterId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const reordered = [...sameCategory];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const orderById = new Map(
        reordered.map((item, index) => [item.id, { ...item, sortOrder: (index + 1) * 10 }]),
      );
      return current.map((item) => (item.id && orderById.has(item.id) ? orderById.get(item.id)! : item));
    });
  }

  async function saveCategoryPosterOrder(categoryLabel: string) {
    const categoryPosters = postersForCategory(websitePosters, categoryLabel).filter((item) => item.id);
    setUploadingKey(`order:${normalizeWebsiteCategoryKey(categoryLabel)}`);
    setMessage(null);
    try {
      await Promise.all(categoryPosters.map((poster) => updateWebsitePoster(poster)));
      setMessageTone("success");
      setMessage(`${categoryLabel} poster order saved.`);
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to save poster order.");
    } finally {
      setUploadingKey(null);
      setDragPosterId(null);
    }
  }

  function patchNavItem(
    index: number,
    updater: (
      item: LandingPageRecord["navbar"]["items"][number],
    ) => LandingPageRecord["navbar"]["items"][number],
  ) {
    setData((current) => {
      if (!current) return current;
      const items = current.navbar.items.map((item, itemIndex) =>
        itemIndex === index ? updater(item) : item,
      );
      return { ...current, navbar: { ...current.navbar, items } };
    });
  }

  function addNavItem() {
    setData((current) => {
      if (!current) return current;
      const items = [
        ...current.navbar.items,
        {
          id: `nav-${Date.now()}`,
          label: "New Link",
          href: "#section",
          sortOrder: (current.navbar.items.length + 1) * 10,
          visible: true,
          published: true,
        },
      ];
      return { ...current, navbar: { ...current.navbar, items } };
    });
  }

  function removeNavItem(index: number) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        navbar: {
          ...current.navbar,
          items: current.navbar.items.filter((_, itemIndex) => itemIndex !== index),
        },
      };
    });
  }

  if (loading || !data) {
    return (
      <div className="rounded-[28px] bg-white p-8 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        Loading landing page editor...
      </div>
    );
  }

  const posters = sortByOrder(websitePosters);
  const heroBannerSrc = posters[0]?.imageUrl || data.hero.previewImages[0]?.imageUrl;
  const categoryEditorGroups = UPLOADABLE_WEBSITE_CATEGORIES.map((catalogEntry, index) => {
    const matchingSectionIndex = data.categories.items.findIndex((item) => {
      const itemCategory = findWebsiteCategory(item.title);
      return itemCategory?.id === catalogEntry.id;
    });
    return {
      catalogEntry,
      sectionItemIndex: matchingSectionIndex,
      sectionItem: matchingSectionIndex >= 0 ? data.categories.items[matchingSectionIndex] : null,
      posters: postersForCategory(posters, catalogEntry.label),
      orderSeed: (index + 1) * 100,
    };
  });
  const selectedCategoryGroup =
    categoryEditorGroups.find((group) => group.catalogEntry.id === selectedCategoryId) ??
    categoryEditorGroups[0];

  return (
    <div className="space-y-6">
      <div className="sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-slate-950 px-5 py-4 text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
            Landing Page Inline CMS
          </p>
          <p className="mt-1 text-sm text-slate-200">
            Edit directly on the landing page. Update text, upload images/categories, then save.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://manaposter.in/"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Open Public Site
          </a>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={!isDirty || saving}
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`rounded-[22px] px-4 py-3 text-sm ${
            messageTone === "success"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
          }`}
        >
          {message}
        </div>
      ) : null}

      <article className="overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,#fff7ed_0%,#fff1f2_42%,#f5f3ff_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-1 ring-inset ring-white/80">
        <header className="border-b border-white/80 bg-white/70 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PosterImage
                src={data.navbar.logoImageUrl}
                alt={data.navbar.appName}
                fallback={data.navbar.logoText || "M"}
                className="h-14 w-14 rounded-2xl object-cover"
              />
              <div className="space-y-1">
                <EditableText
                  label="brand name"
                  value={data.navbar.appName}
                  placeholder="Mana Poster Ai"
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, navbar: { ...current.navbar, appName: value } }
                        : current,
                    )
                  }
                />
                <EditableText
                  label="nav button"
                  value={data.navbar.buttonText}
                  placeholder="Download App"
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, navbar: { ...current.navbar, buttonText: value } }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <ImageUploadButton
              label="Upload Logo"
              busy={uploadingKey === "navbar_branding:navbar-logo"}
              onSelect={(file) =>
                void uploadLandingAsset(
                  "navbar_branding",
                  "navbar-logo",
                  file,
                  ({ imageUrl, imagePath }) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            navbar: {
                              ...current.navbar,
                              logoImageUrl: imageUrl,
                              logoImagePath: imagePath,
                            },
                          }
                        : current,
                    ),
                  data.navbar.logoImagePath,
                )
              }
            />
          </div>
          <div className="mt-4 space-y-3 rounded-[24px] bg-white/70 p-4 ring-1 ring-inset ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Header Menu
              </p>
              <button
                type="button"
                onClick={addNavItem}
                className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white"
              >
                + Add Menu
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.navbar.items.map((item, index) => (
                <div
                  key={item.id}
                  className="space-y-2 rounded-[20px] bg-white p-3 ring-1 ring-inset ring-slate-200"
                >
                  <div className="text-sm font-bold text-slate-950">
                    <EditableText
                      label={`menu ${index + 1} label`}
                      value={item.label}
                      placeholder="Menu label"
                      onChange={(value) =>
                        patchNavItem(index, (current) => ({ ...current, label: value }))
                      }
                    />
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    <EditableText
                      label={`menu ${index + 1} link`}
                      value={item.href}
                      placeholder="#features"
                      onChange={(value) =>
                        patchNavItem(index, (current) => ({ ...current, href: value }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={(e) =>
                          patchNavItem(index, (current) => ({
                            ...current,
                            visible: e.target.checked,
                            published: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Visible
                    </label>
                    <button
                      type="button"
                      onClick={() => removeNavItem(index)}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        <section className="px-0 pb-8 pt-0">
          <div className="relative min-h-[520px] overflow-hidden bg-slate-950 sm:min-h-[620px]">
            <PosterImage
              src={heroBannerSrc}
              alt={data.hero.title || "Hero banner"}
              fallback="Hero Banner"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.85),rgba(49,46,129,0.74),rgba(124,45,18,0.34))]" />
            <div className="absolute right-4 top-4 z-10">
              <ImageUploadButton
                label="Upload Hero Banner"
                busy={uploadingKey === "poster:0"}
                onSelect={(file) => void uploadPosterAtIndex(0, file)}
              />
            </div>
            <div className="relative z-[1] mx-auto flex min-h-[520px] max-w-[1440px] items-center px-5 py-10 sm:min-h-[620px] sm:px-8">
              <div className="max-w-3xl space-y-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300">
                  {data.hero.helperText || "Hero"}
                </p>
                <div className="text-4xl font-black tracking-tight sm:text-7xl">
                  <EditableText
                    label="hero title"
                    value={data.hero.title}
                    placeholder="Hero title"
                    onChange={(value) =>
                      setData((current) =>
                        current ? { ...current, hero: { ...current.hero, title: value } } : current,
                      )
                    }
                  />
                </div>
                <div className="text-lg font-semibold text-white/90">
                  <EditableText
                    label="hero subtitle"
                    value={data.hero.subtitle}
                    placeholder="Hero subtitle"
                    multiline
                    onChange={(value) =>
                      setData((current) =>
                        current
                          ? { ...current, hero: { ...current.hero, subtitle: value } }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="max-w-2xl text-sm leading-8 text-white/80 sm:text-base">
                  <EditableText
                    label="hero description"
                    value={data.hero.description}
                    placeholder="Hero description"
                    multiline
                    onChange={(value) =>
                      setData((current) =>
                        current
                          ? { ...current, hero: { ...current.hero, description: value } }
                          : current,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 pt-5 sm:grid-cols-3 sm:px-8">
            {data.hero.previewImages.slice(0, 3).map((item, index) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_42px_rgba(15,23,42,0.12)] ring-1 ring-inset ring-slate-200"
              >
                <div className="relative">
                  <PosterImage
                    src={item.imageUrl}
                    alt={item.title || `Hero ${index + 1}`}
                    fallback={`Hero ${index + 1}`}
                    className="h-72 w-full object-cover"
                  />
                  <div className="absolute right-3 top-3">
                    <ImageUploadButton
                      label="Upload"
                      busy={uploadingKey === `hero_preview_images:${item.id}`}
                      onSelect={(file) =>
                        void uploadLandingAsset(
                          "hero_preview_images",
                          item.id,
                          file,
                          ({ imageUrl, imagePath }) =>
                            patchImageList("hero", "previewImages", index, (current) => ({
                              ...current,
                              imageUrl,
                              imagePath,
                            })),
                          item.imagePath,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="text-base font-bold text-slate-900">
                    <EditableText
                      label={`hero card ${index + 1} title`}
                      value={item.title}
                      placeholder="Poster title"
                      onChange={(value) =>
                        patchImageList("hero", "previewImages", index, (current) => ({
                          ...current,
                          title: value,
                        }))
                      }
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-5 px-5 pb-8 sm:px-8">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-600">
              Posters
            </p>
            <div className="text-3xl font-black text-slate-950">
              <EditableText
                label="categories title"
                value={data.categories.title}
                placeholder="Categories title"
                onChange={(value) =>
                  setData((current) =>
                    current
                      ? { ...current, categories: { ...current.categories, title: value } }
                      : current,
                  )
                }
              />
            </div>
          </div>

          {selectedCategoryGroup ? (
            <div className="space-y-5 rounded-[28px] bg-white p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)] ring-1 ring-inset ring-slate-200 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {categoryEditorGroups.map(({ catalogEntry, posters: categoryPosters }) => (
                  <button
                    key={catalogEntry.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(catalogEntry.id)}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-bold ring-1 ring-inset transition ${
                      selectedCategoryGroup.catalogEntry.id === catalogEntry.id
                        ? "bg-slate-950 text-white ring-slate-950"
                        : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-white"
                    }`}
                  >
                    <span className="block">{catalogEntry.label}</span>
                    <span className="mt-1 block text-xs font-semibold opacity-70">
                      {categoryPosters.length} uploaded
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <SquareUploadBox
                    label={`+ Upload to ${selectedCategoryGroup.catalogEntry.label}`}
                    busy={uploadingKey === `category-upload:${selectedCategoryGroup.catalogEntry.id}`}
                    onSelect={async (file) => {
                      const categoryPosters = selectedCategoryGroup.posters;
                      setUploadingKey(`category-upload:${selectedCategoryGroup.catalogEntry.id}`);
                      setMessage(null);
                      try {
                        const lastPoster = categoryPosters[categoryPosters.length - 1];
                        const nextSortOrder =
                          (lastPoster?.sortOrder ?? selectedCategoryGroup.orderSeed) + 10;
                        await createWebsitePoster(
                          selectedCategoryGroup.catalogEntry.label,
                          nextSortOrder,
                          file,
                        );
                        setMessageTone("success");
                        setMessage(
                          `Poster added to ${selectedCategoryGroup.catalogEntry.label}.`,
                        );
                      } catch (error) {
                        setMessageTone("error");
                        setMessage(
                          error instanceof Error ? error.message : "Unable to upload poster.",
                        );
                      } finally {
                        setUploadingKey(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void saveCategoryPosterOrder(selectedCategoryGroup.catalogEntry.label)
                    }
                    disabled={
                      uploadingKey ===
                      `order:${normalizeWebsiteCategoryKey(selectedCategoryGroup.catalogEntry.label)}`
                    }
                    className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save Order
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectedCategoryGroup.posters.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm font-semibold text-slate-500">
                      No posters yet in {selectedCategoryGroup.catalogEntry.label}.
                    </div>
                  ) : null}

                  {selectedCategoryGroup.posters.map((poster, posterIndex) => (
                    <article
                      key={poster.id ?? `${selectedCategoryGroup.catalogEntry.id}-${posterIndex}`}
                      draggable={Boolean(poster.id)}
                      onDragStart={() => setDragPosterId(poster.id ?? null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() =>
                        reorderPosterInCategory(
                          selectedCategoryGroup.catalogEntry.label,
                          poster.id,
                        )
                      }
                      onDragEnd={() => setDragPosterId(null)}
                      className={`overflow-hidden rounded-[24px] bg-slate-50 ring-1 ring-inset ring-slate-200 ${
                        dragPosterId === poster.id ? "opacity-55 ring-2 ring-violet-400" : ""
                      }`}
                    >
                      <PosterImage
                        src={poster.imageUrl}
                        alt={`${selectedCategoryGroup.catalogEntry.label} ${posterIndex + 1}`}
                        fallback={selectedCategoryGroup.catalogEntry.label}
                        className="aspect-square w-full bg-white object-contain"
                      />
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                            Drag #{posterIndex + 1}
                          </span>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={poster.active}
                              onChange={(e) =>
                                setWebsitePosters((current) =>
                                  current.map((item) =>
                                    item.id === poster.id
                                      ? { ...item, active: e.target.checked }
                                      : item,
                                  ),
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            Active
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ImageUploadButton
                            label="Replace"
                            busy={uploadingKey === `replace:${poster.id}`}
                            onSelect={async (file) => {
                              setUploadingKey(`replace:${poster.id}`);
                              setMessage(null);
                              try {
                                await updateWebsitePoster(poster, file);
                                setMessageTone("success");
                                setMessage("Poster updated.");
                              } catch (error) {
                                setMessageTone("error");
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to replace poster.",
                                );
                              } finally {
                                setUploadingKey(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => void updateWebsitePoster(poster)}
                            className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!poster.id) return;
                              setUploadingKey(`delete:${poster.id}`);
                              try {
                                await deleteWebsitePoster(poster.id);
                                setMessageTone("success");
                                setMessage("Poster deleted.");
                              } catch (error) {
                                setMessageTone("error");
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to delete poster.",
                                );
                              } finally {
                                setUploadingKey(null);
                              }
                            }}
                            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-5 bg-white/55 px-5 py-8 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-600">Features</p>
              <div className="text-3xl font-black text-slate-950">
                <EditableText
                  label="features title"
                  value={data.features.title}
                  placeholder="Features title"
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, features: { ...current.features, title: value } }
                        : current,
                    )
                  }
                />
              </div>
              <div className="max-w-3xl text-sm leading-7 text-slate-600">
                <EditableText
                  label="features subtitle"
                  value={data.features.subtitle || data.features.description}
                  placeholder="Features subtitle"
                  multiline
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, features: { ...current.features, subtitle: value } }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addFeature}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
            >
              + Add Feature
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.features.items.map((item, index) => (
              <article key={item.id} className="rounded-[24px] bg-white p-5 ring-1 ring-inset ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="max-w-20 text-2xl">
                    <EditableText
                      label={`feature ${index + 1} icon`}
                      value={item.icon || ""}
                      placeholder="*"
                      onChange={(value) =>
                        patchFeature(index, (current) => ({ ...current, icon: value }))
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => moveFeature(index, -1)}
                      disabled={index === 0}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFeature(index, 1)}
                      disabled={index === data.features.items.length - 1}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-40"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-lg font-bold text-slate-950">
                  <EditableText
                    label={`feature ${index + 1} title`}
                    value={item.title}
                    placeholder="Feature title"
                    onChange={(value) =>
                      patchFeature(index, (current) => ({ ...current, title: value }))
                    }
                  />
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  <EditableText
                    label={`feature ${index + 1} description`}
                    value={item.description}
                    placeholder="Feature description"
                    multiline
                    onChange={(value) =>
                      patchFeature(index, (current) => ({ ...current, description: value }))
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-5 px-5 py-8 sm:px-8">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-600">FAQ</p>
            <div className="text-3xl font-black text-slate-950">
              <EditableText
                label="faq title"
                value={data.faq.title}
                placeholder="FAQ title"
                onChange={(value) =>
                  setData((current) =>
                    current ? { ...current, faq: { ...current.faq, title: value } } : current,
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-3">
            {data.faq.items.slice(0, 4).map((item, index) => (
              <article key={item.id} className="rounded-[24px] bg-white px-5 py-4 ring-1 ring-inset ring-slate-200">
                <div className="text-base font-bold text-slate-950">
                  <EditableText
                    label={`faq ${index + 1} question`}
                    value={item.question}
                    placeholder="Question"
                    onChange={(value) =>
                      patchFaq(index, (current) => ({ ...current, question: value }))
                    }
                  />
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  <EditableText
                    label={`faq ${index + 1} answer`}
                    value={item.answer}
                    placeholder="Answer"
                    multiline
                    onChange={(value) =>
                      patchFaq(index, (current) => ({ ...current, answer: value }))
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-5 bg-[linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)] px-5 py-8 text-white sm:px-8">
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-white/70">Testimonials</p>
            <div className="text-3xl font-black">
              <EditableText
                label="testimonials title"
                value={data.testimonials.title}
                placeholder="Testimonials title"
                onChange={(value) =>
                  setData((current) =>
                    current
                      ? {
                          ...current,
                          testimonials: { ...current.testimonials, title: value },
                        }
                      : current,
                  )
                }
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {data.testimonials.items.slice(0, 3).map((item, index) => (
              <article key={item.id} className="rounded-[24px] bg-white/10 p-5 ring-1 ring-inset ring-white/20">
                <div className="text-lg font-bold">
                  <EditableText
                    label={`testimonial ${index + 1} name`}
                    value={item.name}
                    placeholder="Name"
                    onChange={(value) =>
                      patchTestimonial(index, (current) => ({ ...current, name: value }))
                    }
                  />
                </div>
                <div className="mt-3 text-sm leading-7 text-white/85">
                  <EditableText
                    label={`testimonial ${index + 1} review`}
                    value={item.review}
                    placeholder="Review"
                    multiline
                    onChange={(value) =>
                      patchTestimonial(index, (current) => ({ ...current, review: value }))
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="bg-slate-950 px-5 py-8 text-white sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-3">
              <div className="text-2xl font-black">
                <EditableText
                  label="footer title"
                  value={data.footer.title}
                  placeholder="Footer title"
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, footer: { ...current.footer, title: value } }
                        : current,
                    )
                  }
                />
              </div>
              <div className="text-sm leading-7 text-white/75">
                <EditableText
                  label="footer description"
                  value={data.footer.description}
                  placeholder="Footer description"
                  multiline
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? { ...current, footer: { ...current.footer, description: value } }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
                Contact
              </p>
              <div className="text-sm font-semibold text-white/90">
                <EditableText
                  label="support email"
                  value={data.footer.contactEmail}
                  placeholder="support@email.com"
                  onChange={(value) =>
                    setData((current) =>
                      current
                        ? {
                            ...current,
                            footer: { ...current.footer, contactEmail: value },
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}

