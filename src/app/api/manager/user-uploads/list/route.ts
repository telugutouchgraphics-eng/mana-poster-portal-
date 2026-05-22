import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";

interface UserUploadListItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userMobile: string;
  imageUrl: string;
  categoryId: string;
  categoryLabel: string;
  status: string;
  rejectionReason: string;
  approvedPosterTemplateId: string;
  shareCount: number;
  downloadCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "pending")
      .trim()
      .toLowerCase();
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const query = adminDb.collection("userPosterUploads");
    const snap =
      status !== "all"
        ? await query.where("status", "==", status).get()
        : await query.get();
    const now = Date.now();
    const rows = snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          userId: String(data.userId ?? "").trim(),
          userName: String(data.userName ?? "").trim(),
          userEmail: String(data.userEmail ?? "").trim(),
          userMobile: String(data.userMobile ?? "").trim(),
          imageUrl: String(data.imageUrl ?? "").trim(),
          categoryId: String(data.categoryId ?? "").trim(),
          categoryLabel: String(data.categoryLabel ?? "").trim(),
          status: String(data.status ?? "pending")
            .trim()
            .toLowerCase(),
          rejectionReason: String(data.rejectionReason ?? "").trim(),
          approvedPosterTemplateId: String(
            data.approvedPosterTemplateId ?? "",
          ).trim(),
          shareCount: Number(data.shareCount ?? 0),
          downloadCount: Number(data.downloadCount ?? 0),
          createdAt: Number(data.createdAtMillis ?? data.createdAt ?? 0),
          updatedAt: Number(data.updatedAtMillis ?? data.updatedAt ?? 0),
          expiresAt: Number(data.expiresAt ?? 0),
        } satisfies UserUploadListItem;
      })
      .filter((item) => item.expiresAt <= 0 || item.expiresAt > now)
      .filter((item) => {
        if (!q) return true;
        return [
          item.userName,
          item.userEmail,
          item.userMobile,
          item.categoryLabel,
          item.categoryId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 300);
    return NextResponse.json({ ok: true, uploads: rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load user uploads.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
