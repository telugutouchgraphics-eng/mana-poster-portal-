import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { isValidCategoryId } from "@/lib/server/categories";
import { isValidManualEventCategoryId } from "@/lib/server/manual-event-categories";
import { writeAuditLog } from "@/lib/server/audit-log";
import { assertCreatorInScope } from "@/lib/server/manager-scope";

interface Params {
  params: Promise<{ creatorPublicId: string }>;
}

const requestSchema = z.object({
  categoryIds: z.array(z.string().trim().min(1)).max(20),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { creatorPublicId } = await params;
    const payload = requestSchema.parse(await req.json());
    const uniqueIds = Array.from(new Set(payload.categoryIds));
    const invalidIds = await Promise.all(
      uniqueIds.map(async (id) => ({
        id,
        valid: isValidCategoryId(id) || (await isValidManualEventCategoryId(id)),
      })),
    );
    const invalidId = invalidIds.find((item) => !item.valid)?.id;
    if (invalidId) {
      return NextResponse.json(
        { ok: false, error: `Invalid category id: ${invalidId}` },
        { status: 400 }
      );
    }

    const creatorSnap = await assertCreatorInScope(actor, creatorPublicId);
    const creatorRef = creatorSnap.ref;

    await creatorRef.set(
      {
        assignedCategories: uniqueIds,
        categoriesAssignedByUid: actor.uid,
        categoriesAssignedByRole: actor.role,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "creator_categories_updated",
      targetType: "creator_profile",
      targetId: creatorPublicId,
      message: "Creator assigned categories updated.",
      metadata: {
        categoryIds: uniqueIds,
      },
    });

    return NextResponse.json({ ok: true, assignedCategories: uniqueIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Category assignment failed.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
