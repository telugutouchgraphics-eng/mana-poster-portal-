import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredPosters } from "@/lib/server/poster-cleanup";
import { requireRole } from "@/lib/server/auth";

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret =
    process.env.CRON_SECRET ||
    process.env.PUSH_NOTIFICATION_CRON_SECRET ||
    process.env.ADMIN_CRON_SECRET;

  const headerSecret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (cronSecret && headerSecret && headerSecret.trim() === cronSecret.trim()) {
    return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize via CRON secret or admin role
    const isCron = isAuthorizedCron(req);
    if (!isCron) {
      await requireRole(req, ["admin"]);
    }

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const maxDeletions = searchParams.get("limit")
      ? Math.max(1, Math.min(2000, Number(searchParams.get("limit"))))
      : 500;

    const result = await cleanupExpiredPosters({ dryRun, maxDeletions });
    return NextResponse.json({
      dryRun,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cleanup execution failed.";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isCron = isAuthorizedCron(req);
    if (!isCron) {
      await requireRole(req, ["admin"]);
    }

    let dryRun = false;
    let maxDeletions = 500;

    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (typeof body.dryRun === "boolean") {
          dryRun = body.dryRun;
        }
        if (typeof body.limit === "number") {
          maxDeletions = Math.max(1, Math.min(2000, body.limit));
        }
      }
    } catch {
      // Body parsing optional
    }

    const result = await cleanupExpiredPosters({ dryRun, maxDeletions });
    return NextResponse.json({
      dryRun,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Cleanup execution failed.";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
