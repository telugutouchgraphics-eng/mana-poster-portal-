import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { isValidCategoryId } from "@/lib/server/categories";
import { writeAuditLog } from "@/lib/server/audit-log";

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
    const invalidId = uniqueIds.find((id) => !isValidCategoryId(id));
    if (invalidId) {
      return NextResponse.json(
        { ok: false, error: `Invalid category id: ${invalidId}` },
        { status: 400 }
      );
    }

    const creatorRef = adminDb.collection("creatorProfiles").doc(creatorPublicId);
    const creatorSnap = await creatorRef.get();
    if (!creatorSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Creator not found." },
        { status: 404 }
      );
    }

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
