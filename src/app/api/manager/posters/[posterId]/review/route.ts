import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

const payloadSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewComment: z.string().trim().max(300).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> }
) {
  try {
    await requireRole(req, ["admin", "manager"]);
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

    await posterRef.update({
      status: payload.status,
      reviewComment: payload.reviewComment ?? "",
      updatedAt: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update poster.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

