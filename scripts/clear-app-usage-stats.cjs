const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

function loadLocalEnv() {
  const filePath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(filePath)) {
    return;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "mana-poster-ap";

function privateKey() {
  const value = process.env.FIREBASE_PRIVATE_KEY || "";
  return value.trim() ? value.replace(/\\n/g, "\n") : "";
}

if (!getApps().length) {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const key = privateKey();
  if (clientEmail && key) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || projectId,
        clientEmail,
        privateKey: key,
      }),
    });
  } else {
    initializeApp({ projectId });
  }
}

const db = getFirestore();

const collections = [
  "appDailyUsageStats",
  "appDailyActiveUserKeys",
  "appScreenDailyStats",
  "appScreenDailyUserKeys",
  "appRegionDailyUsageStats",
  "appRegionDailyUserKeys",
  "appScreenRegionDailyStats",
  "appScreenRegionDailyUserKeys",
  "appLoginDailyStats",
  "appLoginDailyUserKeys",
  "appLoginRegionDailyStats",
  "appLoginRegionDailyUserKeys",
  "appLoginReasonDailyStats",
  "appLoginRegionReasonDailyStats",
  "appLoginDropoffUserState",
  "appLoginRegionDropoffUserState",
];

async function main() {
  console.log(`Clearing app usage analytics in project ${projectId}...`);
  for (const collectionId of collections) {
    const ref = db.collection(collectionId);
    console.log(`Deleting ${collectionId}...`);
    await db.recursiveDelete(ref);
  }
  console.log("App usage analytics cleared. New data will start fresh.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.terminate();
  });
