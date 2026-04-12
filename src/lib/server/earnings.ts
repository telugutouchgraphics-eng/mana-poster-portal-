export const CREATOR_SHARE_PERCENT = 80;
export const PLATFORM_SHARE_PERCENT = 20;

export interface RevenueSplit {
  grossAmount: number;
  creatorAmount: number;
  platformAmount: number;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function splitRevenue(grossAmount: number): RevenueSplit {
  const safeGross = Number.isFinite(grossAmount) ? Math.max(0, grossAmount) : 0;
  const creatorAmount = roundCurrency((safeGross * CREATOR_SHARE_PERCENT) / 100);
  const platformAmount = roundCurrency(safeGross - creatorAmount);
  return {
    grossAmount: roundCurrency(safeGross),
    creatorAmount,
    platformAmount,
  };
}
