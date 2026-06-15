import { adminDb, adminStorage } from "@/lib/firebase/admin";
import type { LandingPageRecord } from "@/lib/types/landing-page";
import { randomUUID } from "crypto";

function buildStorageUploadMetadata(downloadToken: string, createdAt: number) {
  return {
    cacheControl: "public,max-age=31536000",
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
      createdAt: String(createdAt),
    },
  };
}

export interface AppBannerRecord {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imagePath: string;
  ctaLabel: string;
  ctaTarget: string;
  placement: string;
  targetState?: string;
  targetDistrict?: string;
  targetCity?: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface WebsitePosterRecord {
  id: string;
  category: string;
  categoryId?: string;
  categoryLabel?: string;
  imageUrl: string;
  imagePath: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreatorAnnouncementRecord {
  id: string;
  title: string;
  message: string;
  audience: "creator" | "manager_creator" | "all";
  priority: "normal" | "important" | "urgent";
  active: boolean;
  startAt: number;
  endAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminPushNotificationRecord {
  id: string;
  title: string;
  message: string;
  titleKey: string;
  bodyKey: string;
  imageUrl: string;
  imagePath: string;
  route: string;
  audience: "all_users" | "creators_only" | "area_users";
  targetState?: string;
  targetDistrict?: string;
  targetCity?: string;
  category: string;
  status: "scheduled" | "sent" | "failed" | "processing";
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
}

export type LandingPageConfigRecord = LandingPageRecord;

export async function loadAppBanners(): Promise<AppBannerRecord[]> {
  const snap = await adminDb.collection("appBanners").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AppBannerRecord, "id">) }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (b.updatedAt - a.updatedAt));
}

export async function loadWebsitePosters(): Promise<WebsitePosterRecord[]> {
  const snap = await adminDb.collection("websitePosters").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<WebsitePosterRecord, "id">) }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (b.updatedAt - a.updatedAt));
}

export async function loadCreatorAnnouncements(): Promise<CreatorAnnouncementRecord[]> {
  const snap = await adminDb.collection("creatorAnnouncements").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CreatorAnnouncementRecord, "id">) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadAdminPushNotifications(): Promise<AdminPushNotificationRecord[]> {
  const snap = await adminDb
    .collection("adminPushNotifications")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AdminPushNotificationRecord, "id">),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function loadLandingPageConfig(): Promise<LandingPageConfigRecord | null> {
  const snap = await adminDb.collection("websiteConfig").doc("landingPage").get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as LandingPageConfigRecord;
}

export async function uploadAdminAsset(buffer: Buffer, contentType: string, path: string) {
  const bucket = adminStorage.bucket();
  const file = bucket.file(path);
  const downloadToken = randomUUID();
  const createdAt = Date.now();
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      ...buildStorageUploadMetadata(downloadToken, createdAt),
    },
  });
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket.name,
  )}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
  return { filePath: path, imageUrl };
}

export async function deleteAdminAsset(path?: string | null) {
  const normalized = typeof path === "string" ? path.trim() : "";
  if (!normalized) {
    return;
  }
  const bucket = adminStorage.bucket();
  await bucket.file(normalized).delete({ ignoreNotFound: true });
}
