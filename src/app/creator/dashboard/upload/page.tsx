"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import {
  AppStyleNameStrip,
  isPhotoInNameStripSafeZone,
  NameStripOverlapWarning,
  nameStripSafeZoneHeightPercent,
} from "@/components/posters/app-style-name-strip";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
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
import {
  parseVideoPhotoAnimation,
  resolveVideoPhotoAnimationStyle,
  VIDEO_PHOTO_ANIMATION_GLOBAL_CSS,
  VIDEO_PHOTO_ANIMATION_OPTIONS,
  type VideoPhotoAnimation,
} from "@/lib/video-photo-animation";

interface CreatorCategory {
  id: string;
  label: string;
  isDynamic?: boolean;
  allowPoliticalProtocol?: boolean;
  eventDateLabel?: string;
  eventStartAt?: number;
}

interface CreatorPoster {
  id: string;
  categoryId: string;
  categoryLabel: string;
  mediaType?: string;
  imageUrl: string;
  videoUrl?: string;
  personalizationConfig?: Partial<PersonalizationConfig> | null;
  status: string;
  reviewComment?: string;
  createdAt: number;
  uploadDayKey?: string;
  requestedPublishAt?: number;
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
  stripWidth: number;
  stripX: number;
  stripBottom: number;
  showPoliticalProtocol: boolean;
  politicalProtocolX: number;
  politicalProtocolY: number;
  politicalProtocolScale: number;
  politicalProtocolSlots: PoliticalProtocolSlot[];
  sampleName: string;
  sampleDesignation: string;
}

interface PoliticalProtocolSlot {
  x: number;
  y: number;
  scale: number;
}

const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;

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
  stripWidth: 100,
  stripX: 50,
  stripBottom: 0,
  showPoliticalProtocol: true,
  politicalProtocolX: 50,
  politicalProtocolY: 7,
  politicalProtocolScale: 85,
  politicalProtocolSlots: [
    { x: 28, y: 8, scale: 85 },
    { x: 72, y: 8, scale: 85 },
  ],
  sampleName: PERSONALIZATION_SAMPLE.name,
  sampleDesignation: PERSONALIZATION_SAMPLE.designation,
};

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";
const MAX_VIDEO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_LABEL = "5 MB";
const IST_OFFSET_MINUTES = 330;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function isVideoFile(file: File | null): boolean {
  return Boolean(file && (file.type || "").toLowerCase().startsWith("video/"));
}

function isImageFile(file: File | null): boolean {
  return Boolean(file && (file.type || "").toLowerCase().startsWith("image/"));
}

function isVideoPoster(
  poster: Pick<CreatorPoster, "mediaType" | "videoUrl">,
): boolean {
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
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `Poster image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
  }
  return null;
}

function shiftedIstDate(epochMs: number) {
  return new Date(epochMs + IST_OFFSET_MINUTES * MINUTE_MS);
}

function getIstDateKey(epochMs: number): string {
  const date = shiftedIstDate(epochMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIstStartOfDay(epochMs: number): number {
  const date = shiftedIstDate(epochMs);
  return (
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
    IST_OFFSET_MINUTES * MINUTE_MS
  );
}

function getIstStartOfDayOffset(
  epochMs: number,
  daysFromInputDay: number,
): number {
  return getIstStartOfDay(epochMs) + daysFromInputDay * DAY_MS;
}

function getNextIstWeekdayStart(
  epochMs: number,
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): number {
  const startOfDay = getIstStartOfDay(epochMs);
  const shifted = shiftedIstDate(startOfDay);
  const todayWeekday = ((shifted.getUTCDay() + 6) % 7) + 1;
  let daysAhead = weekday - todayWeekday;
  if (daysAhead < 0) {
    daysAhead += 7;
  }
  return startOfDay + daysAhead * DAY_MS;
}

function categoryWeekday(categoryId: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  switch (categoryId) {
    case "weekday_monday_special":
      return 1;
    case "weekday_tuesday_special":
      return 2;
    case "weekday_wednesday_special":
      return 3;
    case "weekday_thursday_special":
      return 4;
    case "weekday_friday_special":
      return 5;
    case "weekday_saturday_special":
      return 6;
    case "weekday_sunday_special":
      return 7;
    default:
      return null;
  }
}

function categoryAllowsPoliticalProtocol(category: CreatorCategory | null): boolean {
  if (!category) return false;
  const normalized = category.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (
    category.allowPoliticalProtocol === false &&
    !normalized.startsWith("party_") &&
    normalized !== "today_special"
  ) {
    return false;
  }
  return (
    normalized.startsWith("party_") ||
    normalized === "today_special" ||
    category.allowPoliticalProtocol === true ||
    category.isDynamic === true
  );
}

function supportsManualPublishDate(category: CreatorCategory | null): boolean {
  if (!category) return false;
  return !category.isDynamic || categoryWeekday(category.id) != null;
}

function resolveDefaultPublishDateKey(
  category: CreatorCategory | null,
  now: number,
): string {
  if (!category) return "";
  const weekday = categoryWeekday(category.id);
  if (weekday) {
    return getIstDateKey(getNextIstWeekdayStart(now, weekday));
  }
  if (category.isDynamic && (category.eventStartAt ?? 0) > 0) {
    const earliestVisible = Math.max(
      (category.eventStartAt ?? 0) - 3 * DAY_MS,
      now,
    );
    return getIstDateKey(earliestVisible);
  }
  return getIstDateKey(getIstStartOfDayOffset(now, 1));
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
  const edgeTravelBleed = 18;
  const bottomBleed = config.showBottomStrip
    ? Math.max(1, Math.min(16, config.stripHeight * 0.75))
    : bleed;
  const aspect = posterAspect(meta);
  const maxScaleX = 100 - margin * 2;
  const maxScaleY = (100 - margin * 2) / aspect;
  const photoScale = clampNumber(
    config.photoScale,
    12,
    Math.max(12, Math.min(90, maxScaleX, maxScaleY)),
  );
  const videoExtraPhotoScale = clampNumber(
    config.videoExtraPhotoScale,
    12,
    Math.max(12, Math.min(90, maxScaleX, maxScaleY)),
  );
  const halfX = photoScale / 2;
  const halfY = (photoScale * aspect) / 2;
  const extraHalfX = videoExtraPhotoScale / 2;
  const extraHalfY = (videoExtraPhotoScale * aspect) / 2;
  const stripWidth = clampNumber(config.stripWidth, 35, 100);
  const stripHalfWidth = stripWidth / 2;
  return {
    ...config,
    stripHeight: clampNumber(config.stripHeight, 1, 40),
    stripWidth,
    stripX: clampNumber(config.stripX, stripHalfWidth, 100 - stripHalfWidth),
    stripBottom: clampNumber(config.stripBottom, 0, 20),
    showPoliticalProtocol: config.showPoliticalProtocol,
    politicalProtocolX: clampNumber(config.politicalProtocolX, 4, 96),
    politicalProtocolY: clampNumber(config.politicalProtocolY, 4, 96),
    politicalProtocolScale: clampNumber(config.politicalProtocolScale, 45, 135),
    politicalProtocolSlots: normalizePoliticalProtocolSlots(
      config.politicalProtocolSlots,
      config.politicalProtocolScale,
      config.politicalProtocolX,
      config.politicalProtocolY,
    ),
    photoScale,
    photoX: clampNumber(
      config.photoX,
      margin + halfX - edgeTravelBleed,
      100 - margin - halfX + edgeTravelBleed,
    ),
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

function normalizePoliticalProtocolSlots(
  raw: PoliticalProtocolSlot[] | undefined,
  fallbackScale: number,
  fallbackX: number,
  fallbackY: number,
): PoliticalProtocolSlot[] {
  const avoidOverlap = (slots: PoliticalProtocolSlot[]) => {
    if (slots.length < 2) return slots;
    const first = slots[0]!;
    const second = slots[1]!;
    const firstSide = protocolSlotSidePercent(first.scale);
    const secondSide = protocolSlotSidePercent(second.scale);
    const minimumGap = (firstSide + secondSide) / 2 + 2;
    const deltaX = second.x - first.x;
    const deltaY = second.y - first.y;
    if (Math.hypot(deltaX, deltaY) >= minimumGap) return slots;

    const centerX = clampNumber((first.x + second.x) / 2, minimumGap / 2, 100 - minimumGap / 2);
    const direction = deltaX >= 0 ? 1 : -1;
    const nextFirstX = clampNumber(centerX - (minimumGap / 2) * direction, firstSide / 2, 100 - firstSide / 2);
    const nextSecondX = clampNumber(centerX + (minimumGap / 2) * direction, secondSide / 2, 100 - secondSide / 2);
    return [
      { ...first, x: nextFirstX },
      { ...second, x: nextSecondX },
      ...slots.slice(2),
    ];
  };
  if (Array.isArray(raw) && raw.length >= 2) {
    return avoidOverlap(raw.slice(0, 2).map((slot) => ({
      x: clampNumber(Number(slot.x), 4, 96),
      y: clampNumber(Number(slot.y), 4, 96),
      scale: clampNumber(Number(slot.scale || fallbackScale), 45, 135),
    })));
  }
  const safeScale = clampNumber(fallbackScale, 45, 135);
  const side = protocolSlotSidePercent(safeScale);
  const spacing = side + 4;
  return avoidOverlap(Array.from({ length: 2 }, (_, index) => ({
    x: clampNumber(fallbackX + (index - 0.5) * spacing, 4, 96),
    y: clampNumber(fallbackY, 4, 96),
    scale: safeScale,
  })));
}

function protocolSlotSidePercent(scale: number): number {
  return 15 * (clampNumber(scale, 45, 135) / 100);
}

function protocolSlotCenterPercent(value: number, sidePercent: number): number {
  const half = sidePercent / 2;
  return clampNumber(value, half, 100 - half);
}

function parsePersonalizationConfig(
  input: Partial<PersonalizationConfig> | null | undefined,
): PersonalizationConfig {
  return clampPhotoSafeArea(
    {
      ...defaultPersonalization,
      ...input,
      politicalProtocolSlots: input?.politicalProtocolSlots ?? [],
      photoAnimation: parseVideoPhotoAnimation(input?.photoAnimation),
      videoExtraPhotoAnimation: parseVideoPhotoAnimation(
        input?.videoExtraPhotoAnimation,
      ),
    },
    null,
  );
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
  const { region } = useDashboardRegion();
  const searchParams = useSearchParams();
  const requestedCategoryId = (searchParams.get("categoryId") ?? "").trim();
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<CreatorDashboardResponse | null>(
    null,
  );
  const [pageNow] = useState(() => Date.now());
  const [categoryId, setCategoryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<ImageMeta | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [videoPreviewStarted, setVideoPreviewStarted] = useState(false);
  const [videoPreviewCycle, setVideoPreviewCycle] = useState(0);
  const [personalization, setPersonalization] = useState<PersonalizationConfig>(
    defaultPersonalization,
  );
  const [selectedPhotoTarget, setSelectedPhotoTarget] = useState<
    "photo" | "videoExtraPhoto"
  >("photo");
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isVideoExtraPhotoDragging, setIsVideoExtraPhotoDragging] =
    useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [requestedPublishDate, setRequestedPublishDate] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "review">("upload");
  const [editingPoster, setEditingPoster] = useState<CreatorPoster | null>(
    null,
  );
  const [posterActionBusyMap, setPosterActionBusyMap] = useState<
    Record<string, boolean>
  >({});
  const [selectedPosterIds, setSelectedPosterIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [openCustomizeAfterPick, setOpenCustomizeAfterPick] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<{
    target:
      | "photo"
      | "videoExtraPhoto"
      | "politicalProtocolSlot"
      | "name"
      | "strip-left"
      | "strip-right"
      | "strip-top"
      | null;
    dragging: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    slotIndex: number;
  }>({
    target: null,
    dragging: false,
    startX: 0,
    startY: 0,
    initialX: 50,
    initialY: 45,
    initialWidth: 100,
    initialHeight: 16,
    slotIndex: -1,
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
        withCreatorImpersonationQuery(
          `/api/creator/dashboard?regionId=${encodeURIComponent(region.id)}`,
          searchParams,
        ),
        {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        },
      );
      const next = (await response.json()) as CreatorDashboardResponse;
      if (!response.ok || !next.ok) {
        throw new Error(
          next.error ??
            t("creator.upload.unableLoadWorkspace", portalLanguage(language)),
        );
      }
      setDashboard(next);
      if (next.assignedCategories && next.assignedCategories.length > 0) {
        const requestedMatch = requestedCategoryId
          ? next.assignedCategories.find(
              (item) => item.id === requestedCategoryId,
            )
          : null;
        if (requestedMatch) {
          setCategoryId(requestedMatch.id);
        } else if (!categoryId) {
          setCategoryId(next.assignedCategories[0]!.id);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("creator.upload.unableLoadWorkspace", portalLanguage(language)),
      );
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
  }, [user, requestedCategoryId, searchParams, region.id]);

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
    setVideoPreviewStarted(false);
    setVideoPreviewCycle(0);
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }
  }, [customizeOpen, filePreviewUrl]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!dragRef.current.dragging) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const deltaXPercent =
        ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaYPercent =
        ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(
        0,
        Math.min(100, dragRef.current.initialX + deltaXPercent),
      );
      const nextY = Math.max(
        0,
        Math.min(100, dragRef.current.initialY + deltaYPercent),
      );
      if (dragRef.current.target === "photo") {
        setPersonalization((prev) => {
          return clampPhotoSafeArea(
            { ...prev, photoX: nextX, photoY: nextY },
            fileMeta,
          );
        });
      } else if (dragRef.current.target === "videoExtraPhoto") {
        setPersonalization((prev) => {
          return clampPhotoSafeArea(
            { ...prev, videoExtraPhotoX: nextX, videoExtraPhotoY: nextY },
            fileMeta,
          );
        });
      } else if (dragRef.current.target === "politicalProtocolSlot") {
        setPersonalization((prev) => {
          const slotIndex = dragRef.current.slotIndex;
          if (slotIndex < 0 || slotIndex >= 6) return prev;
          const slots = normalizePoliticalProtocolSlots(
            prev.politicalProtocolSlots,
            prev.politicalProtocolScale,
            prev.politicalProtocolX,
            prev.politicalProtocolY,
          );
          slots[slotIndex] = {
            ...slots[slotIndex]!,
            x: nextX,
            y: nextY,
          };
          return clampPhotoSafeArea(
            { ...prev, politicalProtocolSlots: slots },
            fileMeta,
          );
        });
      } else if (
        dragRef.current.target === "strip-left" ||
        dragRef.current.target === "strip-right"
      ) {
        setPersonalization((prev) => {
          const startLeft =
            dragRef.current.initialX - dragRef.current.initialWidth / 2;
          const startRight =
            dragRef.current.initialX + dragRef.current.initialWidth / 2;
          const nextLeft =
            dragRef.current.target === "strip-left"
              ? clampNumber(startLeft + deltaXPercent, 0, startRight - 35)
              : startLeft;
          const nextRight =
            dragRef.current.target === "strip-right"
              ? clampNumber(startRight + deltaXPercent, nextLeft + 35, 100)
              : startRight;
          const stripWidth = clampNumber(nextRight - nextLeft, 35, 100);
          return clampPhotoSafeArea(
            {
              ...prev,
              stripWidth,
              stripX: nextLeft + stripWidth / 2,
            },
            fileMeta,
          );
        });
      } else if (dragRef.current.target === "strip-top") {
        setPersonalization((prev) =>
          clampPhotoSafeArea(
            {
              ...prev,
              stripHeight: clampNumber(
                dragRef.current.initialHeight - deltaYPercent,
                1,
                40,
              ),
            },
            fileMeta,
          ),
        );
      } else if (dragRef.current.target === "name") {
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
    if (
      !personalization.showVideoExtraPhoto &&
      selectedPhotoTarget === "videoExtraPhoto"
    ) {
      setSelectedPhotoTarget("photo");
    }
  }, [personalization.showVideoExtraPhoto, selectedPhotoTarget]);

  function startPhotoDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedPhotoTarget("photo");
    dragRef.current = {
      target: "photo",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.photoX,
      initialY: personalization.photoY,
      initialWidth: personalization.photoScale,
      initialHeight: personalization.photoScale,
      slotIndex: -1,
    };
    setIsPhotoDragging(true);
    setIsVideoExtraPhotoDragging(false);
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
      initialWidth: personalization.stripWidth,
      initialHeight: personalization.stripHeight,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(true);
  }

  function startStripResize(
    event: React.PointerEvent<HTMLDivElement>,
    target: "strip-left" | "strip-right" | "strip-top",
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target,
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.stripX,
      initialY: personalization.nameY,
      initialWidth: personalization.stripWidth,
      initialHeight: personalization.stripHeight,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(true);
  }

  function startVideoExtraPhotoDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedPhotoTarget("videoExtraPhoto");
    dragRef.current = {
      target: "videoExtraPhoto",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: personalization.videoExtraPhotoX,
      initialY: personalization.videoExtraPhotoY,
      initialWidth: personalization.videoExtraPhotoScale,
      initialHeight: personalization.videoExtraPhotoScale,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(true);
  }

  function startPoliticalProtocolDrag(
    event: React.PointerEvent<HTMLDivElement>,
    slotIndex: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const slots = normalizePoliticalProtocolSlots(
      personalization.politicalProtocolSlots,
      personalization.politicalProtocolScale,
      personalization.politicalProtocolX,
      personalization.politicalProtocolY,
    );
    const slot =
      slots[slotIndex] ??
      defaultPersonalization.politicalProtocolSlots[slotIndex]!;
    dragRef.current = {
      target: "politicalProtocolSlot",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: slot.x,
      initialY: slot.y,
      initialWidth: slot.scale,
      initialHeight: slot.scale,
      slotIndex,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(false);
  }

  function onPhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalization((prev) =>
      clampPhotoSafeArea(
        { ...prev, photoScale: prev.photoScale + direction * 2 },
        fileMeta,
      ),
    );
  }

  function onVideoExtraPhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalization((prev) =>
      clampPhotoSafeArea(
        {
          ...prev,
          videoExtraPhotoScale: prev.videoExtraPhotoScale + direction * 2,
        },
        fileMeta,
      ),
    );
  }

  async function performUpload() {
    if (!file && !editingPoster) {
      setUploadMessage(
        t("creator.upload.selectPoster", portalLanguage(language)),
      );
      return;
    }
    const fileError = validatePosterFile(file);
    if (fileError) {
      alert(fileError);
      setUploadMessage(fileError);
      return;
    }
    if (!categoryId) {
      setUploadMessage(
        t("creator.upload.selectAssignedCategory", portalLanguage(language)),
      );
      return;
    }
    setUploadBusy(true);
    setUploadMessage(
      t("creator.upload.preparingUpload", portalLanguage(language)),
    );
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(
          t("creator.upload.loginRequired", portalLanguage(language)),
        );
      }
      const uploadFile = file ? await preparePosterFileForUpload(file) : null;
      const body = new FormData();
      body.set("categoryId", categoryId);
      body.set("regionId", region.id);
      if (manualPublishDateEnabled) {
        body.set(
          "requestedPublishDate",
          requestedPublishDate || defaultPublishDate,
        );
      }
      if (uploadFile) {
        body.set("media", uploadFile);
      }
      body.set(
        "personalizationConfig",
        JSON.stringify(clampPhotoSafeArea(personalization, fileMeta)),
      );
      const response = await fetch(
        editingPoster
          ? `/api/creator/posters/${encodeURIComponent(editingPoster.id)}`
          : "/api/creator/posters",
        {
          method: editingPoster ? "PATCH" : "POST",
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
          body,
        },
      );
      const data = await readUploadResponse(response);
      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ??
            t("creator.upload.uploadFailed", portalLanguage(language)),
        );
      }
      setUploadMessage(
        editingPoster
          ? language === "telugu"
            ? "పోస్టర్ అప్‌డేట్ అయి మళ్లీ రివ్యూకు వెళ్లింది."
            : "Poster updated and sent back for review."
          : t("creator.upload.uploadedForReview", portalLanguage(language)),
      );
      setCustomizeOpen(false);
      setEditingPoster(null);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(
        err instanceof Error
          ? err.message
          : t("creator.upload.uploadFailed", portalLanguage(language)),
      );
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
  const reviewPosters = dashboard?.posters ?? [];
  const uploadWindow = dashboard?.uploadWindow;
  const activeCategory =
    assignedCategories.find((item) => item.id === categoryId) ?? null;
  const activeEditPoster =
    editingPoster && editingPoster.categoryId === categoryId
      ? editingPoster
      : null;
  const defaultPublishDate = resolveDefaultPublishDateKey(
    activeCategory,
    pageNow,
  );
  const manualPublishDateEnabled = supportsManualPublishDate(activeCategory);
  const activePreviewAspectRatio =
    fileMeta && fileMeta.width > 0 && fileMeta.height > 0
      ? `${fileMeta.width} / ${fileMeta.height}`
      : "1 / 1";
  const safePersonalization = clampPhotoSafeArea(personalization, fileMeta);
  const isVideoPreview = Boolean(
    (file && isVideoFile(file)) ||
    (activeEditPoster && isVideoPoster(activeEditPoster)),
  );
  const canUsePoliticalProtocol =
    categoryAllowsPoliticalProtocol(activeCategory) && !isVideoPreview;
  const stripSafeZoneHeight = nameStripSafeZoneHeightPercent(personalization);
  const posterAspectRatio = posterAspect(fileMeta);
  const stripOverlapWarning =
    isPhotoInNameStripSafeZone({
      config: personalization,
      posterAspectRatio,
      photoY: safePersonalization.photoY,
      photoScale: safePersonalization.photoScale,
    }) ||
    (safePersonalization.showVideoExtraPhoto &&
      isPhotoInNameStripSafeZone({
        config: personalization,
        posterAspectRatio,
        photoY: safePersonalization.videoExtraPhotoY,
        photoScale: safePersonalization.videoExtraPhotoScale,
      }));
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
    noAssignedCategories: isTelugu
      ? "అసైన్డ్ క్యాటగిరీస్ లేవు."
      : "No assigned categories.",
    accepted: isTelugu ? "యాక్సెప్టెడ్" : "Accepted",
    rejected: isTelugu ? "రిజెక్టెడ్" : "Rejected",
    pending: isTelugu ? "పెండింగ్" : "Pending",
    reason: isTelugu ? "రీజన్" : "Reason",
    choosePoster: isTelugu ? "చూస్ పోస్టర్" : "Choose Poster",
    customization: isTelugu ? "కస్టమైజేషన్" : "Customization",
    uploading: isTelugu ? "అప్లోడింగ్..." : "Uploading...",
    upload: isTelugu ? "అప్లోడ్" : "Upload",
    updatePoster: isTelugu
      ? "అప్‌డేట్ చేసి రివ్యూకు పంపండి"
      : "Update and send for review",
    cancelEdit: isTelugu ? "ఎడిట్ క్యాన్సిల్" : "Cancel edit",
    uploadTab: isTelugu ? "అప్లోడ్" : "Upload",
    reviewTab: isTelugu ? "రివ్యూ స్టేటస్" : "Review Status",
    submittedPosters: isTelugu
      ? "సబ్మిట్ చేసిన పోస్టర్లు"
      : "Submitted Posters",
    noSubmittedPosters: isTelugu
      ? "ఇంకా సబ్మిట్ చేసిన పోస్టర్లు లేవు."
      : "No submitted posters yet.",
    edit: isTelugu ? "రీ-ఎడిట్" : "Re-edit",
    reupload: isTelugu ? "రీ-అప్లోడ్" : "Re-upload",
    delete: isTelugu ? "డిలీట్" : "Delete",
    chooseReplacement: isTelugu
      ? "కొత్త ఫైల్ ఎంచుకుని అప్‌డేట్ చేయండి, లేదా కేటగిరీ మార్చి అప్‌డేట్ చేయండి."
      : "Choose a new file to replace it, or change the category and update.",
    customize: isTelugu ? "కస్టమైజ్" : "Customize",
    previewPlacement: isTelugu ? "ప్రివ్యూ ప్లేస్‌మెంట్" : "Preview Placement",
    close: isTelugu ? "క్లోజ్" : "Close",
    photoShape: isTelugu ? "ఫోటో షేప్" : "Photo Shape",
    premiumShapes: isTelugu ? "ప్రీమియం షేప్స్" : "Premium Shapes",
    transparentCutouts: isTelugu
      ? "ట్రాన్స్‌పరెంట్ కటౌట్స్"
      : "Transparent Cutouts",
    photoMode: isTelugu ? "ఫోటో మోడ్" : "Photo Mode",
    bgRemoved: isTelugu ? "బ్యాక్‌గ్రౌండ్ తొలగించినది" : "BG Removed",
    originalPhoto: isTelugu ? "ఒరిజినల్ ఫోటో" : "Original Photo",
    photoSize: isTelugu ? "ఫోటో సైజ్" : "Photo Size",
    dragHelp: isTelugu
      ? "ఫోటో, నేమ్‌ని డైరెక్ట్‌గా డ్రాగ్ చేయండి. ఫోటో సైజ్ మార్చడానికి మౌస్ వీల్ వాడండి."
      : "Drag the photo and name directly. Use the mouse wheel to adjust photo size.",
    showGradientStrip: isTelugu
      ? "షో గ్రాడియెంట్ స్ట్రిప్"
      : "Show gradient strip",
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
      vertical_rectangle: isTelugu
        ? "వెర్టికల్ రెక్టాంగిల్"
        : "Vertical Rectangle",
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
      transparent_bottom_fade: t(
        "creator.upload.shape.transparent_bottom_fade",
        lang,
      ),
      transparent_clean: t("creator.upload.shape.transparent_clean", lang),
      transparent_soft_round: t(
        "creator.upload.shape.transparent_soft_round",
        lang,
      ),
      transparent_sharp_round: t(
        "creator.upload.shape.transparent_sharp_round",
        lang,
      ),
    } as Record<string, string>,
  });

  useEffect(() => {
    if (!activeCategory) {
      setRequestedPublishDate("");
      return;
    }
    if (
      activeEditPoster?.requestedPublishAt &&
      activeEditPoster.requestedPublishAt > 0
    ) {
      setRequestedPublishDate(
        getIstDateKey(activeEditPoster.requestedPublishAt),
      );
      return;
    }
    setRequestedPublishDate(defaultPublishDate);
  }, [
    activeCategory,
    activeEditPoster?.id,
    activeEditPoster?.requestedPublishAt,
    defaultPublishDate,
  ]);

  function openFilePicker(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setOpenCustomizeAfterPick(false);
    fileInputRef.current?.click();
  }

  function openCustomizationPicker(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    if (nextCategoryId === categoryId && file) {
      setCustomizeOpen(true);
      setUploadMessage(null);
      return;
    }
    setOpenCustomizeAfterPick(true);
    fileInputRef.current?.click();
  }

  function canCreatorEditPoster(poster: CreatorPoster): boolean {
    return poster.status === "pending" || poster.status === "rejected";
  }

  function canCreatorDeletePoster(poster: CreatorPoster): boolean {
    return poster.status === "pending" || poster.status === "rejected";
  }

  function startEditPoster(poster: CreatorPoster) {
    setEditingPoster(poster);
    setCategoryId(poster.categoryId);
    setFile(null);
    setFileMeta(null);
    setFilePreviewUrl(null);
    setPersonalization(
      parsePersonalizationConfig(poster.personalizationConfig),
    );
    setUploadMessage(customizationCopy.chooseReplacement);
    setActiveTab("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function cancelEditPoster() {
    setEditingPoster(null);
    setFile(null);
    setPersonalization(defaultPersonalization);
    setUploadMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function deletePoster(poster: CreatorPoster) {
    if (!canCreatorDeletePoster(poster)) return;
    const confirmed = window.confirm(
      isTelugu ? "ఈ పోస్టర్‌ని డిలీట్ చేయాలా?" : "Delete this poster?",
    );
    if (!confirmed) return;
    setPosterActionBusyMap((prev) => ({ ...prev, [poster.id]: true }));
    setUploadMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(
          t("creator.upload.loginRequired", portalLanguage(language)),
        );
      }
      const response = await fetch(
        `/api/creator/posters/${encodeURIComponent(poster.id)}`,
        {
          method: "DELETE",
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        },
      );
      const data = await readUploadResponse(response);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to delete poster.");
      }
      if (editingPoster?.id === poster.id) {
        cancelEditPoster();
      }
      setSelectedPosterIds((prev) => {
        const next = new Set(prev);
        next.delete(poster.id);
        return next;
      });
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              posters: (prev.posters ?? []).filter(
                (item) => item.id !== poster.id,
              ),
            }
          : prev,
      );
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(
        err instanceof Error ? err.message : "Unable to delete poster.",
      );
    } finally {
      setPosterActionBusyMap((prev) => ({ ...prev, [poster.id]: false }));
    }
  }

  function togglePosterSelection(poster: CreatorPoster) {
    if (!canCreatorDeletePoster(poster)) return;
    setSelectedPosterIds((prev) => {
      const next = new Set(prev);
      if (next.has(poster.id)) {
        next.delete(poster.id);
      } else {
        next.add(poster.id);
      }
      return next;
    });
  }

  function toggleAllVisiblePosters() {
    const deletableIds = reviewPosters
      .filter(canCreatorDeletePoster)
      .map((poster) => poster.id);
    setSelectedPosterIds((prev) => {
      if (deletableIds.length > 0 && deletableIds.every((id) => prev.has(id))) {
        return new Set([...prev].filter((id) => !deletableIds.includes(id)));
      }
      return new Set([...prev, ...deletableIds]);
    });
  }

  async function deleteSelectedPosters() {
    const selected = reviewPosters.filter(
      (poster) =>
        selectedPosterIds.has(poster.id) && canCreatorDeletePoster(poster),
    );
    if (selected.length === 0) return;
    const confirmed = window.confirm(
      isTelugu
        ? `${selected.length} పోస్టర్లను డిలీట్ చేయాలా?`
        : `Delete ${selected.length} selected poster(s)?`,
    );
    if (!confirmed) return;
    const ids = selected.map((poster) => poster.id);
    setPosterActionBusyMap((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));
    setUploadMessage(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(
          t("creator.upload.loginRequired", portalLanguage(language)),
        );
      }
      for (const poster of selected) {
        const response = await fetch(
          `/api/creator/posters/${encodeURIComponent(poster.id)}`,
          {
            method: "DELETE",
            headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
          },
        );
        const data = await readUploadResponse(response);
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to delete selected posters.");
        }
      }
      if (editingPoster && ids.includes(editingPoster.id)) {
        cancelEditPoster();
      }
      setSelectedPosterIds(
        (prev) => new Set([...prev].filter((id) => !ids.includes(id))),
      );
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              posters: (prev.posters ?? []).filter(
                (item) => !ids.includes(item.id),
              ),
            }
          : prev,
      );
      await loadDashboard(true);
    } catch (err) {
      setUploadMessage(
        err instanceof Error
          ? err.message
          : "Unable to delete selected posters.",
      );
    } finally {
      setPosterActionBusyMap((prev) => ({
        ...prev,
        ...Object.fromEntries(ids.map((id) => [id, false])),
      }));
    }
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
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    {item.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.message}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-5 inline-flex rounded-2xl border border-[var(--portal-border)] bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "upload"
              ? "bg-[var(--portal-purple)] text-white"
              : "text-slate-600 hover:bg-[var(--portal-surface-soft)]"
          }`}
        >
          {customizationCopy.uploadTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "review"
              ? "bg-[var(--portal-purple)] text-white"
              : "text-slate-600 hover:bg-[var(--portal-surface-soft)]"
          }`}
        >
          {customizationCopy.reviewTab}
        </button>
      </div>

      {activeTab === "upload" ? (
        <section className="space-y-6">
          <article className="px-1 py-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                  {customizationCopy.uploadStudio}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">
                  {customizationCopy.uploadTitle}
                </h3>
              </div>
              <button
                onClick={() => void loadDashboard(true)}
                className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
              >
                {refreshing
                  ? customizationCopy.refreshing
                  : customizationCopy.refresh}
              </button>
            </div>

            {!uploadWindow?.isOpen ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                {customizationCopy.uploadWindowClosed}{" "}
                {formatDate(uploadWindow?.opensAt ?? 0)}.
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
                  if (selectedFile) {
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
                      <CategoryLabelWithLogo
                        id={category.id}
                        label={category.label}
                      />
                    </button>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleUpload}
              className="mt-5 rounded-[28px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                    {customizationCopy.selectedCategory}
                  </p>
                  <h4 className="mt-2 text-lg font-bold text-slate-950">
                    {activeCategory ? (
                      <CategoryLabelWithLogo
                        id={activeCategory.id}
                        label={activeCategory.label}
                      />
                    ) : (
                      customizationCopy.selectCategory
                    )}
                  </h4>
                  {editingPoster ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(editingPoster.status)}`}
                      >
                        {editingPoster.status === "approved"
                          ? customizationCopy.accepted
                          : editingPoster.status === "rejected"
                            ? customizationCopy.rejected
                            : customizationCopy.pending}
                      </span>
                      <p>{customizationCopy.chooseReplacement}</p>
                      <button
                        type="button"
                        onClick={cancelEditPoster}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {customizationCopy.cancelEdit}
                      </button>
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
                  style={{
                    aspectRatio:
                      filePreviewUrl || activeEditPoster
                        ? activePreviewAspectRatio
                        : "1 / 1",
                  }}
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
                  ) : activeEditPoster ? (
                    isVideoPoster(activeEditPoster) ? (
                      <video
                        src={activeEditPoster.videoUrl}
                        className="h-full w-full bg-slate-950 object-contain"
                        controls
                        muted
                        playsInline
                      />
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeEditPoster.imageUrl}
                          alt={
                            activeEditPoster.categoryLabel ||
                            activeEditPoster.categoryId
                          }
                          className="h-full w-full object-contain"
                        />
                      </>
                    )
                  ) : (
                    <div className="flex w-full flex-col items-center justify-center p-6">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--portal-purple)] text-xl font-semibold text-white">
                        +
                      </span>
                      <span className="mt-3 text-sm font-semibold text-slate-900">
                        {customizationCopy.choosePoster}
                      </span>
                    </div>
                  )}
                </button>

                <div>
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {isTelugu ? "యాప్ పబ్లిష్ డేట్" : "App Publish Date"}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="date"
                        value={requestedPublishDate}
                        min={defaultPublishDate || undefined}
                        disabled={!manualPublishDateEnabled}
                        onChange={(event) =>
                          setRequestedPublishDate(event.target.value)
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      />
                      <span className="text-xs text-slate-600">
                        {manualPublishDateEnabled
                          ? isTelugu
                            ? `డిఫాల్ట్: ${defaultPublishDate}`
                            : `Default: ${defaultPublishDate}`
                          : isTelugu
                            ? `ఆటో షెడ్యూల్: ${defaultPublishDate}`
                            : `Auto schedule: ${defaultPublishDate}`}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    disabled={!filePreviewUrl}
                    className="rounded-xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--portal-purple)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {customizationCopy.customize}
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
                      disabled={
                        uploadBusy ||
                        (!file && !editingPoster) ||
                        !uploadWindow?.isOpen ||
                        !categoryId
                      }
                      className="rounded-xl bg-[var(--portal-green)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadBusy
                        ? customizationCopy.uploading
                        : editingPoster
                          ? customizationCopy.updatePoster
                          : customizationCopy.upload}
                    </button>
                  </div>

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
      ) : (
        <section className="space-y-6">
          <article className="px-1 py-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
                  {customizationCopy.reviewTab}
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">
                  {customizationCopy.submittedPosters}
                </h3>
              </div>
              <button
                onClick={() => void loadDashboard(true)}
                className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
              >
                {refreshing
                  ? customizationCopy.refreshing
                  : customizationCopy.refresh}
              </button>
            </div>

            {uploadMessage ? (
              <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                {uploadMessage}
              </p>
            ) : null}

            {reviewPosters.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      reviewPosters.filter(canCreatorDeletePoster).length > 0 &&
                      reviewPosters
                        .filter(canCreatorDeletePoster)
                        .every((poster) => selectedPosterIds.has(poster.id))
                    }
                    onChange={toggleAllVisiblePosters}
                    className="h-4 w-4 accent-rose-600"
                  />
                  Select visible
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedPosterIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={() => void deleteSelectedPosters()}
                  disabled={selectedPosterIds.size === 0}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete selected
                </button>
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {reviewPosters.length === 0 ? (
                <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                  {customizationCopy.noSubmittedPosters}
                </div>
              ) : (
                reviewPosters.map((poster) => {
                  const editable = canCreatorEditPoster(poster);
                  const deletable = canCreatorDeletePoster(poster);
                  const approved = poster.status === "approved";
                  const busy = Boolean(posterActionBusyMap[poster.id]);
                  return (
                    <article
                      key={poster.id}
                      className="grid gap-4 rounded-[28px] border border-[var(--portal-border)] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:grid-cols-[120px_minmax(0,1fr)]"
                    >
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={selectedPosterIds.has(poster.id)}
                          disabled={!deletable || busy}
                          onChange={() => togglePosterSelection(poster)}
                          className="h-4 w-4 accent-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        Select poster
                      </label>
                      <div className="aspect-[3/4] w-full overflow-hidden rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
                        {isVideoPoster(poster) ? (
                          <video
                            src={poster.videoUrl}
                            className="h-full w-full bg-slate-950 object-cover"
                            controls
                            muted
                            playsInline
                          />
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={poster.imageUrl}
                              alt={poster.categoryLabel || poster.categoryId}
                              className="h-full w-full object-cover"
                            />
                          </>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-bold text-slate-950">
                              <CategoryLabelWithLogo
                                id={poster.categoryId}
                                label={
                                  poster.categoryLabel || poster.categoryId
                                }
                              />
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatDate(poster.createdAt)}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(poster.status)}`}
                          >
                            {poster.status === "approved"
                              ? customizationCopy.accepted
                              : poster.status === "rejected"
                                ? customizationCopy.rejected
                                : customizationCopy.pending}
                          </span>
                        </div>

                        {poster.reviewComment ? (
                          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {customizationCopy.reason}: {poster.reviewComment}
                          </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-3">
                          {!approved ? (
                            <button
                              type="button"
                              onClick={() => startEditPoster(poster)}
                              disabled={!editable || busy}
                              className="rounded-xl border border-[var(--portal-purple)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-purple)] transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {customizationCopy.edit}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void deletePoster(poster)}
                            disabled={!deletable || busy}
                            className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy
                              ? customizationCopy.refreshing
                              : customizationCopy.delete}
                          </button>
                          {approved ? (
                            <button
                              type="button"
                              disabled
                              className="rounded-xl bg-[var(--portal-green)] px-4 py-2.5 text-sm font-semibold text-white opacity-50 disabled:cursor-not-allowed"
                            >
                              {customizationCopy.reupload}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </article>
        </section>
      )}

      {customizeOpen ? (
        <div
          data-no-auto-translate="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/82 p-2 backdrop-blur-sm sm:p-4"
        >
          <div className="mx-auto grid min-h-full max-w-7xl gap-3 py-2 sm:gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <section className="max-h-none overflow-y-auto rounded-[22px] border border-white/10 bg-slate-950 p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:p-5 xl:max-h-[calc(100vh-2rem)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                    {customizationCopy.customize}
                  </p>
                  <h4 className="mt-2 text-lg font-bold">
                    {customizationCopy.previewPlacement}
                  </h4>
                </div>
                <button
                  onClick={() => setCustomizeOpen(false)}
                  className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                >
                  {customizationCopy.close}
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                    Photo Controls
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Select photo slot, adjust shape and size, then drag it
                    inside the preview.
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
                          onClick={() =>
                            setSelectedPhotoTarget("videoExtraPhoto")
                          }
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
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        {customizationCopy.photoShape}
                      </span>
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
                              ? {
                                  videoExtraPhotoShape: event.target
                                    .value as PhotoShape,
                                }
                              : {
                                  photoShape: event.target.value as PhotoShape,
                                }),
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
                              <option
                                key={option.value}
                                value={option.value}
                                className="bg-white text-slate-950"
                              >
                                {customizationCopy.shapeLabels[option.value] ??
                                  option.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        {customizationCopy.photoMode}
                      </span>
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
                                  videoExtraPhotoRenderMode: event.target
                                    .value as "cutout" | "original",
                                }
                              : {
                                  photoRenderMode: event.target.value as
                                    "cutout" | "original",
                                }),
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                      >
                        <option
                          value="cutout"
                          className="bg-white text-slate-950"
                        >
                          {customizationCopy.bgRemoved}
                        </option>
                        <option
                          value="original"
                          className="bg-white text-slate-950"
                        >
                          {customizationCopy.originalPhoto}
                        </option>
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
                                    videoExtraPhotoAnimation:
                                      parseVideoPhotoAnimation(
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
                        {customizationCopy.photoSize} (
                        {Math.round(
                          selectedPhotoTarget === "videoExtraPhoto"
                            ? personalization.videoExtraPhotoScale
                            : personalization.photoScale,
                        )}
                        %)
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
                                ? {
                                    ...prev,
                                    videoExtraPhotoScale: Number(
                                      event.target.value,
                                    ),
                                  }
                                : {
                                    ...prev,
                                    photoScale: Number(event.target.value),
                                  },
                              fileMeta,
                            ),
                          )
                        }
                        className="mt-3 w-full accent-[var(--portal-green)]"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-slate-300">
                  {customizationCopy.dragHelp}
                </div>

                <label className="flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90">
                  <span className="font-medium">
                    {customizationCopy.showGradientStrip}
                  </span>
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

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-white/90">
                  <label className="flex items-center justify-between">
                    <span className="font-medium">
                      Political protocol photos
                    </span>
                    <span className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={
                          personalization.showPoliticalProtocol &&
                          canUsePoliticalProtocol
                        }
                        disabled={!canUsePoliticalProtocol}
                        onChange={(event) =>
                          setPersonalization((prev) =>
                            clampPhotoSafeArea(
                              {
                                ...prev,
                                showPoliticalProtocol:
                                  canUsePoliticalProtocol &&
                                  event.target.checked,
                              },
                              fileMeta,
                            ),
                          )
                        }
                        className="peer sr-only"
                      />
                      <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90" />
                      <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                    </span>
                  </label>
                  {personalization.showPoliticalProtocol &&
                  canUsePoliticalProtocol ? (
                    <div className="mt-4 grid gap-3">
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Protocol size (
                          {Math.round(personalization.politicalProtocolScale)}%)
                        </span>
                        <input
                          type="range"
                          min={45}
                          max={135}
                          value={safePersonalization.politicalProtocolScale}
                          onChange={(event) =>
                            setPersonalization((prev) => {
                              const nextScale = Number(event.target.value);
                              return clampPhotoSafeArea(
                                {
                                  ...prev,
                                  politicalProtocolScale: nextScale,
                                  politicalProtocolSlots:
                                    normalizePoliticalProtocolSlots(
                                      prev.politicalProtocolSlots,
                                      nextScale,
                                      prev.politicalProtocolX,
                                      prev.politicalProtocolY,
                                    ).map((slot) => ({
                                      ...slot,
                                      scale: nextScale,
                                    })),
                                },
                                fileMeta,
                              );
                            })
                          }
                          className="mt-3 w-full accent-[var(--portal-green)]"
                        />
                      </label>
                      <p className="text-xs leading-5 text-slate-400">
                        Drag each round icon separately inside the poster safe
                        area.
                      </p>
                    </div>
                  ) : null}
                </div>
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
                            <img
                              src={filePreviewUrl}
                              alt="Poster preview"
                              className="block h-auto max-h-[62vh] w-auto max-w-full object-contain align-top sm:max-h-[72vh]"
                            />
                          </>
                        )}

                        {personalization.showPoliticalProtocol &&
                        canUsePoliticalProtocol
                          ? safePersonalization.politicalProtocolSlots.map(
                              (slot, index) => {
                                const side = protocolSlotSidePercent(
                                  slot.scale,
                                );
                                return (
                                  <div
                                    key={index}
                                    onPointerDown={(event) =>
                                      startPoliticalProtocolDrag(event, index)
                                    }
                                    className="absolute z-[2] flex touch-none items-center justify-center overflow-hidden rounded-full border border-white bg-emerald-500 text-xl font-bold text-white"
                                    style={{
                                      left: `${protocolSlotCenterPercent(slot.x, side)}%`,
                                      top: `${protocolSlotCenterPercent(slot.y, side)}%`,
                                      width: `${side}%`,
                                      aspectRatio: "1 / 1",
                                      transform: "translate(-50%, -50%)",
                                      cursor: "grab",
                                    }}
                                  >
                                    {index + 1}
                                  </div>
                                );
                              },
                            )
                          : null}

                        <div
                          key={`main-photo-${personalization.photoAnimation}-${videoPreviewCycle}`}
                          onPointerDown={startPhotoDrag}
                          onWheel={onPhotoWheel}
                          className={`absolute touch-none overflow-hidden ${
                            isPhotoDragging ? "cursor-grabbing" : "cursor-grab"
                          }`}
                          style={{
                            left: `${safePersonalization.photoX}%`,
                            top: `${safePersonalization.photoY}%`,
                            width: `${safePersonalization.photoScale}%`,
                            zIndex: 1,
                            aspectRatio: photoShapeAspectRatio(
                              safePersonalization.photoShape,
                            ),
                            ...photoShapeFrameStyle(
                              safePersonalization.photoShape,
                            ),
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
                            onPointerDown={startVideoExtraPhotoDrag}
                            onWheel={onVideoExtraPhotoWheel}
                            className={`absolute touch-none overflow-hidden ${
                              isVideoExtraPhotoDragging
                                ? "cursor-grabbing"
                                : "cursor-grab"
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
                              renderMode:
                                safePersonalization.videoExtraPhotoRenderMode,
                              edgeStyle:
                                safePersonalization.videoExtraPhotoEdgeStyle,
                              frameStyle:
                                safePersonalization.videoExtraPhotoFrameStyle,
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
                            <span className="ml-1 text-3xl leading-none">
                              ▶
                            </span>
                          </button>
                        ) : null}

                        {stripOverlapWarning ? (
                          <NameStripOverlapWarning
                            heightPercent={stripSafeZoneHeight}
                          />
                        ) : null}
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
                              zIndex: 3,
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
                            <p className="mt-1 truncate text-center text-sm font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                              {PERMANENT_SAMPLE_DESIGNATION}
                            </p>
                          </div>
                        ) : null}
                        {personalization.showBottomStrip ? (
                          <div
                            className="absolute z-[3] touch-none"
                            style={{
                              left: `${safePersonalization.stripX}%`,
                              bottom: `${safePersonalization.stripBottom}%`,
                              width: `${safePersonalization.stripWidth}%`,
                              height: `${Math.max(0.5, safePersonalization.stripHeight * 0.5)}%`,
                              transform: "translateX(-50%)",
                            }}
                          >
                            <AppStyleNameStrip
                              config={personalization}
                              imageSeed={
                                file?.name ??
                                activeEditPoster?.imageUrl ??
                                "creator-upload"
                              }
                              sampleName={PERMANENT_SAMPLE_NAME}
                              sampleDesignation={PERMANENT_SAMPLE_DESIGNATION}
                            />
                            <div
                              onPointerDown={(event) =>
                                startStripResize(event, "strip-left")
                              }
                              className="absolute -left-2 top-1/2 h-8 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/80 bg-sky-500/90 shadow-lg"
                              aria-label="Resize name strip left"
                            />
                            <div
                              onPointerDown={(event) =>
                                startStripResize(event, "strip-right")
                              }
                              className="absolute -right-2 top-1/2 h-8 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/80 bg-sky-500/90 shadow-lg"
                              aria-label="Resize name strip right"
                            />
                            <div
                              onPointerDown={(event) =>
                                startStripResize(event, "strip-top")
                              }
                              className="absolute left-1/2 top-0 h-4 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-white/80 bg-emerald-500/90 shadow-lg"
                              aria-label="Resize name strip height"
                            />
                          </div>
                        ) : null}
                      </div>
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
      <style jsx global>
        {VIDEO_PHOTO_ANIMATION_GLOBAL_CSS}
      </style>
    </>
  );
}
