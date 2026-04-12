import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import type { NextRequest } from "next/server";

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

function requestFingerprint(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
  const userAgent = req.headers.get("user-agent") ?? "";
  const raw = `${forwardedFor}|${userAgent}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

export async function enforceRateLimit(
  req: NextRequest,
  options: RateLimitOptions,
): Promise<void> {
  const now = Date.now();
  const bucket = Math.floor(now / options.windowMs);
  const fingerprint = requestFingerprint(req);
  const docId = `${options.key}:${fingerprint}:${bucket}`;
  const ref = adminDb.collection("apiRateLimits").doc(docId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const currentCount = Number(snap.data()?.count ?? 0);
    if (currentCount >= options.limit) {
      throw new Error("Rate limit exceeded");
    }
    tx.set(
      ref,
      {
        key: options.key,
        fingerprint,
        count: currentCount + 1,
        bucket,
        windowMs: options.windowMs,
        updatedAt: now,
        expiresAt: now + options.windowMs,
      },
      { merge: true },
    );
  });
}
