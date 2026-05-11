import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { resolveManagedAuthEmail } from "@/lib/server/managed-auth";

const requestSchema = z.object({
  identifier: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "creator"]),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = requestSchema.parse(await req.json());
    const resolved = await resolveManagedAuthEmail(adminDb, payload.identifier, payload.role);
    return NextResponse.json({
      ok: true,
      authEmail: resolved.authEmail,
      email: resolved.contactEmail,
      uid: resolved.uid,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve login.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
