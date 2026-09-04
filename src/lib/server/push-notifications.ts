import { randomUUID } from "crypto";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

export type PushAudience = "all_users" | "creators_only" | "area_users";
export type PushAudienceSegment =
  | "all_area_users"
  | "inactive_users"
  | "subscribers"
  | "non_subscribers";
export type PushReligionTarget = "all" | "hindu" | "muslim" | "christian";
export type PushStatus = "scheduled" | "sent" | "failed" | "processing";
const PUSH_PROCESSING_RETRY_AFTER_MS = 2 * 60 * 1000;
const INACTIVE_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PUSH_AUDIENCE_USER_READ_LIMIT = 5000;
const PUSH_AUDIENCE_TOKEN_READ_LIMIT = 5000;

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
  const snap = await adminDb.collection("users").limit(PUSH_AUDIENCE_USER_READ_LIMIT).get();
  return snap.docs
    .filter((doc) => userReligionMatches(doc.data(), normalizedReligion))
    .map((doc) => doc.id);
}

async function loadCreatorUids(targetReligion: PushReligionTarget = "all"): Promise<string[]> {
  const [primarySnap, rolesSnap] = await Promise.all([
    adminDb.collection("users").where("role", "==", "creator").limit(PUSH_AUDIENCE_USER_READ_LIMIT).get(),
    adminDb.collection("users").where("roles", "array-contains", "creator").limit(PUSH_AUDIENCE_USER_READ_LIMIT).get(),
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
  for (const uid of userIds.slice(0, PUSH_AUDIENCE_USER_READ_LIMIT)) {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("deviceTokens")
      .limit(10)
      .get();
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

async function loadPublicDeviceTokensForReligion(targetReligion: PushReligionTarget) {
  const target = normalizeReligionTarget(targetReligion);
  const tokens: Array<{ token: string; refPath?: string }> = [];
  const snap = await adminDb
    .collection("publicDeviceTokens")
    .limit(PUSH_AUDIENCE_TOKEN_READ_LIMIT)
    .get();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const token = trimValue(data.token);
    if (!token || !userReligionMatches(data, target)) {
      continue;
    }
    tokens.push({ token, refPath: doc.ref.path });
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
  return !userReligion || userReligion === targetReligion || userReligion === "all";
}

function hasActiveSubscriptionAccess(data: Record<string, unknown> | undefined, now = Date.now()) {
  if (!data || data.isPro !== true) {
    return false;
  }
  const expiryMillis = readTimestampMillis(data.expiryTime);
  return expiryMillis <= 0 || expiryMillis > now;
}

function userActivityMillis(data: FirebaseFirestore.DocumentData) {
  return Math.max(
    readTimestampMillis(data.lastLoginAt),
    readTimestampMillis(data.lastActiveAt),
    readTimestampMillis(data.updatedAt),
    readTimestampMillis(data.createdAt),
  );
}

async function loadInactiveUserUidSet(userIds: string[]) {
  const inactive = new Set<string>();
  const uniqueIds = Array.from(new Set(userIds.map((uid) => trimValue(uid)).filter(Boolean)));
  const inactiveBefore = Date.now() - INACTIVE_USER_WINDOW_MS;
  for (let index = 0; index < uniqueIds.length; index += 300) {
    const group = uniqueIds.slice(index, index + 300);
    if (group.length === 0) {
      continue;
    }
    const refs = group.map((uid) => adminDb.collection("users").doc(uid));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap, offset) => {
      const uid = group[offset];
      const lastActivity = userActivityMillis(snap.data() || {});
      if (lastActivity <= 0 || lastActivity < inactiveBefore) {
        inactive.add(uid);
      }
    });
  }
  return inactive;
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
  if (segment === "inactive_users") {
    const inactive = await loadInactiveUserUidSet(uniqueIds);
    return uniqueIds.filter((uid) => inactive.has(uid));
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
  const [allAreaTargets, inactive, subscribed] = await Promise.all([
    loadAreaPublicDeviceTokensForRegionIds({
      ...targetLocation,
      religion: normalizeReligionTarget(targetLocation.religion),
    }),
    loadInactiveUserUidSet(baseUserIds),
    loadSubscribedUserUidSet(baseUserIds),
  ]);

  return {
    all_area_users: allAreaTargets.length,
    inactive_users: inactive.size,
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
      snapshots.push(
        await adminDb
          .collection("users")
          .where("selectedRegion", "in", group)
          .limit(PUSH_AUDIENCE_USER_READ_LIMIT)
          .get(),
      );
    }
  } else {
    snapshots.push(await adminDb.collection("users").limit(PUSH_AUDIENCE_USER_READ_LIMIT).get());
  }
  if (targetRegionId) {
    snapshots.push(
      await adminDb
        .collection("users")
        .where("selectedRegionName", "==", target.state)
        .limit(PUSH_AUDIENCE_USER_READ_LIMIT)
        .get(),
    );
  }
  if (targetRegionNames.length > 0) {
    for (const group of chunk(targetRegionNames, 30)) {
      snapshots.push(
        await adminDb
          .collection("users")
          .where("selectedRegionName", "in", group)
          .limit(PUSH_AUDIENCE_USER_READ_LIMIT)
          .get(),
      );
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

async function loadAreaPublicDeviceTokensForRegionIds(target: {
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
  const targetReligion = normalizeReligionTarget(target.religion);
  const needsLocalArea = Boolean(cleanLocationText(target.district) || cleanLocationText(target.city));
  if (needsLocalArea) {
    const userUids = await loadAreaUserUidsForRegionIds(target);
    return loadUserDeviceTokens(userUids);
  }

  const snapshots: FirebaseFirestore.QuerySnapshot[] = [];
  if (targetRegionIds.length > 0) {
    for (const group of chunk(targetRegionIds, 30)) {
      snapshots.push(
        await adminDb
          .collection("publicDeviceTokens")
          .where("selectedRegion", "in", group)
          .limit(PUSH_AUDIENCE_TOKEN_READ_LIMIT)
          .get(),
      );
    }
  } else {
    snapshots.push(
      await adminDb
        .collection("publicDeviceTokens")
        .limit(PUSH_AUDIENCE_TOKEN_READ_LIMIT)
        .get(),
    );
  }
  if (targetRegionId) {
    snapshots.push(
      await adminDb
        .collection("publicDeviceTokens")
        .where("selectedRegionName", "==", target.state)
        .limit(PUSH_AUDIENCE_TOKEN_READ_LIMIT)
        .get(),
    );
  }
  if (targetRegionNames.length > 0) {
    for (const group of chunk(targetRegionNames, 30)) {
      snapshots.push(
        await adminDb
          .collection("publicDeviceTokens")
          .where("selectedRegionName", "in", group)
          .limit(PUSH_AUDIENCE_TOKEN_READ_LIMIT)
          .get(),
      );
    }
  }

  const docs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      docs.set(doc.id, doc);
    }
  }

  const tokens: Array<{ token: string; refPath?: string }> = [];
  for (const doc of docs.values()) {
    const data = doc.data();
    const token = trimValue(data.token);
    if (!token) {
      continue;
    }
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
    tokens.push({ token, refPath: doc.ref.path });
  }
  return uniqueTokens(tokens);
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
    const isFullBroadcast =
      targetSegment === "all_area_users" &&
      !cleanLocationText(targetLocation.district) &&
      !cleanLocationText(targetLocation.city);

    if (isFullBroadcast) {
      if (targetLocation.regionIds.length === 0) {
        const topic = targetReligion === "all" ? "all_users" : `religion_${targetReligion}`;
        return {
          mode: "topic" as const,
          topic,
          userCount: 0,
          targets: [],
        };
      }
      if (targetLocation.regionIds.length === 1 && targetReligion === "all") {
        return {
          mode: "topic" as const,
          topic: `region_${targetLocation.regionIds[0]}`,
          userCount: 0,
          targets: [],
        };
      }
    }

    if (targetLocation.regionIds.length > 0) {
      if (targetSegment === "all_area_users") {
        const targets = await loadAreaPublicDeviceTokensForRegionIds(targetLocation);
        return {
          mode: "tokens" as const,
          topic: "",
          userCount: targets.length,
          targets,
        };
      }
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
    if (targetSegment === "all_area_users") {
      const targets = await loadPublicDeviceTokensForReligion(targetReligion);
      return {
        mode: "tokens" as const,
        topic: "",
        userCount: targets.length,
        targets,
      };
    }
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
    if (targetSegment === "all_area_users") {
      const targets = await loadAreaPublicDeviceTokensForRegionIds(targetLocation);
      return {
        mode: "tokens" as const,
        topic: "",
        userCount: targets.length,
        targets,
      };
    }
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
  const ref = adminDb.collection("adminPushNotifications").doc(record.id);
  try {
    const dataPayload = buildPushData({
      title: record.title,
      message: record.message,
      titleKey: record.titleKey,
      bodyKey: record.bodyKey,
      route: record.route,
      category: record.category,
      imageUrl: record.imageUrl,
    });

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
      try {
        await adminMessaging.send({
          topic: target.topic,
          data: dataPayload,
          android: {
            priority: "high",
          },
        });
        const sentAt = Date.now();
        await ref.set(
          {
            status: "sent",
            sentAt,
            expiresAt: null,
            updatedAt: sentAt,
            matchedUserCount: 1,
            targetCount: 1,
            deliveredCount: 1,
            failedCount: 0,
            errorMessage: "",
          },
          { merge: true },
        );
        return { targetCount: 1, deliveredCount: 1, failedCount: 0 };
      } catch (error) {
        const failedAt = Date.now();
        const message = error instanceof Error ? error.message : "FCM topic broadcast failed.";
        await ref.set(
          {
            status: "failed",
            sentAt: failedAt,
            expiresAt: null,
            updatedAt: failedAt,
            errorMessage: message,
          },
          { merge: true },
        );
        return { targetCount: 1, deliveredCount: 0, failedCount: 1 };
      }
    }

    const tokens = target.targets;
    if (tokens.length === 0) {
      const sentAt = Date.now();
      await ref.set(
        {
          status: "failed",
          sentAt,
          expiresAt: null,
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
    const deliveryErrors = new Map<string, number>();

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
        const message = result.error.message || result.error.code || "Unknown FCM error";
        deliveryErrors.set(message, (deliveryErrors.get(message) ?? 0) + 1);
        if (isInvalidTokenMessage(message)) {
          await cleanupTokenPath(tokenItem?.refPath);
        }
      }
    }

    const sentAt = Date.now();
    const firstDeliveryError = Array.from(deliveryErrors.entries())
      .map(([message, count]) => `${message} (${count})`)
      .join("; ");
    await ref.set(
      {
        status: failedCount > 0 && deliveredCount === 0 ? "failed" : "sent",
        sentAt,
        expiresAt: null,
        updatedAt: sentAt,
        matchedUserCount: target.userCount,
        targetCount: tokens.length,
        deliveredCount,
        failedCount,
        errorMessage:
          failedCount > 0 && deliveredCount === 0
            ? firstDeliveryError || "Push delivery failed for all matched devices."
            : "",
      },
      { merge: true },
    );

    return { targetCount: tokens.length, deliveredCount, failedCount };
  } catch (error) {
    const failedAt = Date.now();
    const message = error instanceof Error ? error.message : "Unable to send push notification.";
    await ref.set(
      {
        status: "failed",
        sentAt: failedAt,
        expiresAt: null,
        updatedAt: failedAt,
        deliveredCount: 0,
        errorMessage: message,
      },
      { merge: true },
    );
    throw error;
  }
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
  void limit;
  return [];
}

export async function processScheduledPushNotifications(limit = 20) {
  const now = Date.now();
  const scheduledSnap = await adminDb
    .collection("adminPushNotifications")
    .where("status", "==", "scheduled")
    .limit(Math.max(limit * 3, limit))
    .get();
  const dueScheduledDocs = scheduledSnap.docs
    .filter((doc) => readTimestampMillis(doc.data().scheduledFor) <= now)
    .sort((a, b) => readTimestampMillis(a.data().scheduledFor) - readTimestampMillis(b.data().scheduledFor))
    .slice(0, limit);
  const remainingLimit = Math.max(0, limit - dueScheduledDocs.length);
  const staleProcessingSnap = remainingLimit > 0
    ? await adminDb
        .collection("adminPushNotifications")
        .where("status", "==", "processing")
        .limit(Math.max(remainingLimit * 3, remainingLimit))
        .get()
    : null;
  const staleProcessingDocs = (staleProcessingSnap?.docs ?? [])
    .filter((doc) => readTimestampMillis(doc.data().updatedAt) <= now - PUSH_PROCESSING_RETRY_AFTER_MS)
    .sort((a, b) => readTimestampMillis(a.data().updatedAt) - readTimestampMillis(b.data().updatedAt))
    .slice(0, remainingLimit);

  const processed: string[] = [];
  for (const doc of [...dueScheduledDocs, ...staleProcessingDocs]) {
    const record = doc.data() as PushHistoryRecord;
    await sendPushNotificationRecord({ ...record, id: doc.id });
    processed.push(doc.id);
  }
  return processed;
}
