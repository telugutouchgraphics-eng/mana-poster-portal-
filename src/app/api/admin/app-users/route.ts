import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { requireRole } from "@/lib/server/auth";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";

type SubscriptionFilter = "all" | "subscribers" | "non_subscribers";
type MarketingFilter = "all" | "ready" | "not_ready";

function trimValue(value: unknown) {
  return String(value ?? "").trim();
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

function normalizeSubscriptionFilter(value: string | null): SubscriptionFilter {
  const normalized = trimValue(value).toLowerCase();
  if (normalized === "subscribers" || normalized === "non_subscribers") {
    return normalized;
  }
  return "all";
}

function normalizeMarketingFilter(value: string | null): MarketingFilter {
  const normalized = trimValue(value).toLowerCase();
  if (normalized === "ready" || normalized === "not_ready") {
    return normalized;
  }
  return "all";
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasActiveSubscriptionAccess(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (!data || data.isPro !== true) {
    return false;
  }
  const expiryMillis = readTimestampMillis(data.expiryTime);
  return expiryMillis <= 0 || expiryMillis > now;
}

function todayIsoDate() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

async function loadUsersByAllowedRegions(allowedRegionIds: string[], selectedRegionId: string) {
  if (selectedRegionId) {
    const snap = await adminDb
      .collection("users")
      .where("selectedRegion", "==", selectedRegionId)
      .get();
    return snap.docs;
  }

  if (allowedRegionIds.length === DASHBOARD_REGIONS.length) {
    const snap = await adminDb.collection("users").get();
    return snap.docs;
  }

  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (let index = 0; index < allowedRegionIds.length; index += 30) {
    const group = allowedRegionIds.slice(index, index + 30);
    if (group.length === 0) continue;
    const snap = await adminDb
      .collection("users")
      .where("selectedRegion", "in", group)
      .get();
    snap.docs.forEach((doc) => docs.set(doc.id, doc));
  }
  return Array.from(docs.values());
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const requestedRegionId = trimValue(url.searchParams.get("regionId"));
    const selectedRegionId =
      requestedRegionId && requestedRegionId !== "all" ? requestedRegionId : "";
    const search = trimValue(url.searchParams.get("search")).toLowerCase();
    const subscriptionFilter = normalizeSubscriptionFilter(
      url.searchParams.get("subscription"),
    );
    const marketingFilter = normalizeMarketingFilter(
      url.searchParams.get("marketing"),
    );
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);

    if (selectedRegionId && !allowedRegionIds.includes(selectedRegionId)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const docs = await loadUsersByAllowedRegions(allowedRegionIds, selectedRegionId);
    const baseRows = docs
      .map((doc) => {
        const data = doc.data() || {};
        const phoneNumber = trimValue(data.phoneNumber);
        const email = trimValue(data.email);
        const selectedRegion = trimValue(data.selectedRegion);
        const selectedRegionName =
          trimValue(data.selectedRegionName) ||
          DASHBOARD_REGIONS.find((item) => item.id === selectedRegion)?.name ||
          "";
        const preferredLanguage =
          trimValue(data.preferredLanguage || data.selectedRegionLanguageCode || data.selectedRegionLanguage) ||
          "english";
        return {
          uid: doc.id,
          name: trimValue(data.name || data.displayName),
          email,
          phoneNumber,
          phoneDigits: phoneDigits(phoneNumber),
          selectedRegion,
          selectedRegionName,
          preferredLanguage,
          authProvider: trimValue(data.authProvider || data.providerId || "google"),
          lastLoginAt: readTimestampMillis(data.lastLoginAt),
          updatedAt: readTimestampMillis(data.updatedAt),
          createdAt: readTimestampMillis(data.createdAt),
        };
      })
      .filter((row) => row.email || row.phoneNumber || row.name);

    const searchedRows = search
      ? baseRows.filter((row) =>
          row.phoneDigits.includes(search.replace(/\D/g, "")) ||
          row.phoneNumber.toLowerCase().includes(search) ||
          row.email.toLowerCase().includes(search) ||
          row.name.toLowerCase().includes(search) ||
          row.selectedRegionName.toLowerCase().includes(search),
        )
      : baseRows;

    const entitlementRefs = searchedRows.map((row) =>
      adminDb.doc(`users/${row.uid}/entitlements/pro`),
    );
    const entitlementSnaps =
      entitlementRefs.length > 0 ? await adminDb.getAll(...entitlementRefs) : [];
    const subscribedByUid = new Map<string, boolean>();
    entitlementSnaps.forEach((snap, index) => {
      subscribedByUid.set(
        searchedRows[index]?.uid ?? "",
        hasActiveSubscriptionAccess(snap.data() as Record<string, unknown> | undefined),
      );
    });

    const filteredRows = searchedRows.filter((row) => {
      const subscribed = subscribedByUid.get(row.uid) === true;
      if (subscriptionFilter === "subscribers") {
        return subscribed;
      }
      if (subscriptionFilter === "non_subscribers") {
        return !subscribed;
      }
      return true;
    });

    const activityResults = await Promise.all(
      filteredRows.map(async (row) => {
        const [sessionSnap, tokenSnap] = await Promise.all([
          adminDb
            .collection("users")
            .doc(row.uid)
            .collection("activeSession")
            .doc("current")
            .get(),
          adminDb
            .collection("users")
            .doc(row.uid)
            .collection("deviceTokens")
            .limit(5)
            .get(),
        ]);
        const tokenDocs = tokenSnap.docs.map((doc) => doc.data() || {});
        const notificationsReachable = tokenSnap.size > 0;
        const marketingAllowed = tokenDocs.some((data) => {
          const allNotifications = data.allNotifications !== false;
          const offersUpdates = data.offersUpdates !== false;
          return allNotifications && offersUpdates;
        });
        const lastSessionAt = readTimestampMillis(sessionSnap.data()?.updatedAt);
        const lastActiveAt = lastSessionAt || row.lastLoginAt || row.updatedAt || row.createdAt;
        return {
          ...row,
          subscribed: subscribedByUid.get(row.uid) === true,
          tokenCount: tokenSnap.size,
          notificationsReachable,
          marketingReady: notificationsReachable && marketingAllowed,
          marketingStatusReason: notificationsReachable
            ? marketingAllowed
              ? "Ready: device token active"
              : "Not ready: notifications disabled"
            : "Not ready: no device token",
          lastActiveAt,
        };
      }),
    );

    const finalRows = activityResults.filter((row) => {
      if (marketingFilter === "ready") {
        return row.marketingReady;
      }
      if (marketingFilter === "not_ready") {
        return !row.marketingReady;
      }
      return true;
    });

    finalRows.sort(
      (a, b) =>
        (b.lastActiveAt || b.lastLoginAt || b.updatedAt || b.createdAt) -
        (a.lastActiveAt || a.lastLoginAt || a.updatedAt || a.createdAt),
    );

    const summary = finalRows.reduce(
      (acc, row) => ({
        total: acc.total + 1,
        subscribers: acc.subscribers + (row.subscribed ? 1 : 0),
        nonSubscribers: acc.nonSubscribers + (row.subscribed ? 0 : 1),
        reachable: acc.reachable + (row.notificationsReachable ? 1 : 0),
        marketingReady: acc.marketingReady + (row.marketingReady ? 1 : 0),
      }),
      { total: 0, subscribers: 0, nonSubscribers: 0, reachable: 0, marketingReady: 0 },
    );

    return NextResponse.json({
      ok: true,
      date: todayIsoDate(),
      regions: DASHBOARD_REGIONS.filter((region) => allowedRegionIds.includes(region.id)).map(
        (region) => ({
          id: region.id,
          name: region.name,
        }),
      ),
      summary,
      users: finalRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load app users.";
    const status = /forbidden/i.test(message) ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
