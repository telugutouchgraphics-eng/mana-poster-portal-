import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

interface RawDashboardAdminDoc {
  uid?: string;
  dashboardAdminLoginId?: string;
  email?: string;
  name?: string;
  phone?: string;
  dashboardAdminStatus?: string;
  dashboardAdminManaged?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const snapshot = await adminDb
      .collection("users")
      .where("dashboardAdminManaged", "==", true)
      .get();

    const admins = snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        ...(doc.data() as RawDashboardAdminDoc),
      }))
      .filter((item) => {
        const status = String(item.dashboardAdminStatus ?? "active");
        const hasIdentity =
          String(item.email ?? "").trim().length > 0 || String(item.name ?? "").trim().length > 0;
        return hasIdentity && (status === "active" || status === "inactive");
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
        dashboardAdminStatus: String(item.dashboardAdminStatus ?? "active"),
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
