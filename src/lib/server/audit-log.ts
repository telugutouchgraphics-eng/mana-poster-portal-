import { adminDb } from "@/lib/firebase/admin";
import type { AppRole } from "@/lib/types/roles";

interface AuditLogInput {
  actorUid: string;
  actorRole: AppRole;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  const now = Date.now();
  const ref = adminDb.collection("adminAuditLogs").doc();
  await ref.set({
    id: ref.id,
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    actorEmail: input.actorEmail ?? "",
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    message: input.message,
    metadata: input.metadata ?? {},
    createdAt: now,
  });
}
