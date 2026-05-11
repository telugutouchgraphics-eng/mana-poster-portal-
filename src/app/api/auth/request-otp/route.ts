import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createOtpChallenge } from "@/lib/server/otp-auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  identifier: z.string().trim().min(2),
  role: z.enum(["admin", "manager", "creator"]),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "request_login_otp",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const payload = requestSchema.parse(await req.json());
    const result = await createOtpChallenge(payload.identifier, payload.role, payload.password);
    return NextResponse.json({
      ok: true,
      challengeId: result.challengeId,
      authEmail: result.authEmail,
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send OTP.";
    const status =
      message === "Rate limit exceeded" ? 429 : message.includes("credentials") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
