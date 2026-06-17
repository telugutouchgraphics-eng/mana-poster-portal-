"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DASHBOARD_REGIONS,
  DEFAULT_DASHBOARD_REGION_ID,
  DashboardRegion,
  getDashboardRegion,
} from "@/lib/dashboard-regions";
import { useAuth } from "@/components/auth/auth-provider";

const STORAGE_KEY = "mana-poster-dashboard-region";

interface DashboardRegionContextValue {
  region: DashboardRegion;
  setRegionId: (regionId: string) => void;
  regions: DashboardRegion[];
}

const DashboardRegionContext = createContext<DashboardRegionContextValue | null>(null);

export function DashboardRegionProvider({ children }: { children: ReactNode }) {
  const { assignedRegionIds, roles } = useAuth();
  const [regionId, setRegionIdState] = useState(DEFAULT_DASHBOARD_REGION_ID);
  const initializedRegionRef = useRef(false);
  const allowedRegions = useMemo(
    () => {
      if (roles.includes("admin")) {
        return DASHBOARD_REGIONS.filter((item) => assignedRegionIds.includes(item.id));
      }
      return assignedRegionIds.length === 0
        ? DASHBOARD_REGIONS
        : DASHBOARD_REGIONS.filter((item) => assignedRegionIds.includes(item.id));
    },
    [assignedRegionIds, roles],
  );

  useEffect(() => {
    setRegionIdState((currentRegionId) => {
      const currentRegion = allowedRegions.find((item) => item.id === currentRegionId);
      if (initializedRegionRef.current && currentRegion) {
        return currentRegion.id;
      }

      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedRegion = getDashboardRegion(saved).id;
      const nextRegion =
        allowedRegions.find((item) => item.id === savedRegion) ??
        currentRegion ??
        allowedRegions[0] ??
        getDashboardRegion(null);
      initializedRegionRef.current = true;
      return nextRegion.id;
    });
  }, [allowedRegions]);

  const setRegionId = useCallback(
    (nextRegionId: string) => {
      const next = getDashboardRegion(nextRegionId);
      const scoped =
        allowedRegions.find((item) => item.id === next.id) ??
        allowedRegions[0] ??
        next;
      initializedRegionRef.current = true;
      setRegionIdState(scoped.id);
      window.localStorage.setItem(STORAGE_KEY, scoped.id);
    },
    [allowedRegions],
  );

  const scopedRegion = useMemo(
    () => allowedRegions.find((item) => item.id === regionId) ?? allowedRegions[0] ?? getDashboardRegion(regionId),
    [allowedRegions, regionId],
  );

  const value = useMemo(
    () => ({
      region: scopedRegion,
      setRegionId,
      regions: allowedRegions,
    }),
    [scopedRegion, setRegionId, allowedRegions],
  );

  return (
    <DashboardRegionContext.Provider value={value}>
      {children}
    </DashboardRegionContext.Provider>
  );
}

export function useDashboardRegion() {
  const context = useContext(DashboardRegionContext);
  if (!context) {
    throw new Error("useDashboardRegion must be used inside DashboardRegionProvider.");
  }
  return context;
}
