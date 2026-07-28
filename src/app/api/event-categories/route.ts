import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  generateManualEventCategoryId,
  listManualEventCategories,
  normalizeManualEventDateRange,
  normalizeManualEventCategoryId,
  parseIsoDateInput,
} from "@/lib/server/manual-event-categories";
import { buildCategoryLabelsByLanguage } from "@/lib/server/category-label-translations";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

function cleanRegionIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.map((item) => String(item ?? "").trim()).filter(Boolean)),
  );
}

const payloadSchema = z.object({
  id: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9_]+$/)
      .optional(),
  ),
  label: z.string().trim().min(2).max(120),
  labelsByLanguage: z.record(z.string(), z.string()).optional(),
  iconAssetPath: z
    .string()
    .trim()
    .max(500)
    .regex(
      /^(|assets\/.+\.svg|https:\/\/.+\.svg(?:\?.*)?)$/i,
      "Use an assets/...svg path or https SVG URL.",
    )
    .optional(),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10).optional(),
  allowPoliticalProtocol: z.boolean().optional(),
  regionId: z.string().trim().min(1),
  regionIds: z.array(z.string().trim().min(1)).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const region = await assertActorCanAccessRegion(
      actor,
      req.nextUrl.searchParams.get("regionId"),
    );
    const categories = await listManualEventCategories(region.id);
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load event categories.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const payload = payloadSchema.parse(await req.json());
    const region = await assertActorCanAccessRegion(actor, payload.regionId);
    const regionIds = cleanRegionIds(payload.regionIds);
    const targetRegions =
      regionIds.length > 0
        ? await Promise.all(
            regionIds.map((regionId) =>
              assertActorCanAccessRegion(actor, regionId),
            ),
          )
        : [region];
    const effectiveRegionIds = targetRegions.map((item) => item.id);
    const requestedId = normalizeManualEventCategoryId(
      payload.id ?? payload.label,
    );
    let categoryId = requestedId || generateManualEventCategoryId();
    let docId = categoryId.startsWith(`${region.id}_`)
      ? categoryId
      : `${region.id}_${categoryId}`;
    let ref = adminDb.collection("manualEventCategories").doc(docId);
    let existing = await ref.get();
    while (existing.exists && !requestedId) {
      categoryId = generateManualEventCategoryId();
      docId = categoryId.startsWith(`${region.id}_`)
        ? categoryId
        : `${region.id}_${categoryId}`;
      ref = adminDb.collection("manualEventCategories").doc(docId);
      existing = await ref.get();
    }
    if (existing.exists) {
      return NextResponse.json(
        { ok: false, error: `Category already exists: ${docId}` },
        { status: 409 },
      );
    }

    const startAtRaw = parseIsoDateInput(payload.startDate);
    const endAtRaw = payload.endDate
      ? parseIsoDateInput(payload.endDate)
      : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(
      startAtRaw,
      endAtRaw,
    );
    const now = Date.now();
    const labelsByLanguage = await buildCategoryLabelsByLanguage(
      payload.label,
      undefined,
      payload.labelsByLanguage,
    );

    await ref.set({
      id: docId,
      label: payload.label,
      labelsByLanguage,
      iconAssetPath: payload.iconAssetPath ?? "",
      regionId: region.id,
      regionIds: effectiveRegionIds,
      regionName: region.name,
      allowPoliticalProtocol: payload.allowPoliticalProtocol ?? false,
      startAt,
      endAt,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdByUid: actor.uid,
      createdByRole: actor.role,
    });

    return NextResponse.json({
      ok: true,
      categories: await listManualEventCategories(region.id),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
