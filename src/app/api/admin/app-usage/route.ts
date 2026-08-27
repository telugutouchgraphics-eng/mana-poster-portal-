import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { requireRole } from "@/lib/server/auth";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";

interface UsageRow {
  screenKey: string;
  screenLabel: string;
  visitCount: number;
  uniqueUserCount: number;
  totalDurationMs: number;
  loginDropoffCount: number;
  lastSeenAt: number;
}

interface DailyRow {
  dateKey: string;
  activeUserCount: number;
  visitCount: number;
  totalDurationMs: number;
  loginDropoffCount: number;
}

function todayIsoDate() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function defaultStartDate() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - 6);
  return ist.toISOString().slice(0, 10);
}

function cleanDate(value: string | null, fallback: string) {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function millisValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }
  return 0;
}

function mergeScreenRows(rows: UsageRow[], next: UsageRow) {
  const existing = rows.find((row) => row.screenKey === next.screenKey);
  if (!existing) {
    rows.push(next);
    return;
  }
  existing.visitCount += next.visitCount;
  existing.uniqueUserCount += next.uniqueUserCount;
  existing.totalDurationMs += next.totalDurationMs;
  existing.loginDropoffCount += next.loginDropoffCount;
  existing.lastSeenAt = Math.max(existing.lastSeenAt, next.lastSeenAt);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const startDate = cleanDate(url.searchParams.get("startDate"), defaultStartDate());
    const endDate = cleanDate(url.searchParams.get("endDate"), todayIsoDate());
    const requestedRegionId = String(url.searchParams.get("regionId") ?? "").trim();
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const allRegionIds = DASHBOARD_REGIONS.map((region) => region.id);
    const canReadAll = allowedRegionIds.length === allRegionIds.length;
    const selectedRegionId =
      requestedRegionId && requestedRegionId !== "all" ? requestedRegionId : "";

    if (selectedRegionId && !allowedRegionIds.includes(selectedRegionId)) {
      return NextResponse.json({ok: false, error: "Forbidden"}, {status: 403});
    }

    const usableRegions = DASHBOARD_REGIONS.filter((region) =>
      allowedRegionIds.includes(region.id),
    );
    if (!canReadAll && !selectedRegionId && usableRegions.length === 0) {
      return NextResponse.json({ok: false, error: "Forbidden"}, {status: 403});
    }

    const useRegionCollections = Boolean(selectedRegionId) || !canReadAll;
    const screenCollection = useRegionCollections
      ? "appScreenRegionDailyStats"
      : "appScreenDailyStats";
    const dailyCollection = useRegionCollections
      ? "appRegionDailyUsageStats"
      : "appDailyUsageStats";
    const [screenSnap, dailySnap] = await Promise.all([
      adminDb
        .collection(screenCollection)
        .where("dateKey", ">=", startDate)
        .where("dateKey", "<=", endDate)
        .get(),
      adminDb
        .collection(dailyCollection)
        .where("dateKey", ">=", startDate)
        .where("dateKey", "<=", endDate)
        .get(),
    ]);

    const screens: UsageRow[] = [];
    screenSnap.docs.forEach((doc) => {
      const data = doc.data();
      const regionId = String(data.regionId ?? "").trim();
      if (selectedRegionId && regionId !== selectedRegionId) {
        return;
      }
      if (!selectedRegionId && !canReadAll && regionId && !allowedRegionIds.includes(regionId)) {
        return;
      }
      mergeScreenRows(screens, {
        screenKey: String(data.screenKey ?? doc.id).trim(),
        screenLabel: String(data.screenLabel ?? data.screenKey ?? "Unknown").trim(),
        visitCount: numberValue(data.visitCount),
        uniqueUserCount: numberValue(data.uniqueUserCount),
        totalDurationMs: numberValue(data.totalDurationMs),
        loginDropoffCount: numberValue(data.loginDropoffCount),
        lastSeenAt: millisValue(data.lastSeenAt),
      });
    });

    const dailyMap = new Map<string, DailyRow>();
    dailySnap.docs.forEach((doc) => {
      const data = doc.data();
      const shouldInclude = (() => {
        const regionId = String(data.regionId ?? "").trim();
        if (selectedRegionId) {
          return regionId === selectedRegionId;
        }
        return canReadAll || !regionId || allowedRegionIds.includes(regionId);
      })();
      if (!shouldInclude) {
        return;
      }
      const dateKey = String(data.dateKey ?? "").trim();
      const existing =
        dailyMap.get(dateKey) ?? {
          dateKey,
          activeUserCount: 0,
          visitCount: 0,
          totalDurationMs: 0,
          loginDropoffCount: 0,
        };
      existing.activeUserCount += numberValue(data.activeUserCount);
      existing.visitCount += numberValue(data.visitCount);
      existing.totalDurationMs += numberValue(data.totalDurationMs);
      existing.loginDropoffCount += numberValue(data.loginDropoffCount);
      dailyMap.set(dateKey, existing);
    });
    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );

    const summary = daily.reduce(
      (acc, row) => ({
        activeUserCount: acc.activeUserCount + row.activeUserCount,
        visitCount: acc.visitCount + row.visitCount,
        totalDurationMs: acc.totalDurationMs + row.totalDurationMs,
        loginDropoffCount: acc.loginDropoffCount + row.loginDropoffCount,
      }),
      {
        activeUserCount: 0,
        visitCount: 0,
        totalDurationMs: 0,
        loginDropoffCount: 0,
      },
    );

    return NextResponse.json({
      ok: true,
      startDate,
      endDate,
      selectedRegionId,
      regions: usableRegions,
      summary,
      screens: screens.sort((a, b) => b.totalDurationMs - a.totalDurationMs),
      daily,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load app usage.";
    return NextResponse.json(
      {ok: false, error: message},
      {status: message === "Forbidden" ? 403 : 400},
    );
  }
}
