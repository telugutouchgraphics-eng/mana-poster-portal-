import { adminDb } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES } from "@/lib/server/categories";
import type {
  CreatorProfileRecord,
  PosterRecord,
} from "@/lib/server/dashboard-metrics";
import {
  type DailyPosterMetric,
  loadDailyPosterMetrics,
} from "@/lib/server/performance-metrics";
import { getIstDayKey, getIstStartOfDay } from "@/lib/server/ist-schedule";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

export interface CompetitionRewardTier {
  rank: number;
  amount: number;
  label: string;
}

export interface CompetitionRecord {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  submissionStartAt: number;
  submissionEndAt: number;
  liveAt: number;
  status: "draft" | "active" | "completed";
  rewardNote: string;
  rewardTiers: CompetitionRewardTier[];
  createdAt: number;
  updatedAt: number;
}

export type CompetitionPhase =
  | "upcoming"
  | "submission_open"
  | "countdown"
  | "live"
  | "completed";

export interface CompetitionLeaderboardRow {
  creatorPublicId: string;
  creatorName: string;
  rank: number;
  shares: number;
  downloads: number;
  approvedCount: number;
  totalUploads: number;
  prizeAmount: number;
}

export interface CompetitionSnapshot {
  competition: CompetitionRecord;
  phase: CompetitionPhase;
  creatorCount: number;
  totalShares: number;
  totalDownloads: number;
  leaderboard: CompetitionLeaderboardRow[];
  winners: CompetitionLeaderboardRow[];
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

function buildCategoryLabelMap(): Record<string, string> {
  return Object.fromEntries(
    CREATOR_ASSIGNABLE_CATEGORIES.map((item) => [item.id, item.label]),
  );
}

function sanitizeRewardTiers(value: unknown): CompetitionRewardTier[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const source = item as Record<string, unknown>;
      const rank = readNumber(source.rank);
      const amount = readNumber(source.amount);
      const label = String(source.label ?? `Rank ${index + 1}`).trim();
      if (rank <= 0 || amount < 0) {
        return null;
      }
      return {
        rank,
        amount,
        label: label || `Rank ${rank}`,
      } satisfies CompetitionRewardTier;
    })
    .filter((item): item is CompetitionRewardTier => item !== null)
    .sort((a, b) => a.rank - b.rank);
}

function resolveCompetitionPhase(
  competition: CompetitionRecord,
  now: number,
): CompetitionPhase {
  const liveDayStart = getIstStartOfDay(competition.liveAt);
  const liveDayEnd = liveDayStart + 24 * 60 * 60 * 1000 - 1;

  if (competition.status === "completed" || now > liveDayEnd) {
    return "completed";
  }
  if (now >= liveDayStart && now <= liveDayEnd) {
    return "live";
  }
  if (now > competition.submissionEndAt) {
    return "countdown";
  }
  if (now >= competition.submissionStartAt) {
    return "submission_open";
  }
  return "upcoming";
}

function rewardAmountForRank(
  rewardTiers: CompetitionRewardTier[],
  rank: number,
): number {
  return rewardTiers.find((item) => item.rank === rank)?.amount ?? 0;
}

function buildLeaderboardRows(
  competition: CompetitionRecord,
  competitionPosters: PosterRecord[],
  dayMetrics: DailyPosterMetric[],
  creatorProfiles: CreatorProfileRecord[],
): CompetitionLeaderboardRow[] {
  const creatorNameMap = new Map(
    creatorProfiles.map((profile) => [profile.creatorPublicId, profile.name]),
  );
  const allowedPosterIds = new Set(competitionPosters.map((poster) => poster.id));
  const liveDayKey = getIstDayKey(competition.liveAt);

  const statsMap = new Map<
    string,
    {
      creatorPublicId: string;
      creatorName: string;
      shares: number;
      downloads: number;
      approvedCount: number;
      totalUploads: number;
    }
  >();

  const posterCountMap = new Map<
    string,
    {
      approvedCount: number;
      totalUploads: number;
    }
  >();

  for (const poster of competitionPosters) {
    const current = posterCountMap.get(poster.creatorPublicId) ?? {
      approvedCount: 0,
      totalUploads: 0,
    };
    current.totalUploads += 1;
    if (isApprovedEquivalentStatus(poster.status)) {
      current.approvedCount += 1;
    }
    posterCountMap.set(poster.creatorPublicId, current);
  }

  for (const metric of dayMetrics) {
    if (metric.dateKey !== liveDayKey || !allowedPosterIds.has(metric.posterId)) {
      continue;
    }
    const posterMeta = posterCountMap.get(metric.creatorPublicId);
    const current = statsMap.get(metric.creatorPublicId) ?? {
      creatorPublicId: metric.creatorPublicId,
      creatorName:
        creatorNameMap.get(metric.creatorPublicId) ?? metric.creatorPublicId,
      shares: 0,
      downloads: 0,
      approvedCount: posterMeta?.approvedCount ?? 0,
      totalUploads: posterMeta?.totalUploads ?? 0,
    };
    current.shares += metric.shares;
    current.downloads += metric.downloads;
    statsMap.set(metric.creatorPublicId, current);
  }

  for (const [creatorPublicId, posterCounts] of posterCountMap.entries()) {
    if (statsMap.has(creatorPublicId)) {
      continue;
    }
    statsMap.set(creatorPublicId, {
      creatorPublicId,
      creatorName: creatorNameMap.get(creatorPublicId) ?? creatorPublicId,
      shares: 0,
      downloads: 0,
      approvedCount: posterCounts.approvedCount,
      totalUploads: posterCounts.totalUploads,
    });
  }

  return Array.from(statsMap.values())
    .sort((a, b) => {
      if (b.shares !== a.shares) {
        return b.shares - a.shares;
      }
      if (b.downloads !== a.downloads) {
        return b.downloads - a.downloads;
      }
      if (b.approvedCount !== a.approvedCount) {
        return b.approvedCount - a.approvedCount;
      }
      if (b.totalUploads !== a.totalUploads) {
        return b.totalUploads - a.totalUploads;
      }
      return a.creatorName.localeCompare(b.creatorName);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      prizeAmount: rewardAmountForRank(competition.rewardTiers, index + 1),
    }))
    .slice(0, 25);
}

export async function loadCompetitions(): Promise<CompetitionRecord[]> {
  const snap = await adminDb.collection("competitions").get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      const submissionStartAt = readNumber(
        data.submissionStartAt ?? data.startAt,
      );
      const submissionEndAt = readNumber(data.submissionEndAt ?? data.endAt);
      const liveAt = readNumber(data.liveAt ?? data.endAt);
      return {
        id: doc.id,
        title: String(data.title ?? "Untitled Competition"),
        description: String(data.description ?? ""),
        categoryIds: Array.isArray(data.categoryIds)
          ? data.categoryIds.map(String)
          : [],
        submissionStartAt,
        submissionEndAt,
        liveAt,
        status:
          data.status === "draft" || data.status === "completed"
            ? data.status
            : "active",
        rewardNote: String(data.rewardNote ?? ""),
        rewardTiers: sanitizeRewardTiers(data.rewardTiers),
        createdAt: readNumber(data.createdAt),
        updatedAt: readNumber(data.updatedAt),
      } satisfies CompetitionRecord;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function buildCompetitionSnapshots(
  competitions: CompetitionRecord[],
  posters: PosterRecord[],
  creatorProfiles: CreatorProfileRecord[],
  now: number = Date.now(),
): Promise<CompetitionSnapshot[]> {
  const creatorIds = Array.from(
    new Set(
      creatorProfiles
        .map((profile) => profile.creatorPublicId)
        .filter((item) => item.trim().length > 0),
    ),
  );
  const dayMetrics = await loadDailyPosterMetrics(creatorIds);

  return competitions
    .map((competition) => {
      const competitionPosters = posters.filter(
        (poster) =>
          poster.createdAt >= competition.submissionStartAt &&
          poster.createdAt <= competition.submissionEndAt &&
          competition.categoryIds.includes(poster.categoryId) &&
          isApprovedEquivalentStatus(poster.status),
      );
      const leaderboard = buildLeaderboardRows(
        competition,
        competitionPosters,
        dayMetrics,
        creatorProfiles,
      );
      return {
        competition,
        phase: resolveCompetitionPhase(competition, now),
        creatorCount: new Set(
          competitionPosters.map((poster) => poster.creatorPublicId).filter(Boolean),
        ).size,
        totalShares: leaderboard.reduce((sum, row) => sum + row.shares, 0),
        totalDownloads: leaderboard.reduce((sum, row) => sum + row.downloads, 0),
        leaderboard,
        winners: leaderboard.slice(0, 3),
      } satisfies CompetitionSnapshot;
    })
    .sort((a, b) => b.competition.liveAt - a.competition.liveAt);
}

export function filterCreatorCompetitionSnapshots(
  snapshots: CompetitionSnapshot[],
  assignedCategories: string[],
): CompetitionSnapshot[] {
  const assigned = new Set(assignedCategories);
  return snapshots.filter((snapshot) =>
    snapshot.competition.categoryIds.some((categoryId) => assigned.has(categoryId)),
  );
}

export function buildCompetitionCategoryLabels(categoryIds: string[]): string[] {
  const labelMap = buildCategoryLabelMap();
  return categoryIds.map((categoryId) => labelMap[categoryId] ?? categoryId);
}
