import { Firestore } from "firebase-admin/firestore";

export type ManagedPortalRole = "admin" | "manager" | "creator";
export type ManagedAuthScope = ManagedPortalRole;

function splitEmailParts(email: string) {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0) {
    throw new Error("Valid email is required.");
  }
  return {
    local: normalized.slice(0, atIndex),
    domain: normalized.slice(atIndex + 1),
    normalized,
  };
}

export function buildRoleAuthEmail(email: string, role: ManagedAuthScope): string {
  const { local, domain } = splitEmailParts(email);
  const suffix = `+manaposter-${role}`;
  if (local.endsWith(suffix)) {
    return `${local}@${domain}`;
  }
  return `${local}${suffix}@${domain}`;
}

export function roleContactEmail(email: string, role: ManagedAuthScope): string {
  const { local, domain } = splitEmailParts(email);
  const suffix = `+manaposter-${role}`;
  if (!local.endsWith(suffix)) {
    return `${local}@${domain}`;
  }
  return `${local.slice(0, -suffix.length)}@${domain}`;
}

export function roleLoginField(role: ManagedPortalRole): string[] {
  if (role === "admin") {
    return ["adminLoginId", "dashboardAdminLoginId"];
  }
  if (role === "manager") {
    return ["managerPublicId"];
  }
  return ["creatorPublicId"];
}

export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

interface ManagedUserRecord {
  uid: string;
  role?: string;
  roles?: unknown;
  email?: string;
  authEmail?: string;
  adminLoginId?: string;
  dashboardAdminLoginId?: string;
  adminManaged?: boolean;
  dashboardAdminManaged?: boolean;
  managerPublicId?: string;
  creatorPublicId?: string;
}

function hasRole(data: ManagedUserRecord, role: ManagedPortalRole) {
  if (
    role === "admin" &&
    data.adminManaged === true &&
    data.dashboardAdminManaged !== true
  ) {
    return false;
  }
  if (data.role === role) {
    return true;
  }
  return Array.isArray(data.roles) && data.roles.includes(role);
}

export async function resolveManagedAuthEmail(
  db: Firestore,
  identifier: string,
  role: ManagedPortalRole,
): Promise<{
  authEmail: string;
  contactEmail: string;
  uid: string;
}> {
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);
  const snapshot = await db.collection("users").get();

  for (const doc of snapshot.docs) {
    const data = { uid: doc.id, ...(doc.data() as Omit<ManagedUserRecord, "uid">) };
    if (!hasRole(data, role)) {
      continue;
    }
    const rawContactEmail = String(data.email ?? data.authEmail ?? "").trim().toLowerCase();
    const contactEmail = roleContactEmail(rawContactEmail, role);
    const authEmail = buildRoleAuthEmail(
      String(data.authEmail ?? contactEmail).trim().toLowerCase(),
      role,
    );
    const loginMatches = roleLoginField(role).some(
      (field) => String((data as Record<string, unknown>)[field] ?? "").trim().toLowerCase() === normalizedIdentifier,
    );
    if (
      contactEmail === normalizedIdentifier ||
      authEmail === normalizedIdentifier ||
      loginMatches
    ) {
      return {
        uid: doc.id,
        authEmail: authEmail || buildRoleAuthEmail(contactEmail, role),
        contactEmail,
      };
    }
  }

  throw new Error(`No ${role} access found for this login.`);
}
