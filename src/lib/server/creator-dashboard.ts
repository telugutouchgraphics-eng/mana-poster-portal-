import { NextRequest } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";

export interface CreatorAccessContext {
  uid: string;
  creatorPublicId: string;
  name: string;
  email: string;
  assignedCategories: string[];
}

export async function requireCreatorAccessContext(
  req: NextRequest
): Promise<CreatorAccessContext> {
  const actor = await requireRole(req, ["creator", "admin"]);
  const userSnap = await adminDb.collection("users").doc(actor.uid).get();
  const userData = userSnap.data();
  const creatorPublicId = String(userData?.creatorPublicId ?? "").trim();
  if (!creatorPublicId) {
    throw new Error("Creator profile is not linked.");
  }

  const profileSnap = await adminDb
    .collection("creatorProfiles")
    .doc(creatorPublicId)
    .get();
  if (!profileSnap.exists) {
    throw new Error("Creator profile not found.");
  }

  const profile = profileSnap.data()!;
  const status = String(profile.status ?? "pending_invite");
  if (status !== "active") {
    throw new Error("Creator access is currently disabled.");
  }
  const assignedCategories = Array.isArray(profile.assignedCategories)
    ? profile.assignedCategories.map(String)
    : [];

  return {
    uid: actor.uid,
    creatorPublicId,
    name: String(profile.name ?? userData?.name ?? ""),
    email: String(profile.email ?? userData?.email ?? ""),
    assignedCategories,
  };
}
