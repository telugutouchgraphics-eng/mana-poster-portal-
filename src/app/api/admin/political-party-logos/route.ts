import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { findManagedPoliticalParty } from "@/lib/server/political-parties";
import {
  deleteAdminAsset,
  uploadAdminAsset,
} from "@/lib/server/content-management";

const COLLECTION = "politicalPartyLogos";
const MAX_IMAGE_UPLOAD_BYTES = 700 * 1024;

function isSupportedImage(file: File) {
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
    (file.type || "").toLowerCase(),
  );
}

function extensionFor(file: File) {
  const type = (file.type || "").toLowerCase();
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const partyId = String(
      req.nextUrl.searchParams.get("partyId") ?? "",
    ).trim();
    const snap = partyId
      ? await adminDb.collection(COLLECTION).doc(partyId).get()
      : null;
    const logo = snap?.exists
      ? { id: snap.id, ...(snap.data() as Record<string, unknown>) }
      : null;
    return NextResponse.json({ ok: true, logo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load party logo.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const partyId = String(formData.get("partyId") ?? "").trim();
    const image = formData.get("image");
    const party = await findManagedPoliticalParty(partyId);
    if (!party) {
      return NextResponse.json(
        { ok: false, error: "Valid political party is required." },
        { status: 400 },
      );
    }
    if (!(image instanceof File) || !isSupportedImage(image)) {
      return NextResponse.json(
        { ok: false, error: "PNG, JPG, or WEBP logo is required." },
        { status: 400 },
      );
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Logo must be 700 KB or smaller." },
        { status: 400 },
      );
    }

    const ref = adminDb.collection(COLLECTION).doc(party.partyId);
    const existing = await ref.get();
    const existingPath = String(existing.data()?.logoPath ?? "").trim();
    const now = Date.now();
    const ext = extensionFor(image);
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `portal_assets/political_party_logos/${party.partyId}/${now}.${ext}`,
    );
    await ref.set(
      {
        id: party.partyId,
        partyId: party.partyId,
        partyCategoryId: party.id,
        partyLabel: party.label,
        partyShortName: party.shortName,
        logoUrl: uploaded.imageUrl,
        logoPath: uploaded.filePath,
        active: true,
        updatedAt: now,
        updatedBy: actor.uid,
        createdAt: existing.exists ? (existing.data()?.createdAt ?? now) : now,
        createdBy: existing.exists
          ? (existing.data()?.createdBy ?? actor.uid)
          : actor.uid,
      },
      { merge: true },
    );
    await deleteAdminAsset(existingPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to replace party logo.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const partyId = String(
      req.nextUrl.searchParams.get("partyId") ?? "",
    ).trim();
    const party = await findManagedPoliticalParty(partyId);
    if (!party) {
      return NextResponse.json(
        { ok: false, error: "Valid political party is required." },
        { status: 400 },
      );
    }
    const ref = adminDb.collection(COLLECTION).doc(party.partyId);
    const snap = await ref.get();
    const logoPath = String(snap.data()?.logoPath ?? "").trim();
    await ref.set(
      {
        active: false,
        logoUrl: "",
        logoPath: "",
        updatedAt: Date.now(),
        updatedBy: actor.uid,
      },
      { merge: true },
    );
    await deleteAdminAsset(logoPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset party logo.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
