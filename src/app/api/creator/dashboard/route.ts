import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { CREATOR_ASSIGNABLE_CATEGORIES } from "@/lib/server/categories";
import { requireCreatorAccessContext } from "@/lib/server/creator-dashboard";
import { requireRole } from "@/lib/server/auth";

function dayKey(epochMs: number): string {
  const date = new Date(epochMs);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const actorUserSnap = await adminDb.collection("users").doc(actor.uid).get();
    const actorCreatorId = String(actorUserSnap.data()?.creatorPublicId ?? "").trim();
    if (actor.role === "admin" && actorCreatorId.length === 0) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
        profile: null,
        assignedCategories: [],
        stats: {
          totalUploads: 0,
          todayUploads: 0,
          approvedCount: 0,
          rejectedCount: 0,
          todayEarnings: 0,
        },
        posters: [],
      });
    }

    const creator = await requireCreatorAccessContext(req);
    const now = Date.now();
    const today = dayKey(now);

    const posterSnap = await adminDb
      .collection("creatorPosters")
      .where("creatorPublicId", "==", creator.creatorPublicId)
      .get();

    const posters = posterSnap.docs
      .map((doc) => ({
        id: doc.id,
        title: String(doc.data().title ?? "Untitled"),
        categoryId: String(doc.data().categoryId ?? ""),
        categoryLabel: String(doc.data().categoryLabel ?? ""),
        imageUrl: String(doc.data().imageUrl ?? ""),
        status: String(doc.data().status ?? "pending"),
        createdAt: Number(doc.data().createdAt ?? 0),
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    const todayUploads = posters.filter((item) => dayKey(item.createdAt) === today).length;
    const approvedCount = posters.filter((item) => item.status === "approved").length;
    const rejectedCount = posters.filter((item) => item.status === "rejected").length;

    const categoryMap = Object.fromEntries(
      CREATOR_ASSIGNABLE_CATEGORIES.map((item) => [item.id, item.label])
    );

    const assignedCategories = creator.assignedCategories.map((categoryId) => ({
      id: categoryId,
      label: categoryMap[categoryId] ?? categoryId,
    }));

    return NextResponse.json({
      ok: true,
      profile: {
        creatorPublicId: creator.creatorPublicId,
        name: creator.name,
        email: creator.email,
      },
      assignedCategories,
      stats: {
        totalUploads: posters.length,
        todayUploads,
        approvedCount,
        rejectedCount,
        todayEarnings: 0,
      },
      posters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creator dashboard.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
