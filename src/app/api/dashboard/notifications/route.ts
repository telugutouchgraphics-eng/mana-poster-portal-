import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import {
  loadAdminPushNotifications,
  loadCreatorAnnouncements,
} from "@/lib/server/content-management";

type DashboardNotificationAudience = "creator" | "manager_creator" | "all";

function canViewAudience(
  role: "admin" | "manager" | "creator",
  audience: DashboardNotificationAudience,
): boolean {
  if (role === "admin") return true;
  if (role === "manager") {
    return audience === "manager_creator" || audience === "all";
  }
  return audience === "creator" || audience === "manager_creator" || audience === "all";
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager", "creator"]);
    const now = Date.now();
    const actorRole = actor.role === "user" ? "creator" : actor.role;

    const announcementNotifications = (await loadCreatorAnnouncements())
      .filter((item) => item.active)
      .filter((item) => item.startAt <= now && item.endAt >= now)
      .filter((item) => canViewAudience(actorRole, item.audience as DashboardNotificationAudience))
      .map((item) => ({
        id: `announcement:${item.id}`,
        title: item.title,
        message: item.message,
        priority: item.priority,
        audience: item.audience,
        createdAt: item.createdAt,
        source: "announcement" as const,
      }));

    const pushNotifications = (await loadAdminPushNotifications())
      .filter((item) => item.status === "sent" || item.status === "scheduled")
      .filter((item) => (item.expiresAt ? item.expiresAt >= now : true))
      .filter((item) => {
        if (actorRole === "creator") {
          return item.audience === "all_users" || item.audience === "creators_only";
        }
        return true;
      })
      .map((item) => ({
        id: `push:${item.id}`,
        title: item.title,
        message: item.message,
        priority: "important" as const,
        audience: item.audience,
        createdAt: item.createdAt,
        source: "push" as const,
      }));

    const notifications = [...announcementNotifications, ...pushNotifications]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15);

    return NextResponse.json({
      ok: true,
      notifications,
      generatedAt: now,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load dashboard notifications.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
