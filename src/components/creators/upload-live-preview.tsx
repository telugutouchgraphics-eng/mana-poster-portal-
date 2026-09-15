"use client";

import type React from "react";
import {
  AppStyleNameStrip,
  NameStripOverlapWarning,
} from "@/components/posters/app-style-name-strip";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";
import {
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
} from "@/lib/poster-photo-preview";
import type {
  CreatorPoster,
  PersonalizationConfig,
} from "@/lib/types/creator-upload";
import { resolveVideoPhotoAnimationStyle } from "@/lib/video-photo-animation";

const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function protocolSlotSidePercent(scale: number): number {
  return 15 * (clampNumber(scale, 45, 135) / 100);
}

function protocolSlotCenterPercent(value: number, sidePercent: number): number {
  const half = sidePercent / 2;
  return clampNumber(value, half, 100 - half);
}

interface UploadLivePreviewProps {
  filePreviewUrl: string | null;
  file: File | null;
  isVideoPreview: boolean;
  videoPreviewStarted: boolean;
  videoPreviewCycle: number;
  previewFrameRef: React.RefObject<HTMLDivElement | null>;
  previewVideoRef: React.RefObject<HTMLVideoElement | null>;
  replayVideoPreviewFromStart: () => Promise<void>;
  startVideoPreviewPlayback: () => Promise<void>;
  personalization: PersonalizationConfig;
  safePersonalization: PersonalizationConfig;
  canUsePoliticalProtocol: boolean;
  isJokesCustomization: boolean;
  stripOverlapWarning: boolean;
  stripSafeZoneHeight: number;
  isPhotoDragging: boolean;
  isVideoExtraPhotoDragging: boolean;
  isNameDragging: boolean;
  startPoliticalProtocolDrag: (
    event: React.PointerEvent<HTMLDivElement>,
    slotIndex: number,
  ) => void;
  startPhotoDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPhotoWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  startVideoExtraPhotoDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onVideoExtraPhotoWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  startNameDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  startStripResize: (
    event: React.PointerEvent<HTMLDivElement>,
    direction: "strip-left" | "strip-right" | "strip-top",
  ) => void;
  onApply: () => void;
  customizationCopy: {
    apply: string;
    appliedMessage: string;
  };
  activeEditPoster?: CreatorPoster | null;
}

export function UploadLivePreview({
  filePreviewUrl,
  file,
  isVideoPreview,
  videoPreviewStarted,
  videoPreviewCycle,
  previewFrameRef,
  previewVideoRef,
  replayVideoPreviewFromStart,
  startVideoPreviewPlayback,
  personalization,
  safePersonalization,
  canUsePoliticalProtocol,
  isJokesCustomization,
  stripOverlapWarning,
  stripSafeZoneHeight,
  isPhotoDragging,
  isVideoExtraPhotoDragging,
  isNameDragging,
  startPoliticalProtocolDrag,
  startPhotoDrag,
  onPhotoWheel,
  startVideoExtraPhotoDrag,
  onVideoExtraPhotoWheel,
  startNameDrag,
  startStripResize,
  onApply,
  customizationCopy,
  activeEditPoster,
}: UploadLivePreviewProps) {
  return (
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

                {personalization.showPoliticalProtocol && canUsePoliticalProtocol
                  ? safePersonalization.politicalProtocolSlots.map(
                      (slot, index) => {
                        const side = protocolSlotSidePercent(slot.scale);
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

                {!isJokesCustomization ? (
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
                ) : null}

                {personalization.showVideoExtraPhoto && !isJokesCustomization ? (
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
                      renderMode: safePersonalization.videoExtraPhotoRenderMode,
                      edgeStyle: safePersonalization.videoExtraPhotoEdgeStyle,
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
                    <span className="ml-1 text-3xl leading-none">▶</span>
                  </button>
                ) : null}

                {stripOverlapWarning ? (
                  <NameStripOverlapWarning heightPercent={stripSafeZoneHeight} />
                ) : null}
                {!isJokesCustomization && !personalization.showBottomStrip ? (
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
                {!isJokesCustomization && personalization.showBottomStrip ? (
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
              onClick={onApply}
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
  );
}

