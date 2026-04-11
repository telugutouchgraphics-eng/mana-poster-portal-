import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeRoles } from "@/lib/server/role-utils";

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
    await requireRole(req, ["admin"]);
    const { managerUid } = await params;
    const userRef = adminDb.collection("users").doc(managerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !hasManagerRole(userSnap.data() as Record<string, unknown> | undefined)) {
      return NextResponse.json(
        { ok: false, error: "Manager not found." },
        { status: 404 }
      );
    }

    await userRef.set(
      {
        activeDeviceId: null,
        activeDeviceMeta: null,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset manager device.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
