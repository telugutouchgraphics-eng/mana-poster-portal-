import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/server/auth";

const requestSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const payload = requestSchema.parse(await req.json());
    const userRef = adminDb.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    const activeDeviceId = userSnap.data()?.activeDeviceId as
      | string
      | null
      | undefined;

    if (!activeDeviceId || activeDeviceId === payload.deviceId) {
      await userRef.set(
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
    const message = error instanceof Error ? error.message : "Logout failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
