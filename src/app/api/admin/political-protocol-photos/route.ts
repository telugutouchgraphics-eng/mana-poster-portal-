import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { uploadAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import { findManagedPoliticalParty } from "@/lib/server/political-parties";

const COLLECTION = "politicalProtocolPhotos";
const MAX_IMAGE_UPLOAD_BYTES = 700 * 1024;
const MAX_PHOTOS_PER_PARTY_REGION = 6;

type ProtocolPhotoRow = Record<string, unknown> & { id: string };

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
    const regionId = String(
      req.nextUrl.searchParams.get("regionId") ?? "",
    ).trim();
    const partyId = String(
      req.nextUrl.searchParams.get("partyId") ?? "",
    ).trim();
    const snap = await adminDb.collection(COLLECTION).get();
    const photos: ProtocolPhotoRow[] = snap.docs
      .map(
        (doc) =>
          ({
            id: doc.id,
            ...(doc.data() as Record<string, unknown>),
          }) as ProtocolPhotoRow,
      )
      .filter((item) => !regionId || String(item.regionId ?? "") === regionId)
      .filter((item) => !partyId || String(item.partyId ?? "") === partyId)
      .sort(
        (a, b) =>
          Number(a.sortOrder ?? 100) - Number(b.sortOrder ?? 100) ||
          Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0),
      );
    return NextResponse.json({ ok: true, photos });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load protocol photos.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const regionId = String(formData.get("regionId") ?? "").trim();
    const partyId = String(formData.get("partyId") ?? "").trim();
    const sortOrder = Number(formData.get("sortOrder") ?? 100);
    const image = formData.get("image");

    const region = await assertActorCanAccessRegion(actor, regionId);
    const party = await findManagedPoliticalParty(partyId);
    if (!party) {
      return NextResponse.json(
        { ok: false, error: "Valid political party is required." },
        { status: 400 },
      );
    }
    if (!(image instanceof File) || !isSupportedImage(image)) {
      return NextResponse.json(
        { ok: false, error: "PNG, JPG, or WEBP image is required." },
        { status: 400 },
      );
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Image must be 700 KB or smaller." },
        { status: 400 },
      );
    }

    const existingSnap = await adminDb
      .collection(COLLECTION)
      .where("regionId", "==", region.id)
      .where("partyId", "==", party.partyId)
      .get();
    if (existingSnap.size >= MAX_PHOTOS_PER_PARTY_REGION) {
      return NextResponse.json(
        {
          ok: false,
          error: "Maximum 6 protocol photos are allowed per party.",
        },
        { status: 400 },
      );
    }

    const now = Date.now();
    const ref = adminDb.collection(COLLECTION).doc();
    const ext = extensionFor(image);
    const uploaded = await uploadAdminAsset(
      Buffer.from(await image.arrayBuffer()),
      image.type || "image/png",
      `portal_assets/political_protocol/${region.id}/${party.partyId}/${ref.id}-${now}.${ext}`,
    );
    await ref.set({
      id: ref.id,
      partyId: party.partyId,
      partyCategoryId: party.id,
      partyLabel: party.label,
      partyShortName: party.shortName,
      regionId: region.id,
      regionName: region.name,
      imageUrl: uploaded.imageUrl,
      imagePath: uploaded.filePath,
      active: true,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.uid,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save protocol photo.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as {
      regionId?: string;
      partyId?: string;
      orderedIds?: unknown;
    };
    const regionId = String(body.regionId ?? "").trim();
    const partyId = String(body.partyId ?? "").trim();
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];

    const region = await assertActorCanAccessRegion(actor, regionId);
    const party = await findManagedPoliticalParty(partyId);
    if (!party) {
      return NextResponse.json(
        { ok: false, error: "Valid political party is required." },
        { status: 400 },
      );
    }
    if (
      orderedIds.length === 0 ||
      orderedIds.length > MAX_PHOTOS_PER_PARTY_REGION
    ) {
      return NextResponse.json(
        { ok: false, error: "Photo order is required." },
        { status: 400 },
      );
    }
    if (new Set(orderedIds).size !== orderedIds.length) {
      return NextResponse.json(
        { ok: false, error: "Photo order contains duplicates." },
        { status: 400 },
      );
    }

    const snap = await adminDb
      .collection(COLLECTION)
      .where("regionId", "==", region.id)
      .where("partyId", "==", party.partyId)
      .get();
    const existingIds = new Set(snap.docs.map((doc) => doc.id));
    const allKnown = orderedIds.every((id) => existingIds.has(id));
    if (!allKnown || orderedIds.length !== existingIds.size) {
      return NextResponse.json(
        { ok: false, error: "Refresh photos and try ordering again." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const batch = adminDb.batch();
    orderedIds.forEach((id, index) => {
      batch.update(adminDb.collection(COLLECTION).doc(id), {
        sortOrder: (index + 1) * 10,
        updatedAt: now,
        updatedBy: actor.uid,
      });
    });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update photo order.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
