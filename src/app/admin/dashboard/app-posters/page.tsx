"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";
import {
  PHOTO_SHAPE_GROUPS,
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
  type PhotoEdgeStyle,
  type PhotoFrameStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";

interface CategoryItem {
  id: string;
  label: string;
  isDynamic?: boolean;
  eventDateLabel?: string;
}

interface AppPosterItem {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  mediaType: string;
  imageUrl: string;
  videoUrl?: string;
  imagePath?: string;
  status: string;
  createdAt: number;
  approvedAt: number;
}

interface AppPostersResponse {
  ok: boolean;
  error?: string;
  categories?: CategoryItem[];
  posters?: AppPosterItem[];
}

interface ImageMeta {
  width: number;
  height: number;
}

interface PersonalizationConfig {
  photoShape: PhotoShape;
  photoRenderMode: "cutout" | "original";
  edgeStyle: PhotoEdgeStyle;
  photoFrameStyle: PhotoFrameStyle;
  showSafeAreas: boolean;
  photoX: number;
  photoY: number;
  photoScale: number;
  nameX: number;
  nameY: number;
  showBottomStrip: boolean;
  stripHeight: number;
}

const PERMANENT_SAMPLE_NAME = "Gopi Krishna";

const POSTER_STRIP_GRADIENTS = [
  ["#071E48", "#0057B8"],
  ["#062D1D", "#0F9F6E"],
  ["#4A1407", "#E76F1E"],
  ["#34115B", "#9D4EDD"],
  ["#5A3A00", "#FFB703"],
] as const;

const defaultPersonalization: PersonalizationConfig = {
  photoShape: "circle",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  photoFrameStyle: "none",
  showSafeAreas: false,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
};

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_IMAGE_LABEL = "12 MB";
const MAX_VIDEO_UPLOAD_LABEL = "5 MB";

function isVideoFile(file: File | null): boolean {
  if (!file) return false;
  return (file.type || "").toLowerCase().startsWith("video/");
}

function isImageFile(file: File | null): boolean {
  if (!file) return false;
  return (file.type || "").toLowerCase().startsWith("image/");
}

function isServerAcceptedImage(file: File): boolean {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
    (file.type || "").toLowerCase(),
  );
}

function isVideoPoster(poster: Pick<AppPosterItem, "mediaType" | "videoUrl">): boolean {
  return poster.mediaType === "video" && Boolean(poster.videoUrl);
}

function validatePosterFile(file: File | null): string | null {
  if (!file) return null;
  const mimeType = (file.type || "").toLowerCase();
  const allowedImageMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  const allowedVideoMimeTypes = ["video/mp4", "video/quicktime", "video/webm"];
  if (allowedImageMimeTypes.includes(mimeType) || mimeType.startsWith("image/")) {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      return `Poster image must be ${MAX_SOURCE_IMAGE_LABEL} or smaller.`;
    }
    return null;
  }
  if (allowedVideoMimeTypes.includes(mimeType)) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      return `Video must be ${MAX_VIDEO_UPLOAD_LABEL} or smaller.`;
    }
    return null;
  }
  return "Only PNG, JPG, WEBP, MP4, MOV, or WEBM files are allowed.";
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to prepare image for upload."));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

async function preparePosterFileForUpload(file: File): Promise<File> {
  if (!isImageFile(file)) {
    return file;
  }
  if (file.size <= MAX_IMAGE_UPLOAD_BYTES && isServerAcceptedImage(file)) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image format is not supported. Please choose JPG, PNG, or WEBP."));
    });
    image.src = objectUrl;
    await loaded;

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Unable to read image size.");
    }

    let maxSide = 1600;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to optimize image on this device.");
      }
      context.drawImage(image, 0, 0, width, height);

      for (const quality of [0.84, 0.76, 0.68, 0.6, 0.52]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob.size <= MAX_IMAGE_UPLOAD_BYTES) {
          const outputName = file.name.replace(/\.[^.]+$/, "") || "poster";
          return new File([blob], `${outputName}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }
      maxSide = Math.round(maxSide * 0.78);
    }
    throw new Error(`Image could not be compressed under ${MAX_IMAGE_UPLOAD_LABEL}. Please choose a smaller image.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readUploadResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return { ok: response.ok } as { ok: boolean; error?: string };
  }
  try {
    return JSON.parse(text) as { ok: boolean; error?: string };
  } catch {
    const isTooLarge =
      response.status === 413 || text.toLowerCase().includes("request entity");
    return {
      ok: false,
      error: isTooLarge
        ? `Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller. Video must be ${MAX_VIDEO_UPLOAD_LABEL} or smaller.`
        : text.slice(0, 160) || "Upload failed.",
    };
  }
}

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCategoryDate(label?: string): string {
  return label ? label : "";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function posterAspect(meta: ImageMeta | null): number {
  if (!meta || meta.width <= 0 || meta.height <= 0) return 1;
  return meta.width / meta.height;
}

function clampPhotoSafeArea(
  config: PersonalizationConfig,
  meta: ImageMeta | null,
): PersonalizationConfig {
  const margin = 0;
  const bleed = 0;
  const bottomBleed = config.showBottomStrip
    ? Math.max(8, Math.min(16, config.stripHeight * 0.75))
    : bleed;
  const aspect = posterAspect(meta);
  const maxScaleX = 100 - margin * 2;
  const maxScaleY = (100 - margin * 2) / aspect;
  const photoScale = clampNumber(config.photoScale, 12, Math.max(12, Math.min(90, maxScaleX, maxScaleY)));
  const halfX = photoScale / 2;
  const halfY = (photoScale * aspect) / 2;
  return {
    ...config,
    photoScale,
    photoX: clampNumber(config.photoX, margin + halfX, 100 - margin - halfX),
    photoY: clampNumber(config.photoY, margin + halfY - bleed, 100 - margin - halfY + bottomBleed),
  };
}

function resolvePosterStripGradient(sampleName: string, stripHeight: number): readonly [string, string] {
  const seedSource = `${sampleName}|${stripHeight}`;
  let hash = 23;
  for (const char of seedSource) {
    hash = 41 * hash + char.charCodeAt(0);
  }
  return POSTER_STRIP_GRADIENTS[Math.abs(hash) % POSTER_STRIP_GRADIENTS.length]!;
}

function stripTextColor(gradient: readonly [string, string]): string {
  const luminance =
    gradient
      .map((color) => {
        const hex = color.replace("#", "");
        const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
        const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
        const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
        const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      })
      .reduce((sum, value) => sum + value, 0) / gradient.length;
  return luminance > 0.48 ? "#111827" : "#FFFFFF";
}

function categoryTone(category: CategoryItem): string {
  if (category.isDynamic) {
    return "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300";
  }
  return "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300";
}

export default function AdminAppPostersPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [posters, setPosters] = useState<AppPosterItem[]>([]);
  const [actionPosterId, setActionPosterId] = useState<string | null>(null);
  const [editingPoster, setEditingPoster] = useState<AppPosterItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<ImageMeta | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [personalization, setPersonalization] =
    useState<PersonalizationConfig>(defaultPersonalization);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    target: null as "photo" | "name" | null,
    dragging: false,
    startX: 0,
    startY: 0,
    initialX: 50,
    initialY: 45,
  });

  async function loadData() {
    setLoading(true);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const response = await fetch("/api/admin/app-posters", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as AppPostersResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load app posters.");
      }
      const nextCategories = data.categories ?? [];
      setCategories(nextCategories);
      setPosters(data.posters ?? []);
      setCategoryId((current) => current || nextCategories[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load app posters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      setFileMeta(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    if (isVideoFile(file)) {
      setFileMeta({ width: 1080, height: 1920 });
    } else {
      const image = new window.Image();
      image.onload = () => {
        setFileMeta({
          width: image.naturalWidth || 1080,
          height: image.naturalHeight || 1080,
        });
      };
      image.src = url;
    }
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!editFile) {
      setEditPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(editFile);
    setEditPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [editFile]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!dragRef.current.dragging) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const deltaX = ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaY = ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(0, Math.min(100, dragRef.current.initialX + deltaX));
      const nextY = Math.max(0, Math.min(100, dragRef.current.initialY + deltaY));
      if (dragRef.current.target === "photo") {
        setPersonalization((prev) => {
          return clampPhotoSafeArea({ ...prev, photoX: nextX, photoY: nextY }, fileMeta);
        });
      }
      if (dragRef.current.target === "name") {
        setPersonalization((prev) => ({ ...prev, nameX: nextX, nameY: nextY }));
      }
    }
    function stopDragging() {
      dragRef.current.dragging = false;
      dragRef.current.target = null;
      setIsPhotoDragging(false);
      setIsNameDragging(false);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [fileMeta]);

  useEffect(() => {
    setPersonalization((prev) => clampPhotoSafeArea(prev, fileMeta));
  }, [fileMeta]);

  function startDrag(target: "photo" | "name", event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target,
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: target === "photo" ? personalization.photoX : personalization.nameX,
      initialY: target === "photo" ? personalization.photoY : personalization.nameY,
    };
    setIsPhotoDragging(target === "photo");
    setIsNameDragging(target === "name");
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Select a poster image or video.");
      return;
    }
    const fileError = validatePosterFile(file);
    if (fileError) {
      alert(fileError);
      setMessage(fileError);
      return;
    }
    if (!categoryId) {
      setMessage("Select a category.");
      return;
    }
    setSaving(true);
    setMessage("Preparing upload...");
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const uploadFile = await preparePosterFileForUpload(file);
      const body = new FormData();
      body.set("categoryId", categoryId);
      body.set("uploadSource", "app_posters");
      body.set("media", uploadFile);
      body.set("personalizationConfig", JSON.stringify(clampPhotoSafeArea(personalization, fileMeta)));
      const response = await fetch("/api/admin/app-posters", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = await readUploadResponse(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage("Poster uploaded and approved. It will appear in the app after refresh.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  const activeCategory = categories.find((item) => item.id === categoryId);
  const uploadBoxAspectRatio = useMemo(() => {
    if (fileMeta && fileMeta.width > 0 && fileMeta.height > 0) {
      return `${fileMeta.width} / ${fileMeta.height}`;
    }
    return "1 / 1";
  }, [fileMeta]);
  const safePersonalization = clampPhotoSafeArea(personalization, fileMeta);
  const stripGradient = resolvePosterStripGradient(
    PERMANENT_SAMPLE_NAME,
    personalization.stripHeight,
  );
  const gradientTextColor = stripTextColor(stripGradient);
  const isTelugu = language === "telugu";
  const customizationCopy = {
    customize: isTelugu ? "కస్టమైజ్" : "Customize",
    personalization: isTelugu ? "పర్సనలైజేషన్" : "Personalization",
    close: isTelugu ? "క్లోజ్" : "Close",
    photoShape: isTelugu ? "ఫోటో షేప్" : "Photo Shape",
    premiumShapes: isTelugu ? "ప్రీమియం షేప్స్" : "Premium Shapes",
    transparentCutouts: isTelugu ? "ట్రాన్స్‌పరెంట్ కటౌట్స్" : "Transparent Cutouts",
    photoMode: isTelugu ? "ఫోటో మోడ్" : "Photo Mode",
    bgRemoved: isTelugu ? "బీజీ రిమూవ్డ్" : "BG Removed",
    original: isTelugu ? "ఒరిజినల్" : "Original",
    photoSize: isTelugu ? "ఫోటో సైజ్" : "Photo Size",
    showGradientStrip: isTelugu ? "షో గ్రాడియెంట్ స్ట్రిప్" : "Show gradient strip",
    apply: isTelugu ? "అప్లై" : "Apply",
    appliedMessage: isTelugu
      ? "కస్టమైజేషన్ అప్లై అయింది. పోస్టర్ సేవ్ చేసినప్పుడు ఇదే ప్లేస్‌మెంట్ సేవ్ అవుతుంది."
      : "Customization applied. This placement will be saved when the poster is saved.",
    shapeLabels: {
      circle: isTelugu ? "సర్కిల్" : "Circle",
      scallop_circle: isTelugu ? "స్కాలోప్ సర్కిల్" : "Scallop Circle",
      soft_burst: isTelugu ? "సాఫ్ట్ బర్స్్ట్" : "Soft Burst",
      badge: isTelugu ? "బ్యాడ్జ్" : "Badge",
      rounded_square: isTelugu ? "రౌండెడ్ స్క్వేర్" : "Rounded Square",
      vertical_rectangle: isTelugu ? "వెర్టికల్ రెక్టాంగిల్" : "Vertical Rectangle",
      square: isTelugu ? "క్లాసిక్ స్క్వేర్" : "Classic Square",
      transparent_bottom_fade: isTelugu ? "బాటమ్ బ్లెండ్" : "Bottom Blend",
      transparent_clean: isTelugu ? "క్లీన్ కటౌట్" : "Clean Cutout",
      transparent_soft_round: isTelugu ? "సాఫ్ట్ రౌండ్" : "Soft Round",
      transparent_sharp_round: isTelugu ? "షార్ప్ రౌండ్" : "Sharp Round",
    } as Record<string, string>,
  };

  function openFilePicker(nextCategoryId = categoryId) {
    if (!nextCategoryId) return;
    setCategoryId(nextCategoryId);
    fileInputRef.current?.click();
  }

  function startEdit(poster: AppPosterItem) {
    setEditingPoster(poster);
    setEditTitle(poster.title);
    setEditCategoryId(poster.categoryId);
    setEditFile(null);
    setEditPreviewUrl(null);
    setMessage(null);
  }

  function closeEditModal() {
    setEditingPoster(null);
    setEditTitle("");
    setEditCategoryId("");
    setEditFile(null);
    setEditPreviewUrl(null);
  }

  async function handleDeletePoster(poster: AppPosterItem) {
    const confirmed = window.confirm(
      `Delete the ${poster.categoryLabel || poster.categoryId} poster?`,
    );
    if (!confirmed) return;
    setActionPosterId(poster.id);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const response = await fetch(`/api/admin/app-posters/${poster.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Delete failed.");
      }
      setMessage("Poster deleted.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setActionPosterId(null);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPoster) return;
    if (!editTitle.trim()) {
      setMessage("Poster title required.");
      return;
    }
    if (!editCategoryId) {
      setMessage("Select a category.");
      return;
    }
    setActionPosterId(editingPoster.id);
    setMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Login required.");
      const body = new FormData();
      body.set("title", editTitle.trim());
      body.set("categoryId", editCategoryId);
      if (editFile) {
        const fileError = validatePosterFile(editFile);
        if (fileError) {
          throw new Error(fileError);
        }
        const uploadFile = await preparePosterFileForUpload(editFile);
        body.set("media", uploadFile);
      }
      const response = await fetch(`/api/admin/app-posters/${editingPoster.id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Update failed.");
      }
      closeEditModal();
      setMessage("Poster updated.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setActionPosterId(null);
    }
  }

  return (
    <section className="space-y-6">
      <article className="border-b border-[var(--portal-border)] px-1 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
              App Posters
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">
              Upload posters directly to app
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              These posters are saved as approved items in the `creatorPosters` collection and shown in app home/categories.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            const fileError = validatePosterFile(selectedFile);
            if (fileError) {
              const message = fileError;
              alert(message);
              setMessage(message);
              event.target.value = "";
              setFile(null);
              return;
            }
            setFile(selectedFile);
          }}
          className="hidden"
        />

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Categories
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <span className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm text-slate-600">
                Categories loading...
              </span>
            ) : (
              categories.map((category) => {
                const isActive = category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setCategoryId(category.id);
                      setMessage(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : categoryTone(category)
                    }`}
                  >
                    <span>{category.label}</span>
                    {formatCategoryDate(category.eventDateLabel) ? (
                      <span className="ml-2 text-[11px] opacity-75">
                        {formatCategoryDate(category.eventDateLabel)}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <form onSubmit={handleUpload} className="mt-5 border-t border-[var(--portal-border)] pt-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,460px)_320px]">
            <button
              type="button"
              onClick={() => openFilePicker()}
              disabled={!categoryId}
              style={{ aspectRatio: uploadBoxAspectRatio }}
              className={`relative flex w-full max-w-[460px] flex-col items-center justify-center overflow-hidden border bg-white text-center transition ${
                categoryId
                  ? "border-[var(--portal-border)] hover:border-[var(--portal-purple)]"
                  : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
              }`}
            >
              {filePreviewUrl ? (
                <>
                  {isVideoFile(file) ? (
                    <video
                      src={filePreviewUrl}
                      className="h-full w-full object-contain bg-slate-950"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreviewUrl}
                        alt="Poster preview"
                        className="h-full w-full object-contain p-3"
                      />
                    </>
                  )}
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--portal-purple)] px-4 py-2 text-xs font-semibold text-white shadow-sm">
                    Change file
                  </span>
                </>
              ) : (
                <div className="px-4">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--portal-purple)] text-2xl font-semibold text-white">
                    +
                  </span>
                  <span className="mt-3 block text-sm font-semibold text-slate-900">
                    {categoryId ? "Upload poster image or video" : "Select category first"}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {activeCategory?.label ?? "Select a category to enable upload."}
                  </span>
                </div>
              )}
            </button>

            <div className="flex flex-col justify-between gap-4">
              <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Selected Category
                </p>
                <p className="mt-2 text-base font-bold text-slate-950">
                  {activeCategory?.label ?? "Select category"}
                </p>
                {activeCategory?.eventDateLabel ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--portal-purple)]">
                    {activeCategory.eventDateLabel}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Select a category, choose an image or video, customize images if needed, and upload.
                </p>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(true)}
                  disabled={!filePreviewUrl || isVideoFile(file)}
                  className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isVideoFile(file) ? "Image customization only" : "Customize"}
                </button>
                <button
                  type="submit"
                  disabled={saving || !file || !categoryId}
                  className="rounded-xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>

          {message ? (
            <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              {message}
            </p>
          ) : null}
        </form>

      </article>

      <article className="px-1">
        <h3 className="text-lg font-bold text-slate-950 sm:text-xl">Recent admin app posters</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
          {posters.length === 0 ? (
            <p className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              No admin uploaded app posters yet.
            </p>
          ) : (
            posters.map((poster) => (
              <article key={poster.id} className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-white">
                {isVideoPoster(poster) ? (
                  <video
                    src={poster.videoUrl}
                    className="h-28 w-full bg-slate-950 object-cover sm:h-32"
                    controls
                    muted
                    playsInline
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={poster.imageUrl} alt={poster.categoryLabel} className="h-28 w-full object-cover sm:h-32" />
                  </>
                )}
                <div className="p-2 sm:p-3">
                  <p className="text-xs font-semibold text-slate-900 sm:text-sm">{poster.categoryLabel || poster.categoryId}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 sm:text-xs">{poster.title}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {isVideoPoster(poster) ? "video" : "image"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700">{poster.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(poster.createdAt)}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(poster)}
                      disabled={actionPosterId === poster.id}
                      className="flex-1 rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePoster(poster)}
                      disabled={actionPosterId === poster.id}
                      className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {actionPosterId === poster.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      {editingPoster ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                  App Poster
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">Edit poster</h3>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-[var(--portal-border)] px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Poster title</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Category</span>
                <select
                  value={editCategoryId}
                  onChange={(event) => setEditCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] px-4 py-3 text-sm text-slate-900 outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                      {category.eventDateLabel ? ` - ${category.eventDateLabel}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Replace file (optional)</span>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/quicktime,video/webm"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] ?? null;
                      const fileError = validatePosterFile(selectedFile);
                      if (fileError) {
                        alert(fileError);
                        setMessage(fileError);
                        event.target.value = "";
                        setEditFile(null);
                        return;
                      }
                      setEditFile(selectedFile);
                    }}
                    className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--portal-purple)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Selecting a new file will replace the existing media.
                  </p>
                </label>

                <div className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
                  {isVideoFile(editFile) || (!editPreviewUrl && isVideoPoster(editingPoster)) ? (
                    <video
                      src={editPreviewUrl || editingPoster.videoUrl}
                      className="h-48 w-full bg-slate-950 object-contain"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editPreviewUrl || editingPoster.imageUrl}
                        alt={editTitle || editingPoster.categoryLabel}
                        className="h-48 w-full object-cover"
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-[var(--portal-border)] px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPosterId === editingPoster.id}
                  className="rounded-xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {actionPosterId === editingPoster.id ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {customizeOpen ? (
        <div data-no-auto-translate="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/82 p-2 backdrop-blur-sm sm:p-4">
          <div className="mx-auto grid min-h-full max-w-7xl gap-3 py-2 sm:gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="max-h-none overflow-y-auto rounded-[22px] border border-white/10 bg-slate-950 p-4 text-white sm:rounded-[28px] sm:p-5 xl:max-h-[calc(100vh-2rem)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">{customizationCopy.customize}</p>
                  <h4 className="mt-2 text-lg font-bold">{customizationCopy.personalization}</h4>
                </div>
                <button onClick={() => setCustomizeOpen(false)} className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold">
                  {customizationCopy.close}
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{customizationCopy.photoShape}</span>
                  <select
                    data-no-auto-translate="true"
                    value={personalization.photoShape}
                    onChange={(event) =>
                      setPersonalization((prev) => ({
                        ...prev,
                        photoShape: event.target.value as PhotoShape,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    {PHOTO_SHAPE_GROUPS.map((group) => (
                      <optgroup
                        key={group.label}
                        label={
                          group.label === "Premium Shapes"
                            ? customizationCopy.premiumShapes
                            : customizationCopy.transparentCutouts
                        }
                      >
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value} className="bg-white text-slate-950">
                            {customizationCopy.shapeLabels[option.value] ?? option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{customizationCopy.photoMode}</span>
                  <select
                    data-no-auto-translate="true"
                    value={personalization.photoRenderMode}
                    onChange={(event) =>
                      setPersonalization((prev) => ({ ...prev, photoRenderMode: event.target.value as "cutout" | "original" }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="cutout" className="bg-white text-slate-950">{customizationCopy.bgRemoved}</option>
                    <option value="original" className="bg-white text-slate-950">{customizationCopy.original}</option>
                  </select>
                </label>


                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{customizationCopy.photoSize} {Math.round(safePersonalization.photoScale)}%</span>
                  <input
                    type="range"
                    min={12}
                    max={90}
                    value={safePersonalization.photoScale}
                    onChange={(event) =>
                      setPersonalization((prev) =>
                        clampPhotoSafeArea(
                          { ...prev, photoScale: Number(event.target.value) },
                          fileMeta,
                        ),
                      )
                    }
                    className="mt-3 w-full accent-[var(--portal-green)]"
                  />
                </label>

                <label className="flex items-center gap-2 text-sm text-white/90">
                  <input
                    type="checkbox"
                    checked={personalization.showBottomStrip}
                    onChange={(event) =>
                      setPersonalization((prev) =>
                        clampPhotoSafeArea(
                          {
                            ...prev,
                            showBottomStrip: event.target.checked,
                          },
                          fileMeta,
                        ),
                      )
                    }
                  />
                  {customizationCopy.showGradientStrip}
                </label>

              </div>
            </section>

            <section className="flex min-w-0 items-center justify-center p-0 sm:p-2">
              {filePreviewUrl ? (
                <div className="w-full max-w-4xl">
                  <div className="overflow-auto p-0 sm:p-1">
                    <div className="mx-auto inline-block max-w-full align-top leading-none">
                      <div ref={previewFrameRef} className="relative overflow-visible align-top">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={filePreviewUrl} alt="Poster preview" className="block h-auto max-h-[62vh] w-auto max-w-full object-contain align-top sm:max-h-[72vh]" />

                        <div
                          onPointerDown={(event) => startDrag("photo", event)}
                          className={`absolute touch-none overflow-hidden ${
                            isPhotoDragging ? "cursor-grabbing" : "cursor-grab"
                          }`}
                          style={{
                            left: `${safePersonalization.photoX}%`,
                            top: `${safePersonalization.photoY}%`,
                            width: `${safePersonalization.photoScale}%`,
                            aspectRatio: photoShapeAspectRatio(safePersonalization.photoShape),
                            ...photoShapeFrameStyle(safePersonalization.photoShape),
                          }}
                        >
                          {renderPosterPhotoPreview({
                            shape: safePersonalization.photoShape,
                            renderMode: safePersonalization.photoRenderMode,
                            edgeStyle: safePersonalization.edgeStyle,
                            frameStyle: safePersonalization.photoFrameStyle,
                            src: PERSONALIZATION_SAMPLE.photoUrl,
                            alt: "Sample user",
                          })}
                        </div>

                        {!personalization.showBottomStrip ? (
                          <div
                            onPointerDown={(event) => startDrag("name", event)}
                            className={`absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 select-none touch-none ${isNameDragging ? "cursor-grabbing" : "cursor-grab"}`}
                            style={{ left: `${personalization.nameX}%`, top: `${personalization.nameY}%` }}
                          >
                            <p className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                              {PERMANENT_SAMPLE_NAME}
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {personalization.showBottomStrip ? (
                        <div
                          className="-mt-px w-full px-4 py-2 text-center"
                          style={{
                            backgroundImage: `linear-gradient(90deg, ${stripGradient[0]}, ${stripGradient[1]})`,
                            color: gradientTextColor,
                          }}
                        >
                          <p className="truncate text-xl font-semibold leading-tight tracking-wide">
                            {PERMANENT_SAMPLE_NAME}
                          </p>
                        </div>
                      ) : null}

                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setCustomizeOpen(false);
                        setMessage(customizationCopy.appliedMessage);
                      }}
                      className="rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white"
                    >
                      {customizationCopy.apply}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">Select poster image first.</div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </section>
  );
}
