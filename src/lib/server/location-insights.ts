import { createHash } from "crypto";

import { adminDb } from "@/lib/firebase/admin";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

const LOCATION_INSIGHTS_USER_READ_LIMIT = 5000;
const LOCATION_INSIGHTS_REPORT_READ_LIMIT = 1000;
const LOCATION_INSIGHTS_CACHE_TTL_MS = 10 * 60 * 1000;

const REGION_ID_TO_NAME = new Map<string, string>(
  DASHBOARD_REGIONS.map((r) => [r.id.toLowerCase(), r.name]),
);
for (const r of DASHBOARD_REGIONS) {
  REGION_ID_TO_NAME.set(r.name.toLowerCase(), r.name);
}

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

function readTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    const seconds = Number((value as { _seconds?: unknown })._seconds ?? 0);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const maybeTimestamp = value as { toMillis?: () => number };
    const millis = maybeTimestamp.toMillis?.();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

function readArea(data: Record<string, unknown>) {
  const area = data.locationArea;
  let state = "";
  let district = "";
  let city = "";

  if (area && typeof area === "object" && !Array.isArray(area)) {
    const map = area as Record<string, unknown>;
    state = cleanText(map.state);
    district = cleanText(map.district);
    city = cleanText(map.city);
  }
  if (!state) state = cleanText(data.locationState);
  if (!district) district = cleanText(data.locationDistrict);
  if (!city) city = cleanText(data.locationCity);

  if (!state) {
    const selectedRegionName = cleanText(data.selectedRegionName);
    const selectedRegion = cleanText(data.selectedRegion).toLowerCase();
    const stateCandidate = cleanText(data.state || data.region);

    if (selectedRegionName) {
      state = REGION_ID_TO_NAME.get(selectedRegionName.toLowerCase()) || selectedRegionName;
    } else if (selectedRegion) {
      state = REGION_ID_TO_NAME.get(selectedRegion) || selectedRegion;
    } else if (stateCandidate) {
      state = REGION_ID_TO_NAME.get(stateCandidate.toLowerCase()) || stateCandidate;
    }
  }

  return { state, district, city };
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
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    if (allowedStateNames && !allowedStateNames.has(area.state.trim().toLowerCase())) return;
    const row = ensureRow(rows, area);
    const activityAt = readTimestampMillis(
      data.locationUpdatedAt || data.updatedAt || data.lastActiveAt || data.createdAt,
    );
    row.userCount += 1;
    if (activityAt >= lastSevenDays) {
      row.activeUserCount += 1;
    }
    row.latestActivityAt = Math.max(row.latestActivityAt, activityAt);
  });

  reportsSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    if (allowedStateNames && !allowedStateNames.has(area.state.trim().toLowerCase())) return;
    const row = ensureRow(rows, area);
    row.reportCount += 1;
    const reportedAt = readTimestampMillis(data.reportedAt || data.createdAt);
    row.latestActivityAt = Math.max(row.latestActivityAt, reportedAt);
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
