import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  loadAdminPushNotifications,
  uploadAdminAsset,
} from "@/lib/server/content-management";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const notifications = await loadAdminPushNotifications();
    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load push notifications.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const route = String(formData.get("route") ?? "home").trim() || "home";
    const image = formData.get("image");

    if (!title || !message) {
      return NextResponse.json(
        { ok: false, error: "Title and message are required." },
        { status: 400 },
      );
    }
    if (!(image instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Notification image is required." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const ext = image.type.includes("jpeg")
      ? "jpg"
      : image.type.includes("webp")
        ? "webp"
        : "png";
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `portal_assets/push_notifications/${now}.${ext}`,
    );

    const ref = adminDb.collection("adminPushNotifications").doc();

    try {
      await adminMessaging.send({
        topic: "all_users",
        notification: {
          title,
          body: message,
          imageUrl: uploaded.imageUrl,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "mana_poster_general",
            imageUrl: uploaded.imageUrl,
          },
        },
        data: {
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          route,
          imageUrl: uploaded.imageUrl,
          source: "admin_manual_push",
        },
      });

      await ref.set({
        id: ref.id,
        title,
        message,
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.filePath,
        route,
        audience: "all_users",
        status: "sent",
        createdAt: now,
        updatedAt: now,
        sentAt: now,
        createdByUid: actor.uid,
        createdByEmail: actor.email ?? "",
      });

      await writeAuditLog({
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        action: "admin.push_notification.send",
        targetId: ref.id,
        targetType: "pushNotification",
        message: `Sent app push notification: ${title}`,
        metadata: {
          route,
          imageUrl: uploaded.imageUrl,
          audience: "all_users",
        },
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : "Unable to send push notification.";
      await ref.set({
        id: ref.id,
        title,
        message,
        imageUrl: uploaded.imageUrl,
        imagePath: uploaded.filePath,
        route,
        audience: "all_users",
        status: "failed",
        errorMessage: failureMessage,
        createdAt: now,
        updatedAt: now,
        sentAt: now,
        createdByUid: actor.uid,
        createdByEmail: actor.email ?? "",
      });
      return NextResponse.json(
        { ok: false, error: failureMessage },
        { status: 500 },
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
