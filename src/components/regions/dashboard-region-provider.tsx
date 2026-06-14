"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DASHBOARD_REGIONS,
  DEFAULT_DASHBOARD_REGION_ID,
  DashboardRegion,
  getDashboardRegion,
} from "@/lib/dashboard-regions";

const STORAGE_KEY = "mana-poster-dashboard-region";

interface DashboardRegionContextValue {
  region: DashboardRegion;
  setRegionId: (regionId: string) => void;
  regions: DashboardRegion[];
}

const DashboardRegionContext = createContext<DashboardRegionContextValue | null>(null);

export function DashboardRegionProvider({ children }: { children: ReactNode }) {
  const [regionId, setRegionIdState] = useState(DEFAULT_DASHBOARD_REGION_ID);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    setRegionIdState(getDashboardRegion(saved).id);
  }, []);

  function setRegionId(nextRegionId: string) {
    const next = getDashboardRegion(nextRegionId);
    setRegionIdState(next.id);
    window.localStorage.setItem(STORAGE_KEY, next.id);
  }

  const value = useMemo(
    () => ({
      region: getDashboardRegion(regionId),
      setRegionId,
      regions: DASHBOARD_REGIONS,
    }),
    [regionId],
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

