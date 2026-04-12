import { adminDb, adminStorage } from "@/lib/firebase/admin";

export interface AppBannerRecord {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imagePath: string;
  ctaLabel: string;
  ctaTarget: string;
  placement: string;
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
  imageUrl: string;
  imagePath: string;
  route: string;
  audience: "all_users";
  status: "sent" | "failed";
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
  sentAt: number;
  createdByUid: string;
  createdByEmail: string;
}

export async function loadAppBanners(): Promise<AppBannerRecord[]> {
  const snap = await adminDb.collection("appBanners").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AppBannerRecord, "id">) }))
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (b.updatedAt - a.updatedAt));
}

export async function loadCreatorAnnouncements(): Promise<CreatorAnnouncementRecord[]> {
  const snap = await adminDb.collection("creatorAnnouncements").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CreatorAnnouncementRecord, "id">) }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadAdminPushNotifications(): Promise<AdminPushNotificationRecord[]> {
  const snap = await adminDb.collection("adminPushNotifications").limit(50).get();
  return snap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<AdminPushNotificationRecord, "id">),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function uploadAdminAsset(buffer: Buffer, contentType: string, path: string) {
  const bucket = adminStorage.bucket();
  const file = bucket.file(path);
  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "public,max-age=31536000",
    },
  });
  const [imageUrl] = await file.getSignedUrl({
    action: "read",
    expires: "2491-01-01",
  });
  return { filePath: path, imageUrl };
}
