const PERMANENT_DASHBOARD_ADMIN_EMAILS = new Set([
  "supportmanaposter@gmail.com",
  "manaposter2026@gmail.com",
]);

export function dashboardContactEmail(email?: string | null): string {
  const normalized = String(email ?? "").trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    return normalized;
  }
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const suffix = "+manaposter-admin";
  return local.endsWith(suffix)
    ? `${local.slice(0, -suffix.length)}@${domain}`
    : normalized;
}

export function isPermanentDashboardAdminEmail(email?: string | null): boolean {
  return PERMANENT_DASHBOARD_ADMIN_EMAILS.has(dashboardContactEmail(email));
}
