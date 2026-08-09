import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

const CONFIG_PATH = "promo_config/first150";
const IST_OFFSET_MILLIS = 5.5 * 60 * 60 * 1000;

function toDateInput(value: unknown) {
  if (!value) return "";
  let date: Date | null = null;
  if (value instanceof Timestamp) {
    date = value.toDate();
  } else if (typeof value === "object" && value !== null && "toDate" in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  } else {
    const parsed = new Date(String(value));
    date = Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  if (!date || !Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + IST_OFFSET_MILLIS).toISOString().slice(0, 10);
}

function timestampIso(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) return "";
  const date = (value as { toDate?: () => Date }).toDate?.();
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function parseDateInput(value: unknown, endOfDay = false) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Invalid date.");
  }
  return Timestamp.fromDate(date);
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const snap = await adminDb.doc(CONFIG_PATH).get();
    const data = snap.data() || {};
    return NextResponse.json({
      ok: true,
      config: {
        exists: snap.exists,
        enabled: data.enabled === true,
        limit: numberValue(data.limit, 150),
        usedCount: numberValue(data.usedCount, 0),
        days: numberValue(data.days, 30),
        startsAt: toDateInput(data.startsAt),
        endsAt: toDateInput(data.endsAt),
        updatedAt: timestampIso(data.updatedAt),
        updatedByEmail: typeof data.updatedByEmail === "string" ? data.updatedByEmail : "",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load first 150 config.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as {
      enabled?: boolean;
      limit?: number;
      days?: number;
      startsAt?: string;
      endsAt?: string;
      resetUsedCount?: boolean;
    };

    const limit = Math.floor(numberValue(body.limit, 150));
    const days = Math.floor(numberValue(body.days, 30));
    if (limit < 1 || limit > 10000) {
      throw new Error("Limit must be between 1 and 10000.");
    }
    if (days < 1 || days > 365) {
      throw new Error("Validity days must be between 1 and 365.");
    }

    const startsAt = parseDateInput(body.startsAt, false);
    const endsAt = parseDateInput(body.endsAt, true);
    if (startsAt && endsAt && endsAt.toMillis() <= startsAt.toMillis()) {
      throw new Error("End date must be after start date.");
    }

    const update: Record<string, unknown> = {
      enabled: body.enabled === true,
      limit,
      days,
      startsAt,
      endsAt,
      updatedAt: Timestamp.now(),
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? "",
    };
    if (body.resetUsedCount === true) {
      update.usedCount = 0;
    }

    await adminDb.doc(CONFIG_PATH).set(update, { merge: true });
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.first150_trial.update",
      targetType: "promo_config",
      targetId: "first150",
      message: "Updated first 150 free trial promo config",
      metadata: {
        enabled: update.enabled,
        limit,
        days,
        startsAt: body.startsAt || null,
        endsAt: body.endsAt || null,
        resetUsedCount: body.resetUsedCount === true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save first 150 config.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
