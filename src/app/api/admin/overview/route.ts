import { NextRequest, NextResponse } from "next/server";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
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

function emptyReligionRow(regionId: string, regionName: string) {
  return {
    regionId,
    regionName,
    totalUsers: 0,
    hindu: 0,
    muslim: 0,
    christian: 0,
    allReligions: 0,
    unknown: 0,
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

function subscriptionStartMillis(data: Record<string, unknown> | undefined) {
  if (!data) return 0;
  return (
    readTimestampMillis(data.startTime) ||
    readTimestampMillis(data.purchaseTime) ||
    readTimestampMillis(data.purchaseTimeMillis) ||
    readTimestampMillis(data.activatedAt) ||
    readTimestampMillis(data.createdAt)
  );
}

function hasPaidSubscriptionHistory(data: Record<string, unknown> | undefined) {
  if (!data) return false;
  const source = String(data.source ?? "").trim();
  const productId = String(data.productId ?? "").trim();
  return Boolean(
    productId &&
      productId !== "manual_lifetime_whitelist" &&
      productId !== "first150_trial" &&
      source !== "manual_lifetime_whitelist" &&
      source !== "first150_trial",
  );
}


// Paginate through ALL users — no limit
async function loadAllUserDocsForRegions(_regionIds: string[]) {
  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const PAGE_SIZE = 500;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query = adminDb
      .collection("users")
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    snap.docs.forEach((doc) => docs.set(doc.id, doc));
    if (snap.docs.length < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return Array.from(docs.values());
}

// Install metrics — calculated accurately per region using IST day boundaries
function loadInstallMetrics(
  regionIds: string[],
  userDocs?: FirebaseFirestore.QueryDocumentSnapshot[],
) {
  const allowed = new Set(regionIds);
  const allowedRegions = DASHBOARD_REGIONS.filter((item) => allowed.has(item.id));
  if (allowedRegions.length === 0) {
    return { totalInstalls: 0, todayInstalls: 0, todayActive: 0, last7DaysActive: 0, byRegion: [] };
  }

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const istMidnightUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
  const todayStartMs = istMidnightUtc.getTime() - istOffset;
  const last7DaysStartMs = todayStartMs - 7 * 24 * 60 * 60 * 1000;

  const byRegion = new Map(
    allowedRegions.map((item) => [
      item.id,
      {
        regionId: item.id,
        regionName: item.name,
        totalInstalls: 0,
        todayInstalls: 0,
        todayActive: 0,
        last7DaysActive: 0,
      },
    ]),
  );

  const otherRow = {
    regionId: "other",
    regionName: "Other / General",
    totalInstalls: 0,
    todayInstalls: 0,
    todayActive: 0,
    last7DaysActive: 0,
  };

  if (userDocs && userDocs.length > 0) {
    userDocs.forEach((doc) => {
      const data = doc.data();
      const regionId = String(data.selectedRegion ?? "").trim();
      const row = byRegion.get(regionId) ?? otherRow;

      row.totalInstalls += 1;

      const created = data.createdAt;
      let createdMs = created
        ? typeof created.toMillis === "function"
          ? created.toMillis()
          : ((created as any)._seconds ?? 0) * 1000
        : 0;
      if (!createdMs && doc.createTime) {
        createdMs = doc.createTime.toMillis();
      }
      if (createdMs >= todayStartMs) {
        row.todayInstalls += 1;
      }

      const updated = data.updatedAt;
      const updatedMs = updated
        ? typeof updated.toMillis === "function"
          ? updated.toMillis()
          : ((updated as any)._seconds ?? 0) * 1000
        : 0;
      if (updatedMs >= todayStartMs) {
        row.todayActive += 1;
      }
      if (updatedMs >= last7DaysStartMs) {
        row.last7DaysActive += 1;
      }
    });
  }

  const rows = Array.from(byRegion.values());
  if (otherRow.totalInstalls > 0) {
    rows.push(otherRow);
  }
  rows.sort((a, b) => b.totalInstalls - a.totalInstalls);

  return {
    totalInstalls: rows.reduce((sum, r) => sum + r.totalInstalls, 0),
    todayInstalls: rows.reduce((sum, r) => sum + r.todayInstalls, 0),
    todayActive: rows.reduce((sum, r) => sum + r.todayActive, 0),
    last7DaysActive: rows.reduce((sum, r) => sum + r.last7DaysActive, 0),
    byRegion: rows,
  };
}

async function loadSubscriptionMetrics(
  regionIds: string[],
  existingUserDocs?: FirebaseFirestore.QueryDocumentSnapshot[],
) {
  const allowed = new Set(regionIds);
  const now = Date.now();
  const todayKey = dayKeyInIst(now);
  const byRegion = new Map(
    DASHBOARD_REGIONS.filter((item) => allowed.has(item.id)).map((item) => [
      item.id,
      emptySubscriptionRow(item.id, item.name),
    ]),
  );
  // Full pagination — reuse loaded userDocs if available
  const userDocs = existingUserDocs ?? (await loadAllUserDocsForRegions(regionIds));
  const users = userDocs
    .map((doc) => {
      const data = doc.data();
      const regionId = String(data.selectedRegion ?? "").trim();
      return { uid: doc.id, regionId };
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
    notSubscribed: rows.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          item.totalUsers - item.subscribed - item.trialActive - item.manualFree - item.referralReward,
        ),
      0,
    ),
    manualFree: rows.reduce((sum, item) => sum + item.manualFree, 0),
    referralReward: rows.reduce((sum, item) => sum + item.referralReward, 0),
    lifetimeSubscribers: entitlementSnaps.reduce((sum, snap) => {
      const data = snap.data() as Record<string, unknown> | undefined;
      return sum + (hasPaidSubscriptionHistory(data) ? 1 : 0);
    }, 0),
    todayNewSubscribers: users.reduce((sum, user, index) => {
      const data = entitlementSnaps[index]?.data() as Record<string, unknown> | undefined;
      const startAt = subscriptionStartMillis(data);
      return sum + (hasActiveAccess(data, now) && startAt > 0 && dayKeyInIst(startAt) === todayKey ? 1 : 0);
    }, 0),
    byRegion: rows,
  };
}

// Religion metrics — Firestore count() per religion per region
async function loadReligionMetrics(regionIds: string[]) {
  const allowed = new Set(regionIds);
  const allowedRegions = DASHBOARD_REGIONS.filter((item) => allowed.has(item.id));
  if (allowedRegions.length === 0) {
    return { totalUsers: 0, hindu: 0, muslim: 0, christian: 0, allReligions: 0, unknown: 0, byRegion: [] };
  }

  const rows: Array<{
    regionId: string;
    regionName: string;
    totalUsers: number;
    hindu: number;
    muslim: number;
    christian: number;
    allReligions: number;
    unknown: number;
  }> = [];

  // 3 regions parallel — each region has 5 count queries
  for (let i = 0; i < allowedRegions.length; i += 3) {
    const batch = allowedRegions.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(async (region) => {
        const [totalSnap, hinduSnap, muslimSnap, christianSnap, allSnap] = await Promise.all([
          adminDb.collection("users").where("selectedRegion", "==", region.id).count().get(),
          adminDb.collection("users").where("selectedRegion", "==", region.id).where("religionPreference", "==", "hindu").count().get(),
          adminDb.collection("users").where("selectedRegion", "==", region.id).where("religionPreference", "==", "muslim").count().get(),
          adminDb.collection("users").where("selectedRegion", "==", region.id).where("religionPreference", "==", "christian").count().get(),
          adminDb.collection("users").where("selectedRegion", "==", region.id).where("religionPreference", "==", "all").count().get(),
        ]);
        const total = totalSnap.data().count;
        const hindu = hinduSnap.data().count;
        const muslim = muslimSnap.data().count;
        const christian = christianSnap.data().count;
        const allReligions = allSnap.data().count;
        return {
          regionId: region.id,
          regionName: region.name,
          totalUsers: total,
          hindu,
          muslim,
          christian,
          allReligions,
          unknown: Math.max(0, total - hindu - muslim - christian - allReligions),
        };
      }),
    );
    rows.push(...results);
  }

  rows.sort((a, b) => b.totalUsers - a.totalUsers);
  return {
    totalUsers: rows.reduce((sum, item) => sum + item.totalUsers, 0),
    hindu: rows.reduce((sum, item) => sum + item.hindu, 0),
    muslim: rows.reduce((sum, item) => sum + item.muslim, 0),
    christian: rows.reduce((sum, item) => sum + item.christian, 0),
    allReligions: rows.reduce((sum, item) => sum + item.allReligions, 0),
    unknown: rows.reduce((sum, item) => sum + item.unknown, 0),
    byRegion: rows,
  };
}


export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const requestedRegionId = String(req.nextUrl.searchParams.get("regionId") ?? "").trim();
    const forceRefresh = req.nextUrl.searchParams.get("forceRefresh") === "true";
    const showAllRegions = requestedRegionId === "all";
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const region = showAllRegions
      ? null
      : await assertActorCanAccessRegion(actor, requestedRegionId);

    // ZERO-COST ARCHITECTURE: Read cached analytics summary first (1 single document read = ₹0 cost)
    const summaryRef = adminDb.collection("system").doc("analyticsSummary");
    const summarySnap = await summaryRef.get();

    const now = Date.now();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now + istOffset);
    const istMidnightUtc = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()));
    const todayStartMs = istMidnightUtc.getTime() - istOffset;
    const todayStartTimestamp = Timestamp.fromMillis(todayStartMs);

    const summaryData = summarySnap.exists ? (summarySnap.data() as any) : null;
    const isCacheStale = !summaryData?.lastCalculatedAt || (summaryData.lastCalculatedAt < todayStartMs);

    let installMetrics: any;
    let subscriptionMetrics: any;
    let religionMetrics: any;

    if (summarySnap.exists && !forceRefresh && !isCacheStale) {
      const allInstalls = summaryData.installMetrics;
      const allSubs = summaryData.subscriptionMetrics;
      const allRels = summaryData.religionMetrics;

      if (showAllRegions) {
        installMetrics = allInstalls;
        subscriptionMetrics = allSubs;
        religionMetrics = allRels;
      } else {
        const rId = region?.id ?? "";
        const rInstall = allInstalls?.byRegion?.filter((r: any) => r.regionId === rId) ?? [];
        installMetrics = {
          totalInstalls: rInstall.reduce((s: number, r: any) => s + (r.totalInstalls || 0), 0),
          todayInstalls: rInstall.reduce((s: number, r: any) => s + (r.todayInstalls || 0), 0),
          todayActive: rInstall.reduce((s: number, r: any) => s + (r.todayActive || 0), 0),
          last7DaysActive: rInstall.reduce((s: number, r: any) => s + (r.last7DaysActive || 0), 0),
          byRegion: rInstall,
        };

        const rSub = allSubs?.byRegion?.filter((r: any) => r.regionId === rId) ?? [];
        subscriptionMetrics = {
          ...allSubs,
          totalUsers: rSub.reduce((s: number, r: any) => s + (r.totalUsers || 0), 0),
          subscribed: rSub.reduce((s: number, r: any) => s + (r.subscribed || 0), 0),
          trialActive: rSub.reduce((s: number, r: any) => s + (r.trialActive || 0), 0),
          expired: rSub.reduce((s: number, r: any) => s + (r.expired || 0), 0),
          notSubscribed: rSub.reduce((s: number, r: any) => s + (r.notSubscribed || 0), 0),
          manualFree: rSub.reduce((s: number, r: any) => s + (r.manualFree || 0), 0),
          referralReward: rSub.reduce((s: number, r: any) => s + (r.referralReward || 0), 0),
          byRegion: rSub,
        };

        const rRel = allRels?.byRegion?.filter((r: any) => r.regionId === rId) ?? [];
        religionMetrics = {
          totalUsers: rRel.reduce((s: number, r: any) => s + (r.totalUsers || 0), 0),
          hindu: rRel.reduce((s: number, r: any) => s + (r.hindu || 0), 0),
          muslim: rRel.reduce((s: number, r: any) => s + (r.muslim || 0), 0),
          christian: rRel.reduce((s: number, r: any) => s + (r.christian || 0), 0),
          allReligions: rRel.reduce((s: number, r: any) => s + (r.allReligions || 0), 0),
          unknown: rRel.reduce((s: number, r: any) => s + (r.unknown || 0), 0),
          byRegion: rRel,
        };
      }
    } else {
      // Calculate fresh and cache into system/analyticsSummary for future zero-cost loads
      const allIds = DASHBOARD_REGIONS.map((item) => item.id);
      const userDocs = await loadAllUserDocsForRegions(allIds);
      const fullInstalls = loadInstallMetrics(allIds, userDocs);
      const [fullSubs, fullRels] = await Promise.all([
        loadSubscriptionMetrics(allIds, userDocs),
        loadReligionMetrics(allIds),
      ]);

      await summaryRef.set(
        {
          installMetrics: fullInstalls,
          subscriptionMetrics: fullSubs,
          religionMetrics: fullRels,
          lastCalculatedAt: Date.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );

      if (showAllRegions) {
        installMetrics = fullInstalls;
        subscriptionMetrics = fullSubs;
        religionMetrics = fullRels;
      } else {
        const rId = region?.id ?? "";
        installMetrics = {
          ...fullInstalls,
          byRegion: fullInstalls.byRegion.filter((r) => r.regionId === rId),
        };
        subscriptionMetrics = {
          ...fullSubs,
          byRegion: fullSubs.byRegion.filter((r) => r.regionId === rId),
        };
        religionMetrics = {
          ...fullRels,
          byRegion: fullRels.byRegion.filter((r) => r.regionId === rId),
        };
      }
    }

    const todayKey = dayKeyInIst(now);

    // Real-time zero-cost live installs for today (reads only today's new user documents, e.g. 5-30 docs)
    try {
      const todayUsersSnap = await adminDb
        .collection("users")
        .where("createdAt", ">=", todayStartTimestamp)
        .get();

      const liveTodayByRegion = new Map<string, number>();
      todayUsersSnap.forEach((doc) => {
        const rId = String(doc.data().selectedRegion ?? "").trim();
        if (rId) {
          liveTodayByRegion.set(rId, (liveTodayByRegion.get(rId) ?? 0) + 1);
        }
      });

      const liveTotalToday = todayUsersSnap.size;

      if (installMetrics) {
        if (showAllRegions) {
          installMetrics.todayInstalls = liveTotalToday;
          if (Array.isArray(installMetrics.byRegion)) {
            installMetrics.byRegion.forEach((r: any) => {
              r.todayInstalls = liveTodayByRegion.get(r.regionId) ?? 0;
            });
          }
        } else {
          const rId = region?.id ?? "";
          installMetrics.todayInstalls = liveTodayByRegion.get(rId) ?? 0;
          if (Array.isArray(installMetrics.byRegion)) {
            installMetrics.byRegion.forEach((r: any) => {
              r.todayInstalls = liveTodayByRegion.get(r.regionId) ?? 0;
            });
          }
        }
      }
    } catch {
      // Graceful fallback to cached install metrics
    }

    // Read daily atomic install counter if present (1 single doc read = ₹0 cost)
    try {
      const dailyInstallSnap = await adminDb
        .collection("system")
        .doc("dailyInstallStats")
        .collection("days")
        .doc(todayKey)
        .get();
      if (dailyInstallSnap.exists) {
        const atomicToday = Number(dailyInstallSnap.data()?.installs ?? 0);
        if (atomicToday > (installMetrics?.todayInstalls ?? 0)) {
          installMetrics = {
            ...installMetrics,
            todayInstalls: atomicToday,
          };
        }
      }
    } catch {
      // Graceful fallback to cached install metrics
    }

    const snapshot = await loadPortalAnalyticsSnapshot();
    const posters = showAllRegions
      ? snapshot.posters.filter((item) => allowedRegionIds.includes(item.regionId))
      : snapshot.posters.filter((item) => item.regionId === region?.id);
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
        todayInstalls: installMetrics.todayInstalls,
        todayActiveUsers: installMetrics.todayActive,
        last7DaysActiveUsers: installMetrics.last7DaysActive,
        nonActiveUsers: Math.max(0, installMetrics.totalInstalls - installMetrics.last7DaysActive),
        subscribedUsers: subscriptionMetrics.subscribed,
        lifetimeSubscribers: subscriptionMetrics.lifetimeSubscribers,
        todayNewSubscribers: subscriptionMetrics.todayNewSubscribers,
        trialUsers: subscriptionMetrics.trialActive,
        notSubscribedUsers: subscriptionMetrics.notSubscribed,
        hinduUsers: religionMetrics.hindu,
        muslimUsers: religionMetrics.muslim,
        christianUsers: religionMetrics.christian,
        allReligionUsers: religionMetrics.allReligions,
        unknownReligionUsers: religionMetrics.unknown,
      },
      installMetrics,
      subscriptionMetrics,
      religionMetrics,
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
