import type { CSSProperties } from "react";

export type VideoPhotoAnimation =
  | "none"
  | "top_to_place"
  | "bottom_to_place"
  | "left_to_place"
  | "right_to_place"
  | "zoom_in"
  | "zoom_out";

export const VIDEO_PHOTO_ANIMATION_OPTIONS: ReadonlyArray<{
  value: VideoPhotoAnimation;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "top_to_place", label: "Top to Place" },
  { value: "bottom_to_place", label: "Bottom to Place" },
  { value: "left_to_place", label: "Left to Place" },
  { value: "right_to_place", label: "Right to Place" },
  { value: "zoom_in", label: "Zoom In" },
  { value: "zoom_out", label: "Zoom Out" },
];

export const VIDEO_PHOTO_ANIMATION_GLOBAL_CSS = `
@keyframes portal-video-photo-top-to-place {
  from { transform: translate3d(0, -135%, 0); opacity: 0; }
  to { transform: translate3d(0, 0, 0); opacity: 1; }
}
@keyframes portal-video-photo-bottom-to-place {
  from { transform: translate3d(0, 135%, 0); opacity: 0; }
  to { transform: translate3d(0, 0, 0); opacity: 1; }
}
@keyframes portal-video-photo-left-to-place {
  from { transform: translate3d(-135%, 0, 0); opacity: 0; }
  to { transform: translate3d(0, 0, 0); opacity: 1; }
}
@keyframes portal-video-photo-right-to-place {
  from { transform: translate3d(135%, 0, 0); opacity: 0; }
  to { transform: translate3d(0, 0, 0); opacity: 1; }
}
@keyframes portal-video-photo-zoom-in {
  from { transform: scale(0.22); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes portal-video-photo-zoom-out {
  from { transform: scale(1.35); opacity: 0.7; }
  to { transform: scale(1); opacity: 1; }
}
`;

export function parseVideoPhotoAnimation(value: unknown): VideoPhotoAnimation {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "top_to_place":
    case "bottom_to_place":
    case "left_to_place":
    case "right_to_place":
    case "zoom_in":
    case "zoom_out":
      return String(value).trim().toLowerCase() as VideoPhotoAnimation;
    default:
      return "none";
  }
}

export function resolveVideoPhotoAnimationStyle(
  animation: VideoPhotoAnimation,
  isActive: boolean,
): CSSProperties {
  if (!isActive || animation === "none") {
    return {};
  }

  const animationName = {
    top_to_place: "portal-video-photo-top-to-place",
    bottom_to_place: "portal-video-photo-bottom-to-place",
    left_to_place: "portal-video-photo-left-to-place",
    right_to_place: "portal-video-photo-right-to-place",
    zoom_in: "portal-video-photo-zoom-in",
    zoom_out: "portal-video-photo-zoom-out",
  }[animation];

  return {
    animationName,
    animationDuration: "1.25s",
    animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    animationFillMode: "both",
    animationIterationCount: 1,
    transformOrigin: "center center",
    willChange: "transform, opacity",
  };
}
