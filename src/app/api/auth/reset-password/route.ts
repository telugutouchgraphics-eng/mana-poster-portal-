import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetManagedPasswordAfterOtp } from "@/lib/server/otp-auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  challengeId: z.string().trim().min(8),
  otp: z.string().trim().regex(/^\d{6}$/),
  password: z.string().trim().min(6).max(64),
});

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit(req, {
      key: "complete_password_reset",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    const payload = requestSchema.parse(await req.json());
    await resetManagedPasswordAfterOtp({
      challengeId: payload.challengeId,
      otp: payload.otp,
      nextPassword: payload.password,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password.";
    const status =
      message === "Rate limit exceeded"
        ? 429
        : message.includes("OTP") || message.includes("session")
          ? 401
          : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
