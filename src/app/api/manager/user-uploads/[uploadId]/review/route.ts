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
  CREATOR_ASSIGNABLE_CATEGORIES,
  canonicalCategoryId,
} from "@/lib/server/categories";
import {
  POLITICAL_PARTY_CATEGORY_IDS,
  politicalPartyCategoriesForRegion,
} from "@/lib/political-party-categories";
import { politicalPartyCategoriesForRegionManaged } from "@/lib/server/political-parties";

const payloadSchema = z.object({
  status: z.enum(["approved", "rejected", "deleted"]),
  rejectionReason: z.string().trim().max(300).optional(),
  personalizationConfig: z.record(z.string(), z.unknown()).optional(),
  categoryId: z.string().trim().min(1).optional(),
  categoryLabel: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().url().optional(),
  imagePath: z.string().trim().min(1).optional(),
});

type NotificationLanguage =
  | "telugu"
  | "hindi"
  | "english"
  | "tamil"
  | "kannada"
  | "malayalam"
  | "assamese"
  | "konkani"
  | "gujarati"
  | "marathi"
  | "meitei"
  | "mizo"
  | "odia"
  | "punjabi"
  | "nepali"
  | "bengali"
  | "kashmiri"
  | "ladakhi";

function normalizeNotificationLanguage(value: unknown): NotificationLanguage {
  const normalized = String(value ?? "").trim().toLowerCase();
  const supported = new Set<NotificationLanguage>([
    "telugu",
    "hindi",
    "english",
    "tamil",
    "kannada",
    "malayalam",
    "assamese",
    "konkani",
    "gujarati",
    "marathi",
    "meitei",
    "mizo",
    "odia",
    "punjabi",
    "nepali",
    "bengali",
    "kashmiri",
    "ladakhi",
  ]);
  return supported.has(normalized as NotificationLanguage)
    ? (normalized as NotificationLanguage)
    : "english";
}

function userUploadStatusCopy(
  status: "approved" | "rejected",
  language: NotificationLanguage,
) {
  const copy: Record<NotificationLanguage, { approved: string; rejected: string }> = {
    telugu: {
      approved: "మీ పోస్టర్ ఆమోదించబడింది.",
      rejected: "మీ పోస్టర్ తిరస్కరించబడింది.",
    },
    hindi: {
      approved: "आपका पोस्टर मंजूर हो गया है।",
      rejected: "आपका पोस्टर अस्वीकार कर दिया गया है।",
    },
    english: {
      approved: "Your poster has been approved.",
      rejected: "Your poster has been rejected.",
    },
    tamil: {
      approved: "உங்கள் போஸ்டர் அங்கீகரிக்கப்பட்டது.",
      rejected: "உங்கள் போஸ்டர் நிராகரிக்கப்பட்டது.",
    },
    kannada: {
      approved: "ನಿಮ್ಮ ಪೋಸ್ಟರ್ ಅನುಮೋದಿಸಲಾಗಿದೆ.",
      rejected: "ನಿಮ್ಮ ಪೋಸ್ಟರ್ ನಿರಾಕರಿಸಲಾಗಿದೆ.",
    },
    malayalam: {
      approved: "നിങ്ങളുടെ പോസ്റ്റർ അംഗീകരിച്ചു.",
      rejected: "നിങ്ങളുടെ പോസ്റ്റർ നിരസിച്ചു.",
    },
    assamese: {
      approved: "আপোনাৰ পোষ্টাৰ অনুমোদিত হৈছে।",
      rejected: "আপোনাৰ পোষ্টাৰ নাকচ কৰা হৈছে।",
    },
    konkani: {
      approved: "तुमचो पोस्टर मंजूर जाला.",
      rejected: "तुमचो पोस्टर नाकारला.",
    },
    gujarati: {
      approved: "તમારું પોસ્ટર મંજૂર થયું છે.",
      rejected: "તમારું પોસ્ટર નકારવામાં આવ્યું છે.",
    },
    marathi: {
      approved: "तुमचा पोस्टर मंजूर झाला आहे.",
      rejected: "तुमचा पोस्टर नाकारला आहे.",
    },
    meitei: {
      approved: "নহাক্কী poster approve তৌরে.",
      rejected: "নহাক্কী poster reject তৌরে.",
    },
    mizo: {
      approved: "I poster pawm a ni.",
      rejected: "I poster hnawl a ni.",
    },
    odia: {
      approved: "ଆପଣଙ୍କ ପୋଷ୍ଟର ଅନୁମୋଦିତ ହୋଇଛି।",
      rejected: "ଆପଣଙ୍କ ପୋଷ୍ଟର ଅସ୍ୱୀକାର ହୋଇଛି।",
    },
    punjabi: {
      approved: "ਤੁਹਾਡਾ ਪੋਸਟਰ ਮਨਜ਼ੂਰ ਹੋ ਗਿਆ ਹੈ।",
      rejected: "ਤੁਹਾਡਾ ਪੋਸਟਰ ਰੱਦ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
    },
    nepali: {
      approved: "तपाईंको पोस्टर स्वीकृत भएको छ।",
      rejected: "तपाईंको पोस्टर अस्वीकार गरिएको छ।",
    },
    bengali: {
      approved: "আপনার পোস্টার অনুমোদিত হয়েছে।",
      rejected: "আপনার পোস্টার বাতিল করা হয়েছে।",
    },
    kashmiri: {
      approved: "تُہند پوسٹر منظور گومُت چھ۔",
      rejected: "تُہند پوسٹر رد گومُت چھ۔",
    },
    ladakhi: {
      approved: "Khyod-kyi poster approve in.",
      rejected: "Khyod-kyi poster reject in.",
    },
  };
  return {
    title: "Mana Poster",
    body: status === "approved" ? copy[language].approved : copy[language].rejected,
  };
}


async function sendUserUploadStatusNotificationLocalized(
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
  const tokensByLanguage = new Map<NotificationLanguage, string[]>();
  for (const doc of tokensSnap.docs) {
    const data = doc.data();
    const token = String(data.token ?? "").trim();
    if (!token) {
      continue;
    }
    const language = normalizeNotificationLanguage(data.preferredLanguage);
    const tokens = tokensByLanguage.get(language) ?? [];
    tokens.push(token);
    tokensByLanguage.set(language, tokens);
  }
  if (tokensByLanguage.size === 0) {
    return;
  }
  const isApproved = status === "approved";
  for (const [language, tokens] of tokensByLanguage.entries()) {
    const { title, body } = userUploadStatusCopy(status, language);
    await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        route: "home",
        source: "manager_user_upload_review",
        userUploadStatus: status,
        title,
        body,
        title_key: isApproved ? "user_upload_approved_title" : "user_upload_rejected_title",
        body_key: isApproved ? "user_upload_approved_body" : "user_upload_rejected_body",
        languageCode: language,
        rejectionReason: isApproved ? "" : rejectionReason,
      },
      android: {
        priority: "high",
      },
    });
  }
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
    const categoryId = canonicalCategoryId(
      payload.categoryId ?? String(current.categoryId ?? "").trim(),
    );
    const submittedCategoryLabel =
      payload.categoryLabel ?? String(current.categoryLabel ?? "").trim();
    const categoryLabel =
      CREATOR_ASSIGNABLE_CATEGORIES.find((item) => item.id === categoryId)
        ?.label ?? submittedCategoryLabel;
    const regionId = String(current.regionId ?? "").trim();
    const regionName = String(current.regionName ?? "").trim();
    await assertActorCanAccessRegion(actor, regionId);
    const imageUrl = payload.imageUrl ?? String(current.imageUrl ?? "").trim();
    const imagePath =
      payload.imagePath ?? String(current.imagePath ?? "").trim();
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
      const managedPoliticalCategories = categoryId.startsWith("party_")
        ? await politicalPartyCategoriesForRegionManaged(regionId)
        : [];
      const isManagedPoliticalCategory = managedPoliticalCategories.some(
        (item) => item.id === categoryId,
      );
      const isFallbackPoliticalCategory =
        POLITICAL_PARTY_CATEGORY_IDS.has(categoryId) &&
        politicalPartyCategoriesForRegion(regionId).some(
          (item) => item.id === categoryId,
        );
      if (
        (categoryId.startsWith("party_") ||
          POLITICAL_PARTY_CATEGORY_IDS.has(categoryId)) &&
        !isManagedPoliticalCategory &&
        !isFallbackPoliticalCategory
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This political party category is not available for the upload State / UT.",
          },
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
          userId,
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
    await sendUserUploadStatusNotificationLocalized(
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
