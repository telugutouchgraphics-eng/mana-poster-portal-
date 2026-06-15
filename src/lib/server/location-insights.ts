import { adminDb } from "@/lib/firebase/admin";

export interface LocationInsightRow {
  key: string;
  state: string;
  district: string;
  city: string;
  userCount: number;
  statusCount: number;
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
    const city = cleanText(map.city);
    const state = cleanText(map.state);
    return {
      state,
      district: cleanText(map.district) || city || state,
      city,
    };
  }
  const city = cleanText(data.locationCity);
  const state = cleanText(data.locationState);
  return {
    state,
    district: cleanText(data.locationDistrict) || city || state,
    city,
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
    statusCount: 0,
    reportCount: 0,
    latestActivityAt: 0,
  };
  rows.set(key, row);
  return row;
}

export async function getLocationInsights() {
  const rows = new Map<string, LocationInsightRow>();
  const now = Date.now();
  const lastSevenDays = now - 7 * 24 * 60 * 60 * 1000;

  const [usersSnap, statusesSnap, reportsSnap] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("communityStatuses").where("createdAt", ">=", lastSevenDays).get(),
    adminDb.collection("communityContentReports").get(),
  ]);

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (data.locationEnabled !== true) return;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    const row = ensureRow(rows, area);
    row.userCount += 1;
    row.latestActivityAt = Math.max(row.latestActivityAt, toNumber(data.locationUpdatedAt));
  });

  statusesSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    const row = ensureRow(rows, area);
    row.statusCount += 1;
    row.latestActivityAt = Math.max(row.latestActivityAt, toNumber(data.createdAt));
  });

  reportsSnap.docs.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const area = readArea(data);
    if (!area.state && !area.district && !area.city) return;
    const row = ensureRow(rows, area);
    row.reportCount += 1;
    row.latestActivityAt = Math.max(row.latestActivityAt, toNumber(data.reportedAt));
  });

  const locations = [...rows.values()]
    .sort((a, b) => {
      const activity = b.latestActivityAt - a.latestActivityAt;
      if (activity !== 0) return activity;
      return b.statusCount + b.reportCount + b.userCount - (a.statusCount + a.reportCount + a.userCount);
    })
    .slice(0, 200);

  return {
    generatedAt: now,
    totalLocationEnabledUsers: locations.reduce((sum, item) => sum + item.userCount, 0),
    lastSevenDaysStatusCount: locations.reduce((sum, item) => sum + item.statusCount, 0),
    totalReportCountWithLocation: locations.reduce((sum, item) => sum + item.reportCount, 0),
    locations,
  };
}
