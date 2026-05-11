import { adminDb } from "@/lib/firebase/admin";
import { RequestUser } from "@/lib/server/auth";

function isAdmin(actor: RequestUser): boolean {
  return actor.roles.includes("admin");
}

function matchesManagerScope(
  data: Record<string, unknown> | undefined,
  managerUid: string,
): boolean {
  if (!data) {
    return false;
  }
  const assignedByUid = String(data.assignedByUid ?? "").trim();
  const directManagerUid = String(data.managerUid ?? "").trim();
  return assignedByUid === managerUid || directManagerUid === managerUid;
}

export async function loadScopedCreatorProfiles(actor: RequestUser) {
  const snapshot = await adminDb.collection("creatorProfiles").get();
  const docs = snapshot.docs.filter((doc) => {
    if (isAdmin(actor)) {
      return true;
    }
    return matchesManagerScope(doc.data(), actor.uid);
  });
  return docs;
}

export async function loadScopedCreatorIds(actor: RequestUser): Promise<string[] | null> {
  if (isAdmin(actor)) {
    return null;
  }
  const docs = await loadScopedCreatorProfiles(actor);
  return docs
    .map((doc) => String(doc.data().creatorPublicId ?? doc.id).trim())
    .filter((value) => value.length > 0);
}

export async function assertCreatorInScope(
  actor: RequestUser,
  creatorPublicId: string,
) {
  const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
  const creatorSnap = await creatorRef.get();
  if (!creatorSnap.exists) {
    throw new Error("Creator not found.");
  }
  if (!isAdmin(actor) && !matchesManagerScope(creatorSnap.data(), actor.uid)) {
    throw new Error("Forbidden");
  }
  return creatorSnap;
}

export async function assertPosterInScope(
  actor: RequestUser,
  posterData: Record<string, unknown>,
) {
  if (isAdmin(actor)) {
    return;
  }
  const posterManagerUid = String(posterData.managerUid ?? "").trim();
  if (posterManagerUid && posterManagerUid === actor.uid) {
    return;
  }
  const creatorPublicId = String(posterData.creatorPublicId ?? "").trim();
  if (!creatorPublicId) {
    throw new Error("Creator ID missing on poster.");
  }
  await assertCreatorInScope(actor, creatorPublicId);
}
