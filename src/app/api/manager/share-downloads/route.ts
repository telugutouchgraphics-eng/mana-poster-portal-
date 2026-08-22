import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { loadActorAllowedRegionIds } from "@/lib/server/region-scope";
import { loadScopedCreatorProfiles } from "@/lib/server/manager-scope";
import {
  defaultIstShareDownloadDateRange,
  loadShareDownloadReport,
} from "@/lib/server/share-download-reports";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const defaults = defaultIstShareDownloadDateRange();
    const allowedRegionIds = await loadActorAllowedRegionIds(actor);
    const creatorDocs = await loadScopedCreatorProfiles(actor);
    const creators = creatorDocs
      .map((doc) => {
        const data = doc.data();
        return {
          creatorPublicId: String(data.creatorPublicId ?? doc.id).trim(),
          name: String(data.name ?? doc.id).trim(),
          email: String(data.email ?? "").trim(),
        };
      })
      .filter((item) => item.creatorPublicId.length > 0);
    const allowedCreatorIds = creators.map((item) => item.creatorPublicId);
    const requestedCreatorId = String(url.searchParams.get("creatorPublicId") ?? "").trim();
    const creatorPublicId = allowedCreatorIds.includes(requestedCreatorId) ? requestedCreatorId : "";
    const result = await loadShareDownloadReport({
      allowedRegionIds,
      allowedCreatorPublicIds: allowedCreatorIds,
      creatorPublicId,
      startDate: url.searchParams.get("startDate") || defaults.startDate,
      endDate: url.searchParams.get("endDate") || defaults.endDate,
      search: url.searchParams.get("search"),
    });
    return NextResponse.json({ok: true, creators, selectedCreatorId: creatorPublicId, ...result});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load share/download report.";
    return NextResponse.json({ok: false, error: message}, {status: message === "Forbidden" ? 403 : 400});
  }
}
