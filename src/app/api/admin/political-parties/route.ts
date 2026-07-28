import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import {
  listManagedPoliticalParties,
  normalizeManagedPoliticalPartyId,
  POLITICAL_PARTIES_COLLECTION,
} from "@/lib/server/political-parties";
import { buildCategoryLabelsByLanguage } from "@/lib/server/category-label-translations";
import {
  deleteAdminAsset,
  uploadAdminAsset,
} from "@/lib/server/content-management";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

const MAX_LOGO_BYTES = 700 * 1024;

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

function parseRegionIds(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index);
}

function assertValidRegionIds(regionIds: string[]) {
  const knownRegionIds = new Set(DASHBOARD_REGIONS.map((item) => item.id));
  const invalidRegionIds = regionIds.filter(
    (item) => !knownRegionIds.has(item),
  );
  if (invalidRegionIds.length > 0) {
    throw new Error(`Invalid states/UTs: ${invalidRegionIds.join(", ")}`);
  }
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 10000;
}

function parseLabelsByLanguage(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const parties = await listManagedPoliticalParties();
    return NextResponse.json({ ok: true, parties });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load parties.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const formData = await req.formData();
    const partyId = normalizeManagedPoliticalPartyId(
      String(formData.get("partyId") ?? ""),
    );
    const label = String(formData.get("label") ?? "").trim();
    const shortName = String(formData.get("shortName") ?? "").trim();
    const regionIds = parseRegionIds(formData.get("regionIds"));
    const sortOrder = parseSortOrder(formData.get("sortOrder"));
    const labelsOverride = parseLabelsByLanguage(
      formData.get("labelsByLanguage"),
    );
    const logo = formData.get("logo");

    if (!partyId || !label || !shortName) {
      return NextResponse.json(
        { ok: false, error: "Party ID, name, and short name are required." },
        { status: 400 },
      );
    }
    assertValidRegionIds(regionIds);

    const ref = adminDb.collection(POLITICAL_PARTIES_COLLECTION).doc(partyId);
    const existing = await ref.get();
    const existingData = existing.data() ?? {};
    const now = Date.now();
    const labelsByLanguage = await buildCategoryLabelsByLanguage(
      label,
      existingData.labelsByLanguage,
      labelsOverride,
    );
    let logoUrl = String(existingData.logoUrl ?? "").trim();
    let logoPath = String(existingData.logoPath ?? "").trim();
    let deletePreviousPath = "";

    if (logo instanceof File && logo.size > 0) {
      if (!isSupportedImage(logo) || logo.size > MAX_LOGO_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Logo must be PNG, JPG, or WEBP up to 700 KB." },
          { status: 400 },
        );
      }
      const ext = extensionFor(logo);
      const uploaded = await uploadAdminAsset(
        Buffer.from(await logo.arrayBuffer()),
        logo.type || "image/png",
        `portal_assets/political_party_logos/${partyId}/${now}.${ext}`,
      );
      deletePreviousPath = logoPath;
      logoUrl = uploaded.imageUrl;
      logoPath = uploaded.filePath;
    }

    await ref.set(
      {
        id: `party_${partyId}`,
        partyId,
        label,
        name: label,
        labelsByLanguage,
        shortName,
        regionIds,
        sortOrder,
        logoUrl,
        logoPath,
        active: true,
        updatedAt: now,
        updatedBy: actor.uid,
        createdAt: existing.exists ? (existingData.createdAt ?? now) : now,
        createdBy: existing.exists
          ? (existingData.createdBy ?? actor.uid)
          : actor.uid,
      },
      { merge: true },
    );
    await deleteAdminAsset(deletePreviousPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save party.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const partyId = normalizeManagedPoliticalPartyId(
      String(req.nextUrl.searchParams.get("partyId") ?? ""),
    );
    if (!partyId) {
      return NextResponse.json(
        { ok: false, error: "Party ID is required." },
        { status: 400 },
      );
    }
    await adminDb.collection(POLITICAL_PARTIES_COLLECTION).doc(partyId).set(
      {
        active: false,
        updatedAt: Date.now(),
        updatedBy: actor.uid,
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete party.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
