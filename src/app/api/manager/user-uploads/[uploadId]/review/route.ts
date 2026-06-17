import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, adminMessaging } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import {
  buildNewApprovedPosterId,
  buildUserUploadApprovalWrite,
  buildUserUploadHistoryEntry,
  defaultUserUploadPersonalizationConfig,
  deleteUserUploadCascade,
  promoteUserUploadAssetToPublicPosterAsset,
  resolveUserUploadPublishSchedule,
  sanitizeUserUploadPersonalizationConfig,
  USER_UPLOAD_RETENTION_MS,
} from "@/lib/server/user-uploads";
import { deleteAdminAsset } from "@/lib/server/content-management";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";
import {
  POLITICAL_PARTY_CATEGORY_IDS,
  politicalPartyCategoriesForRegion,
} from "@/lib/political-party-categories";

const payloadSchema = z.object({
  status: z.enum(["approved", "rejected", "deleted"]),
  rejectionReason: z.string().trim().max(300).optional(),
  personalizationConfig: z.record(z.string(), z.unknown()).optional(),
  categoryId: z.string().trim().min(1).optional(),
  categoryLabel: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().url().optional(),
  imagePath: z.string().trim().min(1).optional(),
});

async function sendUserUploadStatusNotification(
  uid: string,
  status: "approved" | "rejected",
  rejectionReason: string,
) {
  if (!uid) {
    return;
  }
  const tokensSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("deviceTokens")
    .get();
  const tokens = tokensSnap.docs
    .map((doc) => String(doc.data().token ?? "").trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return;
  }
  const isApproved = status === "approved";
  const title = "Mana Poster";
  const body = isApproved
    ? "మీ పోస్టర్ ఆమోదించబడింది"
    : "మీ పోస్టర్ తిరస్కరించబడింది";
  await adminMessaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      route: "home",
      source: "manager_user_upload_review",
      userUploadStatus: status,
      rejectionReason: isApproved ? "" : rejectionReason,
    },
    android: {
      priority: "high",
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  try {
    const actor = await requireRole(req, ["admin", "manager"]);
    const payload = payloadSchema.parse(await req.json());
    const { uploadId } = await params;
    const uploadRef = adminDb.collection("userPosterUploads").doc(uploadId);
    const uploadSnap = await uploadRef.get();
    if (!uploadSnap.exists) {
      return NextResponse.json(
        { ok: false, error: "Upload not found." },
        { status: 404 },
      );
    }
    const now = Date.now();
    const current = uploadSnap.data() as Record<string, unknown>;
    const userId = String(current.userId ?? "").trim();
    const userName = String(current.userName ?? "").trim() || "User";
    const categoryId = payload.categoryId ?? String(current.categoryId ?? "").trim();
    const categoryLabel =
      payload.categoryLabel ?? String(current.categoryLabel ?? "").trim();
    const regionId = String(current.regionId ?? "").trim();
    const regionName = String(current.regionName ?? "").trim();
    await assertActorCanAccessRegion(actor, regionId);
    const imageUrl = payload.imageUrl ?? String(current.imageUrl ?? "").trim();
    const imagePath = payload.imagePath ?? String(current.imagePath ?? "").trim();
    const currentStatus = String(current.status ?? "pending")
      .trim()
      .toLowerCase();
    if (!["pending", "rejected", "approved"].includes(currentStatus)) {
      return NextResponse.json(
        { ok: false, error: "Invalid upload status." },
        { status: 400 },
      );
    }
    if (
      payload.status === "rejected" &&
      !(payload.rejectionReason ?? "").trim()
    ) {
      return NextResponse.json(
        { ok: false, error: "Rejection reason is required." },
        { status: 400 },
      );
    }
    if (payload.status === "deleted") {
      await deleteUserUploadCascade(uploadId);
      return NextResponse.json({ ok: true, deleted: true });
    }

    let approvedPosterTemplateId = String(
      current.approvedPosterTemplateId ?? "",
    ).trim();
    const uploadCreatedAt = Number(current.createdAt ?? 0);
    const appVisibleFromAt = Number(current.appVisibleFromAt ?? 0);
    const nextExpiresAt = now + USER_UPLOAD_RETENTION_MS;
    if (payload.status === "approved") {
      if (!imageUrl || !imagePath) {
        return NextResponse.json(
          {
            ok: false,
            error: "Poster image is required before uploading.",
          },
          { status: 400 },
        );
      }
      if (
        POLITICAL_PARTY_CATEGORY_IDS.has(categoryId) &&
        !politicalPartyCategoriesForRegion(regionId).some((item) => item.id === categoryId)
      ) {
        return NextResponse.json(
          { ok: false, error: "This political party category is not available for the upload State / UT." },
          { status: 400 },
        );
      }
      const schedule = await resolveUserUploadPublishSchedule(
        categoryId,
        uploadCreatedAt,
        now,
        appVisibleFromAt,
        regionId,
      );
      const personalizationConfig = sanitizeUserUploadPersonalizationConfig(
        payload.personalizationConfig ??
          current.personalizationConfig ??
          defaultUserUploadPersonalizationConfig,
      );
      if (!approvedPosterTemplateId) {
        approvedPosterTemplateId = buildNewApprovedPosterId();
      }
      const posterRef = adminDb
        .collection("creatorPosters")
        .doc(approvedPosterTemplateId);
      const existingPosterSnap = await posterRef.get();
      const existingPoster = existingPosterSnap.exists
        ? (existingPosterSnap.data() as Record<string, unknown>)
        : null;
      const publicAsset = await promoteUserUploadAssetToPublicPosterAsset({
        sourcePath: imagePath,
        fallbackImageUrl: imageUrl,
        posterId: approvedPosterTemplateId,
      });
      const previousPosterImagePath = String(
        existingPoster?.imagePath ?? "",
      ).trim();
      if (
        previousPosterImagePath &&
        previousPosterImagePath !== publicAsset.imagePath &&
        previousPosterImagePath.startsWith("creator-posters/")
      ) {
        await deleteAdminAsset(previousPosterImagePath);
      }
      await posterRef.set(
        buildUserUploadApprovalWrite({
          uploadId,
          posterId: approvedPosterTemplateId,
          userName,
          userEmail: String(current.userEmail ?? "").trim(),
          userMobile: String(current.userMobile ?? "").trim(),
          categoryId,
          categoryLabel,
          regionId,
          regionName,
          imageUrl: publicAsset.imageUrl,
          imagePath: publicAsset.imagePath,
          approvedAt: now,
          publishAt: schedule.publishAt,
          eventStartAt: schedule.eventStartAt,
          eventEndAt: schedule.eventEndAt,
          personalizationConfig,
        }),
        { merge: true },
      );
    }

    const rejectionReason =
      payload.status === "rejected"
        ? (payload.rejectionReason ?? "").trim()
        : "";
    await uploadRef.set(
      {
        status: payload.status,
        rejectionReason,
        approvedPosterTemplateId:
          payload.status === "approved" ? approvedPosterTemplateId : "",
        personalizationConfig:
          payload.status === "approved"
            ? sanitizeUserUploadPersonalizationConfig(
                payload.personalizationConfig ?? current.personalizationConfig,
              )
            : (current.personalizationConfig ??
              defaultUserUploadPersonalizationConfig),
        categoryId,
        categoryLabel,
        regionId,
        regionName,
        imageUrl,
        imagePath,
        hasImage: Boolean(imageUrl && imagePath),
        submissionType:
          String(current.quoteText ?? "").trim() && imageUrl
            ? "image_quote"
            : imageUrl
              ? "image"
              : String(current.submissionType ?? "").trim(),
        reviewedByUid: actor.uid,
        reviewedByEmail: actor.email ?? "",
        reviewedAt: now,
        expiresAt: nextExpiresAt,
        updatedAtMillis: now,
        updatedAt: now,
        history: [
          ...(Array.isArray(current.history) ? current.history : []),
          buildUserUploadHistoryEntry({
            type: payload.status,
            actorId: actor.uid,
            actorRole: actor.role,
            actorName: actor.email ?? actor.uid,
            reason: rejectionReason,
          }),
        ],
      },
      { merge: true },
    );
    await sendUserUploadStatusNotification(
      userId,
      payload.status,
      rejectionReason,
    );
    return NextResponse.json({ ok: true, approvedPosterTemplateId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to review upload.";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
