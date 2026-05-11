import { NextRequest } from "next/server";
import type { RequestUser } from "@/lib/server/auth";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { pruneInactiveAssignedCategories } from "@/lib/server/categories";

export interface CreatorAccessContext {
  uid: string;
  creatorPublicId: string;
  name: string;
  email: string;
  assignedCategories: string[];
}

async function buildContextFromProfile(
  actorUid: string,
  creatorPublicId: string,
  userData: Record<string, unknown> | undefined,
  options: { skipSideEffects: boolean },
): Promise<CreatorAccessContext> {
  const profileSnap = await adminDb.collection("creatorProfiles").doc(creatorPublicId).get();
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
  const { assignedCategories: activeAssignedCategories, removedCategoryIds } =
    pruneInactiveAssignedCategories(assignedCategories);

  if (!options.skipSideEffects && removedCategoryIds.length > 0) {
    await adminDb.collection("creatorProfiles").doc(creatorPublicId).set(
      {
        assignedCategories: activeAssignedCategories,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }

  return {
    uid: actorUid,
    creatorPublicId,
    name: String(profile.name ?? userData?.name ?? ""),
    email: String(profile.email ?? userData?.email ?? ""),
    assignedCategories: activeAssignedCategories,
  };
}

async function loadLinkedCreatorContext(actor: RequestUser): Promise<CreatorAccessContext> {
  const userSnap = await adminDb.collection("users").doc(actor.uid).get();
  const userData = userSnap.data();
  const creatorPublicId = String(userData?.creatorPublicId ?? "").trim();
  if (!creatorPublicId) {
    throw new Error("Creator profile is not linked.");
  }

  return buildContextFromProfile(actor.uid, creatorPublicId, userData, { skipSideEffects: false });
}

async function loadCreatorContextByPublicId(actorUid: string, creatorPublicId: string) {
  return buildContextFromProfile(actorUid, creatorPublicId, undefined, { skipSideEffects: true });
}

/**
 * Read-only creator workspace: creators use their linked profile; admins may pass
 * `?asCreator=<creatorPublicId>` (must match an active creatorProfiles doc).
 * Returns null when an admin is not linked as a creator and did not pass `asCreator`.
 */
export async function resolveCreatorReadContext(
  req: NextRequest,
): Promise<CreatorAccessContext | null> {
  const actor = await requireRole(req, ["creator", "admin"]);
  const url = new URL(req.url);
  const asCreator = url.searchParams.get("asCreator")?.trim() ?? "";

  if (actor.role === "admin" && asCreator) {
    return loadCreatorContextByPublicId(actor.uid, asCreator);
  }

  try {
    return await loadLinkedCreatorContext(actor);
  } catch (error) {
    if (actor.role === "admin") {
      return null;
    }
    throw error;
  }
}

export async function requireCreatorAccessContext(
  req: NextRequest
): Promise<CreatorAccessContext> {
  const actor = await requireRole(req, ["creator", "admin"]);
  const url = new URL(req.url);
  if (url.searchParams.get("asCreator")?.trim()) {
    throw new Error("Remove ?asCreator from the URL for uploads and account changes.");
  }
  return loadLinkedCreatorContext(actor);
}
