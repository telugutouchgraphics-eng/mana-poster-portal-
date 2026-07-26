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

const APP_STRIP_GRADIENTS = [
  ["#7C2D12", "#EA580C", "#C2410C"],
  ["#581C87", "#BE185D", "#9D174D"],
  ["#064E3B", "#059669", "#047857"],
  ["#7F1D1D", "#DC2626", "#991B1B"],
  ["#082F49", "#0891B2", "#0F766E"],
  ["#831843", "#DB2777", "#BE185D"],
  ["#4C1D95", "#7C3AED", "#5B21B6"],
  ["#134E4A", "#0D9488", "#115E59"],
  ["#3F1D38", "#C026D3", "#DB2777"],
  ["#3B0764", "#9333EA", "#7E22CE"],
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

function stripModel(
  config: NameStripConfig,
  seedName: string,
  imageSeed: string,
): number {
  const seed = `${imageSeed}|model|${seedName}`;
  return hashString(seed, 29, 43) % APP_STRIP_GRADIENTS.length;
}

function stripGradient(
  config: NameStripConfig,
  seedName: string,
  imageSeed: string,
) {
  const seed = `${imageSeed}|${seedName}`;
  return APP_STRIP_GRADIENTS[
    hashString(seed, 23, 41) % APP_STRIP_GRADIENTS.length
  ]!;
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

function AccentLayer({ model }: { model: number }) {
  if (model === 0) {
    return <div className="absolute inset-x-0 top-0 h-[8cqh] bg-white/55" />;
  }
  if (model === 1) {
    return (
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.18)_0,rgba(255,255,255,0.18)_3px,transparent_3px,transparent_16px)]" />
    );
  }
  if (model === 2) {
    return (
      <div className="absolute inset-x-0 bottom-0 h-[12cqh] bg-black/20 shadow-[0_-10px_22px_rgba(255,255,255,0.18)]" />
    );
  }
  if (model === 3) {
    return (
      <div className="absolute inset-x-[8%] inset-y-[10%] rounded-full border border-white/45 bg-white/10" />
    );
  }
  if (model === 4) {
    return (
      <div className="absolute -right-[8%] top-1/2 h-full w-[35%] -translate-y-1/2 rounded-full bg-white/18" />
    );
  }
  if (model === 5) {
    return (
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_50%,rgba(255,255,255,0.34)_0_2px,transparent_3px),radial-gradient(circle_at_88%_50%,rgba(255,255,255,0.28)_0_2px,transparent_3px)]" />
    );
  }
  if (model === 6) {
    return (
      <div className="absolute inset-x-0 bottom-0 h-[14cqh] bg-white/25" />
    );
  }
  if (model === 7) {
    return (
      <div className="absolute -left-[8%] top-1/2 h-full w-[35%] -translate-y-1/2 rounded-full bg-black/20" />
    );
  }
  if (model === 8) {
    return (
      <div className="absolute inset-y-0 left-1/2 w-[22%] -translate-x-1/2 bg-white/16 blur-sm" />
    );
  }
  return (
    <div className="absolute inset-[8%] rounded-md border border-white/35" />
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
  const gradient = stripGradient(config, resolvedName, imageSeed || "poster");
  const model = stripModel(config, resolvedName, imageSeed || "poster");
  const verticalPadding = clamp(
    config.stripHeight * 0.18,
    compact ? 0 : 1,
    compact ? 5 : 7,
  );
  const horizontalPadding =
    model === 3 ? (compact ? 14 : 24) : compact ? 10 : 14;
  const nameSize = compact
    ? "clamp(4px, 45cqh, 20px)"
    : "clamp(4px, 45cqh, 26px)";
  const designationSize = compact
    ? "clamp(3px, 31cqh, 13px)"
    : "clamp(3px, 31cqh, 15px)";

  return (
    <div
      className="relative h-full w-full overflow-hidden text-white shadow-[0_-8px_18px_rgba(0,0,0,0.22)] [container-type:size]"
      style={{
        backgroundImage: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]}, ${gradient[2]})`,
      }}
    >
      <AccentLayer model={model} />
      <div
        className="relative z-[1] flex h-full min-w-0 items-center justify-center gap-2 text-center"
        style={{
          padding: `${verticalPadding}px ${horizontalPadding}px`,
          fontFamily:
            "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
        }}
      >
        <span
          className="min-w-0 truncate font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
          style={{ fontSize: nameSize }}
        >
          {resolvedName}
        </span>
        {resolvedDesignation ? (
          <>
            <span className="shrink-0 text-white/75">|</span>
            <span
              className="min-w-0 truncate font-bold leading-none text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
              style={{ fontSize: designationSize }}
            >
              {resolvedDesignation}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
