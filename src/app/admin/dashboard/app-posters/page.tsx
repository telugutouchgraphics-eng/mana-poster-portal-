"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
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
import {
  parseVideoPhotoAnimation,
  resolveVideoPhotoAnimationStyle,
  VIDEO_PHOTO_ANIMATION_GLOBAL_CSS,
  VIDEO_PHOTO_ANIMATION_OPTIONS,
  type VideoPhotoAnimation,
} from "@/lib/video-photo-animation";

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
  personalizationConfig?: Partial<PersonalizationConfig> | null;
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
  showVideoExtraPhoto: boolean;
  videoExtraPhotoShape: PhotoShape;
  videoExtraPhotoRenderMode: "cutout" | "original";
  videoExtraPhotoEdgeStyle: PhotoEdgeStyle;
  videoExtraPhotoFrameStyle: PhotoFrameStyle;
  videoExtraPhotoX: number;
  videoExtraPhotoY: number;
  videoExtraPhotoScale: number;
  photoAnimation: VideoPhotoAnimation;
  videoExtraPhotoAnimation: VideoPhotoAnimation;
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
  showVideoExtraPhoto: false,
  videoExtraPhotoShape: "circle",
  videoExtraPhotoRenderMode: "cutout",
  videoExtraPhotoEdgeStyle: "soft_fade",
  videoExtraPhotoFrameStyle: "none",
  videoExtraPhotoX: 24,
  videoExtraPhotoY: 44,
  videoExtraPhotoScale: 28,
  photoAnimation: "none",
  videoExtraPhotoAnimation: "none",
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
};

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";
const MAX_VIDEO_UPLOAD_LABEL = "5 MB";
function isVideoFile(file: File | null): boolean {
  if (!file) return false;
  return (file.type || "").toLowerCase().startsWith("video/");
}

function isImageFile(file: File | null): boolean {
  if (!file) return false;
  return (file.type || "").toLowerCase().startsWith("image/");
}

function isVideoPoster(poster: Pick<AppPosterItem, "mediaType" | "videoUrl">): boolean {
  return poster.mediaType === "video" && Boolean(poster.videoUrl);
}

function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return `Poster image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
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

async function preparePosterFileForUpload(file: File): Promise<File> {
  if (!isImageFile(file)) {
    return file;
  }
  if (file.size <= MAX_IMAGE_UPLOAD_BYTES) {
    return file;
  }
  throw new Error(`Poster image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`);
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
  const edgeTravelBleed = 18;
  const bottomBleed = config.showBottomStrip
    ? Math.max(8, Math.min(16, config.stripHeight * 0.75))
    : bleed;
  const aspect = posterAspect(meta);
  const maxScaleX = 100 - margin * 2;
  const maxScaleY = (100 - margin * 2) / aspect;
  const photoScale = clampNumber(config.photoScale, 12, Math.max(12, Math.min(90, maxScaleX, maxScaleY)));
  const videoExtraPhotoScale = clampNumber(
    config.videoExtraPhotoScale,
    12,
    Math.max(12, Math.min(90, maxScaleX, maxScaleY)),
  );
  const halfX = photoScale / 2;
  const halfY = (photoScale * aspect) / 2;
  const extraHalfX = videoExtraPhotoScale / 2;
  const extraHalfY = (videoExtraPhotoScale * aspect) / 2;
  return {
    ...config,
    photoScale,
    photoX: clampNumber(config.photoX, margin + halfX - edgeTravelBleed, 100 - margin - halfX + edgeTravelBleed),
    photoY: clampNumber(
      config.photoY,
      margin + halfY - bleed - edgeTravelBleed,
      100 - margin - halfY + bottomBleed + edgeTravelBleed,
    ),
    videoExtraPhotoScale,
    videoExtraPhotoX: clampNumber(
      config.videoExtraPhotoX,
      margin + extraHalfX - edgeTravelBleed,
      100 - margin - extraHalfX + edgeTravelBleed,
    ),
    videoExtraPhotoY: clampNumber(
      config.videoExtraPhotoY,
      margin + extraHalfY - bleed - edgeTravelBleed,
      100 - margin - extraHalfY + bottomBleed + edgeTravelBleed,
    ),
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

function statusClass(status: string): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-violet-200 bg-violet-50 text-violet-700";
}

export default function AdminAppPostersPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
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
  const [videoPreviewStarted, setVideoPreviewStarted] = useState(false);
  const [videoPreviewCycle, setVideoPreviewCycle] = useState(0);
  const [personalization, setPersonalization] =
    useState<PersonalizationConfig>(defaultPersonalization);
  const [selectedPhotoTarget, setSelectedPhotoTarget] =
    useState<"photo" | "videoExtraPhoto">("photo");
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isVideoExtraPhotoDragging, setIsVideoExtraPhotoDragging] = useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef({
    target: null as "photo" | "videoExtraPhoto" | "name" | null,
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
      const params = new URLSearchParams({ regionId: region.id });
      const response = await fetch(`/api/admin/app-posters?${params.toString()}`, {
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
  }, [user, region.id]);

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
      if (dragRef.current.target === "videoExtraPhoto") {
        setPersonalization((prev) => {
          return clampPhotoSafeArea(
            { ...prev, videoExtraPhotoX: nextX, videoExtraPhotoY: nextY },
            fileMeta,
          );
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
      setIsVideoExtraPhotoDragging(false);
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

  useEffect(() => {
    setVideoPreviewStarted(false);
    setVideoPreviewCycle(0);
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  }, [customizeOpen, filePreviewUrl]);

  useEffect(() => {
    if (!personalization.showVideoExtraPhoto && selectedPhotoTarget === "videoExtraPhoto") {
      setSelectedPhotoTarget("photo");
    }
  }, [personalization.showVideoExtraPhoto, selectedPhotoTarget]);

  function startDrag(
    target: "photo" | "videoExtraPhoto" | "name",
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (target === "photo" || target === "videoExtraPhoto") {
      setSelectedPhotoTarget(target);
    }
    dragRef.current = {
      target,
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX:
        target === "photo"
          ? personalization.photoX
          : target === "videoExtraPhoto"
            ? personalization.videoExtraPhotoX
            : personalization.nameX,
      initialY:
        target === "photo"
          ? personalization.photoY
          : target === "videoExtraPhoto"
            ? personalization.videoExtraPhotoY
            : personalization.nameY,
    };
    setIsPhotoDragging(target === "photo");
    setIsVideoExtraPhotoDragging(target === "videoExtraPhoto");
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
      body.set("regionId", region.id);
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
  const postersByCategory = useMemo(() => {
    return posters.reduce<Record<string, AppPosterItem[]>>((acc, item) => {
      const key = normalizeCategoryKey(item.categoryId || item.categoryLabel || "");
      const current = acc[key] ?? [];
      current.push(item);
      current.sort((left, right) => right.createdAt - left.createdAt);
      acc[key] = current;
      return acc;
    }, {});
  }, [posters]);
  const activeCategoryKey = normalizeCategoryKey(categoryId);
  const activeCategoryPosters = categoryId ? (postersByCategory[activeCategoryKey] ?? []) : [];
  const activeCategoryPoster = activeCategoryPosters[0] ?? null;
  const visibleRecentUploads = categoryId ? activeCategoryPosters : posters;
  const uploadBoxAspectRatio = useMemo(() => {
    if (fileMeta && fileMeta.width > 0 && fileMeta.height > 0) {
      return `${fileMeta.width} / ${fileMeta.height}`;
    }
    return "1 / 1";
  }, [fileMeta]);
  const safePersonalization = clampPhotoSafeArea(personalization, fileMeta);
  const isVideoPreview = Boolean(filePreviewUrl && isVideoFile(file));
  const stripGradient = resolvePosterStripGradient(
    PERMANENT_SAMPLE_NAME,
    personalization.stripHeight,
  );
  const gradientTextColor = stripTextColor(stripGradient);
  async function startVideoPreviewPlayback() {
    if (!isVideoPreview) return;
    setVideoPreviewCycle((prev) => prev + 1);
    setVideoPreviewStarted(true);
    try {
      await previewVideoRef.current?.play();
    } catch {
      setVideoPreviewStarted(false);
    }
  }
  async function replayVideoPreviewFromStart() {
    if (!isVideoPreview || !previewVideoRef.current) return;
    setVideoPreviewCycle((prev) => prev + 1);
    previewVideoRef.current.currentTime = 0;
    try {
      await previewVideoRef.current.play();
    } catch {
      setVideoPreviewStarted(false);
    }
  }
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
      body.set("regionId", region.id);
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
                  disabled={!filePreviewUrl}
                  className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {customizationCopy.customize}
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
        <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                Recent uploads
              </p>
              <h4 className="mt-2 text-lg font-bold text-slate-950">Latest posters</h4>
              <p className="mt-1 text-xs text-slate-500">
                {visibleRecentUploads.length} uploads
              </p>
            </div>
            {activeCategoryPoster ? (
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-950">
                  {activeCategory?.label ?? activeCategoryPoster.categoryLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {activeCategoryPosters.length} uploads in this category
                </p>
              </div>
            ) : null}
          </div>

          {visibleRecentUploads.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No uploads yet.</p>
          ) : (
            <div className="mt-4 max-h-[36rem] space-y-3 overflow-y-auto pr-1">
              {visibleRecentUploads.map((poster) => (
                <div
                  key={poster.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {isVideoPoster(poster) ? (
                        <video
                          src={poster.videoUrl}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={poster.imageUrl}
                          alt={poster.title || poster.categoryLabel || poster.categoryId}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {poster.categoryLabel || poster.categoryId}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                        {poster.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{formatDate(poster.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(poster.status)}`}
                    >
                      {poster.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
                      {isVideoPoster(poster) ? "video" : "image"}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(poster)}
                      disabled={actionPosterId === poster.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeletePoster(poster)}
                      disabled={actionPosterId === poster.id}
                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
                      {actionPosterId === poster.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                    Photo Controls
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Select photo slot, adjust shape and size, then drag it inside the preview.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <label className="flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90">
                      <span className="font-medium">Add Photo</span>
                      <span className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={personalization.showVideoExtraPhoto}
                          onChange={(event) =>
                            setPersonalization((prev) => ({
                              ...prev,
                              showVideoExtraPhoto: event.target.checked,
                            }))
                          }
                          className="peer sr-only"
                        />
                        <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300" />
                        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                      </span>
                    </label>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-1">
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoTarget("photo")}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            selectedPhotoTarget === "photo"
                              ? "bg-white text-slate-950"
                              : "text-white/80 hover:bg-white/10"
                          }`}
                        >
                          Main Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoTarget("videoExtraPhoto")}
                          disabled={!personalization.showVideoExtraPhoto}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            selectedPhotoTarget === "videoExtraPhoto"
                              ? "bg-white text-slate-950"
                              : "text-white/80 hover:bg-white/10"
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          Add Photo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">{customizationCopy.photoShape}</span>
                      <select
                        data-no-auto-translate="true"
                        value={
                          selectedPhotoTarget === "videoExtraPhoto"
                            ? personalization.videoExtraPhotoShape
                            : personalization.photoShape
                        }
                        onChange={(event) =>
                          setPersonalization((prev) => ({
                            ...prev,
                            ...(selectedPhotoTarget === "videoExtraPhoto"
                              ? { videoExtraPhotoShape: event.target.value as PhotoShape }
                              : { photoShape: event.target.value as PhotoShape }),
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
                        value={
                          selectedPhotoTarget === "videoExtraPhoto"
                            ? personalization.videoExtraPhotoRenderMode
                            : personalization.photoRenderMode
                        }
                        onChange={(event) =>
                          setPersonalization((prev) => ({
                            ...prev,
                            ...(selectedPhotoTarget === "videoExtraPhoto"
                              ? {
                                  videoExtraPhotoRenderMode: event.target.value as
                                    | "cutout"
                                    | "original",
                                }
                              : {
                                  photoRenderMode: event.target.value as "cutout" | "original",
                                }),
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                      >
                        <option value="cutout" className="bg-white text-slate-950">{customizationCopy.bgRemoved}</option>
                        <option value="original" className="bg-white text-slate-950">{customizationCopy.original}</option>
                      </select>
                    </label>

                    {isVideoPreview ? (
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Animation
                        </span>
                        <select
                          data-no-auto-translate="true"
                          value={
                            selectedPhotoTarget === "videoExtraPhoto"
                              ? personalization.videoExtraPhotoAnimation
                              : personalization.photoAnimation
                          }
                          onChange={(event) =>
                            setPersonalization((prev) => ({
                              ...prev,
                              ...(selectedPhotoTarget === "videoExtraPhoto"
                                ? {
                                    videoExtraPhotoAnimation: parseVideoPhotoAnimation(
                                      event.target.value,
                                    ),
                                  }
                                : {
                                    photoAnimation: parseVideoPhotoAnimation(
                                      event.target.value,
                                    ),
                                  }),
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                        >
                          {VIDEO_PHOTO_ANIMATION_OPTIONS.map((option) => (
                            <option
                              key={option.value}
                              value={option.value}
                              className="bg-white text-slate-950"
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        {customizationCopy.photoSize}{" "}
                        {Math.round(
                          selectedPhotoTarget === "videoExtraPhoto"
                            ? safePersonalization.videoExtraPhotoScale
                            : safePersonalization.photoScale,
                        )}
                        %
                      </span>
                      <input
                        type="range"
                        min={12}
                        max={90}
                        value={
                          selectedPhotoTarget === "videoExtraPhoto"
                            ? safePersonalization.videoExtraPhotoScale
                            : safePersonalization.photoScale
                        }
                        onChange={(event) =>
                          setPersonalization((prev) =>
                            clampPhotoSafeArea(
                              selectedPhotoTarget === "videoExtraPhoto"
                                ? { ...prev, videoExtraPhotoScale: Number(event.target.value) }
                                : { ...prev, photoScale: Number(event.target.value) },
                              fileMeta,
                            ),
                          )
                        }
                        className="mt-3 w-full accent-[var(--portal-green)]"
                      />
                    </label>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90">
                  <span className="font-medium">{customizationCopy.showGradientStrip}</span>
                  <span className="relative inline-flex items-center">
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
                      className="peer sr-only"
                    />
                    <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300" />
                    <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </span>
                </label>

              </div>
            </section>

            <section className="flex min-w-0 items-center justify-center p-0 sm:p-2">
              {filePreviewUrl ? (
                <div className="w-full max-w-4xl">
                  <div className="overflow-auto p-0 sm:p-1">
                    <div className="mx-auto inline-block max-w-full align-top leading-none">
                      <div ref={previewFrameRef} className="relative overflow-visible align-top">
                        {isVideoPreview ? (
                          <video
                            ref={previewVideoRef}
                            src={filePreviewUrl}
                            className="block h-auto max-h-[62vh] w-auto max-w-full bg-slate-950 object-contain align-top sm:max-h-[72vh]"
                            controls={videoPreviewStarted}
                            muted
                            playsInline
                            preload="metadata"
                            onEnded={() => {
                              void replayVideoPreviewFromStart();
                            }}
                          />
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={filePreviewUrl} alt="Poster preview" className="block h-auto max-h-[62vh] w-auto max-w-full object-contain align-top sm:max-h-[72vh]" />
                          </>
                        )}

                        <div
                          key={`main-photo-${personalization.photoAnimation}-${videoPreviewCycle}`}
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
                            ...resolveVideoPhotoAnimationStyle(
                              safePersonalization.photoAnimation,
                              isVideoPreview && videoPreviewStarted,
                            ),
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

                        {personalization.showVideoExtraPhoto ? (
                          <div
                            key={`extra-photo-${personalization.videoExtraPhotoAnimation}-${videoPreviewCycle}`}
                            onPointerDown={(event) => startDrag("videoExtraPhoto", event)}
                            className={`absolute touch-none overflow-hidden ${
                              isVideoExtraPhotoDragging ? "cursor-grabbing" : "cursor-grab"
                            }`}
                            style={{
                              left: `${safePersonalization.videoExtraPhotoX}%`,
                              top: `${safePersonalization.videoExtraPhotoY}%`,
                              width: `${safePersonalization.videoExtraPhotoScale}%`,
                              zIndex: 2,
                              touchAction: "none",
                              aspectRatio: photoShapeAspectRatio(
                                safePersonalization.videoExtraPhotoShape,
                              ),
                              ...photoShapeFrameStyle(
                                safePersonalization.videoExtraPhotoShape,
                              ),
                              ...resolveVideoPhotoAnimationStyle(
                                safePersonalization.videoExtraPhotoAnimation,
                                videoPreviewStarted,
                              ),
                            }}
                          >
                            {renderPosterPhotoPreview({
                              shape: safePersonalization.videoExtraPhotoShape,
                              renderMode: safePersonalization.videoExtraPhotoRenderMode,
                              edgeStyle: safePersonalization.videoExtraPhotoEdgeStyle,
                              frameStyle: safePersonalization.videoExtraPhotoFrameStyle,
                              src: PERSONALIZATION_SAMPLE.photoUrl,
                              alt: "Add photo sample user",
                            })}
                            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-950/82 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg">
                              Add Photo
                            </div>
                          </div>
                        ) : null}

                        {isVideoPreview && !videoPreviewStarted ? (
                          <button
                            type="button"
                            onClick={startVideoPreviewPlayback}
                            className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/78 text-white shadow-2xl ring-1 ring-white/15 transition hover:bg-slate-950/88"
                            aria-label="Play video preview"
                          >
                            <span className="ml-1 text-3xl leading-none">▶</span>
                          </button>
                        ) : null}

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
      <style jsx global>{VIDEO_PHOTO_ANIMATION_GLOBAL_CSS}</style>
    </section>
  );
}
