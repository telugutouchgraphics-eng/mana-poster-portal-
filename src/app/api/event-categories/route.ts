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
  id: z.string().trim().min(3).max(80).regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10).optional(),
  regionId: z.string().trim().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const categories = await listManualEventCategories(region.id);
    return NextResponse.json({ ok: true, categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load event categories.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const payload = payloadSchema.parse(await req.json());
    const region = await assertActorCanAccessRegion(actor, payload.regionId);
    const docId = payload.id.startsWith(`${region.id}_`) ? payload.id : `${region.id}_${payload.id}`;
    const ref = adminDb.collection("manualEventCategories").doc(docId);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json(
        { ok: false, error: `Category already exists: ${docId}` },
        { status: 409 },
      );
    }

    const startAtRaw = parseIsoDateInput(payload.startDate);
    const endAtRaw = payload.endDate ? parseIsoDateInput(payload.endDate) : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(startAtRaw, endAtRaw);
    const now = Date.now();

    await ref.set({
      id: docId,
      label: payload.label,
      regionId: region.id,
      regionName: region.name,
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
    const message = error instanceof Error ? error.message : "Unable to create event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
