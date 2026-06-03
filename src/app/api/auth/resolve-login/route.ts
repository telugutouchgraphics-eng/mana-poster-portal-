import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { resolveManagedAuthEmail } from "@/lib/server/managed-auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  identifier: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "creator"]),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "resolve_login",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    const resolved = await resolveManagedAuthEmail(adminDb, payload.identifier, payload.role);
    return NextResponse.json({
      ok: true,
      resolved: true,
      role: payload.role,
      contactEmail: resolved.contactEmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve login.";
    const status =
      message === "Forbidden" ? 403 : message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
