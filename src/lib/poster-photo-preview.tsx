import type { CSSProperties } from "react";

export type PhotoShape =
  | "circle"
  | "scallop_circle"
  | "soft_burst"
  | "badge"
  | "square"
  | "rounded_square"
  | "vertical_rectangle"
  | "oval"
  | "flower"
  | "blob"
  | "wave_bottom"
  | "arch"
  | "diagonal_cut"
  | "diamond"
  | "hexagon"
  | "parallelogram"
  | "sunburst"
  | "transparent_bottom_fade"
  | "transparent_clean"
  | "transparent_soft_round"
  | "transparent_sharp_round";

export type PhotoEdgeStyle = "sharp" | "soft_fade" | "bottom_fade" | "feather";

export type PhotoFrameStyle =
  | "none"
  | "inner_shadow"
  | "white_outline"
  | "glow_edge"
  | "double_border";

interface ShapeFramePreset {
  outerBackground: string;
  photoInset: string;
}

export const PHOTO_SHAPE_GROUPS: Array<{
  label: string;
  options: Array<{ value: PhotoShape; label: string }>;
}> = [
  {
    label: "Premium Shapes",
    options: [
      { value: "circle", label: "Circle" },
      { value: "scallop_circle", label: "Scallop Circle" },
      { value: "soft_burst", label: "Soft Burst" },
      { value: "badge", label: "Badge" },
      { value: "rounded_square", label: "Rounded Square" },
      { value: "vertical_rectangle", label: "Vertical Rectangle" },
      { value: "square", label: "Classic Square" },
    ],
  },
  {
    label: "Transparent Cutouts",
    options: [
      { value: "transparent_bottom_fade", label: "Bottom Blend" },
      { value: "transparent_clean", label: "Clean Cutout" },
      { value: "transparent_soft_round", label: "Soft Round" },
      { value: "transparent_sharp_round", label: "Sharp Round" },
    ],
  },
];

export const PHOTO_EDGE_STYLE_OPTIONS: Array<{ value: PhotoEdgeStyle; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "bottom_fade", label: "Bottom Fade" },
  { value: "feather", label: "Feather Soft Edge" },
];

export const PHOTO_FRAME_STYLE_OPTIONS: Array<{ value: PhotoFrameStyle; label: string }> = [
  { value: "none", label: "Clean" },
];

function normalizedEdgeStyle(edgeStyle: PhotoEdgeStyle): Exclude<PhotoEdgeStyle, "soft_fade"> {
  return edgeStyle === "soft_fade" ? "bottom_fade" : edgeStyle;
}

function roundedRadius(shape: PhotoShape): string | undefined {
  if (shape === "circle") return "9999px";
  if (shape === "square") return "24px";
  if (shape === "rounded_square") return "36px";
  if (shape === "vertical_rectangle") return "28px";
  if (shape === "oval") return "9999px / 72%";
  if (shape === "arch") return "48% 48% 16% 16% / 26% 26% 16% 16%";
  if (shape === "blob") return "58% 42% 48% 52% / 42% 58% 42% 58%";
  return undefined;
}

function radialPolygonClipPath(
  points: number,
  innerRadius: number,
  outerRadius = 1,
  rotationDeg = -90,
): string {
  const coords: string[] = [];
  const total = points * 2;
  for (let index = 0; index < total; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = ((rotationDeg + (360 / total) * index) * Math.PI) / 180;
    const x = 50 + Math.cos(angle) * 50 * radius;
    const y = 50 + Math.sin(angle) * 50 * radius;
    coords.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }
  return `polygon(${coords.join(",")})`;
}

function svgMaskDataUri(pathData: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path fill="white" d="${pathData}"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function smoothRadialPathData(
  points: number,
  innerRadius: number,
  outerRadius = 1,
  rotationDeg = -90,
): string {
  const vertices: Array<{ x: number; y: number }> = [];
  const total = points * 2;
  for (let index = 0; index < total; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = ((rotationDeg + (360 / total) * index) * Math.PI) / 180;
    vertices.push({
      x: 50 + Math.cos(angle) * 50 * radius,
      y: 50 + Math.sin(angle) * 50 * radius,
    });
  }

  const midPoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const start = midPoint(vertices[vertices.length - 1]!, vertices[0]!);
  let path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

  for (let index = 0; index < vertices.length; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    const end = midPoint(current, next);
    path += ` Q ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  return `${path} Z`;
}

function shapeClipPath(shape: PhotoShape): string | undefined {
  if (shape === "scallop_circle") {
    return radialPolygonClipPath(16, 0.9, 1);
  }
  if (shape === "soft_burst") {
    return radialPolygonClipPath(44, 0.95, 1);
  }
  if (shape === "flower") {
    return radialPolygonClipPath(8, 0.74, 1);
  }
  if (shape === "wave_bottom") {
    return "polygon(0 0,100% 0,100% 78%,92% 84%,82% 89%,70% 92%,58% 89%,50% 84%,42% 89%,30% 92%,18% 89%,8% 84%,0 78%)";
  }
  if (shape === "diagonal_cut") {
    return "polygon(10% 0,100% 0,90% 100%,0 100%)";
  }
  if (shape === "diamond") {
    return "polygon(50% 2%,98% 50%,50% 98%,2% 50%)";
  }
  if (shape === "hexagon") {
    return "polygon(22% 6%,78% 6%,96% 50%,78% 94%,22% 94%,4% 50%)";
  }
  if (shape === "parallelogram") {
    return "polygon(16% 0,100% 0,84% 100%,0 100%)";
  }
  if (shape === "sunburst") {
    return radialPolygonClipPath(20, 0.56, 1);
  }
  return undefined;
}

function shapeMaskImage(shape: PhotoShape): string | undefined {
  if (shape === "scallop_circle") {
    return svgMaskDataUri(smoothRadialPathData(16, 0.9, 1));
  }
  if (shape === "soft_burst") {
    return svgMaskDataUri(smoothRadialPathData(44, 0.95, 1));
  }
  if (shape === "flower") {
    return svgMaskDataUri(smoothRadialPathData(8, 0.74, 1));
  }
  if (shape === "badge") {
    return svgMaskDataUri(smoothRadialPathData(12, 0.86, 1));
  }
  return undefined;
}

function shapeShellStyle(shape: PhotoShape): CSSProperties {
  const radius = roundedRadius(shape);
  const clipPath = shapeClipPath(shape);
  const maskImage = shapeMaskImage(shape);
  return {
    borderRadius: radius,
    clipPath,
    overflow: "hidden",
    isolation: "isolate",
    WebkitMaskImage: maskImage ?? "-webkit-radial-gradient(white, black)",
    maskImage,
    WebkitMaskSize: maskImage ? "100% 100%" : undefined,
    maskSize: maskImage ? "100% 100%" : undefined,
    WebkitMaskRepeat: maskImage ? "no-repeat" : undefined,
    maskRepeat: maskImage ? "no-repeat" : undefined,
    WebkitMaskPosition: maskImage ? "center" : undefined,
    maskPosition: maskImage ? "center" : undefined,
    backfaceVisibility: "hidden",
  };
}

function shapeOverlayStyle(shape: PhotoShape): CSSProperties {
  const shell = shapeShellStyle(shape);
  return {
    borderRadius: shell.borderRadius,
    clipPath: shell.clipPath,
    overflow: "hidden",
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  };
}

function isTransparentPhotoShape(shape: PhotoShape): boolean {
  return (
    shape === "transparent_bottom_fade" ||
    shape === "transparent_clean" ||
    shape === "transparent_soft_round" ||
    shape === "transparent_sharp_round"
  );
}

function resolvedRenderShape(shape: PhotoShape): PhotoShape {
  if (shape === "transparent_soft_round" || shape === "transparent_sharp_round") {
    return "circle";
  }
  return shape;
}

function resolvedEdgeStyle(shape: PhotoShape, edgeStyle: PhotoEdgeStyle): PhotoEdgeStyle {
  if (shape === "transparent_bottom_fade") return "bottom_fade";
  if (shape === "transparent_soft_round") return "bottom_fade";
  if (shape === "transparent_clean" || shape === "transparent_sharp_round") return "sharp";
  return edgeStyle;
}

function shouldClipPhotoToShape(shape: PhotoShape): boolean {
  if (shape === "transparent_bottom_fade" || shape === "transparent_clean") {
    return false;
  }
  return true;
}

export function photoShapeAspectRatio(shape: PhotoShape): string {
  if (shape === "transparent_bottom_fade" || shape === "transparent_clean") return "4 / 5";
  if (shape === "vertical_rectangle") return "4 / 5";
  if (shape === "oval") return "4 / 5";
  if (shape === "blob") return "4 / 5";
  if (shape === "wave_bottom") return "4 / 5";
  if (shape === "arch") return "4 / 5";
  if (shape === "parallelogram") return "4 / 5";
  return "1 / 1";
}

export function photoShapeFrameStyle(shape: PhotoShape): CSSProperties {
  if (isTransparentPhotoShape(shape)) {
    return {
      transform: "translate(-50%, -50%)",
    };
  }
  return {
    ...shapeShellStyle(shape),
    transform: "translate(-50%, -50%)",
  };
}

function photoClassName(shape: PhotoShape): string {
  if (
    shape === "circle" ||
    shape === "scallop_circle" ||
    shape === "soft_burst" ||
    shape === "square" ||
    shape === "rounded_square" ||
    shape === "vertical_rectangle" ||
    shape === "oval" ||
    shape === "flower" ||
    shape === "blob" ||
    shape === "arch" ||
    shape === "transparent_soft_round" ||
    shape === "transparent_sharp_round"
  ) {
    return "rounded-[inherit]";
  }
  return "rounded-none";
}

function imageMask(shape: PhotoShape, edgeStyle: PhotoEdgeStyle): string | undefined {
  const normalized = normalizedEdgeStyle(edgeStyle);
  if (shape === "transparent_soft_round") {
    return "radial-gradient(112% 96% at 50% 20%, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 58%, rgba(0,0,0,0.98) 68%, rgba(0,0,0,0.86) 77%, rgba(0,0,0,0.56) 86%, rgba(0,0,0,0.22) 93%, rgba(0,0,0,0) 100%)";
  }
  if (normalized === "bottom_fade") {
    return "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.98) 68%, rgba(0,0,0,0.82) 78%, rgba(0,0,0,0.44) 88%, rgba(0,0,0,0.12) 94%, rgba(0,0,0,0) 100%)";
  }
  if (normalized === "feather") {
    return "radial-gradient(circle at center, rgba(0,0,0,1) 78%, rgba(0,0,0,0.9) 84%, rgba(0,0,0,0.32) 94%, rgba(0,0,0,0) 100%)";
  }
  return undefined;
}

function imageStyle(
  shape: PhotoShape,
  renderMode: "cutout" | "original",
  edgeStyle: PhotoEdgeStyle,
  layer: "main" | "blur",
): CSSProperties {
  const isCutout = renderMode === "cutout";
  const normalized = normalizedEdgeStyle(edgeStyle);
  const radius = roundedRadius(shape);
  const mask = imageMask(shape, edgeStyle);
  const isBlurLayer = layer === "blur";
  const cutoutPosition =
    shape === "flower"
      ? "center 44%"
      : shape === "scallop_circle"
        ? "center 42%"
        : shape === "soft_burst"
          ? "center 42%"
          : shape === "sunburst"
            ? "center 42%"
            : shape === "badge"
              ? "center 43%"
              : shape === "oval"
                ? "center 40%"
                : shape === "circle" || shape === "square"
                  ? "center 38%"
                  : "center 36%";
  return {
    objectPosition: isCutout ? cutoutPosition : "center center",
    transform: isCutout ? (isBlurLayer ? "scale(1.07)" : "scale(1.035)") : isBlurLayer ? "scale(1.04)" : undefined,
    transformOrigin: "top center",
    filter:
      normalized === "feather" && isBlurLayer
        ? "blur(8px) saturate(0.96) brightness(1.02)"
        : undefined,
    opacity: normalized === "feather" && isBlurLayer ? 0.9 : 1,
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskSize: mask ? "100% 100%" : undefined,
    maskSize: mask ? "100% 100%" : undefined,
    WebkitMaskRepeat: mask ? "no-repeat" : undefined,
    maskRepeat: mask ? "no-repeat" : undefined,
    borderRadius: radius,
  };
}

function shapeFramePreset(shape: PhotoShape): ShapeFramePreset {
  switch (shape) {
    case "transparent_bottom_fade":
    case "transparent_clean":
    case "transparent_soft_round":
    case "transparent_sharp_round":
      return {
        outerBackground: "transparent",
        photoInset: "0%",
      };
    case "circle":
      return {
        outerBackground: "linear-gradient(145deg, #22C55E 0%, #14B8A6 100%)",
        photoInset: "0%",
      };
    case "scallop_circle":
      return {
        outerBackground: "linear-gradient(145deg, #F59E0B 0%, #EF4444 100%)",
        photoInset: "0%",
      };
    case "soft_burst":
      return {
        outerBackground: "linear-gradient(145deg, #A855F7 0%, #EC4899 100%)",
        photoInset: "0%",
      };
    case "badge":
      return {
        outerBackground: "linear-gradient(145deg, #2563EB 0%, #06B6D4 100%)",
        photoInset: "0%",
      };
    case "rounded_square":
      return {
        outerBackground: "linear-gradient(145deg, #8B5CF6 0%, #3B82F6 100%)",
        photoInset: "0%",
      };
    case "vertical_rectangle":
      return {
        outerBackground: "linear-gradient(160deg, #0EA5E9 0%, #22C55E 100%)",
        photoInset: "0%",
      };
    case "square":
      return {
        outerBackground: "linear-gradient(145deg, #F97316 0%, #FACC15 100%)",
        photoInset: "0%",
      };
    default:
      return {
        outerBackground: "linear-gradient(145deg, #64748B 0%, #334155 100%)",
        photoInset: "0%",
      };
  }
}

export function renderPosterPhotoPreview({
  shape,
  renderMode,
  edgeStyle,
  frameStyle,
  src,
  alt,
}: {
  shape: PhotoShape;
  renderMode: "cutout" | "original";
  edgeStyle: PhotoEdgeStyle;
  frameStyle: PhotoFrameStyle;
  src: string;
  alt: string;
}): React.JSX.Element {
  void frameStyle;
  const renderShape = resolvedRenderShape(shape);
  const effectiveEdgeStyle = resolvedEdgeStyle(shape, edgeStyle);
  const className = `h-full w-full object-contain object-top ${photoClassName(shape)}`;
  const normalized = normalizedEdgeStyle(effectiveEdgeStyle);
  const preset = shapeFramePreset(shape);
  const outerShell = shapeShellStyle(renderShape);
  const photoShell = shapeOverlayStyle(renderShape);
  const hasBackground = !isTransparentPhotoShape(shape);
  const shouldClip = shouldClipPhotoToShape(shape);

  return (
    <div className={`relative h-full w-full ${photoClassName(shape)}`}>
      {hasBackground ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            ...outerShell,
            background: preset.outerBackground,
          }}
        />
      ) : null}
      <div
        style={{
          ...(shouldClip
            ? photoShell
            : {
                position: "absolute",
                inset: 0,
                overflow: "hidden",
              }),
          inset: preset.photoInset,
          overflow: "hidden",
        }}
      >
      {normalized === "feather" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className={`${className} absolute inset-0`}
            style={imageStyle(renderShape, renderMode, effectiveEdgeStyle, "blur")}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`${className} relative`}
            style={imageStyle(renderShape, renderMode, effectiveEdgeStyle, "main")}
          />
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={`${className} relative`}
            style={imageStyle(renderShape, renderMode, effectiveEdgeStyle, "main")}
          />
        </>
      )}
      </div>
    </div>
  );
}

export function renderPosterPhotoPlaceholderPreview({
  shape,
  frameStyle,
  label = "Add Photo",
}: {
  shape: PhotoShape;
  frameStyle: PhotoFrameStyle;
  label?: string;
}): React.JSX.Element {
  void frameStyle;
  const renderShape = resolvedRenderShape(shape);
  const preset = shapeFramePreset(shape);
  const outerShell = shapeShellStyle(renderShape);
  const photoShell = shapeOverlayStyle(renderShape);
  const hasBackground = !isTransparentPhotoShape(shape);
  const shouldClip = shouldClipPhotoToShape(shape);

  return (
    <div className={`relative h-full w-full ${photoClassName(shape)}`}>
      {hasBackground ? (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            ...outerShell,
            background: preset.outerBackground,
          }}
        />
      ) : null}
      <div
        style={{
          ...(shouldClip
            ? photoShell
            : {
                position: "absolute",
                inset: 0,
                overflow: "hidden",
              }),
          inset: preset.photoInset,
          overflow: "hidden",
        }}
      >
        <div
          className="relative flex h-full w-full items-center justify-center"
          style={{
            background: hasBackground
              ? "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))"
              : "linear-gradient(180deg, rgba(15,23,42,0.06), rgba(15,23,42,0.14))",
          }}
        >
          <div className="flex flex-col items-center gap-2 text-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.28)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/20 text-xl font-semibold">
              +
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">
              {label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
