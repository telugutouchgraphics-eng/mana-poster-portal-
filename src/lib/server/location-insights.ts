import { createHash } from "crypto";

import { adminDb } from "@/lib/firebase/admin";

const LOCATION_INSIGHTS_USER_READ_LIMIT = 2000;
const LOCATION_INSIGHTS_REPORT_READ_LIMIT = 1000;
const LOCATION_INSIGHTS_CACHE_TTL_MS = 10 * 60 * 1000;

export interface LocationInsightRow {
  key: string;
  state: string;
  district: string;
  city: string;
  userCount: number;
  activeUserCount: number;
  reportCount: number;
  latestActivityAt: number;
}

interface LocationInsightsPayload {
  generatedAt: number;
  totalLocationEnabledUsers: number;
  lastSevenDaysActiveUserCount: number;
  totalReportCountWithLocation: number;
  locations: LocationInsightRow[];
}

interface CachedLocationInsights {
  data: LocationInsightsPayload;
  cachedAt: number;
}

const memoryCache = new Map<string, CachedLocationInsights>();

function cacheKeyForAllowedStates(allowedStateNames?: Set<string>) {
  return allowedStateNames
    ? Array.from(allowedStateNames).sort().join("|")
    : "all";
}

function locationInsightsCacheDocId(cacheKey: string) {
  return `locationInsightsCache_${createHash("sha256").update(cacheKey).digest("hex")}`;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readArea(data: Record<string, unknown>) {
  const area = data.locationArea;
  if (area && typeof area === "object" && !Array.isArray(area)) {
    const map = area as Record<string, unknown>;
    return {
      state: cleanText(map.state),
      district: cleanText(map.district),
      city: cleanText(map.city),
    };
  }
  return {
    state: cleanText(data.locationState),
    district: cleanText(data.locationDistrict),
    city: cleanText(data.locationCity),
  };
}

function areaKey(area: { state: string; district: string; city: string }) {
  const state = area.state || "Unknown State";
  const district = area.district || "Unknown District";
  const city = area.city || "Unknown City";
  return `${state.toLowerCase()}|${district.toLowerCase()}|${city.toLowerCase()}`;
}

function ensureRow(
  rows: Map<string, LocationInsightRow>,
  area: { state: string; district: string; city: string },
) {
  const key = areaKey(area);
  const existing = rows.get(key);
  if (existing) {
    return existing;
  }
  const row: LocationInsightRow = {
    key,
    state: area.state || "Unknown State",
    district: area.district || "Unknown District",
    city: area.city || "Unknown City",
    userCount: 0,
    activeUserCount: 0,
    reportCount: 0,
    latestActivityAt: 0,
  };
  rows.set(key, row);
  return row;
}

export async function getLocationInsights(
  allowedStateNames?: Set<string>,
): Promise<LocationInsightsPayload> {
  const cacheKey = cacheKeyForAllowedStates(allowedStateNames);
  const now = Date.now();
  const memoryHit = memoryCache.get(cacheKey);
  if (memoryHit && now - memoryHit.cachedAt < LOCATION_INSIGHTS_CACHE_TTL_MS) {
    return memoryHit.data;
  }

  const cacheRef = adminDb.collection("system").doc(locationInsightsCacheDocId(cacheKey));
  try {
    const cacheSnap = await cacheRef.get();
    const cachedAt = Number(cacheSnap.data()?.cachedAt ?? 0);
    const data = cacheSnap.data()?.data as LocationInsightsPayload | undefined;
    if (cacheSnap.exists && data && now - cachedAt < LOCATION_INSIGHTS_CACHE_TTL_MS) {
      memoryCache.set(cacheKey, { data, cachedAt: now });
      return data;
    }
  } catch (error) {
    console.warn("Failed to read location insights cache", error);
  }

  const rows = new Map<string, LocationInsightRow>();
  const lastSevenDays = now - 7 * 24 * 60 * 60 * 1000;

  const [usersSnap, reportsSnap] = await Promise.all([
    adminDb.collection("users").limit(LOCATION_INSIGHTS_USER_READ_LIMIT).get(),
    adminDb.collection("communityContentReports").limit(LOCATION_INSIGHTS_REPORT_READ_LIMIT).get(),
  ]);

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (data.locationEnabled !== true) return;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    if (allowedStateNames && !allowedStateNames.has(area.state.trim().toLowerCase())) return;
    const row = ensureRow(rows, area);
    const locationUpdatedAt = toNumber(data.locationUpdatedAt);
    row.userCount += 1;
    if (locationUpdatedAt >= lastSevenDays) {
      row.activeUserCount += 1;
    }
    row.latestActivityAt = Math.max(row.latestActivityAt, locationUpdatedAt);
  });

  reportsSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    if (allowedStateNames && !allowedStateNames.has(area.state.trim().toLowerCase())) return;
    const row = ensureRow(rows, area);
    row.reportCount += 1;
    row.latestActivityAt = Math.max(row.latestActivityAt, toNumber(data.reportedAt));
  });

  const allLocations = [...rows.values()];
  const locations = [...allLocations]
    .sort((a, b) => {
      const activity = b.latestActivityAt - a.latestActivityAt;
      if (activity !== 0) return activity;
      return b.activeUserCount + b.reportCount + b.userCount - (a.activeUserCount + a.reportCount + a.userCount);
    })
    .slice(0, 200);

  const data = {
    generatedAt: now,
    totalLocationEnabledUsers: allLocations.reduce((sum, item) => sum + item.userCount, 0),
    lastSevenDaysActiveUserCount: allLocations.reduce((sum, item) => sum + item.activeUserCount, 0),
    totalReportCountWithLocation: allLocations.reduce((sum, item) => sum + item.reportCount, 0),
    locations,
  };
  memoryCache.set(cacheKey, { data, cachedAt: now });
  cacheRef.set({ data, cachedAt: now }).catch((error) => {
    console.warn("Failed to cache location insights", error);
  });
  return data;
}
