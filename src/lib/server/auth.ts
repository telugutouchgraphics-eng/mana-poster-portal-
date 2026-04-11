import { DecodedIdToken } from "firebase-admin/auth";
import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { AppRole } from "@/lib/types/roles";
import { isAppRole, normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";

const PERMANENT_ADMIN_EMAILS = new Set<string>([
  "telugutouchgraphics@gmail.com",
]);

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
  const email = decoded.email?.toLowerCase();
  if (email && PERMANENT_ADMIN_EMAILS.has(email)) {
    return ["admin"];
  }

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

export async function requireAuth(req: NextRequest): Promise<RequestUser> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const decoded = await adminAuth.verifyIdToken(token);
  const roles = await resolveRoles(decoded.uid, decoded);
  return {
    uid: decoded.uid,
    email: decoded.email,
    roles,
    role: pickPrimaryRole(roles),
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
