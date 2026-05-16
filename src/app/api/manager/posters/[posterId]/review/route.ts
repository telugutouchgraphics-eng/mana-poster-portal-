import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { assertPosterInScope } from "@/lib/server/manager-scope";
import { writeAuditLog } from "@/lib/server/audit-log";
import { deleteAdminAsset } from "@/lib/server/content-management";
import {
  getVisibleDynamicCategoryById,
  getWeekdayForCategoryId,
} from "@/lib/server/categories";
import { getManualEventCategoryById } from "@/lib/server/manual-event-categories";
import {
  getCreatorPosterPublishAt,
  getIstEndOfDay,
  getNextIstMidnight,
  getNextIstWeekdayStart,
  getPosterPublishAt,
} from "@/lib/server/ist-schedule";
import {
  resolveFeedPublishAtMs,
  resolveManualFeedPublishAtMs,
} from "@/lib/server/poster-feed-schedule";

const APPROVAL_REWARD_AMOUNT = 10;

const payloadSchema = z.object({
  status: z.enum(["approved", "rejected", "archived", "deleted"]),
  reviewComment: z.string().trim().max(300).optional(),
});

async function resolveCreatorPosterPublishSchedule(categoryId: string, uploadedAt: number, approvedAt: number) {
  const weekday = getWeekdayForCategoryId(categoryId);
  if (weekday) {
    const scheduledStart = getNextIstWeekdayStart(approvedAt, weekday);
    return {
      publishAt: scheduledStart,
      eventStartAt: scheduledStart,
      eventEndAt: getNextIstMidnight(scheduledStart) - 1,
    };
  }

  const creatorPublishAt = getCreatorPosterPublishAt(uploadedAt);
  const creatorEventEndAt = getIstEndOfDay(creatorPublishAt);
  if (creatorPublishAt >= approvedAt) {
    return {
      publishAt: creatorPublishAt,
      eventStartAt: creatorPublishAt,
      eventEndAt: creatorEventEndAt,
    };
  }

  const dynamicSchedule = getVisibleDynamicCategoryById(
    categoryId,
    new Date(uploadedAt),
    2,
    7,
    2,
  );
  if (!dynamicSchedule) {
    const item = await getManualEventCategoryById(categoryId);
    if (!item) {
      return {
        publishAt: Math.max(getPosterPublishAt(uploadedAt, approvedAt), approvedAt),
        eventStartAt: 0,
        eventEndAt: 0,
      };
    }
    return {
      publishAt: resolveManualFeedPublishAtMs(item.startAt, approvedAt),
      eventStartAt: item.startAt,
      eventEndAt: item.endAt,
    };
  }
  const eventStartAt = dynamicSchedule?.eventStartAt ?? 0;
  const eventEndAt = dynamicSchedule?.eventEndAt ?? 0;
  return {
    publishAt: resolveFeedPublishAtMs(eventStartAt, approvedAt),
    eventStartAt,
    eventEndAt,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ posterId: string }> }
) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const { posterId } = await params;
    const payload = payloadSchema.parse(await req.json());

    const posterRef = adminDb.collection("creatorPosters").doc(posterId);
    const snap = await posterRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { ok: false, error: "Poster not found." },
        { status: 404 }
      );
    }

    const currentData = snap.data() as Record<string, unknown>;
    await assertPosterInScope(actor, currentData);
    const now = Date.now();
    const hardDelete = payload.status === "deleted";

    if (hardDelete) {
      await posterRef.delete();
      await Promise.all([
        deleteAdminAsset(String(currentData.imagePath ?? "")),
        deleteAdminAsset(String(currentData.videoPath ?? "")),
      ]);

      await writeAuditLog({
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        action: "poster_review_deleted",
        targetType: "creator_poster",
        targetId: posterId,
        message: "Poster deleted from manager review.",
        metadata: {
          status: payload.status,
          reviewComment: payload.reviewComment ?? "",
        },
      });

      return NextResponse.json({ ok: true });
    }

    await adminDb.runTransaction(async (tx) => {
      const currentSnap = await tx.get(posterRef);
      if (!currentSnap.exists) {
        throw new Error("Poster not found.");
      }
      const current = currentSnap.data() as Record<string, unknown>;
      const history = Array.isArray(current.reviewHistory) ? current.reviewHistory : [];
      const wasApproved = String(current.status ?? "pending") === "approved";
      const rewardAlreadyGranted = Number(current.approvalRewardAmount ?? 0) > 0;
      const creatorPublicId = String(current.creatorPublicId ?? "");
      const categoryId = String(current.categoryId ?? "");
      const categoryLabel = String(current.categoryLabel ?? "");
      const title = String(current.title ?? "Poster");
      const uploadedAt = Number(current.createdAt ?? now);
      const createdByRole = String(current.createdByRole ?? "").trim().toLowerCase();
      const createdBySurface = String(current.createdBySurface ?? "").trim().toLowerCase();
      const isCreatorUpload = createdByRole === "creator" || createdBySurface === "creator_upload";
      const creatorSchedule =
        payload.status === "approved" && isCreatorUpload
          ? await resolveCreatorPosterPublishSchedule(categoryId, uploadedAt, now)
          : null;
      const publishAt =
        payload.status === "approved"
          ? (creatorSchedule?.publishAt ?? getPosterPublishAt(uploadedAt, now))
          : Number(current.publishAt ?? 0);
      const nextUpdate: Record<string, unknown> = {
        status: payload.status,
        reviewComment: payload.reviewComment ?? "",
        updatedAt: now,
        archivedAt: payload.status === "archived" ? now : null,
        deletedAt: null,
        approvedAt: payload.status === "approved" ? now : Number(current.approvedAt ?? 0),
        publishAt,
        eventStartAt:
          payload.status === "approved" && creatorSchedule
            ? creatorSchedule.eventStartAt
            : Number(current.eventStartAt ?? 0),
        eventEndAt:
          payload.status === "approved" && creatorSchedule
            ? creatorSchedule.eventEndAt
            : Number(current.eventEndAt ?? 0),
        performanceWindowStartAt: payload.status === "approved" ? publishAt : Number(current.performanceWindowStartAt ?? 0),
        performanceWindowEndAt:
          payload.status === "approved"
            ? (creatorSchedule?.eventEndAt && creatorSchedule.eventEndAt >= publishAt
                ? creatorSchedule.eventEndAt
                : publishAt + 24 * 60 * 60 * 1000)
            : Number(current.performanceWindowEndAt ?? 0),
        dashboardHiddenAt: payload.status === "approved" ? 0 : Number(current.dashboardHiddenAt ?? 0),
        dashboardHiddenReason: payload.status === "approved" ? "" : String(current.dashboardHiddenReason ?? ""),
        dashboardVisibleUntil:
          payload.status === "approved"
            ? now + 24 * 60 * 60 * 1000
            : Number(current.dashboardVisibleUntil ?? 0),
        reviewHistory: [
          ...history,
          {
            type:
              payload.status === "approved"
                ? "approved"
                : payload.status === "rejected"
                  ? "rejected"
                  : payload.status,
            actorRole: actor.role,
            actorId: actor.uid,
            actorName: actor.email ?? actor.uid,
            comment: payload.reviewComment ?? "",
            createdAt: now,
          },
        ],
      };

      if (payload.status === "approved" && !wasApproved && !rewardAlreadyGranted && creatorPublicId) {
        const ledgerRef = adminDb.collection("creatorEarningLedger").doc();
        nextUpdate.creatorEarnings = Number(current.creatorEarnings ?? 0) + APPROVAL_REWARD_AMOUNT;
        nextUpdate.approvalRewardAmount = APPROVAL_REWARD_AMOUNT;
        nextUpdate.approvalRewardGrantedAt = now;
        tx.set(ledgerRef, {
          id: ledgerRef.id,
          type: "sale",
          source: "manager_poster_approval_reward",
          posterId,
          creatorPublicId,
          categoryId,
          categoryLabel,
          grossAmount: APPROVAL_REWARD_AMOUNT,
          creatorAmount: APPROVAL_REWARD_AMOUNT,
          platformAmount: 0,
          note: `${title} approved reward`,
          createdAt: now,
          createdByUid: actor.uid,
          createdByRole: actor.role,
        });
      }

      tx.update(posterRef, nextUpdate);
    });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "poster_review_updated",
      targetType: "creator_poster",
      targetId: posterId,
      message: `Poster status changed to ${payload.status}.`,
      metadata: {
        status: payload.status,
        reviewComment: payload.reviewComment ?? "",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update poster.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
