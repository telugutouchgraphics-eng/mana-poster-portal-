import { adminDb } from "@/lib/firebase/admin";
import { getIstDayKey } from "@/lib/server/ist-schedule";

export interface DailyPosterMetric {
  creatorPublicId: string;
  posterId: string;
  posterTitle: string;
  categoryId: string;
  categoryLabel: string;
  dateKey: string;
  shares: number;
  downloads: number;
  performancePercent: number;
}

export interface CalendarDayMetric {
  dateKey: string;
  day: number;
  shares: number;
  downloads: number;
  performancePercent: number;
  posterCount: number;
  posters: DailyPosterMetric[];
}

export interface RecentPosterPerformanceMetric {
  creatorPublicId: string;
  posterId: string;
  posterTitle: string;
  categoryId: string;
  categoryLabel: string;
  createdAt: number;
  publishAt: number;
  performanceWindowEndAt: number;
  shares: number;
  downloads: number;
  performancePercent: number;
  rank: number;
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

function normalizeDateKey(input: unknown): string {
  const value = String(input ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const timestamp = readNumber(input);
  if (timestamp > 0) {
    const date = new Date(timestamp);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

export async function loadDailyPosterMetrics(
  creatorPublicIds: string[],
): Promise<DailyPosterMetric[]> {
  if (creatorPublicIds.length === 0) {
    return [];
  }

  const [statsSnap, posterSnap] = await Promise.all([
    adminDb.collection("creatorPosterDailyStats").get(),
    adminDb.collection("creatorPosters").get(),
  ]);

  const creatorSet = new Set(creatorPublicIds);
  const posterMap = new Map(
    posterSnap.docs.map((doc) => {
      const data = doc.data();
      return [
        doc.id,
        {
          title: String(data.title ?? "Poster"),
          categoryId: String(data.categoryId ?? ""),
          categoryLabel: String(data.categoryLabel ?? ""),
          creatorPublicId: String(data.creatorPublicId ?? ""),
        },
      ] as const;
    }),
  );

  return statsSnap.docs
    .map((doc) => {
      const data = doc.data();
      const creatorPublicId = String(data.creatorPublicId ?? "").trim();
      if (!creatorSet.has(creatorPublicId)) {
        return null;
      }
      const posterId = String(data.posterId ?? data.templateId ?? "").trim();
      const posterMeta = posterMap.get(posterId);
      const dateKey =
        normalizeDateKey(data.dateKey) ||
        normalizeDateKey(data.dayKey) ||
        normalizeDateKey(data.createdAt) ||
        normalizeDateKey(data.updatedAt);
      if (!dateKey) {
        return null;
      }
      const shares = readNumber(data.shareCount ?? data.shares ?? data.totalShares);
      const downloads = readNumber(
        data.downloadCount ?? data.downloads ?? data.totalDownloads,
      );
      const rawPerformance = readNumber(
        data.performancePercent ??
          data.performancePercentage ??
          data.performance,
      );

      return {
        creatorPublicId,
        posterId,
        posterTitle: String(
          data.posterTitle ?? posterMeta?.title ?? "Poster",
        ).trim(),
        categoryId: String(
          data.categoryId ?? posterMeta?.categoryId ?? "",
        ).trim(),
        categoryLabel: String(
          data.categoryLabel ?? posterMeta?.categoryLabel ?? "",
        ).trim(),
        dateKey,
        shares,
        downloads,
        performancePercent: Math.max(0, Math.min(100, rawPerformance)),
      } satisfies DailyPosterMetric;
    })
    .filter((item): item is DailyPosterMetric => item !== null);
}

export async function loadActivePosterPerformanceMetrics(
  now = Date.now(),
): Promise<RecentPosterPerformanceMetric[]> {
  const [statsSnap, posterSnap] = await Promise.all([
    adminDb.collection("creatorPosterDailyStats").get(),
    adminDb.collection("creatorPosters").get(),
  ]);

  const recentPosters = posterSnap.docs
    .map((doc) => ({
      posterId: doc.id,
      creatorPublicId: String(doc.data().creatorPublicId ?? "").trim(),
      posterTitle: String(doc.data().title ?? "Poster").trim(),
      categoryId: String(doc.data().categoryId ?? "").trim(),
      categoryLabel: String(doc.data().categoryLabel ?? "").trim(),
      createdAt: readNumber(doc.data().createdAt),
      publishAt: readNumber(doc.data().publishAt),
      performanceWindowEndAt: readNumber(doc.data().performanceWindowEndAt),
      publishDayKey: String(doc.data().uploadDayKey ?? getIstDayKey(readNumber(doc.data().publishAt))),
      status: String(doc.data().status ?? "pending").trim(),
    }))
    .filter(
      (item) =>
        item.status === "approved" &&
        item.publishAt > 0 &&
        item.publishAt <= now &&
        item.performanceWindowEndAt > now,
    );

  if (recentPosters.length === 0) {
    return [];
  }

  const recentPosterIds = new Set(recentPosters.map((item) => item.posterId));
  const statsByPoster = new Map<
    string,
    {
      shares: number;
      downloads: number;
      performanceTotal: number;
      count: number;
    }
  >();

  for (const doc of statsSnap.docs) {
    const data = doc.data();
    const posterId = String(data.posterId ?? data.templateId ?? "").trim();
    if (!recentPosterIds.has(posterId)) {
      continue;
    }
    const poster = recentPosters.find((item) => item.posterId === posterId);
    if (!poster) {
      continue;
    }
    const dateKey =
      normalizeDateKey(data.dateKey) ||
      normalizeDateKey(data.dayKey) ||
      normalizeDateKey(data.createdAt) ||
      normalizeDateKey(data.updatedAt);
    if (!dateKey || dateKey !== getIstDayKey(poster.publishAt)) {
      continue;
    }
    const current = statsByPoster.get(posterId) ?? {
      shares: 0,
      downloads: 0,
      performanceTotal: 0,
      count: 0,
    };
    current.shares += readNumber(data.shareCount ?? data.shares ?? data.totalShares);
    current.downloads += readNumber(
      data.downloadCount ?? data.downloads ?? data.totalDownloads,
    );
    current.performanceTotal += readNumber(
      data.performancePercent ?? data.performancePercentage ?? data.performance,
    );
    current.count += 1;
    statsByPoster.set(posterId, current);
  }

  const enriched = recentPosters
    .map((poster) => {
      const stats = statsByPoster.get(poster.posterId);
      return {
        ...poster,
        shares: stats?.shares ?? 0,
        downloads: stats?.downloads ?? 0,
        performancePercent:
          stats && stats.count > 0
            ? Number((stats.performanceTotal / stats.count).toFixed(1))
            : 0,
        rank: 0,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  const groupedByCategory = new Map<string, RecentPosterPerformanceMetric[]>();
  for (const poster of enriched) {
    const key = poster.categoryId || "uncategorized";
    const existing = groupedByCategory.get(key) ?? [];
    existing.push(poster);
    groupedByCategory.set(key, existing);
  }

  for (const group of groupedByCategory.values()) {
    group.sort((a, b) => {
      if (b.shares !== a.shares) {
        return b.shares - a.shares;
      }
      if (b.performancePercent !== a.performancePercent) {
        return b.performancePercent - a.performancePercent;
      }
      if (b.downloads !== a.downloads) {
        return b.downloads - a.downloads;
      }
      return b.publishAt - a.publishAt;
    });
    group.forEach((item, index) => {
      item.rank = index + 1;
    });
  }

  return enriched;
}

export async function loadRecentPosterPerformanceMetrics(
  creatorPublicId: string,
  now = Date.now(),
): Promise<RecentPosterPerformanceMetric[]> {
  const activePosters = await loadActivePosterPerformanceMetrics(now);
  return activePosters
    .filter((item) => item.creatorPublicId === creatorPublicId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function buildMonthlyCalendarMetrics(
  metrics: DailyPosterMetric[],
  year: number,
  month: number,
): CalendarDayMetric[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const grouped = new Map<string, DailyPosterMetric[]>();

  for (const metric of metrics) {
    if (!metric.dateKey.startsWith(`${year}-${String(month).padStart(2, "0")}-`)) {
      continue;
    }
    const existing = grouped.get(metric.dateKey) ?? [];
    existing.push(metric);
    grouped.set(metric.dateKey, existing);
  }

  const days: CalendarDayMetric[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const posters = (grouped.get(dateKey) ?? []).sort((a, b) => {
      if (b.performancePercent !== a.performancePercent) {
        return b.performancePercent - a.performancePercent;
      }
      if (b.shares !== a.shares) {
        return b.shares - a.shares;
      }
      return a.posterTitle.localeCompare(b.posterTitle);
    });
    const shares = posters.reduce((sum, item) => sum + item.shares, 0);
    const downloads = posters.reduce((sum, item) => sum + item.downloads, 0);
    const performancePercent =
      posters.length === 0
        ? 0
        : posters.reduce((sum, item) => sum + item.performancePercent, 0) /
          posters.length;

    days.push({
      dateKey,
      day,
      shares,
      downloads,
      performancePercent: Number(performancePercent.toFixed(1)),
      posterCount: posters.length,
      posters,
    });
  }

  return days;
}

export function buildPerformanceSummary(days: CalendarDayMetric[]) {
  const shares = days.reduce((sum, day) => sum + day.shares, 0);
  const downloads = days.reduce((sum, day) => sum + day.downloads, 0);
  const activeDays = days.filter((day) => day.posterCount > 0).length;
  const posterCount = days.reduce((sum, day) => sum + day.posterCount, 0);
  const performancePercent =
    activeDays === 0
      ? 0
      : days
          .filter((day) => day.posterCount > 0)
          .reduce((sum, day) => sum + day.performancePercent, 0) / activeDays;

  return {
    shares,
    downloads,
    activeDays,
    posterCount,
    performancePercent: Number(performancePercent.toFixed(1)),
  };
}
