import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { buildRoleAuthEmail, roleContactEmail } from "@/lib/server/managed-auth";
import { FieldValue } from "firebase-admin/firestore";

const requestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(8).max(64).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "dashboard_admin_profile_update",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const normalizedEmail = roleContactEmail(payload.email.toLowerCase(), "admin");
    const authEmail = buildRoleAuthEmail(normalizedEmail, "admin");
    const nextPassword = payload.password?.trim() ?? "";
    const now = Date.now();

    await adminAuth.updateUser(actor.uid, {
      email: authEmail,
      ...(nextPassword.length > 0 ? { password: nextPassword } : {}),
    });

    await adminDb.collection("users").doc(actor.uid).set(
      {
        uid: actor.uid,
        email: normalizedEmail,
        authEmail,
        dashboardAdminManaged: true,
        dashboardAdminStatus: "active",
        loginPassword: FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "dashboard_admin_profile_updated",
      targetType: "dashboard_admin_user",
      targetId: actor.uid,
      message: "Dashboard admin login credentials updated.",
      metadata: {
        email: normalizedEmail,
        authEmail,
        passwordChanged: nextPassword.length > 0,
      },
    });

    return NextResponse.json({
      ok: true,
      email: normalizedEmail,
      passwordChanged: nextPassword.length > 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Dashboard admin profile update failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
