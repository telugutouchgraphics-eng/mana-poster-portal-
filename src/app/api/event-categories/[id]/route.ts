import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  listManualEventCategories,
  normalizeManualEventDateRange,
  parseIsoDateInput,
} from "@/lib/server/manual-event-categories";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const payloadSchema = z.object({
  label: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10).optional(),
  active: z.boolean().optional(),
  regionId: z.string().trim().min(1),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    const payload = payloadSchema.parse(await req.json());
    const requestedRegion = await assertActorCanAccessRegion(actor, payload.regionId);
    const ref = adminDb.collection("manualEventCategories").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });
    }
    const currentRegionId = String(snap.data()?.regionId ?? "").trim();
    if (currentRegionId) {
      await assertActorCanAccessRegion(actor, currentRegionId);
      if (currentRegionId !== requestedRegion.id) {
        throw new Error("Forbidden");
      }
    } else if (!actor.roles.includes("admin")) {
      throw new Error("Forbidden");
    }
    const startAtRaw = parseIsoDateInput(payload.startDate);
    const endAtRaw = payload.endDate ? parseIsoDateInput(payload.endDate) : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(startAtRaw, endAtRaw);
    await ref.set(
      {
        label: payload.label,
        regionId: currentRegionId || requestedRegion.id,
        regionName: currentRegionId ? String(snap.data()?.regionName ?? "") : requestedRegion.name,
        startAt,
        endAt,
        active: payload.active ?? true,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true, categories: await listManualEventCategories(requestedRegion.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    const requestedRegion = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const ref = adminDb.collection("manualEventCategories").doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      const currentRegionId = String(snap.data()?.regionId ?? "").trim();
      if (currentRegionId) {
        await assertActorCanAccessRegion(actor, currentRegionId);
        if (currentRegionId !== requestedRegion.id) {
          throw new Error("Forbidden");
        }
      } else if (!actor.roles.includes("admin")) {
        throw new Error("Forbidden");
      }
    }
    await ref.delete();
    return NextResponse.json({ ok: true, categories: await listManualEventCategories(requestedRegion.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
