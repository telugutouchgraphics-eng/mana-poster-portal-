export type AppRole = "admin" | "manager" | "creator" | "user";

export interface UserProfileDoc {
  uid: string;
  role: AppRole;
  roles?: AppRole[];
  email: string;
  name: string;
  phone?: string;
  creatorPublicId?: string;
  activeDeviceId?: string | null;
  activeDeviceMeta?: {
    userAgent?: string;
    platform?: string;
    lastSeenAt?: number;
  } | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreatorProfileDoc {
  creatorPublicId: string;
  name: string;
  email: string;
  phone: string;
  status: "pending_invite" | "active" | "blocked";
  authUid?: string;
  assignedByUid: string;
  assignedByRole: "admin" | "manager";
  createdAt: number;
  updatedAt: number;
}
