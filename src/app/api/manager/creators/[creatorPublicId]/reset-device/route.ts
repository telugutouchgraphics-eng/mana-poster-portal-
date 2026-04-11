import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireRole(req, ["manager", "admin"]);
    const { creatorPublicId } = await params;
    const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
    const creatorSnap = await creatorRef.get();
    if (!creatorSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Creator not found." },
        { status: 404 }
      );
    }

    const authUid = creatorSnap.data()?.authUid as string | undefined;
    if (authUid) {
      await adminDb.collection("users").doc(authUid).set(
        {
          activeDeviceId: null,
          activeDeviceMeta: null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
