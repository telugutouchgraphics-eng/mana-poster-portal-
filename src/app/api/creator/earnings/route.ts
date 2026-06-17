import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import { resolveCreatorReadContext } from "@/lib/server/creator-dashboard";
import { isApprovedEquivalentStatus } from "@/lib/server/poster-status";

const APPROVAL_REWARD = 10;

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["creator", "admin"]);
    const creator = await resolveCreatorReadContext(req);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    if (!creator) {
      return NextResponse.json({
        ok: true,
        previewOnly: true,
        requiresAsCreator: true,
        earnings: {
          rewardPerApprovedPoster: APPROVAL_REWARD,
          approvedPosterCount: 0,
          totalApprovedReward: 0,
          paidOut: 0,
          readyForPayout: 0,
          onHoldAmount: 0,
          pendingBalance: 0,
        },
        payoutProfile: null,
        approvedPosters: [],
        payoutHistory: [],
      });
    }
    const [posterSnap, payoutSnap, profileSnap] = await Promise.all([
      adminDb
        .collection("creatorPosters")
        .where("creatorPublicId", "==", creator.creatorPublicId)
        .get(),
      adminDb
        .collection("creatorPayouts")
        .where("creatorPublicId", "==", creator.creatorPublicId)
        .get(),
      adminDb
        .collection("creatorPayoutProfiles")
        .doc(creator.creatorPublicId)
        .get(),
    ]);

    const posters = posterSnap.docs
        .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          regionId: String(data.regionId ?? "").trim(),
          title: String(data.title ?? "Poster"),
          categoryLabel: String(data.categoryLabel ?? data.categoryId ?? ""),
          status: String(data.status ?? "pending"),
          createdAt: Number(data.createdAt ?? 0),
          approvedAt: Number(data.approvedAt ?? 0),
          approvalRewardAmount: Number(data.approvalRewardAmount ?? 0),
        };
      })
      .filter((poster) => poster.regionId === region.id)
      .sort((a, b) => Math.max(b.approvedAt, b.createdAt) - Math.max(a.approvedAt, a.createdAt));

    const approvedPosters = posters.filter((poster) => isApprovedEquivalentStatus(poster.status));
    const totalApprovedReward = approvedPosters.reduce(
      (sum, poster) => sum + (poster.approvalRewardAmount || APPROVAL_REWARD),
      0,
    );
    const paidOut = payoutSnap.docs.reduce((sum, doc) => {
      const data = doc.data();
      return String(data.status ?? "paid") === "paid" ? sum + Number(data.amount ?? 0) : sum;
    }, 0);
    const readyForPayout = payoutSnap.docs.reduce((sum, doc) => {
      const data = doc.data();
      return String(data.status ?? "") === "approved_for_payout"
        ? sum + Number(data.amount ?? 0)
        : sum;
    }, 0);
    const onHoldAmount = payoutSnap.docs.reduce((sum, doc) => {
      const data = doc.data();
      return String(data.status ?? "") === "on_hold" ? sum + Number(data.amount ?? 0) : sum;
    }, 0);
    const payoutHistory = payoutSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: Number(data.amount ?? 0),
          status: String(data.status ?? "approved_for_payout"),
          note: String(data.note ?? ""),
          createdAt: Number(data.createdAt ?? 0),
          settledAt: Number(data.settledAt ?? 0),
        };
      })
      .sort((a, b) => Math.max(b.settledAt, b.createdAt) - Math.max(a.settledAt, a.createdAt));

    const profile = profileSnap.exists ? profileSnap.data() as Record<string, unknown> : null;

    return NextResponse.json({
      ok: true,
      earnings: {
        rewardPerApprovedPoster: APPROVAL_REWARD,
        approvedPosterCount: approvedPosters.length,
        totalApprovedReward,
        paidOut,
        readyForPayout,
        onHoldAmount,
        pendingBalance: Math.max(0, totalApprovedReward - paidOut),
      },
      payoutProfile: profile
        ? {
            status: String(profile.status ?? "pending_review"),
            accountHolderName: String(profile.accountHolderName ?? ""),
            bankName: String(profile.bankName ?? ""),
            branchName: String(profile.branchName ?? ""),
            ifscCode: String(profile.ifscCode ?? ""),
            accountNumberMasked: String(profile.accountNumberMasked ?? ""),
            reviewComment: String(profile.reviewComment ?? ""),
            signatureName: String(profile.signatureName ?? ""),
            submittedAt: Number(profile.submittedAt ?? 0),
            reviewedAt: Number(profile.reviewedAt ?? 0),
          }
        : null,
      approvedPosters: approvedPosters.map((poster) => ({
        id: poster.id,
        title: poster.title,
        categoryLabel: poster.categoryLabel,
        approvedAt: poster.approvedAt,
        createdAt: poster.createdAt,
        rewardAmount: poster.approvalRewardAmount || APPROVAL_REWARD,
      })),
      payoutHistory,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load earnings.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
