import { adminDb } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES } from "@/lib/server/categories";
import { roundCurrency } from "@/lib/server/earnings";

export interface CreatorProfileRecord {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  assignedCategories: string[];
}

export interface PosterRecord {
  id: string;
  creatorPublicId: string;
  categoryId: string;
  categoryLabel: string;
  status: string;
  createdAt: number;
  creatorEarnings: number;
  platformEarnings: number;
  grossAmount: number;
}

export interface OverviewMetrics {
  totalManagers: number;
  activeManagers: number;
  inactiveManagers: number;
  totalCreators: number;
  activeCreators: number;
  blockedCreators: number;
  pendingInvites: number;
  totalPosters: number;
  pendingPosters: number;
  approvedPosters: number;
  rejectedPosters: number;
}

export interface CategoryPerformanceItem {
  categoryId: string;
  categoryLabel: string;
  totalUploads: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

export interface LeaderboardItem {
  creatorPublicId: string;
  creatorName: string;
  approvedCount: number;
  totalUploads: number;
  creatorEarnings: number;
}

export interface CategoryLeaderboard {
  categoryId: string;
  categoryLabel: string;
  creatorCount: number;
  leaders: LeaderboardItem[];
}

export interface CreatorCompetitionItem {
  categoryId: string;
  categoryLabel: string;
  rank: number;
  creatorCount: number;
  approvedCount: number;
  totalUploads: number;
  creatorEarnings: number;
  leaders: LeaderboardItem[];
}

export interface CreatorEarningsSummary {
  today: number;
  thisMonth: number;
  total: number;
  paidOut: number;
  pendingBalance: number;
  platformToday: number;
  platformThisMonth: number;
  platformTotal: number;
  sharePercent: number;
}

export interface CreatorVisibilityItem {
  creatorPublicId: string;
  creatorName: string;
  status: string;
  assignedCategoryCount: number;
  totalUploads: number;
  approvedCount: number;
  pendingCount: number;
  lastUploadAt: number;
}

export interface PortalAnalyticsSnapshot {
  overview: OverviewMetrics;
  creatorProfiles: CreatorProfileRecord[];
  posters: PosterRecord[];
  ledger: LedgerRecord[];
  payouts: PayoutRecord[];
}

export interface LedgerRecord {
  id: string;
  type: "sale" | "payout";
  posterId: string;
  creatorPublicId: string;
  categoryId: string;
  categoryLabel: string;
  grossAmount: number;
  creatorAmount: number;
  platformAmount: number;
  note: string;
  createdAt: number;
}

export interface PayoutRecord {
  id: string;
  creatorPublicId: string;
  amount: number;
  status: string;
  note: string;
  createdAt: number;
}

interface InternalLeaderboard {
  categoryId: string;
  categoryLabel: string;
  creatorCount: number;
  rows: LeaderboardItem[];
}

function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(epochMs: number): string {
  const date = new Date(epochMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

export async function loadPortalAnalyticsSnapshot(): Promise<PortalAnalyticsSnapshot> {
  const [
    creatorSnap,
    posterSnap,
    ledgerSnap,
    payoutSnap,
    primaryManagerSnap,
    multiRoleManagerSnap,
  ] =
    await Promise.all([
      adminDb.collection("creatorProfiles").get(),
      adminDb.collection("creatorPosters").get(),
      adminDb.collection("creatorEarningLedger").get(),
      adminDb.collection("creatorPayouts").get(),
      adminDb.collection("users").where("role", "==", "manager").get(),
      adminDb.collection("users").where("roles", "array-contains", "manager").get(),
    ]);

  const managerIds = new Set<string>();
  let activeManagers = 0;
  let inactiveManagers = 0;
  for (const doc of [...primaryManagerSnap.docs, ...multiRoleManagerSnap.docs]) {
    if (managerIds.has(doc.id)) {
      continue;
    }
    managerIds.add(doc.id);
    const status = String(doc.data().managerStatus ?? "active");
    if (status === "inactive") {
      inactiveManagers += 1;
    } else {
      activeManagers += 1;
    }
  }

  const creatorProfiles = creatorSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      creatorPublicId: String(data.creatorPublicId ?? doc.id),
      name: String(data.name ?? "-"),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      status: String(data.status ?? "pending_invite"),
      assignedCategories: Array.isArray(data.assignedCategories)
        ? data.assignedCategories.map(String)
        : [],
    };
  });

  const posters = posterSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      creatorPublicId: String(data.creatorPublicId ?? ""),
      categoryId: String(data.categoryId ?? ""),
      categoryLabel: String(data.categoryLabel ?? ""),
      status: String(data.status ?? "pending"),
      createdAt: readNumber(data.createdAt),
      creatorEarnings: readNumber(data.creatorEarnings),
      platformEarnings: readNumber(data.platformEarnings),
      grossAmount: readNumber(data.grossAmount),
    };
  });

  const overview: OverviewMetrics = {
    totalManagers: managerIds.size,
    activeManagers,
    inactiveManagers,
    totalCreators: creatorProfiles.length,
    activeCreators: creatorProfiles.filter((item) => item.status === "active").length,
    blockedCreators: creatorProfiles.filter((item) => item.status === "blocked").length,
    pendingInvites: creatorProfiles.filter((item) => item.status === "pending_invite").length,
    totalPosters: posters.length,
    pendingPosters: posters.filter((item) => item.status === "pending").length,
    approvedPosters: posters.filter((item) => item.status === "approved").length,
    rejectedPosters: posters.filter((item) => item.status === "rejected").length,
  };

  return {
    overview,
    creatorProfiles,
    posters,
    ledger: ledgerSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: String(data.type ?? "sale") === "payout" ? "payout" : "sale",
        posterId: String(data.posterId ?? ""),
        creatorPublicId: String(data.creatorPublicId ?? ""),
        categoryId: String(data.categoryId ?? ""),
        categoryLabel: String(data.categoryLabel ?? ""),
        grossAmount: readNumber(data.grossAmount),
        creatorAmount: readNumber(data.creatorAmount),
        platformAmount: readNumber(data.platformAmount),
        note: String(data.note ?? ""),
        createdAt: readNumber(data.createdAt),
      } satisfies LedgerRecord;
    }),
    payouts: payoutSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        creatorPublicId: String(data.creatorPublicId ?? ""),
        amount: readNumber(data.amount),
        status: String(data.status ?? "paid"),
        note: String(data.note ?? ""),
        createdAt: readNumber(data.createdAt),
      } satisfies PayoutRecord;
    }),
  };
}

export function buildCategoryPerformance(
  posters: PosterRecord[],
): CategoryPerformanceItem[] {
  const labelMap = buildCategoryLabelMap();
  const grouped = new Map<string, CategoryPerformanceItem>();

  for (const poster of posters) {
    const key = poster.categoryId || "uncategorized";
    const current = grouped.get(key) ?? {
      categoryId: key,
      categoryLabel:
        poster.categoryLabel || labelMap[key] || key || "Uncategorized",
      totalUploads: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
    };
    current.totalUploads += 1;
    if (poster.status === "approved") {
      current.approvedCount += 1;
    } else if (poster.status === "rejected") {
      current.rejectedCount += 1;
    } else {
      current.pendingCount += 1;
    }
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.totalUploads != a.totalUploads) {
      return b.totalUploads - a.totalUploads;
    }
    return a.categoryLabel.localeCompare(b.categoryLabel);
  });
}

export function buildCategoryLeaderboards(
  posters: PosterRecord[],
  creatorProfiles: CreatorProfileRecord[],
  categoryIds?: string[],
): CategoryLeaderboard[] {
  return buildInternalLeaderboards(posters, creatorProfiles, categoryIds).map(
    (item) => ({
      categoryId: item.categoryId,
      categoryLabel: item.categoryLabel,
      creatorCount: item.creatorCount,
      leaders: item.rows.slice(0, 8),
    }),
  );
}

function buildInternalLeaderboards(
  posters: PosterRecord[],
  creatorProfiles: CreatorProfileRecord[],
  categoryIds?: string[],
): InternalLeaderboard[] {
  const labelMap = buildCategoryLabelMap();
  const creatorMap = new Map(
    creatorProfiles.map((item) => [item.creatorPublicId, item]),
  );
  const scopedCategoryIds = categoryIds?.filter((item) => item.trim().length > 0);
  const categories = scopedCategoryIds && scopedCategoryIds.length > 0
    ? scopedCategoryIds
    : Array.from(new Set(posters.map((item) => item.categoryId).filter(Boolean)));

  return categories
    .map((categoryId) => {
      const categoryPosters = posters.filter((poster) => poster.categoryId === categoryId);
      const perCreator = new Map<string, LeaderboardItem>();
      for (const poster of categoryPosters) {
        const creatorId = poster.creatorPublicId;
        if (!creatorId) {
          continue;
        }
        const creator = creatorMap.get(creatorId);
        const current = perCreator.get(creatorId) ?? {
          creatorPublicId: creatorId,
          creatorName: creator?.name ?? creatorId,
          approvedCount: 0,
          totalUploads: 0,
          creatorEarnings: 0,
        };
        current.totalUploads += 1;
        if (poster.status === "approved") {
          current.approvedCount += 1;
        }
        current.creatorEarnings += poster.creatorEarnings;
        perCreator.set(creatorId, current);
      }

      const leaders = Array.from(perCreator.values())
        .sort((a, b) => {
          if (b.approvedCount !== a.approvedCount) {
            return b.approvedCount - a.approvedCount;
          }
          if (b.totalUploads !== a.totalUploads) {
            return b.totalUploads - a.totalUploads;
          }
          return a.creatorName.localeCompare(b.creatorName);
        })
        .slice(0, 8);

      return {
        categoryId,
        categoryLabel: labelMap[categoryId] || categoryId,
        creatorCount: perCreator.size,
        rows: leaders,
      };
    })
    .filter((item) => item.rows.length > 0)
    .sort((a, b) => {
      if (b.creatorCount !== a.creatorCount) {
        return b.creatorCount - a.creatorCount;
      }
      return a.categoryLabel.localeCompare(b.categoryLabel);
    });
}

export function buildCreatorCompetition(
  creatorPublicId: string,
  assignedCategories: string[],
  posters: PosterRecord[],
  creatorProfiles: CreatorProfileRecord[],
): CreatorCompetitionItem[] {
  const leaderboards = buildInternalLeaderboards(
    posters,
    creatorProfiles,
    assignedCategories,
  );

  return leaderboards.map((board) => {
    const fullRows = board.rows;
    const matched = fullRows.find((item) => item.creatorPublicId === creatorPublicId);
    const rank =
      matched == null
        ? fullRows.length + 1
        : fullRows.findIndex((item) => item.creatorPublicId === creatorPublicId) + 1;

    return {
      categoryId: board.categoryId,
      categoryLabel: board.categoryLabel,
      rank: rank <= 0 ? 1 : rank,
      creatorCount: board.creatorCount,
      approvedCount: matched?.approvedCount ?? 0,
      totalUploads: matched?.totalUploads ?? 0,
      creatorEarnings: matched?.creatorEarnings ?? 0,
      leaders: board.rows.slice(0, 8),
    };
  });
}

export function buildCreatorEarningsSummary(
  creatorPublicId: string,
  posters: PosterRecord[],
  payouts: PayoutRecord[] = [],
  now: number = Date.now(),
): CreatorEarningsSummary {
  const today = dayKey(now);
  const month = monthKey(now);
  const creatorPosters = posters.filter((item) => item.creatorPublicId === creatorPublicId);

  let todayCreator = 0;
  let monthCreator = 0;
  let totalCreator = 0;
  let todayPlatform = 0;
  let monthPlatform = 0;
  let totalPlatform = 0;
  let paidOut = 0;

  for (const poster of creatorPosters) {
    totalCreator += poster.creatorEarnings;
    totalPlatform += poster.platformEarnings;
    if (dayKey(poster.createdAt) === today) {
      todayCreator += poster.creatorEarnings;
      todayPlatform += poster.platformEarnings;
    }
    if (monthKey(poster.createdAt) === month) {
      monthCreator += poster.creatorEarnings;
      monthPlatform += poster.platformEarnings;
    }
  }

  for (const payout of payouts) {
    if (payout.creatorPublicId !== creatorPublicId || payout.status !== "paid") {
      continue;
    }
    paidOut += payout.amount;
  }

  return {
    today: todayCreator,
    thisMonth: monthCreator,
    total: totalCreator,
    paidOut,
    pendingBalance: roundCurrency(totalCreator - paidOut),
    platformToday: todayPlatform,
    platformThisMonth: monthPlatform,
    platformTotal: totalPlatform,
    sharePercent: 80,
  };
}

export function buildCreatorVisibility(
  creatorProfiles: CreatorProfileRecord[],
  posters: PosterRecord[],
): CreatorVisibilityItem[] {
  const grouped = new Map<string, PosterRecord[]>();
  for (const poster of posters) {
    if (!poster.creatorPublicId) continue;
    const existing = grouped.get(poster.creatorPublicId) ?? [];
    existing.push(poster);
    grouped.set(poster.creatorPublicId, existing);
  }

  return creatorProfiles
    .map((profile) => {
      const creatorPosters = grouped.get(profile.creatorPublicId) ?? [];
      return {
        creatorPublicId: profile.creatorPublicId,
        creatorName: profile.name,
        status: profile.status,
        assignedCategoryCount: profile.assignedCategories.length,
        totalUploads: creatorPosters.length,
        approvedCount: creatorPosters.filter((item) => item.status === "approved").length,
        pendingCount: creatorPosters.filter((item) => item.status === "pending").length,
        lastUploadAt: creatorPosters.reduce(
          (latest, item) => (item.createdAt > latest ? item.createdAt : latest),
          0,
        ),
      } satisfies CreatorVisibilityItem;
    })
    .sort((a, b) => {
      if (b.lastUploadAt !== a.lastUploadAt) {
        return b.lastUploadAt - a.lastUploadAt;
      }
      return a.creatorName.localeCompare(b.creatorName);
    });
}
