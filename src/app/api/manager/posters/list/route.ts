import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

interface PosterPersonalization {
  photoShape: "circle" | "rounded" | "square" | "hexagon" | "pill";
  photoRenderMode: "cutout" | "original";
  edgeStyle: "soft_fade" | "sharp";
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
  imageUrl: string;
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
  grossAmount: number;
  creatorEarnings: number;
  platformEarnings: number;
  personalizationConfig: PosterPersonalization;
  createdAt: number;
  updatedAt: number;
}

const defaultPersonalization: PosterPersonalization = {
  photoShape: "circle",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  showSafeAreas: true,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  showWhatsapp: true,
  sampleName: "User Name",
};

function parsePersonalization(input: unknown): PosterPersonalization {
  if (!input || typeof input !== "object") {
    return defaultPersonalization;
  }
  const raw = input as Record<string, unknown>;
  const shape = String(raw.photoShape ?? defaultPersonalization.photoShape);
  const photoShape: PosterPersonalization["photoShape"] =
    shape === "circle" ||
    shape === "rounded" ||
    shape === "square" ||
    shape === "hexagon" ||
    shape === "pill"
      ? shape
      : defaultPersonalization.photoShape;
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
    edgeStyle: raw.edgeStyle === "sharp" ? "sharp" : defaultPersonalization.edgeStyle,
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
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "pending").trim();
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

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
          imageUrl: String(item.data.imageUrl ?? ""),
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
          grossAmount: Number(item.data.grossAmount ?? 0),
          creatorEarnings: Number(item.data.creatorEarnings ?? 0),
          platformEarnings: Number(item.data.platformEarnings ?? 0),
          personalizationConfig: parsePersonalization(item.data.personalizationConfig),
          createdAt: Number(item.data.createdAt ?? 0),
          updatedAt: Number(item.data.updatedAt ?? 0),
        };
      })
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
