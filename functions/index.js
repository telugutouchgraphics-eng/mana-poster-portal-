/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const admin = require("firebase-admin");
const { FieldPath } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const { FieldValue } = admin.firestore;

const EXPIRY_HOURS = 168;
const EXPIRY_MS = EXPIRY_HOURS * 60 * 60 * 1000;
const DASHBOARD_POSTER_RETENTION_HOURS = 24;
const DASHBOARD_POSTER_RETENTION_MS = DASHBOARD_POSTER_RETENTION_HOURS * 60 * 60 * 1000;
const PUSH_HISTORY_EXPIRY_HOURS = 24;
const PUSH_HISTORY_EXPIRY_MS = PUSH_HISTORY_EXPIRY_HOURS * 60 * 60 * 1000;
const STORAGE_PAGE_SIZE = 1000;
const FIRESTORE_PAGE_SIZE = 500;
const DELETE_BATCH_SIZE = 25;
const SCHEDULE = process.env.STORAGE_CLEANUP_SCHEDULE || "0 3 * * *";
const SCHEDULE_TIME_ZONE = process.env.STORAGE_CLEANUP_TIME_ZONE || "Asia/Kolkata";
const PUSH_HISTORY_CLEANUP_SCHEDULE =
  process.env.PUSH_HISTORY_CLEANUP_SCHEDULE || "every 60 minutes";

function normalizePath(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^\/+/, "");
}

function normalizePrefix(value) {
  const normalized = normalizePath(value);
  if (!normalized) {
    return "";
  }

  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function parsePrefixList(envValue, fallback) {
  const source = typeof envValue === "string" && envValue.trim().length > 0 ? envValue : fallback;
  return source
    .split(",")
    .map((item) => normalizePrefix(item))
    .filter(Boolean);
}

function parseBooleanEnv(envValue, fallback) {
  if (typeof envValue !== "string" || envValue.trim().length === 0) {
    return fallback;
  }

  const normalized = envValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

const TEMP_PREFIXES = parsePrefixList(process.env.STORAGE_CLEANUP_TEMP_PREFIXES, "temp/");
const ORPHAN_SCAN_ENABLED = parseBooleanEnv(
  process.env.STORAGE_CLEANUP_ENABLE_ORPHAN_SCAN,
  true,
);
const ORPHAN_PREFIXES = ORPHAN_SCAN_ENABLED
  ? parsePrefixList(
      process.env.STORAGE_CLEANUP_ORPHAN_PREFIXES,
      "creator_posters/,portal_assets/admin_app_posters/",
    )
  : [];

function resolveCreatedAtMs(metadata) {
  const customCreatedAt = metadata?.metadata?.createdAt;
  if (typeof customCreatedAt === "string" && customCreatedAt.trim().length > 0) {
    const numericValue = Number(customCreatedAt);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const parsedValue = Date.parse(customCreatedAt);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  const timeCreated = metadata?.timeCreated;
  if (typeof timeCreated === "string" && timeCreated.trim().length > 0) {
    const parsedValue = Date.parse(timeCreated);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
}

function extractPathFromStorageUrl(rawValue, bucketName) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return "";
  }

  const value = rawValue.trim();
  if (!/^https?:\/\//i.test(value) && !value.startsWith("gs://")) {
    return "";
  }

  if (value.startsWith("gs://")) {
    const expectedPrefix = `gs://${bucketName}/`;
    return value.startsWith(expectedPrefix) ? normalizePath(value.slice(expectedPrefix.length)) : "";
  }

  try {
    const parsed = new URL(value);

    if (parsed.hostname === "firebasestorage.googleapis.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const bucketIndex = segments.findIndex((segment) => segment === "b");
      const objectIndex = segments.findIndex((segment) => segment === "o");
      if (
        bucketIndex >= 0 &&
        objectIndex > bucketIndex &&
        segments[bucketIndex + 1] === bucketName &&
        segments[objectIndex + 1]
      ) {
        return normalizePath(decodeURIComponent(segments.slice(objectIndex + 1).join("/")));
      }
    }

    if (parsed.hostname === "storage.googleapis.com") {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments[0] === bucketName && segments[1]) {
        return normalizePath(decodeURIComponent(segments.slice(1).join("/")));
      }
    }
  } catch (error) {
    logger.warn("Failed to parse storage URL while building reference set.", {
      value,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return "";
}

function collectProtectedPath(value, bucketName, protectedPaths) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return;
  }

  const normalizedPath = normalizePath(value);
  if (normalizedPath && !normalizedPath.startsWith("http://") && !normalizedPath.startsWith("https://")) {
    protectedPaths.add(normalizedPath);
  }

  const parsedPath = extractPathFromStorageUrl(value, bucketName);
  if (parsedPath) {
    protectedPaths.add(parsedPath);
  }
}

async function appendProtectedPathsFromCollection(collectionName, fieldNames, bucketName, protectedPaths) {
  let lastDocumentId = null;
  let documentCount = 0;

  while (true) {
    let query = db
      .collection(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(FIRESTORE_PAGE_SIZE)
      .select(...fieldNames);

    if (lastDocumentId) {
      query = query.startAfter(lastDocumentId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    snapshot.docs.forEach((document) => {
      documentCount += 1;
      const data = document.data();
      fieldNames.forEach((fieldName) => {
        collectProtectedPath(data[fieldName], bucketName, protectedPaths);
      });
    });

    lastDocumentId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  return documentCount;
}

async function buildProtectedPathSet(bucketName) {
  const protectedPaths = new Set();
  const creatorPosterDocs = await appendProtectedPathsFromCollection(
    "creatorPosters",
    ["imagePath", "videoPath", "imageUrl", "videoUrl"],
    bucketName,
    protectedPaths,
  );
  const websitePosterDocs = await appendProtectedPathsFromCollection(
    "websitePosters",
    ["imagePath", "imageUrl"],
    bucketName,
    protectedPaths,
  );

  return {
    protectedPaths,
    creatorPosterDocs,
    websitePosterDocs,
  };
}

async function expireApprovedCreatorPosterContent(bucket, cutoffMs) {
  let lastDocumentId = null;
  let scanned = 0;
  let expired = 0;
  let fileDeletes = 0;
  let fileDeleteErrors = 0;
  let updateErrors = 0;

  while (true) {
    let query = db
      .collection("creatorPosters")
      .orderBy(FieldPath.documentId())
      .limit(FIRESTORE_PAGE_SIZE)
      .select(
        "status",
        "approvedAt",
        "createdAt",
        "imagePath",
        "videoPath",
        "reviewHistory",
        "contentExpiredAt",
      );

    if (lastDocumentId) {
      query = query.startAfter(lastDocumentId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const document of snapshot.docs) {
      scanned += 1;
      const data = document.data();
      if (String(data.status ?? "").trim().toLowerCase() !== "approved") {
        continue;
      }
      if (Number(data.contentExpiredAt ?? 0) > 0) {
        continue;
      }

      const approvedAtMs = Number(data.approvedAt ?? data.createdAt ?? 0);
      if (!Number.isFinite(approvedAtMs) || approvedAtMs <= 0 || approvedAtMs > cutoffMs) {
        continue;
      }

      const pathsToDelete = [
        normalizePath(data.imagePath),
        normalizePath(data.videoPath),
      ].filter(Boolean);

      const deleteResults = await Promise.allSettled(
        pathsToDelete.map((filePath) => bucket.file(filePath).delete({ ignoreNotFound: true })),
      );
      deleteResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          fileDeletes += 1;
          return;
        }
        fileDeleteErrors += 1;
        logger.error("Failed to delete expired creator poster media.", {
          posterId: document.id,
          filePath: pathsToDelete[index],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      });

      try {
        await document.ref.set(
          {
            status: "expired",
            imagePath: "",
            imageUrl: "",
            videoPath: "",
            videoUrl: "",
            publishAt: 0,
            performanceWindowStartAt: 0,
            performanceWindowEndAt: 0,
            contentExpiredAt: Date.now(),
            contentExpiryReason: "auto_cleanup_after_7_days",
            updatedAt: Date.now(),
            reviewHistory: FieldValue.arrayUnion({
              type: "expired",
              actorRole: "system",
              actorId: "cleanupExpiredStorageAssets",
              actorName: "Scheduled Cleanup",
              comment: "Poster media auto-expired after 7 days while preserving business records.",
              createdAt: Date.now(),
            }),
          },
          { merge: true },
        );
        expired += 1;
      } catch (error) {
        updateErrors += 1;
        logger.error("Failed to update expired creator poster record.", {
          posterId: document.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    lastDocumentId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  return {
    scanned,
    expired,
    fileDeletes,
    fileDeleteErrors,
    updateErrors,
  };
}

async function hideExpiredCreatorPostersFromDashboards(cutoffMs) {
  let lastDocumentId = null;
  let scanned = 0;
  let hidden = 0;
  let updateErrors = 0;

  while (true) {
    let query = db
      .collection("creatorPosters")
      .orderBy(FieldPath.documentId())
      .limit(FIRESTORE_PAGE_SIZE)
      .select(
        "status",
        "approvedAt",
        "createdAt",
        "dashboardHiddenAt",
        "dashboardVisibleUntil",
        "reviewHistory",
      );

    if (lastDocumentId) {
      query = query.startAfter(lastDocumentId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const document of snapshot.docs) {
      scanned += 1;
      const data = document.data();
      if (Number(data.dashboardHiddenAt ?? 0) > 0) {
        continue;
      }

      const status = String(data.status ?? "").trim().toLowerCase();
      if (status === "expired") {
        continue;
      }

      const baseTime =
        status === "approved"
          ? Number(data.approvedAt ?? data.createdAt ?? 0)
          : Number(data.createdAt ?? 0);
      if (!Number.isFinite(baseTime) || baseTime <= 0 || baseTime > cutoffMs) {
        continue;
      }

      try {
        const hiddenAt = Date.now();
        await document.ref.set(
          {
            dashboardHiddenAt: hiddenAt,
            dashboardHiddenReason:
              status === "approved"
                ? "approved_dashboard_auto_cleanup_after_24_hours"
                : "creator_upload_dashboard_auto_cleanup_after_24_hours",
            dashboardVisibleUntil: baseTime + DASHBOARD_POSTER_RETENTION_MS,
            updatedAt: hiddenAt,
            reviewHistory: FieldValue.arrayUnion({
              type: "dashboard_hidden",
              actorRole: "system",
              actorId: "cleanupExpiredStorageAssets",
              actorName: "Scheduled Cleanup",
              comment:
                "Poster hidden from manager/creator dashboards after 24 hours while app visibility is preserved.",
              createdAt: hiddenAt,
            }),
          },
          { merge: true },
        );
        hidden += 1;
      } catch (error) {
        updateErrors += 1;
        logger.error("Failed to hide creator poster from dashboards.", {
          posterId: document.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    lastDocumentId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  return {
    scanned,
    hidden,
    updateErrors,
  };
}

function createStats() {
  return {
    scanned: 0,
    deleted: 0,
    protectedSkipped: 0,
    notExpiredSkipped: 0,
    missingTimestampSkipped: 0,
    deleteErrors: 0,
  };
}

async function flushDeletes(filesToDelete, stats) {
  if (filesToDelete.length === 0) {
    return;
  }

  const batch = filesToDelete.splice(0, filesToDelete.length);
  const results = await Promise.allSettled(
    batch.map((file) => file.delete({ ignoreNotFound: true })),
  );

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      stats.deleted += 1;
      return;
    }

    stats.deleteErrors += 1;
    logger.error("Failed to delete expired storage object.", {
      filePath: batch[index].name,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });
}

async function deletePushHistoryDocuments(documents) {
  const bucket = storage.bucket();
  let deleted = 0;
  let imageDeletes = 0;
  let imageDeleteErrors = 0;
  let documentDeleteErrors = 0;

  for (const document of documents) {
    const data = document.data() || {};
    const imagePath = normalizePath(data.imagePath);
    if (imagePath) {
      try {
        await bucket.file(imagePath).delete({ ignoreNotFound: true });
        imageDeletes += 1;
      } catch (error) {
        imageDeleteErrors += 1;
        logger.error("Failed to delete expired push notification image.", {
          notificationId: document.id,
          imagePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await document.ref.delete();
      deleted += 1;
    } catch (error) {
      documentDeleteErrors += 1;
      logger.error("Failed to delete expired push notification history.", {
        notificationId: document.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    deleted,
    imageDeletes,
    imageDeleteErrors,
    documentDeleteErrors,
  };
}

async function loadExpiredPushHistoryDocuments(cutoffMs, limit) {
  const byExpiresAt = await db
    .collection("adminPushNotifications")
    .where("expiresAt", "<=", Date.now())
    .limit(limit)
    .get();
  const docsById = new Map();
  byExpiresAt.docs.forEach((document) => docsById.set(document.id, document));

  if (docsById.size < limit) {
    const byCreatedAt = await db
      .collection("adminPushNotifications")
      .where("createdAt", "<=", cutoffMs)
      .limit(limit - docsById.size)
      .get();
    byCreatedAt.docs.forEach((document) => docsById.set(document.id, document));
  }

  return Array.from(docsById.values());
}

exports.cleanupExpiredPushNotificationHistory = onSchedule(
  {
    schedule: PUSH_HISTORY_CLEANUP_SCHEDULE,
    timeZone: SCHEDULE_TIME_ZONE,
    region: "asia-south1",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const startedAt = Date.now();
    const cutoffMs = startedAt - PUSH_HISTORY_EXPIRY_MS;
    const expiredDocuments = await loadExpiredPushHistoryDocuments(cutoffMs, FIRESTORE_PAGE_SIZE);
    const deleteSummary = await deletePushHistoryDocuments(expiredDocuments);
    const summary = {
      expiryHours: PUSH_HISTORY_EXPIRY_HOURS,
      cutoffIso: new Date(cutoffMs).toISOString(),
      scanned: expiredDocuments.length,
      ...deleteSummary,
      durationMs: Date.now() - startedAt,
    };

    logger.info("Push notification history cleanup completed.", summary);
    return null;
  },
);

async function scanPrefixForExpiredFiles(bucket, prefix, protectedPaths, cutoffMs) {
  const stats = createStats();
  const filesToDelete = [];
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      prefix,
      autoPaginate: false,
      maxResults: STORAGE_PAGE_SIZE,
      pageToken,
    });

    stats.scanned += files.length;

    for (const file of files) {
      const filePath = normalizePath(file.name);
      if (!filePath) {
        continue;
      }

      if (protectedPaths.has(filePath)) {
        stats.protectedSkipped += 1;
        continue;
      }

      const createdAtMs = resolveCreatedAtMs(file.metadata);
      if (!createdAtMs) {
        stats.missingTimestampSkipped += 1;
        continue;
      }

      if (createdAtMs > cutoffMs) {
        stats.notExpiredSkipped += 1;
        continue;
      }

      filesToDelete.push(file);
      if (filesToDelete.length >= DELETE_BATCH_SIZE) {
        await flushDeletes(filesToDelete, stats);
      }
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);

  await flushDeletes(filesToDelete, stats);
  return stats;
}

exports.cleanupExpiredStorageAssets = onSchedule(
  {
    schedule: SCHEDULE,
    timeZone: SCHEDULE_TIME_ZONE,
    region: "asia-south1",
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async () => {
    const startedAt = Date.now();
    const cutoffMs = startedAt - EXPIRY_MS;
    const dashboardCutoffMs = startedAt - DASHBOARD_POSTER_RETENTION_MS;
    const bucket = storage.bucket();
    const expiredPosterSummary = await expireApprovedCreatorPosterContent(bucket, cutoffMs);
    const dashboardPosterSummary = await hideExpiredCreatorPostersFromDashboards(dashboardCutoffMs);
    const { protectedPaths, creatorPosterDocs, websitePosterDocs } =
      await buildProtectedPathSet(bucket.name);

    const prefixesToScan = [
      ...TEMP_PREFIXES.map((prefix) => ({ prefix, scope: "temp" })),
      ...ORPHAN_PREFIXES.map((prefix) => ({ prefix, scope: "orphan" })),
    ];

    const summary = {
      bucket: bucket.name,
      expiryHours: EXPIRY_HOURS,
      cutoffIso: new Date(cutoffMs).toISOString(),
      protectedPathCount: protectedPaths.size,
      firestoreDocs: {
        creatorPosters: creatorPosterDocs,
        websitePosters: websitePosterDocs,
      },
      expiredCreatorPosterContent: expiredPosterSummary,
      dashboardCreatorPosterCleanup: dashboardPosterSummary,
      prefixes: {},
      totals: createStats(),
      durationMs: 0,
    };

    for (const entry of prefixesToScan) {
      const stats = await scanPrefixForExpiredFiles(
        bucket,
        entry.prefix,
        protectedPaths,
        cutoffMs,
      );

      summary.prefixes[entry.prefix] = {
        scope: entry.scope,
        ...stats,
      };
      summary.totals.scanned += stats.scanned;
      summary.totals.deleted += stats.deleted;
      summary.totals.protectedSkipped += stats.protectedSkipped;
      summary.totals.notExpiredSkipped += stats.notExpiredSkipped;
      summary.totals.missingTimestampSkipped += stats.missingTimestampSkipped;
      summary.totals.deleteErrors += stats.deleteErrors;
    }

    summary.durationMs = Date.now() - startedAt;

    logger.info("Storage cleanup job completed.", summary);
    return null;
  },
);
