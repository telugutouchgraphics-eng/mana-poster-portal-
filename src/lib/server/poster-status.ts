export const EXPIRED_POSTER_STATUS = "expired";

export function isApprovedEquivalentStatus(status: unknown): boolean {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "approved" || normalized === EXPIRED_POSTER_STATUS;
}

export function isVisiblePosterStatus(status: unknown): boolean {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized !== EXPIRED_POSTER_STATUS;
}
