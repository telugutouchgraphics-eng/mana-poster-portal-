import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  loadAdminPushNotifications,
  uploadAdminAsset,
} from "@/lib/server/content-management";
import {
  cleanupExpiredPushHistory,
  createPushHistoryRecord,
  sendPushNotificationRecord,
  type PushAudience,
} from "@/lib/server/push-notifications";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const AUDIENCE_OPTIONS = new Set<PushAudience>(["all_users", "creators_only"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    await cleanupExpiredPushHistory();
    const notifications = await loadAdminPushNotifications();
    return NextResponse.json({
      ok: true,
      notifications,
      audiences: ["all_users", "creators_only"],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load push notifications.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    await cleanupExpiredPushHistory();
    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const requestedRoute = String(formData.get("route") ?? "home").trim() || "home";
    const audience = String(formData.get("audience") ?? "all_users").trim() as PushAudience;
    const route = audience === "creators_only" ? "creator_dashboard" : requestedRoute;
    const category = "";
    const image = formData.get("image");

    if (!title || !message) {
      return NextResponse.json(
        { ok: false, error: "Notification title and message are required." },
        { status: 400 },
      );
    }
    if (!AUDIENCE_OPTIONS.has(audience)) {
      return NextResponse.json(
        { ok: false, error: "Valid audience is required." },
        { status: 400 },
      );
    }
    const hasImage = image instanceof File && image.size > 0;
    if (hasImage && image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be 500 KB or smaller." }, { status: 400 });
    }
    if (hasImage && !ALLOWED_IMAGE_TYPES.has(image.type)) {
      return NextResponse.json({ ok: false, error: "Only PNG, JPG, or WEBP images are allowed." }, { status: 400 });
    }

    const scheduledFor: number | null = null;

    const now = Date.now();
    let imageUrl = "";
    let imagePath = "";
    if (hasImage) {
      const ext = image.type.includes("jpeg") || image.type.includes("jpg")
        ? "jpg"
        : image.type.includes("webp")
          ? "webp"
          : "png";
      const uploaded = await uploadAdminAsset(
        Buffer.from(await image.arrayBuffer()),
        image.type || "image/png",
        `portal_assets/push_notifications/${now}.${ext}`,
      );
      imageUrl = uploaded.imageUrl;
      imagePath = uploaded.filePath;
    }

    const record = await createPushHistoryRecord({
      title,
      message,
      titleKey: "",
      bodyKey: "",
      imageUrl,
      imagePath,
      route,
      audience,
      category,
      scheduledFor,
      createdByUid: actor.uid,
      createdByEmail: actor.email ?? "",
    });

    if (!scheduledFor || scheduledFor <= now) {
      await sendPushNotificationRecord(record);
    }

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: scheduledFor && scheduledFor > now
        ? "admin.push_notification.schedule"
        : "admin.push_notification.send",
      targetId: record.id,
      targetType: "pushNotification",
      message: `${scheduledFor && scheduledFor > now ? "Scheduled" : "Sent"} push notification: ${title}`,
      metadata: {
        route,
        imageUrl,
        audience,
        category,
        title,
        message,
        scheduledFor,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
