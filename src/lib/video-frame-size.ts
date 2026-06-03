function clampPositiveInt(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(value));
}

export function normalizeStoredPosterFrameSize(
  mediaKind: "image" | "video",
  widthPx: number,
  heightPx: number,
) {
  const width = clampPositiveInt(widthPx);
  const height = clampPositiveInt(heightPx);

  if (!width || !height) {
    return null;
  }

  return {
    widthPx: width,
    heightPx: height,
    mediaType: mediaKind,
  };
}
