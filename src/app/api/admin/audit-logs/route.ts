import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const action = (url.searchParams.get("action") ?? "all").trim().toLowerCase();

    const snap = await adminDb.collection("adminAuditLogs").get();
    const rows = snap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          actorUid: String(data.actorUid ?? ""),
          actorRole: String(data.actorRole ?? ""),
          actorEmail: String(data.actorEmail ?? ""),
          action: String(data.action ?? ""),
          targetType: String(data.targetType ?? ""),
          targetId: String(data.targetId ?? ""),
          message: String(data.message ?? ""),
          metadata: data.metadata ?? {},
          createdAt: Number(data.createdAt ?? 0),
        };
      })
      .filter((item) => (action === "all" ? true : item.action.toLowerCase() === action))
      .filter((item) => {
        if (!q) return true;
        const search = [
          item.actorUid,
          item.actorRole,
          item.actorEmail,
          item.action,
          item.targetType,
          item.targetId,
          item.message,
        ]
          .join(" ")
          .toLowerCase();
        return search.includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 300);

    return NextResponse.json({ ok: true, logs: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load audit logs.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
