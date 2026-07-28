import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import {
  generatePermanentCategoryId,
  listPermanentCategories,
  normalizePermanentCategoryId,
} from "@/lib/server/permanent-categories";
import { buildCategoryLabelsByLanguage } from "@/lib/server/category-label-translations";
import { writeAuditLog } from "@/lib/server/audit-log";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

function cleanRegionIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.map((item) => String(item ?? "").trim()).filter(Boolean)),
  );
}

function assertValidRegionIds(regionIds: string[]) {
  const known = new Set(DASHBOARD_REGIONS.map((region) => region.id));
  if (regionIds.some((regionId) => !known.has(regionId))) {
    throw new Error("Invalid state / UT selection.");
  }
}

const requestSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1).max(80),
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
  active: z.boolean().optional(),
  allowPoliticalProtocol: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  regionIds: z.array(z.string().trim().min(1)).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const categories = await listPermanentCategories({ includeInactive: true });
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const payload = requestSchema.parse(await req.json());
    let id = normalizePermanentCategoryId(payload.id || payload.label);
    if (!id) {
      id = generatePermanentCategoryId();
    }
    let ref = adminDb.collection("permanentCategories").doc(id);
    let existing = await ref.get();
    while (existing.exists && !payload.id) {
      id = generatePermanentCategoryId();
      ref = adminDb.collection("permanentCategories").doc(id);
      existing = await ref.get();
    }
    if (existing.exists) {
      return NextResponse.json(
        { ok: false, error: "Category already exists." },
        { status: 409 },
      );
    }
    const now = Date.now();
    const regionIds = cleanRegionIds(payload.regionIds);
    assertValidRegionIds(regionIds);
    const labelsByLanguage = await buildCategoryLabelsByLanguage(
      payload.label,
      undefined,
      payload.labelsByLanguage,
    );
    const record = {
      id,
      label: payload.label,
      labelsByLanguage,
      iconAssetPath: payload.iconAssetPath ?? "",
      regionIds,
      allowPoliticalProtocol: payload.allowPoliticalProtocol ?? false,
      active: payload.active ?? true,
      sortOrder: payload.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      createdByUid: actor.uid,
      createdByRole: actor.role,
    };
    await ref.set(record);
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "permanent_category_created",
      targetType: "permanent_category",
      targetId: id,
      message: `Permanent category created: ${payload.label}`,
      metadata: {
        categoryId: id,
        label: payload.label,
        regionIds,
        allowPoliticalProtocol: payload.allowPoliticalProtocol ?? false,
      },
    });
    return NextResponse.json({ ok: true, category: record });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Permanent category save failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
