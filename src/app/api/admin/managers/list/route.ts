import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeRoles } from "@/lib/server/role-utils";

interface RawManagerDoc {
  uid: string;
  role?: string;
  roles?: unknown;
  managerPublicId?: string;
  email?: string;
  name?: string;
  phone?: string;
  managerStatus?: string;
  createdAt?: number;
  updatedAt?: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = (url.searchParams.get("status") ?? "all").trim();

    const [primaryRoleSnapshot, multiRoleSnapshot] = await Promise.all([
      adminDb.collection("users").where("role", "==", "manager").get(),
      adminDb.collection("users").where("roles", "array-contains", "manager").get(),
    ]);
    const mergedDocs = new Map<string, (typeof primaryRoleSnapshot.docs)[number]>();
    for (const doc of primaryRoleSnapshot.docs) {
      mergedDocs.set(doc.id, doc);
    }
    for (const doc of multiRoleSnapshot.docs) {
      mergedDocs.set(doc.id, doc);
    }

    const managers = Array.from(mergedDocs.values())
      .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<RawManagerDoc, "uid">) }))
      .filter((item) => {
        const hasManagerRole =
          item.role === "manager" || normalizeRoles((item as { roles?: unknown }).roles).includes("manager");
        if (!hasManagerRole) {
          return false;
        }

        const hasVisibleIdentity =
          String(item.name ?? "").trim().length > 0 ||
          String(item.email ?? "").trim().length > 0;
        if (!hasVisibleIdentity) {
          return false;
        }

        const normalizedStatus = String(item.managerStatus ?? "active");
        if (status !== "all" && normalizedStatus !== status) {
          return false;
        }
        if (!q) {
          return true;
        }
        const searchable = [
          item.uid,
          item.managerPublicId,
          item.email,
          item.name,
          item.phone,
          normalizedStatus,
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(q);
      })
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))
      .map((item) => ({
        uid: String(item.uid),
        managerPublicId: String(item.managerPublicId ?? ""),
        email: String(item.email ?? ""),
        name: String(item.name ?? ""),
        phone: String(item.phone ?? ""),
        managerStatus: String(item.managerStatus ?? "active"),
        createdAt: Number(item.createdAt ?? 0),
        updatedAt: Number(item.updatedAt ?? 0),
      }));

    return NextResponse.json({ ok: true, managers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load managers.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
