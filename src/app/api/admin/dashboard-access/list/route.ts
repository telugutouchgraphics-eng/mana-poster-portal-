import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { loadActorAllowedRegionIds, sanitizeDashboardRegionIds } from "@/lib/server/region-scope";
import { isPermanentDashboardAdminEmail } from "@/lib/server/permanent-admins";

interface RawDashboardAdminDoc {
  uid?: string;
  dashboardAdminLoginId?: string;
  email?: string;
  authEmail?: string;
  name?: string;
  phone?: string;
  loginPassword?: string;
  dashboardAdminStatus?: string;
  dashboardAdminManaged?: boolean;
  role?: string;
  roles?: unknown;
  createdAt?: number;
  updatedAt?: number;
  assignedRegionIds?: unknown;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const actorAllowedRegionIds = await loadActorAllowedRegionIds(actor);
    const actorIsPermanent = isPermanentDashboardAdminEmail(actor.email);
    const snapshot = await adminDb.collection("users").get();

    const admins = snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        ...(doc.data() as RawDashboardAdminDoc),
      }))
      .filter((item) => {
        const roles = Array.isArray(item.roles) ? item.roles.map(String) : [];
        const hasAdminRole = item.role === "admin" || roles.includes("admin");
        const isManaged = item.dashboardAdminManaged === true;
        const status = String(item.dashboardAdminStatus ?? (hasAdminRole ? "active" : ""));
        const hasIdentity =
          String(item.email ?? "").trim().length > 0 || String(item.name ?? "").trim().length > 0;
        if (!hasIdentity || !(hasAdminRole || isManaged) || (status !== "active" && status !== "inactive")) {
          return false;
        }
        if (actorIsPermanent) {
          return true;
        }
        if (String(item.uid ?? "") === actor.uid) {
          return true;
        }
        const assignedRegionIds = sanitizeDashboardRegionIds(item.assignedRegionIds);
        return assignedRegionIds.some((regionId) => actorAllowedRegionIds.includes(regionId));
      })
      .sort(
        (a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0),
      )
      .map((item) => ({
        uid: String(item.uid ?? ""),
        dashboardAdminLoginId: String(item.dashboardAdminLoginId ?? ""),
        email: String(item.email ?? ""),
        name: String(item.name ?? ""),
        phone: String(item.phone ?? ""),
        loginPassword: String(item.loginPassword ?? ""),
        dashboardAdminStatus: String(item.dashboardAdminStatus ?? "active"),
        assignedRegionIds: sanitizeDashboardRegionIds(item.assignedRegionIds),
        permanentAdmin: isPermanentDashboardAdminEmail(item.email ?? item.authEmail),
        createdAt: Number(item.createdAt ?? 0),
        updatedAt: Number(item.updatedAt ?? 0),
      }));

    return NextResponse.json({ ok: true, admins });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load dashboard admin access.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
