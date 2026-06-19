import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import {
  CREATOR_ASSIGNABLE_CATEGORIES,
  getVisibleAssignableCategories,
} from "@/lib/server/categories";
import { loadPortalAnalyticsSnapshot } from "@/lib/server/dashboard-metrics";
import {
  buildCompetitionCategoryLabels,
  buildCompetitionSnapshots,
  loadCompetitions,
} from "@/lib/server/competitions";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import {
  localizeCategoryLabel,
  localizeCategoryList,
} from "@/lib/dashboard-category-localization";

const rewardTierSchema = z.object({
  rank: z.number().int().min(1).max(25),
  amount: z.number().min(0).max(1000000),
  label: z.string().trim().min(1).max(40),
});

const payloadSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(320).default(""),
  categoryIds: z.array(z.string().trim().min(1)).min(1).max(20),
  submissionStartAt: z.number().int().positive(),
  submissionEndAt: z.number().int().positive(),
  liveAt: z.number().int().positive(),
  rewardNote: z.string().trim().max(160).default(""),
  rewardTiers: z.array(rewardTierSchema).max(25).default([]),
  regionId: z.string().trim().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const [competitions, analytics] = await Promise.all([
      loadCompetitions(),
      loadPortalAnalyticsSnapshot(),
    ]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const posters = analytics.posters.filter((item) => item.regionId === region.id);
    const now = Date.now();
    const nextTenDays = now + 10 * 24 * 60 * 60 * 1000;
    const snapshots = await buildCompetitionSnapshots(
      competitions,
      posters,
      analytics.creatorProfiles,
      now,
      region.id,
    );

    return NextResponse.json({
      ok: true,
      categories: localizeCategoryList(getVisibleAssignableCategories(new Date(), 2, 10, 2, region.id)
        .filter((item) => item.isDynamic)
        .filter((item) => !item.id.startsWith("weekday_"))
        .filter(
          (item) =>
            (item.eventStartAt ?? 0) >= now && (item.eventStartAt ?? 0) <= nextTenDays,
        )
        .map((item) => ({
          id: item.id,
          label: item.label,
          eventDateLabel: item.eventDateLabel ?? "",
        })), region),
      competitions: snapshots.map((snapshot) => ({
        ...snapshot,
        categoryLabels: buildCompetitionCategoryLabels(snapshot.competition.categoryIds).map(
          (label, index) =>
            localizeCategoryLabel(
              { id: snapshot.competition.categoryIds[index] ?? "", label },
              region,
            ),
        ),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load competitions.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const payload = payloadSchema.parse(await req.json());
    const region = await assertActorCanAccessRegion(actor, payload.regionId);
    if (payload.submissionEndAt <= payload.submissionStartAt) {
      return NextResponse.json(
        { ok: false, error: "Submission deadline must be after submission start." },
        { status: 400 },
      );
    }
    if (payload.liveAt < payload.submissionEndAt) {
      return NextResponse.json(
        { ok: false, error: "Event live date must be after the submission deadline." },
        { status: 400 },
      );
    }

    const categoryIds = Array.from(new Set(payload.categoryIds));
    const invalidCategory = categoryIds.find(
      (categoryId) =>
        !CREATOR_ASSIGNABLE_CATEGORIES.some((item) => item.id === categoryId && item.id !== "all"),
    );
    if (invalidCategory) {
      return NextResponse.json(
        { ok: false, error: `Invalid category selected: ${invalidCategory}` },
        { status: 400 },
      );
    }

    const rewardTiers = payload.rewardTiers
      .map((item) => ({
        rank: item.rank,
        amount: Number(item.amount.toFixed(2)),
        label: item.label,
      }))
      .sort((a, b) => a.rank - b.rank);

    const now = Date.now();
    const ref = adminDb.collection("competitions").doc();
    await ref.set({
      id: ref.id,
      regionId: region.id,
      regionName: region.name,
      title: payload.title,
      description: payload.description,
      categoryIds,
      submissionStartAt: payload.submissionStartAt,
      submissionEndAt: payload.submissionEndAt,
      liveAt: payload.liveAt,
      startAt: payload.submissionStartAt,
      endAt: payload.submissionEndAt,
      status: payload.submissionStartAt > now ? "draft" : "active",
      rewardNote: payload.rewardNote,
      rewardTiers,
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
