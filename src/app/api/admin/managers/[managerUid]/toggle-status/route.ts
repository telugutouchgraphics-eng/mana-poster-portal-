import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { normalizeRoles } from "@/lib/server/role-utils";

interface Params {
  params: Promise<{ managerUid: string }>;
}

const requestSchema = z.object({
  managerStatus: z.enum(["active", "inactive"]),
});

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
    await requireRole(req, ["admin"]);
    const { managerUid } = await params;
    const payload = requestSchema.parse(await req.json());

    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !hasManagerRole(userSnap.data() as Record<string, unknown> | undefined)) {
      return NextResponse.json(
        { ok: false, error: "Manager not found." },
        { status: 404 }
      );
    }

    await adminAuth.updateUser(managerUid, {
      disabled: payload.managerStatus === "inactive",
    });
    await userRef.set(
      {
        managerStatus: payload.managerStatus,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, managerStatus: payload.managerStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update manager status.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
