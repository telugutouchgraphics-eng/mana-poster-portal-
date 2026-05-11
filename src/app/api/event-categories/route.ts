import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  listManualEventCategories,
  normalizeManualEventDateRange,
} from "@/lib/server/manual-event-categories";

const payloadSchema = z.object({
  id: z.string().trim().min(3).max(80).regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(2).max(120),
  startDate: z.string().trim().min(10).max(10),
  endDate: z.string().trim().min(10).max(10).optional(),
});

function parseDateInput(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error("Invalid date.");
  }
  return new Date(year, month - 1, day).getTime();
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const categories = await listManualEventCategories();
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
    const ref = adminDb.collection("manualEventCategories").doc(payload.id);
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json(
        { ok: false, error: `Category already exists: ${payload.id}` },
        { status: 409 },
      );
    }

    const startAtRaw = parseDateInput(payload.startDate);
    const endAtRaw = payload.endDate ? parseDateInput(payload.endDate) : startAtRaw;
    const { startAt, endAt } = normalizeManualEventDateRange(startAtRaw, endAtRaw);
    const now = Date.now();

    await ref.set({
      id: payload.id,
      label: payload.label,
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
      categories: await listManualEventCategories(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create event category.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
