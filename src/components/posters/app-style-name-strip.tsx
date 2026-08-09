"use client";

import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";

interface NameStripConfig {
  showBottomStrip: boolean;
  stripHeight: number;
  nameX?: number;
  nameY?: number;
  sampleName?: string;
  sampleDesignation?: string;
  stripWidth?: number;
  stripX?: number;
  stripBottom?: number;
  stripLayoutStyle?: "full" | "split" | "badge";
}

interface PhotoOverlapInput {
  config: NameStripConfig;
  posterAspectRatio: number;
  photoY: number;
  photoScale: number;
}

interface AppStyleNameStripProps {
  config: NameStripConfig;
  imageSeed?: string;
  sampleName?: string;
  sampleDesignation?: string;
  compact?: boolean;
}

const APP_STRIP_SOLID_COLORS = [
  "#111827",
  "#0F172A",
  "#064E3B",
  "#1E3A8A",
  "#581C87",
  "#7F1D1D",
  "#134E4A",
  "#3F1D38",
  "#FFFFFF",
  "#F8FAFC",
] as const;

function hashString(seed: string, initial: number, multiplier: number): number {
  let hash = initial;
  for (const char of seed) {
    hash = Math.imul(hash, multiplier) + char.charCodeAt(0);
    hash |= 0;
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stripColor(seedName: string, imageSeed: string) {
  const seed = `${imageSeed}|${seedName}`;
  return APP_STRIP_SOLID_COLORS[
    hashString(seed, 23, 41) % APP_STRIP_SOLID_COLORS.length
  ]!;
}

function textColorForBackground(color: string): string {
  const normalized = color.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 186 ? "#111827" : "#FFFFFF";
}

export function nameStripSafeZoneHeightPercent(
  config: NameStripConfig,
): number {
  if (!config.showBottomStrip) return 0;
  return Math.max(1, Math.min(16, config.stripHeight * 0.75));
}

export function isPhotoInNameStripSafeZone({
  config,
  posterAspectRatio,
  photoY,
  photoScale,
}: PhotoOverlapInput): boolean {
  if (!config.showBottomStrip) return false;
  const normalizedAspect = posterAspectRatio > 0 ? posterAspectRatio : 1;
  const photoHeightPercent = photoScale * normalizedAspect;
  const safeZoneTop = 100 - nameStripSafeZoneHeightPercent(config);
  return photoY + photoHeightPercent > safeZoneTop;
}

export function NameStripOverlapWarning({
  heightPercent,
}: {
  heightPercent: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] animate-pulse border-t-2 border-red-500/95 bg-red-500/20"
      style={{ height: `${heightPercent}%` }}
    >
      <span className="absolute right-2 top-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase leading-tight text-white shadow-lg">
        Photo overlaps name strip
      </span>
    </div>
  );
}

export function AppStyleNameStrip({
  config,
  imageSeed = "poster",
  sampleName,
  sampleDesignation,
  compact = false,
}: AppStyleNameStripProps) {
  const resolvedName =
    (sampleName ?? config.sampleName ?? PERSONALIZATION_SAMPLE.name).trim() ||
    PERSONALIZATION_SAMPLE.name;
  const resolvedDesignation = (
    sampleDesignation ??
    config.sampleDesignation ??
    PERSONALIZATION_SAMPLE.designation
  ).trim();
  const backgroundColor = stripColor(resolvedName, imageSeed || "poster");
  const foregroundColor = textColorForBackground(backgroundColor);
  const mutedColor =
    foregroundColor === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "#475569";
  const verticalPadding = clamp(
    config.stripHeight * 0.18,
    compact ? 0 : 1,
    compact ? 5 : 7,
  );
  const horizontalPadding = compact ? 5 : 6;
  const nameSize = compact
    ? "clamp(4px, 45cqh, 20px)"
    : "clamp(4px, 45cqh, 26px)";
  const designationSize = compact
    ? "clamp(4px, 38cqh, 16px)"
    : "clamp(4px, 38cqh, 19px)";

  return (
    <div
      className="relative h-full w-full overflow-hidden [container-type:size]"
      style={{ backgroundColor, color: foregroundColor }}
    >
      <div
        className="relative z-[1] flex h-full min-w-0 items-center justify-center gap-2 text-center"
        style={{
          padding: `${verticalPadding}px ${horizontalPadding}px`,
          fontFamily:
            "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
        }}
      >
        <span
          className="min-w-0 truncate font-black leading-none"
          style={{ fontSize: nameSize }}
        >
          {resolvedName}
        </span>
        {resolvedDesignation ? (
          <>
            <span className="shrink-0" style={{ color: mutedColor }}>
              |
            </span>
            <span
              className="min-w-0 truncate font-bold leading-none"
              style={{ fontSize: designationSize, color: mutedColor }}
            >
              {resolvedDesignation}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
