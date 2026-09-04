import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";
import { type PushAudienceSegment, type PushReligionTarget } from "@/lib/server/push-notifications";

const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function trimValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeAudienceSegment(value: unknown): PushAudienceSegment {
  const normalized = trimValue(value);
  if (
    normalized === "inactive_users" ||
    normalized === "subscribers" ||
    normalized === "non_subscribers"
  ) {
    return normalized;
  }
  return "all_area_users";
}

function normalizeReligion(value: unknown): PushReligionTarget {
  const normalized = trimValue(value).toLowerCase();
  if (normalized === "hindu" || normalized === "muslim" || normalized === "christian") {
    return normalized;
  }
  return "all";
}

function parseRegionIds(formData: FormData) {
  return Array.from(
    new Set(
      formData
        .getAll("targetRegionIds")
        .map((item) => trimValue(item))
        .filter(Boolean),
    ),
  );
}

type RouteParams = { params: Promise<{ notificationId: string }> };

async function deletePushImageIfUnused(imagePath: string | undefined, currentNotificationId: string) {
  const normalized = trimValue(imagePath);
  if (!normalized) {
    return;
  }
  const snap = await adminDb
    .collection("adminPushNotifications")
    .where("imagePath", "==", normalized)
    .limit(5)
    .get();
  const stillUsed = snap.docs.some((doc) => doc.id !== currentNotificationId);
  if (!stillUsed) {
    await deleteAdminAsset(normalized);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { notificationId } = await params;
    const ref = adminDb.collection("adminPushNotifications").doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    }
    const existing = snap.data() as { imagePath?: string };
    const formData = await req.formData();
    const title = trimValue(formData.get("title"));
    const message = trimValue(formData.get("message"));
    if (!title || !message) {
      return NextResponse.json({ ok: false, error: "Notification title and message are required." }, { status: 400 });
    }

    const image = formData.get("image");
    let imageUrl: string | undefined;
    let imagePath: string | undefined;
    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_UPLOAD_BYTES) {
        return NextResponse.json({ ok: false, error: "Image must be 500 KB or smaller." }, { status: 400 });
      }
      if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
        return NextResponse.json({ ok: false, error: "Only PNG, JPG, or WEBP images are allowed." }, { status: 400 });
      }
      const now = Date.now();
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
      await deletePushImageIfUnused(existing.imagePath, notificationId);
    }

    await ref.set(
      {
        title,
        message,
        route: trimValue(formData.get("route")) || "home",
        audienceSegment: normalizeAudienceSegment(formData.get("audienceSegment")),
        targetState: trimValue(formData.get("targetState")),
        targetRegionIds: parseRegionIds(formData),
        targetDistrict: trimValue(formData.get("targetDistrict")),
        targetCity: trimValue(formData.get("targetCity")),
        targetReligion: normalizeReligion(formData.get("targetReligion")),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imagePath ? { imagePath } : {}),
        updatedAt: Date.now(),
      },
      { merge: true },
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.push_notification.update",
      targetId: notificationId,
      targetType: "pushNotification",
      message: `Updated push notification history: ${title}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { notificationId } = await params;
    const ref = adminDb.collection("adminPushNotifications").doc(notificationId);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as { title?: string; imagePath?: string }) : null;
    if (!data) {
      return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    }
    await ref.delete();
    await deletePushImageIfUnused(data.imagePath, notificationId);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.push_notification.delete",
      targetId: notificationId,
      targetType: "pushNotification",
      message: `Deleted push notification history: ${data.title ?? notificationId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
