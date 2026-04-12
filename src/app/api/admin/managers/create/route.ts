import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { makeManagerPublicId } from "@/lib/server/manager-id";
import {
  isAppRole,
  mergeRoles,
  normalizeRoles,
  pickPrimaryRole,
} from "@/lib/server/role-utils";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const PERMANENT_ADMIN_EMAIL = "telugutouchgraphics@gmail.com";

const requestSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(64),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "admin_manager_create",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();
    const normalizedEmail = payload.email.toLowerCase();

    if (normalizedEmail === PERMANENT_ADMIN_EMAIL) {
      return NextResponse.json(
        { ok: false, error: "This permanent admin email cannot be assigned as manager." },
        { status: 409 }
      );
    }

    let managerUid: string;
    try {
      const existing = await adminAuth.getUserByEmail(normalizedEmail);
      managerUid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email: normalizedEmail,
        password: payload.password,
        displayName: payload.name,
      });
      managerUid = created.uid;
    }

    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    const legacyRole = userSnap.data()?.role;
    const existingRoles = mergeRoles(
      normalizeRoles(userSnap.data()?.roles),
      typeof legacyRole === "string" && isAppRole(legacyRole) ? [legacyRole] : []
    );
    const mergedRoles = mergeRoles(existingRoles, ["manager"]);
    const nextPrimaryRole = pickPrimaryRole(mergedRoles);

    await adminAuth.updateUser(managerUid, {
      password: payload.password,
      displayName: payload.name,
    });
    await adminAuth.setCustomUserClaims(managerUid, {
      role: nextPrimaryRole,
      roles: mergedRoles,
    });

    const managerPublicId = await adminDb.runTransaction(async (tx) => {
      const freshSnap = await tx.get(userRef);
      const existingPublicId = freshSnap.data()?.managerPublicId as string | undefined;
      if (existingPublicId && existingPublicId.trim().length > 0) {
        tx.set(
          userRef,
          {
            uid: managerUid,
            role: nextPrimaryRole,
            roles: mergedRoles,
            managerStatus: "active",
            email: normalizedEmail,
            name: payload.name,
            phone: payload.phone,
            updatedAt: now,
            createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
            managerAssignedByUid: actor.uid,
          },
          { merge: true }
        );
        return existingPublicId;
      }

      const counterRef = adminDb.collection("system").doc("counters");
      const counterSnap = await tx.get(counterRef);
      const currentSerial = (counterSnap.data()?.managerSerial as number) ?? 0;
      const nextSerial = currentSerial + 1;
      const nextPublicId = makeManagerPublicId(nextSerial);

      tx.set(
        counterRef,
        {
          managerSerial: nextSerial,
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        userRef,
        {
          uid: managerUid,
          managerPublicId: nextPublicId,
          role: nextPrimaryRole,
          roles: mergedRoles,
          managerStatus: "active",
          email: normalizedEmail,
          name: payload.name,
          phone: payload.phone,
          updatedAt: now,
          createdAt: userSnap.exists ? userSnap.data()?.createdAt ?? now : now,
          managerAssignedByUid: actor.uid,
        },
        { merge: true }
      );
      return nextPublicId;
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "manager_created",
      targetType: "manager_user",
      targetId: managerUid,
      message: "Manager account created or updated.",
      metadata: {
        managerPublicId,
        email: normalizedEmail,
      },
    });

    return NextResponse.json({
      ok: true,
      managerUid,
      managerPublicId,
      email: normalizedEmail,
      name: payload.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manager create failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
