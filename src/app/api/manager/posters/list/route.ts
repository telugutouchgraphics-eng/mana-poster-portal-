import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadScopedCreatorIds } from "@/lib/server/manager-scope";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import {
  clampVideoPosterCustomization,
  defaultVideoPosterCustomization,
  type VideoPosterFit,
} from "@/lib/video-poster-preview";

type PhotoShape =
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

type PhotoEdgeStyle = "soft_fade" | "sharp" | "bottom_fade" | "feather";
type PhotoFrameStyle = "none" | "inner_shadow" | "white_outline" | "glow_edge" | "double_border";

const photoShapes = new Set<string>([
  "circle",
  "scallop_circle",
  "soft_burst",
  "badge",
  "square",
  "rounded_square",
  "vertical_rectangle",
  "oval",
  "flower",
  "blob",
  "wave_bottom",
  "arch",
  "diagonal_cut",
  "diamond",
  "hexagon",
  "parallelogram",
  "sunburst",
  "transparent_bottom_fade",
  "transparent_clean",
  "transparent_soft_round",
  "transparent_sharp_round",
]);

interface PosterPersonalization {
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
  showWhatsapp: boolean;
  sampleName: string;
  videoFit: VideoPosterFit;
  videoScale: number;
  videoOffsetX: number;
  videoOffsetY: number;
  videoCornerRadius: number;
}

interface PosterListItem {
  id: string;
  creatorPublicId: string;
  creatorName: string;
  creatorEmail: string;
  creatorPhone: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  mediaType: string;
  imageUrl: string;
  videoUrl: string;
  status: string;
  reviewComment: string;
  duplicateStatus: string;
  duplicateCount: number;
  reviewHistory: Array<{
    type: string;
    actorRole: string;
    actorId: string;
    actorName: string;
    comment: string;
    createdAt: number;
  }>;
  saleCount: number;
  engagementCount: number;
  shareCount: number;
  downloadCount: number;
  grossAmount: number;
  creatorEarnings: number;
  platformEarnings: number;
  personalizationConfig: PosterPersonalization;
  createdAt: number;
  updatedAt: number;
  approvedAt: number;
  dashboardHiddenAt: number;
  dashboardVisibleUntil: number;
}

const DASHBOARD_RETENTION_MS = 24 * 60 * 60 * 1000;

function dashboardVisibleUntilForStatus(data: Record<string, unknown>): number {
  const status = String(data.status ?? "pending").trim().toLowerCase();
  if (status === "approved") {
    const approvedAt = Number(data.approvedAt ?? 0);
    return approvedAt > 0 ? approvedAt + DASHBOARD_RETENTION_MS : 0;
  }
  const createdAt = Number(data.createdAt ?? 0);
  return createdAt > 0 ? createdAt + DASHBOARD_RETENTION_MS : 0;
}

function isDashboardVisible(data: Record<string, unknown>, now: number): boolean {
  if (Number(data.dashboardHiddenAt ?? 0) > 0) {
    return false;
  }
  const visibleUntil = dashboardVisibleUntilForStatus(data);
  return visibleUntil <= 0 || visibleUntil > now;
}

const defaultPersonalization: PosterPersonalization = {
  photoShape: "circle",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  photoFrameStyle: "none",
  showSafeAreas: true,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  showWhatsapp: false,
  sampleName: "User Name",
  ...defaultVideoPosterCustomization,
};

function parsePersonalization(input: unknown): PosterPersonalization {
  if (!input || typeof input !== "object") {
    return defaultPersonalization;
  }
  const raw = input as Record<string, unknown>;
  const shape = String(raw.photoShape ?? defaultPersonalization.photoShape);
  const photoShape: PosterPersonalization["photoShape"] =
    photoShapes.has(shape) ? (shape as PhotoShape) : defaultPersonalization.photoShape;
  const numberInRange = (
    value: unknown,
    fallback: number,
    min: number,
    max: number
  ) => {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, num));
  };
  return {
    photoShape,
    photoRenderMode: raw.photoRenderMode === "original" ? "original" : defaultPersonalization.photoRenderMode,
    edgeStyle:
      raw.edgeStyle === "sharp" ||
      raw.edgeStyle === "soft_fade" ||
      raw.edgeStyle === "bottom_fade" ||
      raw.edgeStyle === "feather"
        ? (raw.edgeStyle as PhotoEdgeStyle)
        : defaultPersonalization.edgeStyle,
    photoFrameStyle:
      raw.photoFrameStyle === "inner_shadow" ||
      raw.photoFrameStyle === "white_outline" ||
      raw.photoFrameStyle === "glow_edge" ||
      raw.photoFrameStyle === "double_border"
        ? (raw.photoFrameStyle as PhotoFrameStyle)
        : defaultPersonalization.photoFrameStyle,
    showSafeAreas:
      typeof raw.showSafeAreas === "boolean"
        ? raw.showSafeAreas
        : defaultPersonalization.showSafeAreas,
    photoX: numberInRange(raw.photoX, defaultPersonalization.photoX, 0, 100),
    photoY: numberInRange(raw.photoY, defaultPersonalization.photoY, 0, 100),
    photoScale: numberInRange(raw.photoScale, defaultPersonalization.photoScale, 10, 100),
    nameX: numberInRange(raw.nameX, defaultPersonalization.nameX, 0, 100),
    nameY: numberInRange(raw.nameY, defaultPersonalization.nameY, 0, 100),
    showBottomStrip:
      typeof raw.showBottomStrip === "boolean"
        ? raw.showBottomStrip
        : defaultPersonalization.showBottomStrip,
    stripHeight: numberInRange(raw.stripHeight, defaultPersonalization.stripHeight, 8, 40),
    showWhatsapp:
      typeof raw.showWhatsapp === "boolean"
        ? raw.showWhatsapp
        : defaultPersonalization.showWhatsapp,
    sampleName:
      typeof raw.sampleName === "string" && raw.sampleName.trim().length > 0
        ? raw.sampleName.trim()
        : defaultPersonalization.sampleName,
    ...clampVideoPosterCustomization({
      ...defaultVideoPosterCustomization,
      videoFit: raw.videoFit === "cover" ? "cover" : defaultVideoPosterCustomization.videoFit,
      videoScale: numberInRange(raw.videoScale, defaultVideoPosterCustomization.videoScale, 50, 200),
      videoOffsetX: numberInRange(raw.videoOffsetX, defaultVideoPosterCustomization.videoOffsetX, 0, 100),
      videoOffsetY: numberInRange(raw.videoOffsetY, defaultVideoPosterCustomization.videoOffsetY, 0, 100),
      videoCornerRadius: numberInRange(
        raw.videoCornerRadius,
        defaultVideoPosterCustomization.videoCornerRadius,
        0,
        48,
      ),
    }),
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "pending").trim();
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const region = await assertActorCanAccessRegion(actor, url.searchParams.get("regionId"));
    const now = Date.now();
    const scopedCreatorIds = await loadScopedCreatorIds(actor);
    const scopedCreatorIdSet = scopedCreatorIds ? new Set(scopedCreatorIds) : null;

    const baseQuery = adminDb.collection("creatorPosters");
    const posterSnap =
      status !== "all"
        ? await baseQuery.where("status", "==", status).get()
        : await baseQuery.get();
    const posterDocs = posterSnap.docs
      .map((doc) => ({
        id: doc.id,
        data: doc.data() as Record<string, unknown>,
      }))
      .filter((item) => String(item.data.regionId ?? "").trim() === region.id)
      .sort(
        (a, b) =>
          Number(b.data.createdAt ?? 0) - Number(a.data.createdAt ?? 0)
      )
      .slice(0, 250);

    const duplicateHashCounts = new Map<string, number>();
    for (const item of posterDocs) {
      const hash = String(item.data.imageHash ?? "").trim();
      if (!hash) continue;
      duplicateHashCounts.set(hash, (duplicateHashCounts.get(hash) ?? 0) + 1);
    }

    const creatorIds = Array.from(
      new Set(
        posterDocs
          .map((item) => String(item.data.creatorPublicId ?? "").trim())
          .filter((id) => id.length > 0)
      )
    );
    const creatorSnaps = await Promise.all(
      creatorIds.map((creatorId) =>
        adminDb.collection("creatorProfiles").doc(creatorId).get()
      )
    );
    const creatorMap = new Map(
      creatorSnaps
        .filter((snap) => snap.exists)
        .map((snap) => [snap.id, snap.data() as Record<string, unknown>])
    );

    const posters: PosterListItem[] = posterDocs
      .map((item) => {
        const creatorPublicId = String(item.data.creatorPublicId ?? "").trim();
        if (scopedCreatorIdSet && !scopedCreatorIdSet.has(creatorPublicId)) {
          return null;
        }
        if (!isDashboardVisible(item.data, now)) {
          return null;
        }
        const creator = creatorMap.get(creatorPublicId) ?? {};
        return {
          id: String(item.id),
          creatorPublicId,
          creatorName: String(creator.name ?? item.data.creatorName ?? "-"),
          creatorEmail: String(creator.email ?? item.data.creatorEmail ?? ""),
          creatorPhone: String(creator.phone ?? item.data.creatorPhone ?? ""),
          title: String(item.data.title ?? "Untitled"),
          categoryId: String(item.data.categoryId ?? ""),
          categoryLabel: String(item.data.categoryLabel ?? ""),
          mediaType: String(item.data.mediaType ?? "image"),
          imageUrl: String(item.data.imageUrl ?? ""),
          videoUrl: String(item.data.videoUrl ?? ""),
          status: String(item.data.status ?? "pending"),
          reviewComment: String(item.data.reviewComment ?? ""),
          duplicateStatus: String(item.data.duplicateStatus ?? "unique"),
          duplicateCount: duplicateHashCounts.get(String(item.data.imageHash ?? "").trim()) ?? 0,
          reviewHistory: Array.isArray(item.data.reviewHistory)
            ? item.data.reviewHistory.map((entry) => {
                const raw = entry as Record<string, unknown>;
                return {
                  type: String(raw.type ?? "submitted"),
                  actorRole: String(raw.actorRole ?? ""),
                  actorId: String(raw.actorId ?? ""),
                  actorName: String(raw.actorName ?? ""),
                  comment: String(raw.comment ?? ""),
                  createdAt: Number(raw.createdAt ?? 0),
                };
              })
            : [],
          saleCount: Number(item.data.saleCount ?? 0),
          engagementCount: Number(
            item.data.engagementCount ??
              Number(item.data.shareCount ?? 0) + Number(item.data.downloadCount ?? 0),
          ),
          shareCount: Number(item.data.shareCount ?? 0),
          downloadCount: Number(item.data.downloadCount ?? 0),
          grossAmount: Number(item.data.grossAmount ?? 0),
          creatorEarnings: Number(item.data.creatorEarnings ?? 0),
          platformEarnings: Number(item.data.platformEarnings ?? 0),
          personalizationConfig: parsePersonalization(item.data.personalizationConfig),
          createdAt: Number(item.data.createdAt ?? 0),
          updatedAt: Number(item.data.updatedAt ?? 0),
          approvedAt: Number(item.data.approvedAt ?? 0),
          dashboardHiddenAt: Number(item.data.dashboardHiddenAt ?? 0),
          dashboardVisibleUntil: dashboardVisibleUntilForStatus(item.data),
        };
      })
      .filter((item): item is PosterListItem => item !== null)
      .filter((item) => {
        if (!q) {
          return true;
        }
        const searchable = [
          item.creatorPublicId,
          item.creatorName,
          item.creatorEmail,
          item.creatorPhone,
          item.title,
          item.categoryLabel,
          item.status,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      });

    return NextResponse.json({ ok: true, posters });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load posters.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
