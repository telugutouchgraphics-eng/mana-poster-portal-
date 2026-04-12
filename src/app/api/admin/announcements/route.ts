import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { loadCreatorAnnouncements } from "@/lib/server/content-management";

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const announcements = await loadCreatorAnnouncements();
    return NextResponse.json({ ok: true, announcements });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load announcements.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as {
      title?: string;
      message?: string;
      audience?: "creator" | "manager_creator" | "all";
      priority?: "normal" | "important" | "urgent";
      active?: boolean;
      startAt?: number;
      endAt?: number;
    };
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!title || !message) {
      return NextResponse.json({ ok: false, error: "Title and message are required." }, { status: 400 });
    }
    const now = Date.now();
    const ref = adminDb.collection("creatorAnnouncements").doc();
    await ref.set({
      id: ref.id,
      title,
      message,
      audience: body.audience ?? "creator",
      priority: body.priority ?? "important",
      active: typeof body.active === "boolean" ? body.active : true,
      startAt: Number(body.startAt ?? now),
      endAt: Number(body.endAt ?? now + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.announcement.create",
      targetId: ref.id,
      targetType: "creatorAnnouncement",
      message: `Created creator announcement: ${title}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create announcement.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
