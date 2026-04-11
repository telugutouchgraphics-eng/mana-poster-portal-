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

    const snapshot = await adminDb.collection("creatorProfiles").get();
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
      .map((item) => ({
        creatorPublicId: String(item.creatorPublicId ?? item.id),
        name: String(item.name ?? "-"),
        email: String(item.email ?? ""),
        phone: String(item.phone ?? ""),
        status: String(item.status ?? "pending_invite"),
        assignedCategories: Array.isArray(item.assignedCategories)
          ? item.assignedCategories.map(String)
          : [],
        createdAt: Number(item.createdAt ?? 0),
        updatedAt: Number(item.updatedAt ?? 0),
      }));

    return NextResponse.json({ ok: true, creators: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creators.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
