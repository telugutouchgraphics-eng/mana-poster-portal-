export type VideoPosterFit = "contain" | "cover";

export interface VideoPosterCustomization {
  videoFit: VideoPosterFit;
  videoScale: number;
  videoOffsetX: number;
  videoOffsetY: number;
  videoCornerRadius: number;
}

export const defaultVideoPosterCustomization: VideoPosterCustomization = {
  videoFit: "contain",
  videoScale: 100,
  videoOffsetX: 50,
  videoOffsetY: 50,
  videoCornerRadius: 24,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clampVideoPosterCustomization<T extends VideoPosterCustomization>(
  config: T,
): T {
  return {
    ...config,
    videoFit: config.videoFit === "cover" ? "cover" : "contain",
    videoScale: clampNumber(Number(config.videoScale) || 100, 50, 200),
    videoOffsetX: clampNumber(Number(config.videoOffsetX) || 50, 0, 100),
    videoOffsetY: clampNumber(Number(config.videoOffsetY) || 50, 0, 100),
    videoCornerRadius: clampNumber(Number(config.videoCornerRadius) || 0, 0, 48),
  };
}
