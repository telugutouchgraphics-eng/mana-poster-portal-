import { adminDb } from "@/lib/firebase/admin";

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

export async function getLocationInsights(allowedStateNames?: Set<string>) {
  const rows = new Map<string, LocationInsightRow>();
  const now = Date.now();
  const lastSevenDays = now - 7 * 24 * 60 * 60 * 1000;

  const [usersSnap, reportsSnap] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("communityContentReports").get(),
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

  return {
    generatedAt: now,
    totalLocationEnabledUsers: allLocations.reduce((sum, item) => sum + item.userCount, 0),
    lastSevenDaysActiveUserCount: allLocations.reduce((sum, item) => sum + item.activeUserCount, 0),
    totalReportCountWithLocation: allLocations.reduce((sum, item) => sum + item.reportCount, 0),
    locations,
  };
}
