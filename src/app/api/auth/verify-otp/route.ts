import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setOtpSessionCookie, verifyOtpChallenge } from "@/lib/server/otp-auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  challengeId: z.string().trim().min(8),
  otp: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "verify_login_otp",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    const payload = requestSchema.parse(await req.json());
    const verified = await verifyOtpChallenge(payload.challengeId, payload.otp);
    await setOtpSessionCookie(verified.uid, verified.sessionExpiresAt);
    return NextResponse.json({
      ok: true,
      authEmail: verified.authEmail,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify OTP.";
    const status =
      message === "Rate limit exceeded"
        ? 429
        : message.includes("Invalid OTP") || message.includes("OTP")
          ? 401
          : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
