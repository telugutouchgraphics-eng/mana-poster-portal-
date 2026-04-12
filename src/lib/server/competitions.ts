import { adminDb } from "@/lib/firebase/admin";
import type {
  CreatorProfileRecord,
  LeaderboardItem,
  PosterRecord,
} from "@/lib/server/dashboard-metrics";

export interface CompetitionRecord {
  id: string;
  title: string;
  description: string;
  categoryIds: string[];
  startAt: number;
  endAt: number;
  status: "draft" | "active" | "completed";
  rewardNote: string;
  createdAt: number;
  updatedAt: number;
}

export interface CompetitionLeaderboardRow extends LeaderboardItem {
  rank: number;
}

export interface CompetitionSnapshot {
  competition: CompetitionRecord;
  creatorCount: number;
  leaders: CompetitionLeaderboardRow[];
}

export async function loadCompetitions(): Promise<CompetitionRecord[]> {
  const snap = await adminDb.collection("competitions").get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: String(data.title ?? "Untitled Competition"),
        description: String(data.description ?? ""),
        categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.map(String) : [],
        startAt: Number(data.startAt ?? 0),
        endAt: Number(data.endAt ?? 0),
        status:
          data.status === "draft" || data.status === "completed" ? data.status : "active",
        rewardNote: String(data.rewardNote ?? ""),
        createdAt: Number(data.createdAt ?? 0),
        updatedAt: Number(data.updatedAt ?? 0),
      } satisfies CompetitionRecord;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function buildCompetitionSnapshots(
  competitions: CompetitionRecord[],
  posters: PosterRecord[],
  creatorProfiles: CreatorProfileRecord[],
  now: number = Date.now(),
): CompetitionSnapshot[] {
  const creatorMap = new Map(
    creatorProfiles.map((profile) => [profile.creatorPublicId, profile.name]),
  );

  return competitions
    .filter((competition) => {
      if (competition.status === "completed") {
        return false;
      }
      if (competition.status === "draft") {
        return true;
      }
      return competition.endAt >= now;
    })
    .map((competition) => {
      const relevantPosters = posters.filter(
        (poster) =>
          poster.createdAt >= competition.startAt &&
          poster.createdAt <= competition.endAt &&
          competition.categoryIds.includes(poster.categoryId),
      );

      const perCreator = new Map<string, LeaderboardItem>();
      for (const poster of relevantPosters) {
        if (!poster.creatorPublicId) {
          continue;
        }
        const current = perCreator.get(poster.creatorPublicId) ?? {
          creatorPublicId: poster.creatorPublicId,
          creatorName: creatorMap.get(poster.creatorPublicId) ?? poster.creatorPublicId,
          approvedCount: 0,
          totalUploads: 0,
          creatorEarnings: 0,
        };
        current.totalUploads += 1;
        if (poster.status === "approved") {
          current.approvedCount += 1;
        }
        current.creatorEarnings += poster.creatorEarnings;
        perCreator.set(poster.creatorPublicId, current);
      }

      const leaders = Array.from(perCreator.values())
        .sort((a, b) => {
          if (b.approvedCount !== a.approvedCount) {
            return b.approvedCount - a.approvedCount;
          }
          if (b.totalUploads !== a.totalUploads) {
            return b.totalUploads - a.totalUploads;
          }
          if (b.creatorEarnings !== a.creatorEarnings) {
            return b.creatorEarnings - a.creatorEarnings;
          }
          return a.creatorName.localeCompare(b.creatorName);
        })
        .map((row, index) => ({ ...row, rank: index + 1 }))
        .slice(0, 10);

      return {
        competition,
        creatorCount: perCreator.size,
        leaders,
      };
    })
    .sort((a, b) => b.competition.startAt - a.competition.startAt);
}
