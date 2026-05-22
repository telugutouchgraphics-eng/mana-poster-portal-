/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const fs = require("fs");
const path = require("path");
const admin = require("../functions/node_modules/firebase-admin");
const crypto = require("crypto");

function loadEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    env[key] = value;
  }
  return env;
}

async function exchangeCustomToken(apiKey, customToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.idToken) {
    throw new Error(`Custom token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const env = loadEnvFile(path.join(repoRoot, ".env.local"));
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appUrl =
    process.env.SMOKE_APP_URL ||
    "https://mana-poster-web-portal--mana-poster-ap.us-central1.hosted.app";
  const safeAppUrl = appUrl.trim().replace(/\/+$/, "");
  const bucketName =
    env.FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !privateKey || !apiKey || !bucketName) {
    throw new Error("Missing Firebase env values for smoke test.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: bucketName,
    });
  }

  const db = admin.firestore();
  const auth = admin.auth();
  const bucket = admin.storage().bucket();

  const managerCandidates = [];
  const [managerRoleSnap, managerRolesSnap, adminRoleSnap, adminRolesSnap] =
    await Promise.all([
      db.collection("users").where("role", "==", "manager").limit(5).get(),
      db.collection("users").where("roles", "array-contains", "manager").limit(5).get(),
      db.collection("users").where("role", "==", "admin").limit(5).get(),
      db.collection("users").where("roles", "array-contains", "admin").limit(5).get(),
    ]);
  for (const snap of [managerRoleSnap, managerRolesSnap, adminRoleSnap, adminRolesSnap]) {
    for (const doc of snap.docs) {
      if (!managerCandidates.includes(doc.id)) {
        managerCandidates.push(doc.id);
      }
    }
  }
  if (managerCandidates.length === 0) {
    throw new Error("No manager/admin user document was found.");
  }
  let managerUid = null;
  let managerIdToken = null;
  for (const candidateUid of managerCandidates) {
    const userRecord = await auth.getUser(candidateUid).catch(() => null);
    if (!userRecord || userRecord.disabled) {
      continue;
    }
    try {
      const token = await auth.createCustomToken(candidateUid);
      managerIdToken = await exchangeCustomToken(apiKey, token);
      managerUid = candidateUid;
      break;
    } catch {
      continue;
    }
  }
  if (!managerUid || !managerIdToken) {
    throw new Error("No enabled manager/admin auth account could complete sign-in.");
  }
  const otpExpiresAt = Date.now() + 12 * 60 * 60 * 1000;
  const otpPayload = Buffer.from(
    JSON.stringify({ uid: managerUid, expiresAt: otpExpiresAt }),
    "utf8",
  ).toString("base64url");
  const otpSecretPrivateKey =
    process.env.SMOKE_OTP_SECRET_PRIVATE_KEY !== undefined
      ? process.env.SMOKE_OTP_SECRET_PRIVATE_KEY
      : (env.FIREBASE_PRIVATE_KEY || "");
  const otpSecret = crypto
    .createHash("sha256")
    .update(`${projectId}:${otpSecretPrivateKey}`)
    .digest("hex");
  const otpSignature = crypto
    .createHmac("sha256", otpSecret)
    .update(otpPayload)
    .digest("hex");
  const otpCookie = `mp_portal_otp=${otpPayload}.${otpSignature}`;

  const now = Date.now();
  const smokeId = `smoke_${now}`;
  const uploadRef = db.collection("userPosterUploads").doc(smokeId);
  const userId = `smoke-user-${now}`;
  const imagePath = `users/${userId}/community_uploads/${smokeId}.png`;
  const tinyPngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9E2QAAAAASUVORK5CYII=";
  const imageBuffer = Buffer.from(tinyPngBase64, "base64");

  await bucket.file(imagePath).save(imageBuffer, {
    resumable: false,
    contentType: "image/png",
    metadata: {
      metadata: {
        createdAt: String(now),
      },
    },
  });
  const [imageUrl] = await bucket.file(imagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });

  await uploadRef.set({
    id: smokeId,
    contributionKind: "user_upload",
    userId,
    userName: "Smoke Test User",
    userEmail: "smoke@example.com",
    userMobile: "9999999999",
    imageUrl,
    imagePath,
    categoryId: "motivational",
    categoryLabel: "Motivational",
    status: "pending",
    rejectionReason: "",
    approvedPosterTemplateId: "",
    shareCount: 0,
    downloadCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
  });

  const listResponse = await fetch(`${safeAppUrl}/api/manager/user-uploads/list?status=pending&q=${encodeURIComponent("Smoke Test User")}`, {
    headers: {
      authorization: `Bearer ${managerIdToken}`,
      cookie: otpCookie,
    },
  });
  const listData = await listResponse.json();
  if (!listResponse.ok || !listData.ok) {
    throw new Error(`List API failed: ${JSON.stringify(listData)}`);
  }
  const previewItem = (listData.uploads || []).find((item) => item.id === smokeId);
  if (!previewItem || !previewItem.imageUrl) {
    throw new Error("Pending upload was not visible in manager list.");
  }

  const approveResponse = await fetch(
    `${safeAppUrl}/api/manager/user-uploads/${encodeURIComponent(smokeId)}/review`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${managerIdToken}`,
        cookie: otpCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "approved",
        personalizationConfig: {
          sampleName: "SMOKE TEST",
          photoX: 70,
          photoY: 38,
          photoScale: 40,
          nameX: 48,
          nameY: 82,
          showBottomStrip: true,
          stripHeight: 18,
        },
      }),
    },
  );
  const approveData = await approveResponse.json();
  if (!approveResponse.ok || !approveData.ok) {
    throw new Error(`Approve API failed: ${JSON.stringify(approveData)}`);
  }

  const approvedUploadSnap = await uploadRef.get();
  if (!approvedUploadSnap.exists) {
    throw new Error("Approved upload record disappeared unexpectedly.");
  }
  const approvedUpload = approvedUploadSnap.data();
  const posterId = String(approvedUpload.approvedPosterTemplateId || "").trim();
  if (!posterId) {
    throw new Error("Approved upload did not receive a linked poster id.");
  }

  const posterRef = db.collection("creatorPosters").doc(posterId);
  const posterSnap = await posterRef.get();
  if (!posterSnap.exists) {
    throw new Error("Approved creatorPoster record was not created.");
  }
  const poster = posterSnap.data();
  if (String(poster.status) !== "approved") {
    throw new Error(`Linked poster status mismatch: ${poster.status}`);
  }
  if (Number(poster.publishAt || 0) > Date.now()) {
    throw new Error(`Poster is not app-visible yet. publishAt=${poster.publishAt}`);
  }

  await uploadRef.update({
    shareCount: admin.firestore.FieldValue.increment(1),
    downloadCount: admin.firestore.FieldValue.increment(1),
    updatedAt: Date.now(),
  });
  const counterSnap = await uploadRef.get();
  const counterData = counterSnap.data();
  if (Number(counterData.shareCount || 0) < 1 || Number(counterData.downloadCount || 0) < 1) {
    throw new Error("Counter increment check failed.");
  }

  const deleteResponse = await fetch(
    `${safeAppUrl}/api/manager/user-uploads/${encodeURIComponent(smokeId)}/review`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${managerIdToken}`,
        cookie: otpCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "deleted",
      }),
    },
  );
  const deleteData = await deleteResponse.json();
  if (!deleteResponse.ok || !deleteData.ok) {
    throw new Error(`Delete API failed: ${JSON.stringify(deleteData)}`);
  }

  const uploadAfterDelete = await uploadRef.get();
  const posterAfterDelete = await posterRef.get();
  let storageGone = false;
  try {
    await bucket.file(imagePath).getMetadata();
    storageGone = false;
  } catch {
    storageGone = true;
  }

  const summary = {
    uploadCreated: true,
    previewVisibleInManagerList: !!previewItem,
    approved: String(approvedUpload.status || "") === "approved",
    linkedPosterId: posterId,
    appVisibleNow: Number(poster.publishAt || 0) <= Date.now(),
    countersAfterIncrement: {
      shareCount: Number(counterData.shareCount || 0),
      downloadCount: Number(counterData.downloadCount || 0),
    },
    deletedUploadDoc: !uploadAfterDelete.exists,
    deletedPosterDoc: !posterAfterDelete.exists,
    deletedStorageAsset: storageGone,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
