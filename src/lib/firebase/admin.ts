import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";

function getPrivateKey() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key || key.trim().length === 0) {
    return null;
  }
  return key.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function getEditorPrivateKey() {
  const key = process.env.EDITOR_FIREBASE_PRIVATE_KEY;
  if (!key || key.trim().length === 0) {
    return null;
  }
  return key.trim().replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey) {
    return initializeApp();
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    storageBucket,
  });
}

function getEditorFirebaseAdminApp() {
  const existing = getApps().find((a) => a.name === "editorApp");
  if (existing) {
    return existing;
  }

  const projectId = process.env.EDITOR_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.EDITOR_FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = getEditorPrivateKey();
  if (projectId && clientEmail && privateKey) {
    return initializeApp(
      {
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket:
          process.env.EDITOR_FIREBASE_STORAGE_BUCKET ||
          "mana-poster-editor.firebasestorage.app",
      },
      "editorApp"
    );
  }

  const keyPath = process.env.EDITOR_FIREBASE_KEY_PATH;
  if (keyPath) {
    const resolved = path.isAbsolute(keyPath)
      ? keyPath
      : path.resolve(process.cwd(), keyPath);
    if (fs.existsSync(resolved)) {
      try {
        const sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
        return initializeApp(
          {
            credential: cert(sa),
            storageBucket:
              process.env.EDITOR_FIREBASE_STORAGE_BUCKET ||
              "mana-poster-editor.firebasestorage.app",
          },
          "editorApp"
        );
      } catch (e) {
        console.error("Failed to load editor service account key:", e);
      }
    }
  }

  return app;
}

const app = getFirebaseAdminApp();
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export const adminMessaging = getMessaging(app);

const editorApp = getEditorFirebaseAdminApp();
export const editorAdminDb = getFirestore(editorApp);
export const editorAdminStorage = getStorage(editorApp);
