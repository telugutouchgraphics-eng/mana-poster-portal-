import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadCompetitions } from "@/lib/server/competitions";

const payloadSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).default(""),
  categoryIds: z.array(z.string().trim().min(1)).min(1).max(20),
  startAt: z.number().int().positive(),
  endAt: z.number().int().positive(),
  rewardNote: z.string().trim().max(160).default(""),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const competitions = await loadCompetitions();
    return NextResponse.json({ ok: true, competitions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load competitions.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const payload = payloadSchema.parse(await req.json());
    if (payload.endAt <= payload.startAt) {
      return NextResponse.json(
        { ok: false, error: "Competition end must be after start." },
        { status: 400 },
      );
    }

    const now = Date.now();
    const status: "draft" | "active" =
      payload.startAt > now ? "draft" : "active";

    const ref = adminDb.collection("competitions").doc();
    await ref.set({
      id: ref.id,
      title: payload.title,
      description: payload.description,
      categoryIds: payload.categoryIds,
      startAt: payload.startAt,
      endAt: payload.endAt,
      status,
      rewardNote: payload.rewardNote,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create competition.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
