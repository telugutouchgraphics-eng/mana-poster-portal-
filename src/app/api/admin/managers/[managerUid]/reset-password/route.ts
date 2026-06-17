import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { normalizeRoles } from "@/lib/server/role-utils";
import { buildPortalLoginUrl, generatePortalPasswordResetLink } from "@/lib/server/auth-links";
import { buildRoleAuthEmail } from "@/lib/server/managed-auth";
import { generateManagedPassword } from "@/lib/server/password";
import { assertRecordOverlapsActorRegions } from "@/lib/server/region-scope";

interface Params {
  params: Promise<{ managerUid: string }>;
}

function hasManagerRole(data: Record<string, unknown> | undefined): boolean {
  if (!data) {
    return false;
  }
  if (data.role === "manager") {
    return true;
  }
  return normalizeRoles(data.roles).includes("manager");
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { managerUid } = await params;

    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !hasManagerRole(userSnap.data() as Record<string, unknown> | undefined)) {
      return NextResponse.json(
        { ok: false, error: "Manager not found." },
        { status: 404 }
      );
    }
    await assertRecordOverlapsActorRegions(actor, userSnap.data() as Record<string, unknown>);

    const authEmail = String(userSnap.data()?.authEmail ?? "").trim().toLowerCase();
    const email = String(userSnap.data()?.email ?? "").trim().toLowerCase();
    const resolvedAuthEmail = authEmail || buildRoleAuthEmail(email, "manager");
    const seedPassword = await generateManagedPassword(adminDb, "manager");
    await adminAuth.updateUser(managerUid, {
      password: seedPassword,
      disabled: false,
      email: resolvedAuthEmail,
    });
    await userRef.set(
      {
        managerStatus: "active",
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    const recoveryResetLink = await generatePortalPasswordResetLink(resolvedAuthEmail, "manager");

    return NextResponse.json({
      ok: true,
      loginEmail: email,
      initialPassword: seedPassword,
      loginLink: buildPortalLoginUrl("manager"),
      recoveryResetLink,
      resetLink: recoveryResetLink,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset manager password.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
