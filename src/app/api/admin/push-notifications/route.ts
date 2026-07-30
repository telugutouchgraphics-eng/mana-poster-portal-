import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";
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
const AUDIENCE_OPTIONS = new Set<PushAudience>(["area_users"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function regionForStateName(stateName: string) {
  const normalized = normalize(stateName);
  return DASHBOARD_REGIONS.find((region) => normalize(region.name) === normalized) ?? null;
}

function regionsForIds(regionIds: string[]) {
  const regionMap = new Map(DASHBOARD_REGIONS.map((region) => [region.id, region]));
  return regionIds
    .map((regionId) => regionMap.get(regionId))
    .filter((region): region is (typeof DASHBOARD_REGIONS)[number] => Boolean(region));
}

async function actorRegionContext(actor: Awaited<ReturnType<typeof requireRole>>) {
  const allowedRegionIds = await loadActorAllowedRegionIds(actor);
  const hasAllRegions = allowedRegionIds.length === DASHBOARD_REGIONS.length;
  return { allowedRegionIds, hasAllRegions };
}

function cleanRegionIds(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function notificationVisibleToActor(
  item: { audience: PushAudience; targetState?: string; targetRegionIds?: string[] },
  allowedRegionIds: string[],
  hasAllRegions: boolean,
) {
  if (item.audience !== "area_users") {
    return false;
  }
  const targetRegionIds = cleanRegionIds(item.targetRegionIds);
  if (targetRegionIds.length > 0) {
    return hasAllRegions || targetRegionIds.some((regionId) => allowedRegionIds.includes(regionId));
  }
  const region = regionForStateName(String(item.targetState ?? ""));
  return Boolean(region && (hasAllRegions || allowedRegionIds.includes(region.id)));
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { allowedRegionIds, hasAllRegions } = await actorRegionContext(actor);
    await cleanupExpiredPushHistory();
    const notifications = (await loadAdminPushNotifications()).filter((item) =>
      notificationVisibleToActor(item, allowedRegionIds, hasAllRegions),
    );
    return NextResponse.json({
      ok: true,
      notifications,
      audiences: ["area_users"],
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
    const { allowedRegionIds } = await actorRegionContext(actor);
    await cleanupExpiredPushHistory();
    const formData = await req.formData();
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const requestedRoute = String(formData.get("route") ?? "home").trim() || "home";
    const audience = String(formData.get("audience") ?? "area_users").trim() as PushAudience;
    const route = requestedRoute;
    const category = "";
    const targetState = String(formData.get("targetState") ?? "").trim();
    const requestedRegionIds = Array.from(
      new Set(
        formData
          .getAll("targetRegionIds")
          .map((item) => String(item ?? "").trim())
          .filter(Boolean),
      ),
    );
    const targetDistrict = String(formData.get("targetDistrict") ?? "").trim();
    const targetCity = String(formData.get("targetCity") ?? "").trim();
    const requestedReligion = String(formData.get("targetReligion") ?? "all").trim().toLowerCase();
    const targetReligion =
      requestedReligion === "hindu" || requestedReligion === "muslim" || requestedReligion === "christian"
        ? requestedReligion
        : "all";
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
    if (audience !== "area_users") {
      return NextResponse.json(
        { ok: false, error: "Push notifications must target a selected State / UT." },
        { status: 403 },
      );
    }
    const fallbackTargetRegion = audience === "area_users" && targetState ? regionForStateName(targetState) : null;
    const targetRegions = regionsForIds(
      requestedRegionIds.length > 0
        ? requestedRegionIds
        : fallbackTargetRegion
          ? [fallbackTargetRegion.id]
          : [],
    );
    if (audience === "area_users" && targetRegions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Select at least one valid State / UT for area targeting." },
        { status: 400 },
      );
    }
    if (targetRegions.length !== (requestedRegionIds.length || (fallbackTargetRegion ? 1 : 0))) {
      return NextResponse.json(
        { ok: false, error: "One or more selected State / UT values are invalid." },
        { status: 400 },
      );
    }
    const forbiddenRegion = targetRegions.find((targetRegion) => !allowedRegionIds.includes(targetRegion.id));
    if (forbiddenRegion) {
      return NextResponse.json(
        { ok: false, error: "Forbidden State / UT target." },
        { status: 403 },
      );
    }
    if (targetRegions.length > 1 && (targetDistrict || targetCity)) {
      return NextResponse.json(
        { ok: false, error: "District and city targeting is available only when one State / UT is selected." },
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
    const targetRegionIds = targetRegions.map((targetRegion) => targetRegion.id);
    const targetStateNames = targetRegions.map((targetRegion) => targetRegion.name).join(", ");
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
      targetState: targetStateNames,
      targetRegionIds,
      targetDistrict,
      targetCity,
      targetReligion,
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
        targetState: targetStateNames,
        targetRegionIds,
        targetDistrict,
        targetCity,
        targetReligion,
        category,
        title,
        message,
        scheduledFor,
        regionIds: targetRegionIds,
        regionNames: targetStateNames,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to send push notification.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
