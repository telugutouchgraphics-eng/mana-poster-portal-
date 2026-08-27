import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";
import {
  defaultIstShareDownloadDateRange,
  loadShareDownloadReport,
} from "@/lib/server/share-download-reports";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const url = new URL(req.url);
    const defaults = defaultIstShareDownloadDateRange();
    const userSnap = await adminDb.collection("users").doc(actor.uid).get();
    const creatorPublicId = String(userSnap.data()?.creatorPublicId ?? "").trim();
    if (!creatorPublicId) {
      return NextResponse.json({
        ok: true,
        rows: [],
        summary: {
          posterCount: 0,
          shareCount: 0,
          downloadCount: 0,
          displayShareCount: 0,
          displayDownloadCount: 0,
          totalEngagement: 0,
          displayTotalEngagement: 0,
        },
      });
    }
    const result = await loadShareDownloadReport({
      allowedRegionIds: await loadActorAllowedRegionIds(actor),
      allowedCreatorPublicIds: [creatorPublicId],
      creatorPublicId,
      startDate: url.searchParams.get("startDate") || defaults.startDate,
      endDate: url.searchParams.get("endDate") || defaults.endDate,
      search: url.searchParams.get("search"),
    });
    return NextResponse.json({ok: true, ...result});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load share/download report.";
    return NextResponse.json({ok: false, error: message}, {status: message === "Forbidden" ? 403 : 400});
  }
}
