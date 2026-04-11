import { AppRole } from "@/lib/types/roles";

export const ROLE_PRIORITY: AppRole[] = ["admin", "manager", "creator", "user"];

export function isAppRole(value: string): value is AppRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "creator" ||
    value === "user"
  );
}

export function normalizeRoles(input: unknown): AppRole[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const roles: AppRole[] = [];
  for (const item of input) {
    if (typeof item === "string" && isAppRole(item) && !roles.includes(item)) {
      roles.push(item);
    }
  }
  roles.sort((a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b));
  return roles;
}

export function mergeRoles(existing: AppRole[], toAdd: AppRole[]): AppRole[] {
  return normalizeRoles([...existing, ...toAdd]);
}

export function removeRole(existing: AppRole[], roleToRemove: AppRole): AppRole[] {
  return normalizeRoles(existing.filter((role) => role !== roleToRemove));
}

export function pickPrimaryRole(roles: AppRole[]): AppRole {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return "user";
}
