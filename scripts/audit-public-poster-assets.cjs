/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().length === 0 || line.trim().startsWith("#")) {
      continue;
    }
    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    env[key] = value;
  }
  return env;
}

function initAdmin() {
  const root = path.resolve(__dirname, "..");
  const envPath = path.join(root, ".env.local");
  const env = loadEnvFile(envPath);
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const storageBucket =
    env.FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }
  return {
    db: admin.firestore(),
    bucket: admin.storage().bucket(),
  };
}

function firstString(data, keys) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function classifyPath(rawPath) {
  const value = String(rawPath || "").trim();
  if (!value) return "empty";
  if (value.startsWith("creator-posters/")) return "public_creator_hyphen";
  if (value.startsWith("creator_posters/")) return "old_creator_underscore";
  if (value.startsWith("portal_assets/admin_app_posters/")) return "public_admin_app_posters";
  if (value.startsWith("portal_assets/admin_upload_posters/")) return "private_admin_upload_posters";
  if (value.startsWith("users/")) return "private_user_path";
  if (value.includes("temp") || value.includes("tmp")) return "temporary_path";
  return "other_path";
}

function classifyUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "empty";
  if (value.startsWith("https://firebasestorage.googleapis.com/")) {
    return value.includes("token=") ? "public_download_url" : "storage_http_no_token";
  }
  if (value.startsWith("https://storage.googleapis.com/")) return "gcs_public_url";
  if (value.startsWith("gs://")) return "gs_url";
  if (value.startsWith("http://") || value.startsWith("https://")) return "other_http_url";
  return "other_url";
}

async function main() {
  const { db } = initAdmin();
  const snap = await db.collection("creatorPosters").get();
  const summary = {
    total: snap.size,
    approved: 0,
    affected: 0,
    pathKinds: {},
    urlKinds: {},
    sampleAffected: [],
  };

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const status = String(data.status || "").trim().toLowerCase();
    if (status === "approved") {
      summary.approved += 1;
    }
    const imagePath = firstString(data, [
      "imagePath",
      "imageStoragePath",
      "posterImagePath",
      "posterStoragePath",
      "storagePath",
      "posterStorageRef",
      "firebaseStoragePath",
    ]);
    const imageUrl = firstString(data, [
      "imageUrl",
      "imageURL",
      "posterUrl",
      "previewUrl",
      "posterImageUrl",
      "posterImageURL",
      "downloadUrl",
      "downloadURL",
      "publicUrl",
      "url",
      "firebaseUrl",
    ]);

    const pathKind = classifyPath(imagePath);
    const urlKind = classifyUrl(imageUrl);
    summary.pathKinds[pathKind] = (summary.pathKinds[pathKind] || 0) + 1;
    summary.urlKinds[urlKind] = (summary.urlKinds[urlKind] || 0) + 1;

    const affected =
      status === "approved" &&
      (pathKind === "old_creator_underscore" ||
        pathKind === "private_admin_upload_posters" ||
        pathKind === "private_user_path" ||
        pathKind === "temporary_path" ||
        (!imageUrl && !!imagePath) ||
        (urlKind !== "public_download_url" &&
          urlKind !== "gcs_public_url" &&
          !!imagePath));

    if (affected) {
      summary.affected += 1;
      if (summary.sampleAffected.length < 25) {
        summary.sampleAffected.push({
          id: doc.id,
          status,
          categoryId: String(data.categoryId || ""),
          sourceUploadId: String(data.sourceUploadId || ""),
          imagePath,
          imageUrl,
          pathKind,
          urlKind,
        });
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
