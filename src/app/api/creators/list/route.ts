import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";

interface RawCreatorDoc {
  id: string;
  creatorPublicId?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  assignedCategories?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = (url.searchParams.get("status") ?? "all").trim();

    const [snapshot, posterSnap] = await Promise.all([
      adminDb.collection("creatorProfiles").get(),
      adminDb.collection("creatorPosters").get(),
    ]);

    const posterStats = new Map<
      string,
      {
        totalUploads: number;
        approvedCount: number;
        pendingCount: number;
        rejectedCount: number;
        lastUploadAt: number;
      }
    >();

    for (const doc of posterSnap.docs) {
      const data = doc.data();
      const creatorPublicId = String(data.creatorPublicId ?? "").trim();
      if (!creatorPublicId) continue;
      const current = posterStats.get(creatorPublicId) ?? {
        totalUploads: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        lastUploadAt: 0,
      };
      current.totalUploads += 1;
      const posterStatus = String(data.status ?? "pending");
      if (posterStatus === "approved") current.approvedCount += 1;
      else if (posterStatus === "rejected") current.rejectedCount += 1;
      else current.pendingCount += 1;
      current.lastUploadAt = Math.max(current.lastUploadAt, Number(data.createdAt ?? 0));
      posterStats.set(creatorPublicId, current);
    }

    const rows = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RawCreatorDoc, "id">) }))
      .filter((item) => {
        const itemStatus = String(item.status ?? "pending_invite");
        if (status !== "all" && itemStatus !== status) {
          return false;
        }
        if (!q) {
          return true;
        }
        const searchable = [
          item.creatorPublicId,
          item.name,
          item.email,
          item.phone,
          itemStatus,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      })
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .map((item) => {
        const creatorPublicId = String(item.creatorPublicId ?? item.id);
        const stats = posterStats.get(creatorPublicId);
        return {
        creatorPublicId,
        name: String(item.name ?? "-"),
        email: String(item.email ?? ""),
        phone: String(item.phone ?? ""),
        status: String(item.status ?? "pending_invite"),
        assignedCategories: Array.isArray(item.assignedCategories)
          ? item.assignedCategories.map(String)
          : [],
        createdAt: Number(item.createdAt ?? 0),
        updatedAt: Number(item.updatedAt ?? 0),
        totalUploads: stats?.totalUploads ?? 0,
        approvedCount: stats?.approvedCount ?? 0,
        pendingCount: stats?.pendingCount ?? 0,
        rejectedCount: stats?.rejectedCount ?? 0,
        lastUploadAt: stats?.lastUploadAt ?? 0,
      };
      });

    return NextResponse.json({ ok: true, creators: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creators.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
