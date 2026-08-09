import { randomUUID } from "crypto";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { deleteAdminAsset } from "@/lib/server/content-management";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

export type PushAudience = "all_users" | "creators_only" | "area_users";
export type PushAudienceSegment =
  | "all_area_users"
  | "daily_active_users"
  | "active_users"
  | "monthly_active_users"
  | "inactive_users"
  | "subscribers"
  | "non_subscribers";
export type PushReligionTarget = "all" | "hindu" | "muslim" | "christian";
export type PushStatus = "scheduled" | "sent" | "failed" | "processing";
const PUSH_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;
const DAILY_ACTIVE_USER_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MONTHLY_ACTIVE_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

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
  audienceSegment?: PushAudienceSegment;
  targetState: string;
  targetRegionIds?: string[];
  targetDistrict: string;
  targetCity: string;
  targetReligion?: PushReligionTarget;
  category: string;
  status: PushStatus;
  matchedUserCount?: number;
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

function readTimestampMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const maybeTimestamp = value as { toMillis?: () => number };
    const millis = maybeTimestamp.toMillis?.();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

function notificationPaletteIndex(categoryKey: string) {
  const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  let hash = 0;
  for (const char of categoryKey) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return String(Math.abs(daySeed + hash) % 5);
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

function tokenDocId(token: string) {
  return token.replace(/\//g, "_");
}

async function tokenBelongsToUid(token: string, uid: string) {
  const publicSnap = await adminDb
    .collection("publicDeviceTokens")
    .doc(tokenDocId(token))
    .get();
  if (!publicSnap.exists) {
    return true;
  }
  const ownerUid = trimValue(publicSnap.data()?.uid);
  return !ownerUid || ownerUid === uid;
}

async function loadAllUserUidsForReligion(targetReligion: PushReligionTarget): Promise<string[]> {
  const normalizedReligion = normalizeReligionTarget(targetReligion);
  const snap = await adminDb.collection("users").get();
  return snap.docs
    .filter((doc) => userReligionMatches(doc.data(), normalizedReligion))
    .map((doc) => doc.id);
}

async function loadCreatorUids(targetReligion: PushReligionTarget = "all"): Promise<string[]> {
  const [primarySnap, rolesSnap] = await Promise.all([
    adminDb.collection("users").where("role", "==", "creator").get(),
    adminDb.collection("users").where("roles", "array-contains", "creator").get(),
  ]);
  const normalizedReligion = normalizeReligionTarget(targetReligion);
  const ids = new Set<string>();
  for (const doc of [...primarySnap.docs, ...rolesSnap.docs]) {
    if (!userReligionMatches(doc.data(), normalizedReligion)) {
      continue;
    }
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
      const token = trimValue(data.token);
      if (!token) {
        continue;
      }
      if (!(await tokenBelongsToUid(token, uid))) {
        await cleanupTokenPath(doc.ref.path);
        continue;
      }
      tokens.push({
        token,
        refPath: doc.ref.path,
      });
    }
  }
  return uniqueTokens(tokens);
}

function cleanLocationText(value: unknown) {
  return trimValue(value).toLowerCase();
}

function regionIdForStateName(stateName: string) {
  const normalized = cleanLocationText(stateName);
  return (
    DASHBOARD_REGIONS.find((region) => cleanLocationText(region.name) === normalized)
      ?.id ?? ""
  );
}

function regionNameForId(regionId: string) {
  return (
    DASHBOARD_REGIONS.find((region) => region.id === trimValue(regionId))
      ?.name ?? ""
  );
}

function readUserArea(data: FirebaseFirestore.DocumentData) {
  const area = data.locationArea;
  if (area && typeof area === "object" && !Array.isArray(area)) {
    return {
      state: trimValue(area.state),
      district: trimValue(area.district),
      city: trimValue(area.city),
    };
  }
  return { state: "", district: "", city: "" };
}

function selectedRegionMatches(
  data: FirebaseFirestore.DocumentData,
  targetRegionId: string,
  targetState: string,
) {
  const selectedRegion = cleanLocationText(data.selectedRegion);
  if (targetRegionId && selectedRegion === cleanLocationText(targetRegionId)) {
    return true;
  }

  const selectedRegionName = cleanLocationText(data.selectedRegionName);
  return Boolean(targetState && selectedRegionName === cleanLocationText(targetState));
}

function normalizeReligionTarget(value: unknown): PushReligionTarget {
  const normalized = cleanLocationText(value);
  if (normalized === "hindu" || normalized === "muslim" || normalized === "christian") {
    return normalized;
  }
  return "all";
}

function normalizeAudienceSegment(value: unknown): PushAudienceSegment {
  const normalized = cleanLocationText(value);
  if (
    normalized === "daily_active_users" ||
    normalized === "active_users" ||
    normalized === "monthly_active_users" ||
    normalized === "inactive_users" ||
    normalized === "subscribers" ||
    normalized === "non_subscribers"
  ) {
    return normalized;
  }
  return "all_area_users";
}

function userReligionMatches(data: FirebaseFirestore.DocumentData, targetReligion: PushReligionTarget) {
  if (targetReligion === "all") {
    return true;
  }
  const userReligion = cleanLocationText(data.religionPreference);
  return userReligion === targetReligion || userReligion === "all";
}

function hasActiveSubscriptionAccess(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (!data || data.isPro !== true) {
    return false;
  }
  const expiryMillis = readTimestampMillis(data.expiryTime);
  return expiryMillis <= 0 || expiryMillis > now;
}

async function loadActiveUserUidSet(userIds: string[], windowMs = ACTIVE_USER_WINDOW_MS) {
  if (userIds.length === 0) {
    return new Set<string>();
  }
  const allowed = new Set(userIds);
  const activeSince = Date.now() - windowMs;
  const active = new Set<string>();
  const snap = await adminDb.collectionGroup("activeSession").get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = trimValue(data.uid || doc.ref.parent.parent?.id);
    if (!uid || !allowed.has(uid)) {
      continue;
    }
    const updatedAt = readTimestampMillis(data.updatedAt);
    if (updatedAt >= activeSince) {
      active.add(uid);
    }
  }
  return active;
}

async function loadSubscribedUserUidSet(userIds: string[]) {
  const subscribed = new Set<string>();
  const refs = userIds.map((uid) => adminDb.doc(`users/${uid}/entitlements/pro`));
  for (let index = 0; index < refs.length; index += 300) {
    const group = refs.slice(index, index + 300);
    if (group.length === 0) {
      continue;
    }
    const snaps = await adminDb.getAll(...group);
    snaps.forEach((snap, offset) => {
      if (hasActiveSubscriptionAccess(snap.data() as Record<string, unknown> | undefined)) {
        subscribed.add(userIds[index + offset]);
      }
    });
  }
  return subscribed;
}

async function applyAudienceSegment(
  userIds: string[],
  segment: PushAudienceSegment,
) {
  const uniqueIds = Array.from(new Set(userIds.map((uid) => trimValue(uid)).filter(Boolean)));
  if (segment === "all_area_users") {
    return uniqueIds;
  }
  if (segment === "daily_active_users" || segment === "active_users" || segment === "monthly_active_users" || segment === "inactive_users") {
    const windowMs =
      segment === "daily_active_users"
        ? DAILY_ACTIVE_USER_WINDOW_MS
        : segment === "monthly_active_users"
          ? MONTHLY_ACTIVE_USER_WINDOW_MS
          : ACTIVE_USER_WINDOW_MS;
    const active = await loadActiveUserUidSet(uniqueIds, windowMs);
    return uniqueIds.filter((uid) =>
      segment === "inactive_users" ? !active.has(uid) : active.has(uid),
    );
  }
  const subscribed = await loadSubscribedUserUidSet(uniqueIds);
  return uniqueIds.filter((uid) =>
    segment === "subscribers" ? subscribed.has(uid) : !subscribed.has(uid),
  );
}

export async function countPushAudienceSegments(targetLocation: {
  state: string;
  regionIds: string[];
  district: string;
  city: string;
  religion: PushReligionTarget;
}) {
  const baseUserIds = Array.from(
    new Set(
      (await loadAreaUserUidsForRegionIds({
        ...targetLocation,
        religion: normalizeReligionTarget(targetLocation.religion),
      }))
        .map((uid) => trimValue(uid))
        .filter(Boolean),
    ),
  );
  const [dailyActive, weeklyActive, monthlyActive, subscribed] = await Promise.all([
    loadActiveUserUidSet(baseUserIds, DAILY_ACTIVE_USER_WINDOW_MS),
    loadActiveUserUidSet(baseUserIds, ACTIVE_USER_WINDOW_MS),
    loadActiveUserUidSet(baseUserIds, MONTHLY_ACTIVE_USER_WINDOW_MS),
    loadSubscribedUserUidSet(baseUserIds),
  ]);

  return {
    all_area_users: baseUserIds.length,
    daily_active_users: dailyActive.size,
    active_users: weeklyActive.size,
    monthly_active_users: monthlyActive.size,
    inactive_users: baseUserIds.filter((uid) => !weeklyActive.has(uid)).length,
    subscribers: subscribed.size,
    non_subscribers: baseUserIds.filter((uid) => !subscribed.has(uid)).length,
  } satisfies Record<PushAudienceSegment, number>;
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

async function loadAreaUserUidsForRegionIds(target: {
  state: string;
  regionIds: string[];
  district: string;
  city: string;
  religion: PushReligionTarget;
}) {
  const targetRegionId = regionIdForStateName(target.state);
  const targetRegionIds = Array.from(
    new Set(
      (target.regionIds.length > 0 ? target.regionIds : [targetRegionId])
        .map((item) => trimValue(item))
        .filter(Boolean),
    ),
  );
  const targetRegionNames = Array.from(
    new Set(
      targetRegionIds
        .map((regionId) => regionNameForId(regionId))
        .filter(Boolean),
    ),
  );
  const targetDistrict = cleanLocationText(target.district);
  const targetCity = cleanLocationText(target.city);
  const targetReligion = normalizeReligionTarget(target.religion);
  const needsLocalArea = Boolean(targetDistrict || targetCity);
  const snapshots: FirebaseFirestore.QuerySnapshot[] = [];
  if (targetRegionIds.length > 0) {
    for (const group of chunk(targetRegionIds, 30)) {
      snapshots.push(await adminDb.collection("users").where("selectedRegion", "in", group).get());
    }
  } else {
    snapshots.push(await adminDb.collection("users").get());
  }
  if (targetRegionId) {
    snapshots.push(await adminDb.collection("users").where("selectedRegionName", "==", target.state).get());
  }
  if (targetRegionNames.length > 0) {
    for (const group of chunk(targetRegionNames, 30)) {
      snapshots.push(await adminDb.collection("users").where("selectedRegionName", "in", group).get());
    }
  }
  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      docs.set(doc.id, doc);
    }
  }
  const ids: string[] = [];
  for (const doc of docs.values()) {
    const data = doc.data();
    const matchedByRegionIds = targetRegionIds.length > 0
      ? targetRegionIds.some((regionId) => selectedRegionMatches(data, regionId, regionNameForId(regionId)))
      : selectedRegionMatches(data, targetRegionId, target.state);
    const matchedByStateName = targetRegionId
      ? selectedRegionMatches(data, targetRegionId, target.state)
      : false;
    if (!matchedByRegionIds && !matchedByStateName) {
      continue;
    }
    if (!userReligionMatches(data, targetReligion)) {
      continue;
    }
    if (!needsLocalArea) {
      ids.push(doc.id);
      continue;
    }
    if (areaMatches(readUserArea(data), { ...target, state: "" })) {
      ids.push(doc.id);
    }
  }
  return ids;
}

async function resolveAudienceTargets(
  audience: PushAudience,
  targetLocation: {
    state: string;
    regionIds: string[];
    district: string;
    city: string;
    religion: PushReligionTarget;
    segment: PushAudienceSegment;
  },
) {
  const targetReligion = normalizeReligionTarget(targetLocation.religion);
  const targetSegment = normalizeAudienceSegment(targetLocation.segment);
  if (audience === "all_users") {
    if (targetReligion !== "all" || targetSegment !== "all_area_users") {
      const userUids = await applyAudienceSegment(
        await loadAllUserUidsForReligion(targetReligion),
        targetSegment,
      );
      return {
        mode: "tokens" as const,
        topic: "",
        userCount: userUids.length,
        targets: await loadUserDeviceTokens(userUids),
      };
    }
    return { mode: "topic" as const, topic: "all_users", userCount: 0, targets: [] as Array<{ token: string; refPath?: string }> };
  }

  if (audience === "creators_only") {
    const creatorUids = await applyAudienceSegment(
      await loadCreatorUids(targetReligion),
      targetSegment,
    );
    return {
      mode: "tokens" as const,
      topic: "",
      userCount: creatorUids.length,
      targets: await loadUserDeviceTokens(creatorUids),
    };
  }

  if (audience === "area_users") {
    const userUids = await applyAudienceSegment(
      await loadAreaUserUidsForRegionIds(targetLocation),
      targetSegment,
    );
    return {
      mode: "tokens" as const,
      topic: "",
      userCount: userUids.length,
      targets: await loadUserDeviceTokens(userUids),
    };
  }

  return { mode: "tokens" as const, topic: "", userCount: 0, targets: [] as Array<{ token: string; refPath?: string }> };
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
  const categoryKey = trimValue(payload.category) || "afternoon";
  const message = trimValue(payload.message);
  const title = trimValue(payload.title);
  const imageUrl = trimValue(payload.imageUrl);
  return {
    click_action: "FLUTTER_NOTIFICATION_CLICK",
    route: trimValue(payload.route) || "home",
    category: categoryKey,
    categoryKey,
    imageUrl,
    posterImage: imageUrl,
    userPhoto: "",
    title,
    body: message,
    headerText: message,
    footerText: "Share now",
    paletteIndex: notificationPaletteIndex(categoryKey),
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

  await ref.set(
    {
      status: "processing",
      updatedAt: Date.now(),
    },
    { merge: true },
  );

  const target = await resolveAudienceTargets(record.audience, {
    state: record.targetState,
    regionIds: record.targetRegionIds ?? [],
    district: record.targetDistrict,
    city: record.targetCity,
    religion: normalizeReligionTarget(record.targetReligion),
    segment: normalizeAudienceSegment(record.audienceSegment),
  });

  if (target.mode === "topic") {
    const sentAt = Date.now();
    await adminMessaging.send({
      topic: target.topic,
      data: dataPayload,
      android: {
        priority: "high",
      },
    });

    await ref.set(
      {
        status: "sent",
        sentAt,
        expiresAt: sentAt + PUSH_HISTORY_RETENTION_MS,
        updatedAt: sentAt,
        matchedUserCount: target.userCount,
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
        matchedUserCount: target.userCount,
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
      data: dataPayload,
      android: {
        priority: "high",
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
      matchedUserCount: target.userCount,
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
  audienceSegment?: PushAudienceSegment;
  targetState: string;
  targetRegionIds?: string[];
  targetDistrict: string;
  targetCity: string;
  targetReligion?: PushReligionTarget;
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
    audienceSegment: normalizeAudienceSegment(input.audienceSegment),
    targetState: trimValue(input.targetState),
    targetRegionIds: Array.isArray(input.targetRegionIds)
      ? input.targetRegionIds.map((item) => trimValue(item)).filter(Boolean)
      : [],
    targetDistrict: trimValue(input.targetDistrict),
    targetCity: trimValue(input.targetCity),
    targetReligion: normalizeReligionTarget(input.targetReligion),
    category: trimValue(input.category),
    status: input.scheduledFor && input.scheduledFor > now ? "scheduled" : "processing",
    matchedUserCount: 0,
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
