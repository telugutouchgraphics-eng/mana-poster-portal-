import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

const payloadSchema = z.object({
  status: z.enum(["approved", "rejected", "archived", "deleted"]),
  reviewComment: z.string().trim().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> }
) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { posterId } = await params;
    const payload = payloadSchema.parse(await req.json());

    const posterRef = adminDb.collection("creatorPosters").doc(posterId);
    const snap = await posterRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "Poster not found." },
        { status: 404 }
      );
    }

    const currentData = snap.data() as Record<string, unknown>;
    const history = Array.isArray(currentData.reviewHistory)
      ? currentData.reviewHistory
      : [];
    const now = Date.now();

    await posterRef.update({
      status: payload.status,
      reviewComment: payload.reviewComment ?? "",
      updatedAt: now,
      archivedAt: payload.status === "archived" ? now : null,
      deletedAt: payload.status === "deleted" ? now : null,
      reviewHistory: [
        ...history,
        {
          type:
            payload.status === "approved"
              ? "approved"
              : payload.status === "rejected"
                ? "rejected"
                : payload.status,
          actorRole: actor.role,
          actorId: actor.uid,
          actorName: actor.email ?? actor.uid,
          comment: payload.reviewComment ?? "",
          createdAt: now,
        },
      ],
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "poster_review_updated",
      targetType: "creator_poster",
      targetId: posterId,
      message: `Poster status changed to ${payload.status}.`,
      metadata: {
        status: payload.status,
        reviewComment: payload.reviewComment ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update poster.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
