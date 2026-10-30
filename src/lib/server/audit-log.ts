import type { AppRole } from "@/lib/types/roles";

export interface AuditLogInput {
  actorUid: string;
  actorRole: AppRole;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(_input: AuditLogInput): Promise<void> {
  // Audit logging disabled to eliminate continuous Firestore write costs.
  return Promise.resolve();
}
