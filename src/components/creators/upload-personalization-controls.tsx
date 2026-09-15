"use client";

import type React from "react";
import {
  PHOTO_EDGE_STYLE_OPTIONS,
  PHOTO_SHAPE_GROUPS,
  type PhotoEdgeStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";
import type {
  ImageMeta,
  PersonalizationConfig,
  PoliticalProtocolSlot,
} from "@/lib/types/creator-upload";
import {
  parseVideoPhotoAnimation,
  VIDEO_PHOTO_ANIMATION_OPTIONS,
} from "@/lib/video-photo-animation";

interface UploadPersonalizationControlsProps {
  personalization: PersonalizationConfig;
  safePersonalization: PersonalizationConfig;
  setPersonalization: React.Dispatch<
    React.SetStateAction<PersonalizationConfig>
  >;
  selectedPhotoTarget: "photo" | "videoExtraPhoto";
  setSelectedPhotoTarget: (target: "photo" | "videoExtraPhoto") => void;
  rememberPhotoShape: (shape: PhotoShape) => void;
  clampPhotoSafeArea: (
    config: PersonalizationConfig,
    meta: ImageMeta | null,
  ) => PersonalizationConfig;
  normalizePoliticalProtocolSlots: (
    raw: PoliticalProtocolSlot[] | undefined,
    fallbackScale: number,
    fallbackX: number,
    fallbackY: number,
  ) => PoliticalProtocolSlot[];
  fileMeta: ImageMeta | null;
  isVideoPreview: boolean;
  isJokesCustomization: boolean;
  canUsePoliticalProtocol: boolean;
  customizationCopy: {
    customize: string;
    previewPlacement: string;
    close: string;
    photoShape: string;
    premiumShapes: string;
    transparentCutouts: string;
    shapeLabels: Record<string, string>;
    photoMode: string;
    bgRemoved: string;
    originalPhoto: string;
    photoSize: string;
    dragHelp: string;
    showGradientStrip: string;
  };
  onClose: () => void;
}

export function UploadPersonalizationControls({
  personalization,
  safePersonalization,
  setPersonalization,
  selectedPhotoTarget,
  setSelectedPhotoTarget,
  rememberPhotoShape,
  clampPhotoSafeArea,
  normalizePoliticalProtocolSlots,
  fileMeta,
  isVideoPreview,
  isJokesCustomization,
  canUsePoliticalProtocol,
  customizationCopy,
  onClose,
}: UploadPersonalizationControlsProps) {
  return (
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
          onClick={onClose}
          className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
        >
          {customizationCopy.close}
        </button>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        {isJokesCustomization ? (
          <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
            Jokes posters are watermark-only. User photo, name, and name strip
            controls are disabled for this category.
          </div>
        ) : null}
        <div
          className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-white/6 p-4`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Photo Controls
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Select photo slot, adjust shape and size, then drag it inside the
            preview.
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
                onChange={(event) => {
                  const nextShape = event.target.value as PhotoShape;
                  rememberPhotoShape(nextShape);
                  setPersonalization((prev) => ({
                    ...prev,
                    ...(selectedPhotoTarget === "videoExtraPhoto"
                      ? {
                          videoExtraPhotoShape: nextShape,
                        }
                      : {
                          photoShape: nextShape,
                        }),
                  }));
                }}
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
                            | "cutout"
                            | "original",
                        }),
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="cutout" className="bg-white text-slate-950">
                  {customizationCopy.bgRemoved}
                </option>
                <option value="original" className="bg-white text-slate-950">
                  {customizationCopy.originalPhoto}
                </option>
              </select>
            </label>

            {(selectedPhotoTarget === "videoExtraPhoto"
              ? personalization.videoExtraPhotoShape
              : personalization.photoShape) === "transparent_soft_round" ? (
              <label className="block">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Blend / Feather
                </span>
                <select
                  data-no-auto-translate="true"
                  value={
                    selectedPhotoTarget === "videoExtraPhoto"
                      ? personalization.videoExtraPhotoEdgeStyle
                      : personalization.edgeStyle
                  }
                  onChange={(event) =>
                    setPersonalization((prev) => ({
                      ...prev,
                      ...(selectedPhotoTarget === "videoExtraPhoto"
                        ? {
                            videoExtraPhotoEdgeStyle: event.target
                              .value as PhotoEdgeStyle,
                          }
                        : {
                            edgeStyle: event.target.value as PhotoEdgeStyle,
                          }),
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                >
                  {PHOTO_EDGE_STYLE_OPTIONS.filter(
                    (option) =>
                      option.value === "bottom_fade" ||
                      option.value === "feather",
                  ).map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-white text-slate-950"
                    >
                      {option.value === "bottom_fade"
                        ? "Bottom Blend"
                        : "Feather"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

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
                            videoExtraPhotoScale: Number(event.target.value),
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

        <div
          className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-slate-300`}
        >
          {customizationCopy.dragHelp}
        </div>

        <label
          className={`${isJokesCustomization ? "hidden " : ""}flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90`}
        >
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

        <div
          className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-sm text-white/90`}
        >
          <label className="flex items-center justify-between">
            <span className="font-medium">Political protocol photos</span>
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
                          canUsePoliticalProtocol && event.target.checked,
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
          {personalization.showPoliticalProtocol && canUsePoliticalProtocol ? (
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
                Drag each round icon separately inside the poster safe area.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

