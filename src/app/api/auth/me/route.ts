import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth, resolveVisibleRoles } from "@/lib/server/auth";
import { normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    const data = userSnap.data();
    const docRoles = normalizeRoles(data?.roles);
    const roles = resolveVisibleRoles(user.email, docRoles, user.roles);
    return NextResponse.json({
      ok: true,
      uid: user.uid,
      email: user.email,
      role: pickPrimaryRole(roles),
      roles,
      name: data?.name ?? null,
      creatorPublicId: data?.creatorPublicId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
