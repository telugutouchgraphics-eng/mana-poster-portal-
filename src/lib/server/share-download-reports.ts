import { adminDb } from "@/lib/firebase/admin";
import { categoryLabelWithIcon } from "@/lib/category-display";

export interface ShareDownloadCreatorOption {
  creatorPublicId: string;
  name: string;
  email: string;
}

export interface ShareDownloadHistoryItem {
  dateKey: string;
  shares: number;
  downloads: number;
  total: number;
}

export interface ShareDownloadReportRow {
  posterId: string;
  posterTitle: string;
  categoryId: string;
  categoryLabel: string;
  regionId: string;
  creatorPublicId: string;
  creatorName: string;
  imageUrl: string;
  thumbnailUrl: string;
  videoUrl: string;
  mediaType: string;
  shareCount: number;
  downloadCount: number;
  totalEngagement: number;
  firstDateKey: string;
  lastDateKey: string;
  history: ShareDownloadHistoryItem[];
}

export interface ShareDownloadReportResult {
  rows: ShareDownloadReportRow[];
  summary: {
    posterCount: number;
    shareCount: number;
    downloadCount: number;
    totalEngagement: number;
  };
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function istDateKeyFromMillis(epochMillis: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMillis));
}

export function defaultIstShareDownloadDateRange() {
  const now = Date.now();
  const today = istDateKeyFromMillis(now);
  return {
    startDate: today,
    endDate: today,
  };
}

function isWithinDateRange(dateKey: string, startDate: string, endDate: string): boolean {
  if (!dateKey) {
    return false;
  }
  if (startDate && dateKey < startDate) {
    return false;
  }
  if (endDate && dateKey > endDate) {
    return false;
  }
  return true;
}

export async function loadShareDownloadReport({
  allowedRegionIds,
  allowedCreatorPublicIds,
  creatorPublicId,
  startDate,
  endDate,
  search,
}: {
  allowedRegionIds: string[];
  allowedCreatorPublicIds?: string[] | null;
  creatorPublicId?: string | null;
  startDate: string;
  endDate: string;
  search?: string | null;
}): Promise<ShareDownloadReportResult> {
  const allowedRegions = new Set(allowedRegionIds.map(normalizeString).filter(Boolean));
  const scopedCreators =
    allowedCreatorPublicIds === null || allowedCreatorPublicIds === undefined
      ? null
      : new Set(allowedCreatorPublicIds.map(normalizeString).filter(Boolean));
  const selectedCreator = normalizeString(creatorPublicId);
  const queryText = normalizeString(search).toLowerCase();

  let statsQuery: FirebaseFirestore.Query = adminDb.collection("creatorPosterDailyStats");
  if (startDate) {
    statsQuery = statsQuery.where("dateKey", ">=", startDate);
  }
  if (endDate) {
    statsQuery = statsQuery.where("dateKey", "<=", endDate);
  }
  const statsSnap = await statsQuery.get();

  const rawStats = statsSnap.docs
    .map((doc) => {
      const data = doc.data();
      const posterId = normalizeString(data.posterId || data.templateId);
      const dateKey = normalizeDateKey(data.dateKey || data.dayKey);
      const shareCount = readNumber(data.shareCount ?? data.shares ?? data.totalShares);
      const downloadCount = readNumber(data.downloadCount ?? data.downloads ?? data.totalDownloads);
      return {posterId, dateKey, shareCount, downloadCount, data};
    })
    .filter(
      (item) =>
        item.posterId &&
        isWithinDateRange(item.dateKey, startDate, endDate) &&
        item.shareCount + item.downloadCount > 0,
    );

  const posterIds = Array.from(new Set(rawStats.map((item) => item.posterId)));
  if (posterIds.length === 0) {
    return {
      rows: [],
      summary: {posterCount: 0, shareCount: 0, downloadCount: 0, totalEngagement: 0},
    };
  }

  const posterSnaps = await Promise.all(
    posterIds.map((posterId) => adminDb.collection("creatorPosters").doc(posterId).get()),
  );

  const creators = new Map<string, ShareDownloadCreatorOption>();
  const posters = new Map<string, FirebaseFirestore.DocumentData>();
  const creatorIds = new Set<string>();
  for (const doc of posterSnaps) {
    if (!doc.exists) {
      continue;
    }
    const data = doc.data() || {};
    const regionId = normalizeString(data.regionId);
    const posterCreatorId = normalizeString(data.creatorPublicId);
    if (allowedRegions.size > 0 && !allowedRegions.has(regionId)) {
      continue;
    }
    if (scopedCreators && !scopedCreators.has(posterCreatorId)) {
      continue;
    }
    if (selectedCreator && posterCreatorId !== selectedCreator) {
      continue;
    }
    posters.set(doc.id, data);
    if (posterCreatorId) {
      creatorIds.add(posterCreatorId);
    }
  }

  const creatorSnaps = await Promise.all(
    Array.from(creatorIds).map((creatorId) =>
      adminDb.collection("creatorProfiles").doc(creatorId).get(),
    ),
  );
  for (const doc of creatorSnaps) {
    if (!doc.exists) {
      continue;
    }
    const data = doc.data() || {};
    const publicId = normalizeString(data.creatorPublicId) || doc.id;
    creators.set(publicId, {
      creatorPublicId: publicId,
      name: normalizeString(data.name) || publicId,
      email: normalizeString(data.email),
    });
  }

  const grouped = new Map<string, ShareDownloadReportRow>();
  for (const stat of rawStats) {
    const data = stat.data;
    const posterId = stat.posterId;
    const poster = posters.get(posterId);
    if (!poster) {
      continue;
    }
    const dateKey = stat.dateKey;
    const shareCount = stat.shareCount;
    const downloadCount = stat.downloadCount;
    const posterCreatorId = normalizeString(poster.creatorPublicId || data.creatorPublicId);
    const creator = creators.get(posterCreatorId);
    const categoryId = normalizeString(poster.categoryId || data.categoryId);
    const categoryLabel = categoryLabelWithIcon(
      categoryId,
      normalizeString(poster.categoryLabel || data.categoryLabel),
    );
    const title = normalizeString(poster.title || data.posterTitle) || "Poster";
    const searchable = [
      title,
      categoryLabel,
      posterCreatorId,
      creator?.name ?? "",
      creator?.email ?? "",
      posterId,
    ]
      .join(" ")
      .toLowerCase();
    if (queryText && !searchable.includes(queryText)) {
      continue;
    }

    const existing = grouped.get(posterId);
    if (existing) {
      existing.shareCount += shareCount;
      existing.downloadCount += downloadCount;
      existing.totalEngagement += shareCount + downloadCount;
      existing.firstDateKey = existing.firstDateKey < dateKey ? existing.firstDateKey : dateKey;
      existing.lastDateKey = existing.lastDateKey > dateKey ? existing.lastDateKey : dateKey;
      existing.history.push({
        dateKey,
        shares: shareCount,
        downloads: downloadCount,
        total: shareCount + downloadCount,
      });
      continue;
    }

    grouped.set(posterId, {
      posterId,
      posterTitle: title,
      categoryId,
      categoryLabel,
      regionId: normalizeString(poster.regionId || data.regionId),
      creatorPublicId: posterCreatorId,
      creatorName: creator?.name ?? (posterCreatorId || "Admin upload"),
      imageUrl: normalizeString(poster.imageUrl || poster.downloadUrl || poster.publicUrl),
      thumbnailUrl: normalizeString(poster.thumbnailUrl || poster.thumbUrl || poster.previewUrl),
      videoUrl: normalizeString(poster.videoUrl || poster.videoPreviewUrl),
      mediaType: normalizeString(poster.mediaType || poster.type) || "image",
      shareCount,
      downloadCount,
      totalEngagement: shareCount + downloadCount,
      firstDateKey: dateKey,
      lastDateKey: dateKey,
      history: [
        {
          dateKey,
          shares: shareCount,
          downloads: downloadCount,
          total: shareCount + downloadCount,
        },
      ],
    });
  }

  const rows = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      history: row.history.sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement);

  return {
    rows,
    summary: {
      posterCount: rows.length,
      shareCount: rows.reduce((sum, row) => sum + row.shareCount, 0),
      downloadCount: rows.reduce((sum, row) => sum + row.downloadCount, 0),
      totalEngagement: rows.reduce((sum, row) => sum + row.totalEngagement, 0),
    },
  };
}
