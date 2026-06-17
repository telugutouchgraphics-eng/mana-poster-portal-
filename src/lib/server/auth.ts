import { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireOtpSession } from "@/lib/server/otp-auth";
import { isPermanentDashboardAdminEmail } from "@/lib/server/permanent-admins";
import { AppRole } from "@/lib/types/roles";
import { isAppRole, mergeRoles, normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";

export function isPermanentPortalEmail(email?: string | null): boolean {
  return isPermanentDashboardAdminEmail(email);
}

export function assertManagedRoleAssignmentAllowed(
  email: string,
  existingRoles: AppRole[],
  nextRole: AppRole,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (isPermanentPortalEmail(normalizedEmail)) {
    throw new Error("This account is protected and cannot be reassigned.");
  }
  const portalRoles: AppRole[] = ["admin", "manager", "creator"];
  const existingPortalRoles = existingRoles.filter((role) =>
    portalRoles.includes(role),
  );
  if (
    existingPortalRoles.length > 0 &&
    !existingPortalRoles.includes(nextRole)
  ) {
    throw new Error(
      `This email is already assigned as ${existingPortalRoles.join(", ")}.`,
    );
  }
  return;
}

export interface RequestUser {
  uid: string;
  email?: string;
  role: AppRole;
  roles: AppRole[];
  decoded: DecodedIdToken;
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}

async function resolveRoles(uid: string, decoded: DecodedIdToken): Promise<AppRole[]> {
  const rolesClaim = normalizeRoles((decoded as unknown as { roles?: unknown }).roles);
  if (rolesClaim.length > 0) {
    return rolesClaim;
  }

  const roleClaim = (decoded as unknown as { role?: string }).role;
  if (roleClaim && isAppRole(roleClaim)) {
    return [roleClaim];
  }

  const userDoc = await adminDb.collection("users").doc(uid).get();
  const userData = userDoc.data();
  const userRoles = normalizeRoles(userData?.roles);
  if (userRoles.length > 0) {
    return userRoles;
  }
  const role = userData?.role;
  if (typeof role === "string" && isAppRole(role)) {
    return [role];
  }
  return ["user"];
}

export function resolveVisibleRoles(email: string | undefined, docRoles: AppRole[], fallbackRoles: AppRole[]): AppRole[] {
  const baseRoles = docRoles.length > 0 ? mergeRoles(docRoles, fallbackRoles) : fallbackRoles;
  void email;
  return baseRoles;
}

export type RequireAuthOptions = {
  /** Set on POST /api/auth/register-device so web can bind after OTP even if mobile had activeDeviceId. */
  skipCreatorDeviceBinding?: boolean;
};

export async function requireAuth(
  req: NextRequest,
  options?: RequireAuthOptions,
): Promise<RequestUser> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const decoded = await adminAuth.verifyIdToken(token, true);
  const roles = await resolveRoles(decoded.uid, decoded);
  const role = pickPrimaryRole(roles);
  if (roles.some((item) => item === "admin" || item === "manager" || item === "creator")) {
    await requireOtpSession(decoded.uid);
  }
  if (role === "creator" && !options?.skipCreatorDeviceBinding) {
    const deviceId = String(req.headers.get("x-device-id") ?? "").trim();
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const activeDeviceId = String(userSnap.data()?.activeDeviceId ?? "").trim();
    if (activeDeviceId.length > 0 && deviceId.length === 0) {
      throw new Error("Session expired. Device verification is required.");
    }
    if (activeDeviceId.length > 0 && activeDeviceId !== deviceId) {
      throw new Error("Session expired. This creator account is active on another device.");
    }
  }
  return {
    uid: decoded.uid,
    email: decoded.email,
    roles,
    role,
    decoded,
  };
}

export async function requireRole(
  req: NextRequest,
  allowed: AppRole[]
): Promise<RequestUser> {
  const user = await requireAuth(req);
  if (!allowed.some((role) => user.roles.includes(role))) {
    throw new Error("Forbidden");
  }
  return user;
}
