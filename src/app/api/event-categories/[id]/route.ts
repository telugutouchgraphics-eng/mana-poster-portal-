import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  listManualEventCategories,
  normalizeManualEventDateRange,
  parseIsoDateInput,
} from "@/lib/server/manual-event-categories";

const payloadSchema = z.object({
  label: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10).optional(),
  active: z.boolean().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    const payload = payloadSchema.parse(await req.json());
    const ref = adminDb.collection("manualEventCategories").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });
    }
    const startAtRaw = parseIsoDateInput(payload.startDate);
    const endAtRaw = payload.endDate ? parseIsoDateInput(payload.endDate) : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(startAtRaw, endAtRaw);
    await ref.set(
      {
        label: payload.label,
        startAt,
        endAt,
        active: payload.active ?? true,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true, categories: await listManualEventCategories() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const { id } = await params;
    await adminDb.collection("manualEventCategories").doc(id).delete();
    return NextResponse.json({ ok: true, categories: await listManualEventCategories() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
