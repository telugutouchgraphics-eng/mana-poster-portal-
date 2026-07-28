import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { buildCategoryLabelsByLanguage } from "@/lib/server/category-label-translations";
import { DASHBOARD_REGIONS } from "@/lib/dashboard-regions";

interface Params {
  params: Promise<{ id: string }>;
}

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

const patchSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
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

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { id } = await params;
    const categoryId = id.trim();
    if (!categoryId) {
      return NextResponse.json(
        { ok: false, error: "Category ID is required." },
        { status: 400 },
      );
    }
    const payload = patchSchema.parse(await req.json());
    const ref = adminDb.collection("permanentCategories").doc(categoryId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "Category not found." },
        { status: 404 },
      );
    }
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    if (payload.label != null) {
      update.label = payload.label;
      update.labelsByLanguage = await buildCategoryLabelsByLanguage(
        payload.label,
        snap.data()?.labelsByLanguage,
        payload.labelsByLanguage,
      );
    } else if (payload.labelsByLanguage != null) {
      update.labelsByLanguage = await buildCategoryLabelsByLanguage(
        String(snap.data()?.label ?? categoryId),
        snap.data()?.labelsByLanguage,
        payload.labelsByLanguage,
      );
    }
    if (payload.iconAssetPath != null)
      update.iconAssetPath = payload.iconAssetPath;
    if (payload.active != null) update.active = payload.active;
    if (payload.allowPoliticalProtocol != null)
      update.allowPoliticalProtocol = payload.allowPoliticalProtocol;
    if (payload.sortOrder != null) update.sortOrder = payload.sortOrder;
    if (payload.regionIds != null) {
      const regionIds = cleanRegionIds(payload.regionIds);
      assertValidRegionIds(regionIds);
      update.regionIds = regionIds;
    }
    await ref.set(update, { merge: true });
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "permanent_category_updated",
      targetType: "permanent_category",
      targetId: categoryId,
      message: `Permanent category updated: ${categoryId}`,
      metadata: { categoryId, ...update },
    });
    const nextSnap = await ref.get();
    return NextResponse.json({
      ok: true,
      category: { id: categoryId, ...nextSnap.data() },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Permanent category update failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
