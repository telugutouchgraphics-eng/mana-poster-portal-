import { NextRequest, NextResponse } from "next/server";
import {
  cleanupExpiredPushHistory,
  processScheduledPushNotifications,
} from "@/lib/server/push-notifications";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.PUSH_NOTIFICATION_CRON_SECRET;
    const incoming = req.headers.get("x-cron-secret") ?? "";

    if (!secret || incoming !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    await cleanupExpiredPushHistory();
    const processed = await processScheduledPushNotifications();
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process scheduled push notifications.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
