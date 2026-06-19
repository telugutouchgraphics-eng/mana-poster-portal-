import { NextRequest, NextResponse } from "next/server";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { loadAppBanners, loadCreatorAnnouncements } from "@/lib/server/content-management";
import { assertActorCanAccessRegion, loadActorAllowedRegionIds } from "@/lib/server/region-scope";
import {
  buildCategoryLeaderboards,
  buildCategoryPerformance,
  buildCreatorVisibility,
  loadPortalAnalyticsSnapshot,
} from "@/lib/server/dashboard-metrics";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

function assignedToRegion(assignedRegionIds: string[], regionId: string) {
  return assignedRegionIds.map((item) => item.trim()).includes(regionId);
}

function assignedToAnyAllowedRegion(assignedRegionIds: string[], allowedRegionIds: string[]) {
  return assignedRegionIds.some((regionId) => allowedRegionIds.includes(regionId));
}

function dayKeyInIst(epochMs: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

function buildUploadsTrend(values: number[]) {
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = dayKeyInIst(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * 24 * 60 * 60 * 1000);
    const key = dayKeyInIst(date.getTime());
    return {
      day: date.toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
      }),
      uploads: counts.get(key) ?? 0,
    };
  });
}

function readTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const maybeTimestamp = value as { toMillis?: () => number };
    const millis = maybeTimestamp.toMillis?.();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

function emptySubscriptionRow(regionId: string, regionName: string) {
  return {
    regionId,
    regionName,
    totalUsers: 0,
    subscribed: 0,
    trialActive: 0,
    expired: 0,
    notSubscribed: 0,
    manualFree: 0,
    referralReward: 0,
  };
}

function hasActiveAccess(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (!data) return false;
  if (data.isPro !== true) return false;
  const expiryMillis = readTimestampMillis(data.expiryTime);
  return expiryMillis <= 0 || expiryMillis > now;
}

function subscriptionBucket(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (!data) return "notSubscribed" as const;
  const source = String(data.source ?? "").trim();
  const productId = String(data.productId ?? "").trim();
  const subscriptionState = String(data.subscriptionState ?? "").trim();
  const active = hasActiveAccess(data, now);

  if (source === "manual_lifetime_whitelist" || productId === "manual_lifetime_whitelist") {
    return active ? "manualFree" : "expired";
  }
  if (source === "first150_trial" || productId === "first150_trial" || subscriptionState === "FIRST150_TRIAL") {
    return active ? "trialActive" : "expired";
  }
  if (data.referralRewardActive === true || subscriptionState === "REFERRAL_REWARD") {
    return active ? "referralReward" : "expired";
  }
  if (active) {
    return "subscribed";
  }
  return "expired";
}

async function loadInstallMetrics(regionIds: string[]) {
  const allowed = new Set(regionIds);
  const now = Date.now();
  const todayKey = dayKeyInIst(now);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const rows = new Map(
    DASHBOARD_REGIONS.filter((item) => allowed.has(item.id)).map((item) => [
      item.id,
      {
        regionId: item.id,
        regionName: item.name,
        totalInstalls: 0,
        todayActive: 0,
        last7DaysActive: 0,
      },
    ]),
  );
  const seenInstallIds = new Set<string>();
  const seenTodayIds = new Set<string>();
  const seenLast7Ids = new Set<string>();
  const snap = await adminDb.collectionGroup("activeSession").get();

  for (const doc of snap.docs) {
    const data = doc.data();
    const regionId = String(data.regionId ?? "").trim();
    if (!allowed.has(regionId)) continue;
    const row = rows.get(regionId);
    if (!row) continue;
    const installId = String(data.activeDeviceId ?? doc.ref.parent.parent?.id ?? doc.id).trim();
    if (!installId) continue;
    const installKey = `${regionId}:${installId}`;
    const updatedAt = readTimestampMillis(data.updatedAt);
    if (!seenInstallIds.has(installKey)) {
      seenInstallIds.add(installKey);
      row.totalInstalls += 1;
    }
    if (updatedAt > 0 && dayKeyInIst(updatedAt) === todayKey && !seenTodayIds.has(installKey)) {
      seenTodayIds.add(installKey);
      row.todayActive += 1;
    }
    if (updatedAt >= sevenDaysAgo && !seenLast7Ids.has(installKey)) {
      seenLast7Ids.add(installKey);
      row.last7DaysActive += 1;
    }
  }

  const byRegion = Array.from(rows.values()).sort((a, b) => b.totalInstalls - a.totalInstalls);
  return {
    totalInstalls: byRegion.reduce((sum, item) => sum + item.totalInstalls, 0),
    todayActive: byRegion.reduce((sum, item) => sum + item.todayActive, 0),
    last7DaysActive: byRegion.reduce((sum, item) => sum + item.last7DaysActive, 0),
    byRegion,
  };
}

async function loadSubscriptionMetrics(regionIds: string[]) {
  const allowed = new Set(regionIds);
  const now = Date.now();
  const byRegion = new Map(
    DASHBOARD_REGIONS.filter((item) => allowed.has(item.id)).map((item) => [
      item.id,
      emptySubscriptionRow(item.id, item.name),
    ]),
  );
  const userSnap = await adminDb.collection("users").get();
  const users = userSnap.docs
    .map((doc) => {
      const data = doc.data();
      const regionId = String(data.selectedRegion ?? "").trim();
      return {
        uid: doc.id,
        regionId,
      };
    })
    .filter((item) => allowed.has(item.regionId));

  const entitlementRefs = users.map((item) =>
    adminDb.doc(`users/${item.uid}/entitlements/pro`),
  );
  const entitlementSnaps: DocumentSnapshot[] = [];
  for (let index = 0; index < entitlementRefs.length; index += 300) {
    const chunk = entitlementRefs.slice(index, index + 300);
    if (chunk.length > 0) {
      entitlementSnaps.push(...(await adminDb.getAll(...chunk)));
    }
  }

  users.forEach((user, index) => {
    const row = byRegion.get(user.regionId);
    if (!row) return;
    row.totalUsers += 1;
    const data = entitlementSnaps[index]?.data() as Record<string, unknown> | undefined;
    const bucket = subscriptionBucket(data, now);
    row[bucket] += 1;
  });

  const rows = Array.from(byRegion.values()).sort((a, b) => b.totalUsers - a.totalUsers);
  return {
    totalUsers: rows.reduce((sum, item) => sum + item.totalUsers, 0),
    subscribed: rows.reduce((sum, item) => sum + item.subscribed, 0),
    trialActive: rows.reduce((sum, item) => sum + item.trialActive, 0),
    expired: rows.reduce((sum, item) => sum + item.expired, 0),
    notSubscribed: rows.reduce((sum, item) => sum + item.notSubscribed, 0),
    manualFree: rows.reduce((sum, item) => sum + item.manualFree, 0),
    referralReward: rows.reduce((sum, item) => sum + item.referralReward, 0),
    byRegion: rows,
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const requestedRegionId = String(req.nextUrl.searchParams.get("regionId") ?? "").trim();
    const showAllRegions = requestedRegionId === "all";
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const region = showAllRegions
      ? null
      : await assertActorCanAccessRegion(actor, requestedRegionId);
    const snapshot = await loadPortalAnalyticsSnapshot();
    const posters = showAllRegions
      ? snapshot.posters.filter((item) => allowedRegionIds.includes(item.regionId))
      : snapshot.posters.filter((item) => item.regionId === region?.id);
    const installMetrics = await loadInstallMetrics(
      showAllRegions ? allowedRegionIds : region?.id ? [region.id] : [],
    );
    const subscriptionMetrics = await loadSubscriptionMetrics(
      showAllRegions ? allowedRegionIds : region?.id ? [region.id] : [],
    );
    const creators = showAllRegions
      ? snapshot.creatorProfiles.filter((item) =>
          assignedToAnyAllowedRegion(item.assignedRegionIds, allowedRegionIds),
        )
      : snapshot.creatorProfiles.filter((item) =>
          assignedToRegion(item.assignedRegionIds, region?.id ?? ""),
        );
    const managers = showAllRegions
      ? snapshot.managers.filter((item) =>
          assignedToAnyAllowedRegion(item.assignedRegionIds, allowedRegionIds),
        )
      : snapshot.managers.filter((item) =>
          assignedToRegion(item.assignedRegionIds, region?.id ?? ""),
        );
    const now = Date.now();
    const todayKey = dayKeyInIst(now);
    const banners = await loadAppBanners();
    const announcements = await loadCreatorAnnouncements();
    const activeAnnouncements = announcements.filter(
      (item) => item.active && item.startAt <= now && item.endAt >= now,
    );
    const totalEarnings = posters.reduce((sum, item) => sum + item.creatorEarnings, 0);
    const todayUploads = posters.filter(
      (item) => dayKeyInIst(item.createdAt) === todayKey,
    ).length;

    return NextResponse.json({
      ok: true,
      overview: {
        ...snapshot.overview,
        totalManagers: managers.length,
        activeManagers: managers.filter((item) => item.status !== "inactive").length,
        inactiveManagers: managers.filter((item) => item.status === "inactive").length,
        totalCreators: creators.length,
        activeCreators: creators.filter((item) => item.status === "active").length,
        blockedCreators: creators.filter((item) => item.status === "blocked").length,
        pendingInvites: creators.filter((item) => item.status === "pending_invite").length,
        totalPosters: posters.length,
        pendingPosters: posters.filter((item) => item.status === "pending").length,
        approvedPosters: posters.filter((item) => isApprovedEquivalentStatus(item.status)).length,
        rejectedPosters: posters.filter((item) => item.status === "rejected").length,
      },
      headline: {
        totalCreators: creators.length,
        totalManagers: managers.length,
        totalPosters: posters.length,
        todayUploads,
        totalEarnings,
        totalInstalls: installMetrics.totalInstalls,
        todayActiveUsers: installMetrics.todayActive,
        last7DaysActiveUsers: installMetrics.last7DaysActive,
        subscribedUsers: subscriptionMetrics.subscribed,
        trialUsers: subscriptionMetrics.trialActive,
        notSubscribedUsers: subscriptionMetrics.notSubscribed,
      },
      installMetrics,
      subscriptionMetrics,
      uploadsTrend: buildUploadsTrend(posters.map((item) => item.createdAt)),
      revenue: {
        gross: posters.reduce((sum, item) => sum + item.grossAmount, 0),
        creator: posters.reduce((sum, item) => sum + item.creatorEarnings, 0),
        platform: posters.reduce((sum, item) => sum + item.platformEarnings, 0),
        paidOut: snapshot.payouts
          .filter(
            (item) =>
              item.status === "paid" &&
              (showAllRegions ||
                creators.some((creator) => creator.creatorPublicId === item.creatorPublicId)),
          )
          .reduce((sum, item) => sum + item.amount, 0),
      },
      categoryPerformance: buildCategoryPerformance(posters).slice(0, 8),
      categoryLeaderboards: buildCategoryLeaderboards(
        posters,
        creators,
      ).slice(0, 6),
      creatorVisibility: buildCreatorVisibility(
        creators,
        posters,
      ).slice(0, 6),
      content: {
        totalBanners: banners.length,
        activeBanners: banners.filter((item) => item.active).length,
        totalAnnouncements: announcements.length,
        activeAnnouncements: activeAnnouncements.length,
      },
      liveBanners: banners.slice(0, 4),
      liveAnnouncements: activeAnnouncements.slice(0, 4),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load admin overview.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
