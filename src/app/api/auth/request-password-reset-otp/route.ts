import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetChallenge } from "@/lib/server/otp-auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  identifier: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "creator"]),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "request_password_reset_otp",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    const payload = requestSchema.parse(await req.json());
    const result = await createPasswordResetChallenge(payload.identifier, payload.role);
    return NextResponse.json({
      ok: true,
      challengeId: result.challengeId,
      maskedEmail: "your registered email",
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reset OTP.";
    const status = message === "Rate limit exceeded" ? 429 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
