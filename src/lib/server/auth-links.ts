import { adminAuth } from "@/lib/firebase/admin";
import type { ManagedPortalRole } from "@/lib/server/managed-auth";

type PortalLinkRole = ManagedPortalRole | "landing";

function configuredPortalUrl(envName: string, fallback: string) {
  const configured = process.env[envName]?.trim();
  return configured && configured.length > 0 ? configured : fallback;
}

export function buildPortalLoginUrl(role: PortalLinkRole): string {
  if (role === "admin") {
    return configuredPortalUrl("PORTAL_ADMIN_URL", "https://admin.manaposter.in/login");
  }
  if (role === "manager") {
    return configuredPortalUrl("PORTAL_MANAGER_URL", "https://manager.manaposter.in/login");
  }
  return configuredPortalUrl("PORTAL_CREATOR_URL", "https://creator.manaposter.in/login");
}

export function buildCreatorActivationLink(token: string): string {
  const base = configuredPortalUrl("PORTAL_CREATOR_URL", "https://creator.manaposter.in");
  const url = new URL("/creator/access", base);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function generatePortalPasswordResetLink(
  authEmail: string,
  role: PortalLinkRole,
): Promise<string> {
  return adminAuth.generatePasswordResetLink(authEmail, {
    url: buildPortalLoginUrl(role),
    handleCodeInApp: false,
  });
}
