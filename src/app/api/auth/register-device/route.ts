import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth, resolveVisibleRoles } from "@/lib/server/auth";
import { normalizeRoles, pickPrimaryRole } from "@/lib/server/role-utils";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  deviceId: z.string().trim().min(8).max(128),
  platform: z.string().trim().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "register_device",
      limit: 25,
      windowMs: 10 * 60 * 1000,
    });
    const user = await requireAuth(req);
    const payload = requestSchema.parse(await req.json());
    const now = Date.now();

    const userRef = adminDb.collection("users").doc(user.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const docRoles = normalizeRoles(userData?.roles);
    const roles = resolveVisibleRoles(user.email, docRoles, user.roles);
    const role = pickPrimaryRole(roles);
    const hasCreatorRole = roles.includes("creator");
    const shouldValidateCreatorAccess = role === "creator";

    if (hasCreatorRole && shouldValidateCreatorAccess) {
      const creatorPublicId = String(userData?.creatorPublicId ?? "").trim();
      if (!creatorPublicId) {
        return NextResponse.json(
          {
            ok: false,
            error: "Creator access is not linked to this account.",
          },
          { status: 403 }
        );
      }

      const creatorSnap = await adminDb
        .collection("creatorProfiles")
        .doc(creatorPublicId)
        .get();
      const creatorStatus = String(creatorSnap.data()?.status ?? "pending_invite");
      if (!creatorSnap.exists || creatorStatus !== "active") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Creator access is disabled by admin/manager. Contact support to re-enable access.",
          },
          { status: 403 }
        );
      }
    }

    await userRef.set(
      {
        activeDeviceId: payload.deviceId,
        activeDeviceMeta: {
          userAgent: req.headers.get("user-agent") ?? undefined,
          platform: payload.platform ?? "web",
          lastSeenAt: now,
        },
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, role, roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Device registration failed.";
    const status =
      message.includes("token") ? 401 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
