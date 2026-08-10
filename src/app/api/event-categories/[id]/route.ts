import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  listManualEventCategories,
  normalizeManualEventDateRange,
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
  active: z.boolean().optional(),
  allowPoliticalProtocol: z.boolean().optional(),
  manualAppVisible: z.boolean().optional(),
  regionId: z.string().trim().min(1),
  regionIds: z.array(z.string().trim().min(1)).optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    const payload = payloadSchema.parse(await req.json());
    const requestedRegion = await assertActorCanAccessRegion(
      actor,
      payload.regionId,
    );
    const payloadRegionIds = cleanRegionIds(payload.regionIds);
    const requestedRegions =
      payloadRegionIds.length > 0
        ? await Promise.all(
            payloadRegionIds.map((regionId) =>
              assertActorCanAccessRegion(actor, regionId),
            ),
          )
        : [requestedRegion];
    const effectiveRegionIds = requestedRegions.map((region) => region.id);
    const ref = adminDb.collection("manualEventCategories").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "Category not found." },
        { status: 404 },
      );
    }
    const currentData = snap.data() ?? {};
    const currentRegionId = String(currentData.regionId ?? "").trim();
    const currentRegionIds = cleanRegionIds(currentData.regionIds);
    const ownedRegionIds =
      currentRegionIds.length > 0
        ? currentRegionIds
        : currentRegionId
          ? [currentRegionId]
          : [];
    if (ownedRegionIds.length > 0) {
      await Promise.all(
        ownedRegionIds.map((regionId) =>
          assertActorCanAccessRegion(actor, regionId),
        ),
      );
      if (
        !ownedRegionIds.some((regionId) =>
          effectiveRegionIds.includes(regionId),
        )
      ) {
        throw new Error("Forbidden");
      }
    } else if (!actor.roles.includes("admin")) {
      throw new Error("Forbidden");
    }
    const startAtRaw = parseIsoDateInput(payload.startDate);
    const endAtRaw = payload.endDate
      ? parseIsoDateInput(payload.endDate)
      : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(
      startAtRaw,
      endAtRaw,
    );
    const labelsByLanguage = await buildCategoryLabelsByLanguage(
      payload.label,
      snap.data()?.labelsByLanguage,
      payload.labelsByLanguage,
    );
    const update: Record<string, unknown> = {
        label: payload.label,
        labelsByLanguage,
        iconAssetPath: payload.iconAssetPath ?? "",
        regionId: currentRegionId || requestedRegion.id,
        regionIds: effectiveRegionIds,
        regionName: currentRegionId
          ? String(currentData.regionName ?? "")
          : requestedRegion.name,
        allowPoliticalProtocol: payload.allowPoliticalProtocol ?? false,
        startAt,
        endAt,
        active: payload.active ?? true,
        updatedAt: Date.now(),
      };
    if (actor.roles.includes("admin") && payload.manualAppVisible != null) {
      update.manualAppVisible = payload.manualAppVisible === true;
    }
    await ref.set(update, { merge: true });
    return NextResponse.json({
      ok: true,
      categories: await listManualEventCategories(requestedRegion.id),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    const requestedRegion = await assertActorCanAccessRegion(
      actor,
      req.nextUrl.searchParams.get("regionId"),
    );
    const ref = adminDb.collection("manualEventCategories").doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      const currentData = snap.data() ?? {};
      const currentRegionId = String(currentData.regionId ?? "").trim();
      const currentRegionIds = cleanRegionIds(currentData.regionIds);
      const ownedRegionIds =
        currentRegionIds.length > 0
          ? currentRegionIds
          : currentRegionId
            ? [currentRegionId]
            : [];
      if (ownedRegionIds.length > 0) {
        await Promise.all(
          ownedRegionIds.map((regionId) =>
            assertActorCanAccessRegion(actor, regionId),
          ),
        );
        if (!ownedRegionIds.includes(requestedRegion.id)) {
          throw new Error("Forbidden");
        }
      } else if (!actor.roles.includes("admin")) {
        throw new Error("Forbidden");
      }
    }
    await ref.delete();
    return NextResponse.json({
      ok: true,
      categories: await listManualEventCategories(requestedRegion.id),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to delete event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
