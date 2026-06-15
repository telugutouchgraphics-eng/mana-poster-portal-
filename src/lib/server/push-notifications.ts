import { randomUUID } from "crypto";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { deleteAdminAsset } from "@/lib/server/content-management";

export type PushAudience = "all_users" | "creators_only" | "area_users";
export type PushStatus = "scheduled" | "sent" | "failed" | "processing";
const PUSH_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface PushTemplateOption {
  id: "morning" | "afternoon" | "night";
  titleKey: string;
  bodyKey: string;
  label: string;
}

export const PUSH_TEMPLATE_OPTIONS: PushTemplateOption[] = [
  {
    id: "morning",
    titleKey: "morning_title",
    bodyKey: "morning_body",
    label: "Good Morning",
  },
  {
    id: "afternoon",
    titleKey: "afternoon_title",
    bodyKey: "afternoon_body",
    label: "Good Afternoon",
  },
  {
    id: "night",
    titleKey: "night_title",
    bodyKey: "night_body",
    label: "Good Night",
  },
];

export interface PushHistoryRecord {
  id: string;
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  imageUrl: string;
  imagePath: string;
  route: string;
  audience: PushAudience;
  targetState: string;
  targetDistrict: string;
  targetCity: string;
  category: string;
  status: PushStatus;
  targetCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledFor: number | null;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  sentAt: number | null;
  expiresAt: number | null;
  createdByUid: string;
  createdByEmail: string;
  routeLabel?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function trimValue(value: unknown) {
  return String(value ?? "").trim();
}

function uniqueTokens(
  values: Array<{ token: string; refPath?: string }>,
): Array<{ token: string; refPath?: string }> {
  const seen = new Set<string>();
  const result: Array<{ token: string; refPath?: string }> = [];
  for (const item of values) {
    const token = trimValue(item.token);
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    result.push({ token, refPath: item.refPath });
  }
  return result;
}

function isInvalidTokenMessage(message: string) {
  return (
    /registration-token-not-registered/i.test(message) ||
    /requested entity was not found/i.test(message) ||
    /notregistered/i.test(message)
  );
}

async function cleanupTokenPath(refPath?: string) {
  if (!refPath) {
    return;
  }
  try {
    await adminDb.doc(refPath).delete();
  } catch {}
}

async function loadCreatorUids(): Promise<string[]> {
  const [primarySnap, rolesSnap] = await Promise.all([
    adminDb.collection("users").where("role", "==", "creator").get(),
    adminDb.collection("users").where("roles", "array-contains", "creator").get(),
  ]);
  const ids = new Set<string>();
  for (const doc of [...primarySnap.docs, ...rolesSnap.docs]) {
    ids.add(doc.id);
  }
  return Array.from(ids);
}

async function loadUserDeviceTokens(userIds: string[]) {
  const tokens: Array<{ token: string; refPath?: string }> = [];
  for (const uid of userIds) {
    const snap = await adminDb.collection("users").doc(uid).collection("deviceTokens").get();
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      tokens.push({
        token: trimValue(data.token),
        refPath: doc.ref.path,
      });
    }
  }
  return uniqueTokens(tokens);
}

function cleanLocationText(value: unknown) {
  return trimValue(value).toLowerCase();
}

function readUserArea(data: FirebaseFirestore.DocumentData) {
  const area = data.locationArea;
  if (area && typeof area === "object" && !Array.isArray(area)) {
    const city = trimValue(area.city);
    const state = trimValue(area.state);
    return {
      state,
      district: trimValue(area.district) || city || state,
      city,
    };
  }
  return { state: "", district: "", city: "" };
}

function areaMatches(
  area: { state: string; district: string; city: string },
  target: { state: string; district: string; city: string },
) {
  const targetState = cleanLocationText(target.state);
  const targetDistrict = cleanLocationText(target.district);
  const targetCity = cleanLocationText(target.city);
  if (!targetState && !targetDistrict && !targetCity) {
    return false;
  }
  return (
    (!targetState || cleanLocationText(area.state) === targetState) &&
    (!targetDistrict || cleanLocationText(area.district) === targetDistrict) &&
    (!targetCity || cleanLocationText(area.city) === targetCity)
  );
}

async function loadAreaUserUids(target: { state: string; district: string; city: string }) {
  const snap = await adminDb.collection("users").where("locationEnabled", "==", true).get();
  const ids: string[] = [];
  for (const doc of snap.docs) {
    if (areaMatches(readUserArea(doc.data()), target)) {
      ids.push(doc.id);
    }
  }
  return ids;
}

async function resolveAudienceTargets(
  audience: PushAudience,
  targetLocation: { state: string; district: string; city: string },
) {
  if (audience === "all_users") {
    return { mode: "topic" as const, topic: "all_users", targets: [] as Array<{ token: string; refPath?: string }> };
  }

  if (audience === "creators_only") {
    const creatorUids = await loadCreatorUids();
    return {
      mode: "tokens" as const,
      topic: "",
      targets: await loadUserDeviceTokens(creatorUids),
    };
  }

  if (audience === "area_users") {
    const userUids = await loadAreaUserUids(targetLocation);
    return {
      mode: "tokens" as const,
      topic: "",
      targets: await loadUserDeviceTokens(userUids),
    };
  }

  return { mode: "tokens" as const, topic: "", targets: [] as Array<{ token: string; refPath?: string }> };
}

export function buildPushData(payload: {
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  route: string;
  category: string;
  imageUrl: string;
}) {
  return {
    click_action: "FLUTTER_NOTIFICATION_CLICK",
    route: trimValue(payload.route) || "home",
    category: trimValue(payload.category),
    imageUrl: trimValue(payload.imageUrl),
    posterImage: trimValue(payload.imageUrl),
    userPhoto: "",
    title: trimValue(payload.title),
    body: trimValue(payload.message),
    title_key: trimValue(payload.titleKey),
    body_key: trimValue(payload.bodyKey),
    source: "admin_push_portal",
  };
}

export async function sendPushNotificationRecord(record: PushHistoryRecord) {
  const dataPayload = buildPushData({
    title: record.title,
    message: record.message,
    titleKey: record.titleKey,
    bodyKey: record.bodyKey,
    route: record.route,
    category: record.category,
    imageUrl: record.imageUrl,
  });
  const ref = adminDb.collection("adminPushNotifications").doc(record.id);
  const imageUrl = trimValue(record.imageUrl);
  const notificationPayload = {
    title: trimValue(record.title),
    body: trimValue(record.message),
    ...(imageUrl ? { imageUrl } : {}),
  };
  const androidNotification = imageUrl ? { imageUrl } : undefined;

  await ref.set(
    {
      status: "processing",
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  const target = await resolveAudienceTargets(record.audience, {
    state: record.targetState,
    district: record.targetDistrict,
    city: record.targetCity,
  });

  if (target.mode === "topic") {
    const sentAt = Date.now();
    await adminMessaging.send({
      topic: target.topic,
      notification: notificationPayload,
      data: dataPayload,
      android: {
        priority: "high",
        notification: androidNotification,
      },
    });

    await ref.set(
      {
        status: "sent",
        sentAt,
        expiresAt: sentAt + PUSH_HISTORY_RETENTION_MS,
        updatedAt: sentAt,
        targetCount: 1,
        deliveredCount: 1,
        failedCount: 0,
        errorMessage: "",
      },
      { merge: true },
    );

    return { targetCount: 1, deliveredCount: 1, failedCount: 0 };
  }

  const tokens = target.targets;
  if (tokens.length === 0) {
    const sentAt = Date.now();
    await ref.set(
      {
        status: "failed",
        sentAt,
        expiresAt: sentAt + PUSH_HISTORY_RETENTION_MS,
        updatedAt: sentAt,
        targetCount: 0,
        deliveredCount: 0,
        failedCount: 0,
        errorMessage: "No matching device tokens found for this audience.",
      },
      { merge: true },
    );
    return { targetCount: 0, deliveredCount: 0, failedCount: 0 };
  }

  let deliveredCount = 0;
  let failedCount = 0;

  for (const group of chunk(tokens, 500)) {
    const response = await adminMessaging.sendEachForMulticast({
      tokens: group.map((item) => item.token),
      notification: notificationPayload,
      data: dataPayload,
      android: {
        priority: "high",
        notification: androidNotification,
      },
    });

    deliveredCount += response.successCount;
    failedCount += response.failureCount;

    for (let index = 0; index < response.responses.length; index += 1) {
      const result = response.responses[index];
      const tokenItem = group[index];
      if (result.success || !result.error) {
        continue;
      }
      const message = result.error.message || "";
      if (isInvalidTokenMessage(message)) {
        await cleanupTokenPath(tokenItem?.refPath);
      }
    }
  }

  const sentAt = Date.now();
  await ref.set(
    {
      status: failedCount > 0 && deliveredCount === 0 ? "failed" : "sent",
      sentAt,
      expiresAt: sentAt + PUSH_HISTORY_RETENTION_MS,
      updatedAt: sentAt,
      targetCount: tokens.length,
      deliveredCount,
      failedCount,
      errorMessage: failedCount > 0 && deliveredCount === 0 ? "Push delivery failed for all matched devices." : "",
    },
    { merge: true },
  );

  return { targetCount: tokens.length, deliveredCount, failedCount };
}

export async function createPushHistoryRecord(input: {
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  imageUrl: string;
  imagePath: string;
  route: string;
  audience: PushAudience;
  targetState: string;
  targetDistrict: string;
  targetCity: string;
  category: string;
  scheduledFor: number | null;
  createdByUid: string;
  createdByEmail: string;
}) {
  const now = Date.now();
  const id = randomUUID();
  const record: PushHistoryRecord = {
    id,
    title: input.title,
    message: input.message,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    imageUrl: input.imageUrl,
    imagePath: input.imagePath,
    route: trimValue(input.route) || "home",
    audience: input.audience,
    targetState: trimValue(input.targetState),
    targetDistrict: trimValue(input.targetDistrict),
    targetCity: trimValue(input.targetCity),
    category: trimValue(input.category),
    status: input.scheduledFor && input.scheduledFor > now ? "scheduled" : "processing",
    targetCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    scheduledFor: input.scheduledFor,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
    expiresAt: null,
    createdByUid: input.createdByUid,
    createdByEmail: input.createdByEmail,
  };
  await adminDb.collection("adminPushNotifications").doc(id).set(record);
  return record;
}

export async function cleanupExpiredPushHistory(limit = 50) {
  const now = Date.now();
  const snap = await adminDb
    .collection("adminPushNotifications")
    .where("expiresAt", "<=", now)
    .limit(limit)
    .get();

  if (snap.empty) {
    return [];
  }

  const deleted: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Partial<PushHistoryRecord>;
    const imagePath = trimValue(data.imagePath);
    if (imagePath) {
      try {
        await deleteAdminAsset(imagePath);
      } catch {}
    }
    await doc.ref.delete();
    deleted.push(doc.id);
  }

  return deleted;
}

export async function processScheduledPushNotifications(limit = 20) {
  await cleanupExpiredPushHistory();
  const now = Date.now();
  const snap = await adminDb
    .collection("adminPushNotifications")
    .where("status", "==", "scheduled")
    .where("scheduledFor", "<=", now)
    .limit(limit)
    .get();

  const processed: string[] = [];
  for (const doc of snap.docs) {
    const record = doc.data() as PushHistoryRecord;
    await sendPushNotificationRecord({ ...record, id: doc.id });
    processed.push(doc.id);
  }
  return processed;
}
