"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";
import { portalLanguage, t } from "@/lib/i18n";
import {
  PHOTO_SHAPE_GROUPS,
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
  type PhotoEdgeStyle,
  type PhotoFrameStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";

interface CreatorCategory {
  id: string;
  label: string;
}

interface CreatorPoster {
  id: string;
  categoryId: string;
  categoryLabel: string;
  mediaType?: string;
  imageUrl: string;
  videoUrl?: string;
  status: string;
  reviewComment?: string;
  createdAt: number;
  uploadDayKey?: string;
  publishAt?: number;
  performanceWindowEndAt?: number;
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

interface CreatorDashboardResponse {
  ok: boolean;
  error?: string;
  previewOnly?: boolean;
  profile?: {
    creatorPublicId: string;
    name: string;
    email: string;
  } | null;
  assignedCategories?: CreatorCategory[];
  uploadWindow?: {
    isOpen: boolean;
    closesAt: number;
    opensAt: number;
    cutoffLabel: string;
    dayKey: string;
  };
  todayUploadsByCategory?: CreatorPoster[];
  announcements?: Array<{
    id: string;
    title: string;
    message: string;
    priority: "normal" | "important" | "urgent";
    endAt: number;
  }>;
  posters?: CreatorPoster[];
}

interface ImageMeta {
  width: number;
  height: number;
}

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
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SOURCE_IMAGE_LABEL = "12 MB";
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_LABEL = "5 MB";

function isVideoFile(file: File | null): boolean {
  return Boolean(file && (file.type || "").toLowerCase().startsWith("video/"));
}

function isImageFile(file: File | null): boolean {
  return Boolean(file && (file.type || "").toLowerCase().startsWith("image/"));
}

function isServerAcceptedImage(file: File): boolean {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
    (file.type || "").toLowerCase(),
  );
}

function isVideoPoster(poster: Pick<CreatorPoster, "mediaType" | "videoUrl">): boolean {
  return poster.mediaType === "video" && Boolean(poster.videoUrl);
}

function validatePosterFile(file: File | null): string | null {
  if (!file) return null;
  const mimeType = (file.type || "").toLowerCase();
  const allowedMimeTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];
  if (!allowedMimeTypes.includes(mimeType) && !mimeType.startsWith("image/")) {
    return "Only image files, MP4, MOV, or WEBM files are allowed.";
  }
  if (mimeType.startsWith("video/")) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      return `Poster video must be ${MAX_VIDEO_UPLOAD_LABEL} or smaller.`;
    }
    return null;
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return `Poster image must be ${MAX_SOURCE_IMAGE_LABEL} or smaller.`;
  }
  return null;
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
      throw new Error(t("creator.upload.unableReadImageSize", "en"));
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
        throw new Error(t("creator.upload.unableOptimizeImage", "en"));
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
        ? `Poster image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller, and poster video must be ${MAX_VIDEO_UPLOAD_LABEL} or smaller.`
        : text.slice(0, 160) || t("creator.upload.uploadFailed", "en"),
    };
  }
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

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

export default function CreatorUploadStudioPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const searchParams = useSearchParams();
  const requestedCategoryId = (searchParams.get("categoryId") ?? "").trim();
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CreatorDashboardResponse | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<ImageMeta | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [personalization, setPersonalization] =
    useState<PersonalizationConfig>(defaultPersonalization);
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [openCustomizeAfterPick, setOpenCustomizeAfterPick] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    target: "photo" | "name" | null;
    dragging: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({
    target: null,
    dragging: false,
    startX: 0,
    startY: 0,
    initialX: 50,
    initialY: 45,
  });

  async function loadDashboard(withRefreshState = false) {
    if (withRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const response = await fetch(
        withCreatorImpersonationQuery("/api/creator/dashboard", searchParams),
        {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        },
      );
      const next = (await response.json()) as CreatorDashboardResponse;
      if (!response.ok || !next.ok) {
        throw new Error(next.error ?? t("creator.upload.unableLoadWorkspace", portalLanguage(language)));
      }
      setDashboard(next);
      if (next.assignedCategories && next.assignedCategories.length > 0) {
        const requestedMatch = requestedCategoryId
          ? next.assignedCategories.find((item) => item.id === requestedCategoryId)
          : null;
        if (requestedMatch) {
          setCategoryId(requestedMatch.id);
        } else if (!categoryId) {
          setCategoryId(next.assignedCategories[0]!.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("creator.upload.unableLoadWorkspace", portalLanguage(language)));
    } finally {
      if (withRefreshState) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, requestedCategoryId, searchParams]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      setFileMeta(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setFilePreviewUrl(nextUrl);
    if (isVideoFile(file)) {
      setFileMeta({
        width: 1080,
        height: 1920,
      });
      return () => URL.revokeObjectURL(nextUrl);
    }
    const image = new window.Image();
    image.onload = () => {
      setFileMeta({
        width: image.naturalWidth || 1080,
        height: image.naturalHeight || 1080,
      });
    };
    image.src = nextUrl;
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCustomizeOpen(false);
      }
    }
    if (customizeOpen) {
      window.addEventListener("keydown", closeOnEscape);
    }
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [customizeOpen]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!dragRef.current.dragging) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const deltaXPercent = ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaYPercent = ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(0, Math.min(100, dragRef.current.initialX + deltaXPercent));
      const nextY = Math.max(0, Math.min(100, dragRef.current.initialY + deltaYPercent));
      if (dragRef.current.target === "photo") {
        setPersonalization((prev) => {
          return clampPhotoSafeArea({ ...prev, photoX: nextX, photoY: nextY }, fileMeta);
        });
      } else if (dragRef.current.target === "name") {
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

  function startPhotoDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target: "photo",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.photoX,
      initialY: personalization.photoY,
    };
    setIsPhotoDragging(true);
  }

  function startNameDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target: "name",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.nameX,
      initialY: personalization.nameY,
    };
    setIsNameDragging(true);
  }

  function onPhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalization((prev) =>
      clampPhotoSafeArea({ ...prev, photoScale: prev.photoScale + direction * 2 }, fileMeta),
    );
  }

  async function performUpload() {
    if (!file) {
      setUploadMessage(t("creator.upload.selectPoster", portalLanguage(language)));
      return;
    }
    const fileError = validatePosterFile(file);
    if (fileError) {
      alert(fileError);
      setUploadMessage(fileError);
      return;
    }
    if (!categoryId) {
      setUploadMessage(t("creator.upload.selectAssignedCategory", portalLanguage(language)));
      return;
    }
    setUploadBusy(true);
    setUploadMessage(t("creator.upload.preparingUpload", portalLanguage(language)));
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(t("creator.upload.loginRequired", portalLanguage(language)));
      }
      const uploadFile = await preparePosterFileForUpload(file);
      const body = new FormData();
      body.set("categoryId", categoryId);
      body.set("media", uploadFile);
      body.set("personalizationConfig", JSON.stringify(clampPhotoSafeArea(personalization, fileMeta)));
      const response = await fetch("/api/creator/posters", {
        method: "POST",
        headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        body,
      });
      const data = await readUploadResponse(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? t("creator.upload.uploadFailed", portalLanguage(language)));
      }
      setUploadMessage(t("creator.upload.uploadedForReview", portalLanguage(language)));
      setCustomizeOpen(false);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : t("creator.upload.uploadFailed", portalLanguage(language)));
    } finally {
      setUploadBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await performUpload();
  }

  const assignedCategories = dashboard?.assignedCategories ?? [];
  const announcements = dashboard?.announcements ?? [];
  const uploadWindow = dashboard?.uploadWindow;
  const todayUploadsByCategory = useMemo(
    () =>
      Object.fromEntries(
        (dashboard?.todayUploadsByCategory ?? []).map((item) => [item.categoryId, item]),
      ) as Record<string, CreatorPoster>,
    [dashboard?.todayUploadsByCategory],
  );
  const activeCategory = assignedCategories.find((item) => item.id === categoryId) ?? null;
  const activeTodayUpload = categoryId ? (todayUploadsByCategory[categoryId] ?? null) : null;
  const activePreviewAspectRatio =
    fileMeta && fileMeta.width > 0 && fileMeta.height > 0
      ? `${fileMeta.width} / ${fileMeta.height}`
      : "1 / 1";
  const safePersonalization = clampPhotoSafeArea(personalization, fileMeta);
  const stripGradient = resolvePosterStripGradient(
    PERMANENT_SAMPLE_NAME,
    personalization.stripHeight,
  );
  const gradientTextColor = stripTextColor(stripGradient);
  const lang = portalLanguage(language);
  const isTelugu = language === "telugu";
  const customizationCopy = {
    uploadStudio: isTelugu ? "అప్లోడ్ స్టూడియో" : "Upload Studio",
    uploadTitle: isTelugu ? "అప్లోడ్" : "Upload",
    refresh: isTelugu ? "రిఫ్రెష్" : "Refresh",
    refreshing: isTelugu ? "రిఫ్రెష్ అవుతోంది..." : "Refreshing...",
    uploadWindowClosed: isTelugu
      ? "టుడే అప్లోడ్ విండో క్లోజ్ అయింది. మళ్లీ అప్లోడ్ స్టార్ట్ అయ్యే టైమ్"
      : "Upload window is closed today. Uploads reopen from",
    imageCustomizationOnly: isTelugu
      ? "ఇమేజ్ కస్టమైజేషన్ పోస్టర్ ఇమేజెస్‌కి మాత్రమే అవైలబుల్ ఉంది."
      : "Image customization is available only for poster images.",
    selectedCategory: isTelugu ? "సెలెక్ట్ చేసిన కేటగిరీ" : "Selected Category",
    selectCategory: isTelugu ? "సెలెక్ట్ కేటగిరీ" : "Select category",
    noAssignedCategories: isTelugu ? "అసైన్డ్ క్యాటగిరీస్ లేవు." : "No assigned categories.",
    accepted: isTelugu ? "యాక్సెప్టెడ్" : "Accepted",
    rejected: isTelugu ? "రిజెక్టెడ్" : "Rejected",
    pending: isTelugu ? "పెండింగ్" : "Pending",
    reason: isTelugu ? "రీజన్" : "Reason",
    choosePoster: isTelugu ? "చూస్ పోస్టర్" : "Choose Poster",
    customization: isTelugu ? "కస్టమైజేషన్" : "Customization",
    uploading: isTelugu ? "అప్లోడింగ్..." : "Uploading...",
    upload: isTelugu ? "అప్లోడ్" : "Upload",
    alreadyUploadedToday: isTelugu
      ? "ఈ క్యాటగిరీలో టుడే లేటెస్ట్ సబ్మిషన్ క్రింద కనిపిస్తుంది. ఇంకా పోస్టర్లు అప్లోడ్ చేయొచ్చు."
      : "Latest submission for this category today is shown below. You can upload more posters.",
    customize: isTelugu ? "కస్టమైజ్" : "Customize",
    previewPlacement: isTelugu ? "ప్రివ్యూ ప్లేస్‌మెంట్" : "Preview Placement",
    close: isTelugu ? "క్లోజ్" : "Close",
    photoShape: isTelugu ? "ఫోటో షేప్" : "Photo Shape",
    premiumShapes: isTelugu ? "ప్రీమియం షేప్స్" : "Premium Shapes",
    transparentCutouts: isTelugu ? "ట్రాన్స్‌పరెంట్ కటౌట్స్" : "Transparent Cutouts",
    photoMode: isTelugu ? "ఫోటో మోడ్" : "Photo Mode",
    bgRemoved: isTelugu ? "బ్యాక్‌గ్రౌండ్ తొలగించినది" : "BG Removed",
    originalPhoto: isTelugu ? "ఒరిజినల్ ఫోటో" : "Original Photo",
    photoSize: isTelugu ? "ఫోటో సైజ్" : "Photo Size",
    dragHelp: isTelugu
      ? "ఫోటో, నేమ్‌ని డైరెక్ట్‌గా డ్రాగ్ చేయండి. ఫోటో సైజ్ మార్చడానికి మౌస్ వీల్ వాడండి."
      : "Drag the photo and name directly. Use the mouse wheel to adjust photo size.",
    showGradientStrip: isTelugu ? "షో గ్రాడియెంట్ స్ట్రిప్" : "Show gradient strip",
    apply: isTelugu ? "అప్లై" : "Apply",
    appliedMessage: isTelugu
      ? "కస్టమైజేషన్ అప్లై అయింది. అప్లోడ్ చేసినప్పుడు ఇదే ప్లేస్‌మెంట్ సేవ్ అవుతుంది."
      : "Customization applied. This placement will be saved when you upload.",
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
  Object.assign(customizationCopy, {
    uploadStudio: t("creator.upload.uploadStudio", lang),
    uploadTitle: t("creator.upload.uploadTitle", lang),
    refresh: t("creator.upload.refresh", lang),
    refreshing: t("creator.upload.refreshing", lang),
    uploadWindowClosed: t("creator.upload.uploadWindowClosed", lang),
    imageCustomizationOnly: t("creator.upload.imageCustomizationOnly", lang),
    selectedCategory: t("creator.upload.selectedCategory", lang),
    selectCategory: t("creator.upload.selectCategory", lang),
    noAssignedCategories: t("creator.upload.noAssignedCategories", lang),
    accepted: t("creator.upload.accepted", lang),
    rejected: t("creator.upload.rejected", lang),
    pending: t("creator.upload.pending", lang),
    reason: t("creator.upload.reason", lang),
    choosePoster: t("creator.upload.choosePoster", lang),
    customization: t("creator.upload.customization", lang),
    uploading: t("creator.upload.uploading", lang),
    upload: t("creator.upload.upload", lang),
    alreadyUploadedToday: t("creator.upload.alreadyUploadedToday", lang),
    customize: t("creator.upload.customize", lang),
    previewPlacement: t("creator.upload.previewPlacement", lang),
    close: t("creator.upload.close", lang),
    photoShape: t("creator.upload.photoShape", lang),
    premiumShapes: t("creator.upload.premiumShapes", lang),
    transparentCutouts: t("creator.upload.transparentCutouts", lang),
    photoMode: t("creator.upload.photoMode", lang),
    bgRemoved: t("creator.upload.bgRemoved", lang),
    originalPhoto: t("creator.upload.originalPhoto", lang),
    photoSize: t("creator.upload.photoSize", lang),
    dragHelp: t("creator.upload.dragHelp", lang),
    showGradientStrip: t("creator.upload.showGradientStrip", lang),
    apply: t("creator.upload.apply", lang),
    appliedMessage: t("creator.upload.appliedMessage", lang),
    shapeLabels: {
      circle: t("creator.upload.shape.circle", lang),
      scallop_circle: t("creator.upload.shape.scallop_circle", lang),
      soft_burst: t("creator.upload.shape.soft_burst", lang),
      badge: t("creator.upload.shape.badge", lang),
      rounded_square: t("creator.upload.shape.rounded_square", lang),
      vertical_rectangle: t("creator.upload.shape.vertical_rectangle", lang),
      square: t("creator.upload.shape.square", lang),
      transparent_bottom_fade: t("creator.upload.shape.transparent_bottom_fade", lang),
      transparent_clean: t("creator.upload.shape.transparent_clean", lang),
      transparent_soft_round: t("creator.upload.shape.transparent_soft_round", lang),
      transparent_sharp_round: t("creator.upload.shape.transparent_sharp_round", lang),
    } as Record<string, string>,
  });

  function openFilePicker(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setOpenCustomizeAfterPick(false);
    fileInputRef.current?.click();
  }

  function openCustomizationPicker(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    if (nextCategoryId === categoryId && file && !isVideoFile(file)) {
      setCustomizeOpen(true);
      setUploadMessage(null);
      return;
    }
    setOpenCustomizeAfterPick(true);
    fileInputRef.current?.click();
  }

  return (
    <>
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {announcements.length > 0 ? (
        <section className="mb-6 rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 lg:grid-cols-2">
            {announcements.slice(0, 4).map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {item.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        <article className="px-1 py-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                {customizationCopy.uploadStudio}
              </p>
              <h3 className="mt-2 text-xl font-bold text-slate-950">{customizationCopy.uploadTitle}</h3>
            </div>
            <button
              onClick={() => void loadDashboard(true)}
              className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
            >
              {refreshing ? customizationCopy.refreshing : customizationCopy.refresh}
            </button>
          </div>

          {!uploadWindow?.isOpen ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              {customizationCopy.uploadWindowClosed} {formatDate(uploadWindow?.opensAt ?? 0)}.
            </div>
          ) : null}

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
                setUploadMessage(message);
                event.target.value = "";
                setFile(null);
                setOpenCustomizeAfterPick(false);
                return;
              }
              setFile(selectedFile);
              if (openCustomizeAfterPick) {
                if (isVideoFile(selectedFile)) {
                  setUploadMessage(customizationCopy.imageCustomizationOnly);
                  setCustomizeOpen(false);
                } else if (selectedFile) {
                  setCustomizeOpen(true);
                  setUploadMessage(null);
                }
                setOpenCustomizeAfterPick(false);
              }
            }}
            className="hidden"
          />

          <div className="mt-5 flex flex-wrap gap-3">
            {assignedCategories.length === 0 ? (
              <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                {customizationCopy.noAssignedCategories}
              </div>
            ) : (
              assignedCategories.map((category) => {
                const todayUpload = todayUploadsByCategory[category.id];
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      category.id === categoryId
                        ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                        : "border-[var(--portal-border)] bg-white text-slate-700 hover:border-[var(--portal-purple)] hover:text-[var(--portal-purple)]"
                    }`}
                  >
                    <span>{category.label}</span>
                    {todayUpload ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          todayUpload.status === "approved"
                            ? "bg-emerald-600 text-white"
                            : todayUpload.status === "rejected"
                              ? "bg-rose-600 text-white"
                              : "bg-violet-600 text-white"
                        }`}
                      >
                        {todayUpload.status === "approved"
                          ? customizationCopy.accepted
                          : todayUpload.status === "rejected"
                            ? customizationCopy.rejected
                            : customizationCopy.pending}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <form onSubmit={handleUpload} className="mt-5 rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                  {customizationCopy.selectedCategory}
                </p>
                <h4 className="mt-2 text-lg font-bold text-slate-950">
                  {activeCategory?.label ?? customizationCopy.selectCategory}
                </h4>
                {activeTodayUpload ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(activeTodayUpload.status)}`}>
                      {activeTodayUpload.status === "approved"
                        ? customizationCopy.accepted
                        : activeTodayUpload.status === "rejected"
                          ? customizationCopy.rejected
                          : customizationCopy.pending}
                    </span>
                    <p>{formatDate(activeTodayUpload.createdAt)}</p>
                    {activeTodayUpload.reviewComment ? (
                      <p className="text-rose-600">{customizationCopy.reason}: {activeTodayUpload.reviewComment}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {file ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {file.name}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <button
                type="button"
                disabled={!uploadWindow?.isOpen || !categoryId}
                onClick={() => openFilePicker(categoryId)}
                style={{ aspectRatio: filePreviewUrl ? activePreviewAspectRatio : "1 / 1" }}
                className="relative flex w-full overflow-hidden rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] text-center transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {filePreviewUrl ? (
                  isVideoFile(file) ? (
                    <video
                      src={filePreviewUrl}
                      className="h-full w-full bg-slate-950 object-contain"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreviewUrl}
                        alt={activeCategory?.label ?? "Poster"}
                        className="h-full w-full object-contain"
                      />
                    </>
                  )
                ) : activeTodayUpload ? (
                  isVideoPoster(activeTodayUpload) ? (
                    <video
                      src={activeTodayUpload.videoUrl}
                      className="h-full w-full bg-slate-950 object-contain"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeTodayUpload.imageUrl}
                        alt={activeTodayUpload.categoryLabel || activeTodayUpload.categoryId}
                        className="h-full w-full object-contain"
                      />
                    </>
                  )
                ) : (
                  <div className="flex w-full flex-col items-center justify-center p-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--portal-purple)] text-xl font-semibold text-white">
                      +
                    </span>
                    <span className="mt-3 text-sm font-semibold text-slate-900">{customizationCopy.choosePoster}</span>
                  </div>
                )}
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(true)}
                  disabled={!filePreviewUrl || isVideoFile(file)}
                  className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isVideoFile(file) ? customizationCopy.imageCustomizationOnly : customizationCopy.customize}
                </button>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!uploadWindow?.isOpen || !categoryId}
                    onClick={() => openCustomizationPicker(categoryId)}
                    className="rounded-xl border border-[var(--portal-purple)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-purple)] transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {customizationCopy.customization}
                  </button>
                  <button
                    type="submit"
                    disabled={uploadBusy || !file || !uploadWindow?.isOpen || !categoryId}
                    className="rounded-xl bg-[var(--portal-green)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadBusy ? customizationCopy.uploading : customizationCopy.upload}
                  </button>
                </div>

                {activeTodayUpload ? (
                  <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {customizationCopy.alreadyUploadedToday}
                  </p>
                ) : null}

                {uploadMessage ? (
                  <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                    {uploadMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </form>
        </article>
      </section>

      {customizeOpen ? (
        <div data-no-auto-translate="true" className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/82 p-2 backdrop-blur-sm sm:p-4">
          <div className="mx-auto grid min-h-full max-w-7xl gap-3 py-2 sm:gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="max-h-none overflow-y-auto rounded-[22px] border border-white/10 bg-slate-950 p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:p-5 xl:max-h-[calc(100vh-2rem)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                    {customizationCopy.customize}
                  </p>
                  <h4 className="mt-2 text-lg font-bold">{customizationCopy.previewPlacement}</h4>
                </div>
                <button
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                >
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
                      setPersonalization((prev) => ({
                        ...prev,
                        photoRenderMode: event.target.value as "cutout" | "original",
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                  >
                    <option value="cutout" className="bg-white text-slate-950">{customizationCopy.bgRemoved}</option>
                    <option value="original" className="bg-white text-slate-950">{customizationCopy.originalPhoto}</option>
                  </select>
                </label>


                <label className="block">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {customizationCopy.photoSize} ({Math.round(personalization.photoScale)}%)
                  </span>
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

                <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-slate-300">
                  {customizationCopy.dragHelp}
                </div>

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
                <div className="flex w-full max-w-4xl flex-col items-center gap-4">
                  <div className="w-full overflow-auto p-0 sm:p-1">
                    <div className="mx-auto inline-block max-w-full align-top leading-none">
                      <div
                        ref={previewFrameRef}
                        className="relative overflow-visible align-top"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={filePreviewUrl}
                          alt="Poster preview"
                          className="block h-auto max-h-[62vh] w-auto max-w-full object-contain align-top sm:max-h-[72vh]"
                        />

                        <div
                          onPointerDown={startPhotoDrag}
                          onWheel={onPhotoWheel}
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
                            onPointerDown={startNameDrag}
                            className={`absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 select-none ${
                              isNameDragging ? "cursor-grabbing" : "cursor-grab"
                            }`}
                            style={{
                              left: `${personalization.nameX}%`,
                              top: `${personalization.nameY}%`,
                              touchAction: "none",
                            }}
                          >
                            <p
                              className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                              style={{
                                fontFamily:
                                  "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                              }}
                            >
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
                          <p
                            className="truncate text-xl font-semibold leading-tight tracking-wide"
                            style={{
                              fontFamily:
                                "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                            }}
                          >
                            {PERMANENT_SAMPLE_NAME}
                          </p>
                        </div>
                      ) : null}

                    </div>
                  </div>

                  <div className="flex w-full justify-end">
                    <button
                      onClick={() => {
                        setCustomizeOpen(false);
                        setUploadMessage(customizationCopy.appliedMessage);
                      }}
                      className="rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
                    >
                      {customizationCopy.apply}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[320px] w-full max-w-4xl items-center justify-center rounded-[20px] bg-[#050816] px-4 text-center text-sm text-slate-400 sm:h-[60vh] sm:rounded-[24px]">
                  Select a poster image to open the full preview here.
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
