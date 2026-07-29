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

function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedValues(item));
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedValues(item)]);
    return Object.fromEntries(cleaned);
  }
  return value;
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
    metadata: removeUndefinedValues(input.metadata ?? {}),
    createdAt: now,
  });
}
