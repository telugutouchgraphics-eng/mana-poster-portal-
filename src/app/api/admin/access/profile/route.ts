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
      key: "admin_profile_update",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const normalizedEmail = roleContactEmail(
      roleContactEmail(payload.email.toLowerCase(), "admin"),
      "landing",
    );
    const authEmail = buildRoleAuthEmail(normalizedEmail, "landing");
    const nextPassword = payload.password?.trim() ?? "";
    const now = Date.now();

    let adminUid: string;
    try {
      const landingAdmin = await adminAuth.getUserByEmail(authEmail);
      adminUid = landingAdmin.uid;
      await adminAuth.updateUser(adminUid, {
        email: authEmail,
        ...(nextPassword.length > 0 ? { password: nextPassword } : {}),
        emailVerified: true,
        disabled: false,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (
        code !== "auth/user-not-found"
      ) {
        throw error;
      }
      if (nextPassword.length === 0) {
        throw new Error("Password is required to create landing admin login.");
      }
      const created = await adminAuth.createUser({
        email: authEmail,
        password: nextPassword,
        emailVerified: true,
        disabled: false,
      });
      adminUid = created.uid;
    }

    await adminAuth.setCustomUserClaims(adminUid, {
      landingAdmin: true,
    });

    await adminDb.collection("users").doc(adminUid).set(
      {
        uid: adminUid,
        role: "user",
        roles: [],
        email: normalizedEmail,
        authEmail,
        adminManaged: true,
        adminStatus: "active",
        name: "Landing Page Admin",
        loginPassword: FieldValue.delete(),
        updatedAt: now,
      },
      { merge: true },
    );

    await adminDb.collection("websiteConfig").doc("websiteAdminAccess").set(
      {
        primaryEmail: normalizedEmail,
        allowedEmails: [normalizedEmail],
        authEmail,
        updatedAt: now,
        updatedByUid: actor.uid,
        updatedByEmail: actor.email ?? null,
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin_profile_updated",
      targetType: "admin_user",
      targetId: adminUid,
      message: "Admin login credentials updated.",
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
    const message = error instanceof Error ? error.message : "Admin profile update failed.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
