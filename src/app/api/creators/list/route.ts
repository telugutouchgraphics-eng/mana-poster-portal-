import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/server/auth";
import { adminDb } from "@/lib/firebase/admin";
import { loadScopedCreatorProfiles } from "@/lib/server/manager-scope";
import { decryptSensitiveField } from "@/lib/server/secure-fields";
import {
  filterKnownAssignedCategories,
  pruneInactiveAssignedCategories,
} from "@/lib/server/categories";
import { listManualEventCategories } from "@/lib/server/manual-event-categories";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

interface RawCreatorDoc {
  id: string;
  creatorPublicId?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  assignedCategories?: string[];
  managerUid?: string;
  managerEmail?: string;
  managerName?: string;
  assignedByUid?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface BankReviewSummary {
  status: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  accountNumberMasked: string;
  accountNumber?: string;
  submittedAt: number;
  reviewedAt: number;
  reviewComment: string;
  signatureName: string;
  agreementAcceptedAt: number;
  agreementText: string;
}

interface PayoutSummary {
  latestStatus: string;
  totalPaid: number;
  totalQueued: number;
  totalOnHold: number;
  lastPayoutAt: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function loadDocsByCreatorIds(collectionName: string, creatorIds: string[]) {
  const chunks = chunkArray(creatorIds, 30);
  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      adminDb.collection(collectionName).where("creatorPublicId", "in", chunk).get(),
    ),
  );
  return snapshots.flatMap((snapshot) => snapshot.docs);
}

async function loadProfileDocsByIds(collectionName: string, creatorIds: string[]) {
  const chunks = chunkArray(creatorIds, 40);
  const docs = await Promise.all(
    chunks.map((chunk) =>
      Promise.all(chunk.map((creatorId) => adminDb.collection(collectionName).doc(creatorId).get())),
    ),
  );
  return docs.flat().filter((doc) => doc.exists);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = (url.searchParams.get("status") ?? "all").trim();
    const bankStatus = (url.searchParams.get("bankStatus") ?? "all").trim();
    const payoutStatus = (url.searchParams.get("payoutStatus") ?? "all").trim();
    const [snapshot, manualCategories] = await Promise.all([
      loadScopedCreatorProfiles(actor),
      listManualEventCategories(),
    ]);
    const manualCategoryIds = manualCategories.map((item) => item.id);
    const creatorIds = snapshot
      .map((doc) => String(doc.data().creatorPublicId ?? doc.id).trim())
      .filter((creatorId) => creatorId.length > 0);

    const [posterSnap, payoutProfileSnap, payoutSnap] =
      creatorIds.length > 0
        ? await Promise.all([
            loadDocsByCreatorIds("creatorPosters", creatorIds),
            loadProfileDocsByIds("creatorPayoutProfiles", creatorIds),
            loadDocsByCreatorIds("creatorPayouts", creatorIds),
          ])
        : [[], [], []];

    const posterStats = new Map<
      string,
      {
        totalUploads: number;
        approvedCount: number;
        pendingCount: number;
        rejectedCount: number;
        lastUploadAt: number;
      }
    >();

    for (const doc of posterSnap) {
      const data = doc.data();
      const creatorPublicId = String(data.creatorPublicId ?? "").trim();
      if (!creatorPublicId) continue;
      const current = posterStats.get(creatorPublicId) ?? {
        totalUploads: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        lastUploadAt: 0,
      };
      current.totalUploads += 1;
      const posterStatus = String(data.status ?? "pending");
      if (isApprovedEquivalentStatus(posterStatus)) current.approvedCount += 1;
      else if (posterStatus === "rejected") current.rejectedCount += 1;
      else current.pendingCount += 1;
      current.lastUploadAt = Math.max(current.lastUploadAt, Number(data.createdAt ?? 0));
      posterStats.set(creatorPublicId, current);
    }

    const payoutProfileMap = new Map<string, BankReviewSummary>();
    for (const doc of payoutProfileSnap) {
      const data = doc.data();
      if (!data) {
        continue;
      }
      const encryptedAccountNumber = String(data.accountNumberEncrypted ?? "");
      payoutProfileMap.set(doc.id, {
        status: String(data.status ?? "pending_review"),
        accountHolderName: String(data.accountHolderName ?? ""),
        bankName: String(data.bankName ?? ""),
        branchName: String(data.branchName ?? ""),
        ifscCode: String(data.ifscCode ?? ""),
        accountNumberMasked: String(data.accountNumberMasked ?? ""),
        accountNumber:
          actor.role === "admin" ? decryptSensitiveField(encryptedAccountNumber) : undefined,
        submittedAt: Number(data.submittedAt ?? 0),
        reviewedAt: Number(data.reviewedAt ?? 0),
        reviewComment: String(data.reviewComment ?? ""),
        signatureName: String(data.signatureName ?? ""),
        agreementAcceptedAt: Number(data.agreementAcceptedAt ?? 0),
        agreementText: actor.role === "admin" ? String(data.agreementText ?? "") : "",
      });
    }

    const payoutSummaryMap = new Map<string, PayoutSummary>();
    for (const doc of payoutSnap) {
      const data = doc.data();
      const creatorPublicId = String(data.creatorPublicId ?? "").trim();
      if (!creatorPublicId) continue;
      const statusValue = String(data.status ?? "approved_for_payout");
      const current = payoutSummaryMap.get(creatorPublicId) ?? {
        latestStatus: "none",
        totalPaid: 0,
        totalQueued: 0,
        totalOnHold: 0,
        lastPayoutAt: 0,
      };
      const amount = Number(data.amount ?? 0);
      const createdAt = Number(data.createdAt ?? 0);
      if (statusValue === "paid") current.totalPaid += amount;
      else if (statusValue === "on_hold") current.totalOnHold += amount;
      else current.totalQueued += amount;
      if (createdAt >= current.lastPayoutAt) {
        current.lastPayoutAt = createdAt;
        current.latestStatus = statusValue;
      }
      payoutSummaryMap.set(creatorPublicId, current);
    }

    const rows = snapshot
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<RawCreatorDoc, "id">) }))
      .filter((item) => {
        const itemCreatorId = String(item.creatorPublicId ?? item.id).trim();
        const itemStatus = String(item.status ?? "pending_invite");
        if (status !== "all" && itemStatus !== status) {
          return false;
        }
        const payoutProfile = payoutProfileMap.get(itemCreatorId) ?? null;
        const payoutSummary = payoutSummaryMap.get(itemCreatorId) ?? null;
        if (actor.role === "admin") {
          const creatorBankStatus = payoutProfile?.status ?? "not_submitted";
          const creatorPayoutStatus = payoutSummary?.latestStatus ?? "none";
          if (bankStatus !== "all" && creatorBankStatus !== bankStatus) {
            return false;
          }
          if (payoutStatus !== "all" && creatorPayoutStatus !== payoutStatus) {
            return false;
          }
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
      .map((item) => {
        const creatorPublicId = String(item.creatorPublicId ?? item.id);
        const rawAssignedCategories = Array.isArray(item.assignedCategories)
          ? item.assignedCategories.map(String)
          : [];
        const { assignedCategories: knownAssignedCategories } = filterKnownAssignedCategories(
          rawAssignedCategories,
          manualCategoryIds,
        );
        const { assignedCategories } = pruneInactiveAssignedCategories(knownAssignedCategories);
        const stats = posterStats.get(creatorPublicId);
        const payoutProfile = payoutProfileMap.get(creatorPublicId) ?? null;
        const payoutSummary = payoutSummaryMap.get(creatorPublicId) ?? {
          latestStatus: "none",
          totalPaid: 0,
          totalQueued: 0,
          totalOnHold: 0,
          lastPayoutAt: 0,
        };
        return {
          creatorPublicId,
          name: String(item.name ?? "-"),
          email: String(item.email ?? ""),
          phone: String(item.phone ?? ""),
          status: String(item.status ?? "pending_invite"),
          managerUid: String(item.managerUid ?? item.assignedByUid ?? ""),
          managerEmail: String(item.managerEmail ?? ""),
          managerName: String(item.managerName ?? ""),
          assignedCategories,
          createdAt: Number(item.createdAt ?? 0),
          updatedAt: Number(item.updatedAt ?? 0),
          totalUploads: stats?.totalUploads ?? 0,
          approvedCount: stats?.approvedCount ?? 0,
          pendingCount: stats?.pendingCount ?? 0,
          rejectedCount: stats?.rejectedCount ?? 0,
          lastUploadAt: stats?.lastUploadAt ?? 0,
          payoutProfile,
          payoutSummary,
        };
      });

    return NextResponse.json({ ok: true, creators: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load creators.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
