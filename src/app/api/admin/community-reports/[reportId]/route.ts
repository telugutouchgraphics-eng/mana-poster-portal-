import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { updateCommunityReport } from "@/lib/server/community-reports";

const UpdateSchema = z.object({
  reviewStatus: z.enum(["open", "closed"]),
  actionNote: z.string().trim().max(1000).optional().default(""),
  sendUserEmail: z.boolean().optional().default(true),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ reportId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const { reportId } = await context.params;
    const payload = UpdateSchema.parse(await req.json());
    const result = await updateCommunityReport({
      reportId,
      nextStatus: payload.reviewStatus,
      actionNote: payload.actionNote,
      sendUserEmail: payload.sendUserEmail,
      actor,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update report.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
