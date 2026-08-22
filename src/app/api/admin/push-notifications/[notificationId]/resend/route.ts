import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import {
  createPushHistoryRecord,
  sendPushNotificationRecord,
  type PushHistoryRecord,
} from "@/lib/server/push-notifications";

type RouteParams = { params: Promise<{ notificationId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { notificationId } = await params;
    const snap = await adminDb.collection("adminPushNotifications").doc(notificationId).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    }
    const source = snap.data() as PushHistoryRecord;
    const record = await createPushHistoryRecord({
      title: source.title,
      message: source.message,
      titleKey: source.titleKey ?? "",
      bodyKey: source.bodyKey ?? "",
      imageUrl: source.imageUrl ?? "",
      imagePath: source.imagePath ?? "",
      route: source.route || "home",
      audience: source.audience,
      audienceSegment: source.audienceSegment,
      targetState: source.targetState ?? "",
      targetRegionIds: source.targetRegionIds ?? [],
      targetDistrict: source.targetDistrict ?? "",
      targetCity: source.targetCity ?? "",
      targetReligion: source.targetReligion ?? "all",
      category: source.category ?? "",
      scheduledFor: null,
      createdByUid: actor.uid,
      createdByEmail: actor.email ?? "",
    });
    await adminDb.collection("adminPushNotifications").doc(record.id).set(
      {
        resentFromId: notificationId,
      },
      { merge: true },
    );
    const delivery = await sendPushNotificationRecord(record);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.push_notification.resend",
      targetId: record.id,
      targetType: "pushNotification",
      message: `Resent push notification: ${record.title}`,
      metadata: { sourceNotificationId: notificationId },
    });
    return NextResponse.json({ ok: true, id: record.id, delivery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resend push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
