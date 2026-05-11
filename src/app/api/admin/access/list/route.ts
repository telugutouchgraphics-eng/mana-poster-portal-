import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { normalizeRoles } from "@/lib/server/role-utils";

interface RawAdminDoc {
  uid?: string;
  role?: string;
  roles?: unknown;
  adminLoginId?: string;
  email?: string;
  name?: string;
  phone?: string;
  adminStatus?: string;
  adminManaged?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const snapshot = await adminDb
      .collection("users")
      .where("adminManaged", "==", true)
      .get();

    const admins = snapshot.docs
      .map((doc) => ({
        uid: doc.id,
        ...(doc.data() as RawAdminDoc),
      }))
      .filter((item) => {
        const roles = normalizeRoles(item.roles);
        const hasAdminRole = item.role === "admin" || roles.includes("admin");
        const status = String(item.adminStatus ?? (hasAdminRole ? "active" : "inactive"));
        const hasIdentity =
          String(item.email ?? "").trim().length > 0 || String(item.name ?? "").trim().length > 0;
        return hasIdentity && (status === "active" || status === "inactive");
      })
      .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0))
      .map((item) => {
        const roles = normalizeRoles(item.roles);
        const hasAdminRole = item.role === "admin" || roles.includes("admin");
        return {
          uid: String(item.uid ?? ""),
          adminLoginId: String(item.adminLoginId ?? ""),
          email: String(item.email ?? ""),
          name: String(item.name ?? ""),
          phone: String(item.phone ?? ""),
          adminStatus: String(item.adminStatus ?? (hasAdminRole ? "active" : "inactive")),
          createdAt: Number(item.createdAt ?? 0),
          updatedAt: Number(item.updatedAt ?? 0),
        };
      });

    return NextResponse.json({ ok: true, admins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load admin access.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
