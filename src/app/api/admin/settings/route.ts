import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { assertActorCanAccessRegion } from "@/lib/server/region-scope";

const SETTINGS_DOC_ID = "portalSettings";
const LANDING_DOC_ID = "landingPage";

function scopedDocId(baseId: string, regionId: string) {
  return `${baseId}_${regionId}`;
}

interface PortalSettingsRecord {
  defaultNotificationImageUrl: string;
  defaultLanguage: "en" | "te";
  ads: {
    homeExportRewardedEnabled: boolean;
    homeExportManualAd: {
      active: boolean;
      url: string;
      path: string;
      contentType: string;
      fileName: string;
      updatedAt: number;
    };
  };
  subscriptionExitVideo: {
    active: boolean;
    url: string;
    path: string;
    fileName: string;
    updatedAt: number;
  };
  subscriptionThanksVideo: {
    active: boolean;
    url: string;
    path: string;
    fileName: string;
    updatedAt: number;
  };
  notifications: {
    morningEnabled: boolean;
    afternoonEnabled: boolean;
    nightEnabled: boolean;
  };
  bannerVisibility: {
    appBannersVisible: boolean;
    creatorBannersVisible: boolean;
  };
  updatedAt: number;
  updatedByUid: string;
  updatedByEmail: string;
}

function boolValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function mergeSubscriptionVideo(
  existingVideo: Record<string, unknown> | undefined,
  bodyVideo: { active?: boolean; url?: string } | undefined,
) {
  const existingUrl = stringValue(existingVideo?.url);
  const requestedUrl = stringValue(bodyVideo?.url, existingUrl);
  const url = requestedUrl || existingUrl;
  return {
    active: boolValue(bodyVideo?.active, boolValue(existingVideo?.active, false)),
    url,
    path: stringValue(existingVideo?.path),
    fileName: stringValue(existingVideo?.fileName),
    updatedAt: Number(existingVideo?.updatedAt || 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const region = await assertActorCanAccessRegion(actor, req.nextUrl.searchParams.get("regionId"));
    const [settingsSnap, landingSnap] = await Promise.all([
      adminDb.collection("websiteConfig").doc(scopedDocId(SETTINGS_DOC_ID, region.id)).get(),
      adminDb.collection("websiteConfig").doc(scopedDocId(LANDING_DOC_ID, region.id)).get(),
    ]);

    const settingsData = settingsSnap.data() || {};
    const landingData = landingSnap.data() || {};
    const hero = (landingData.hero || {}) as Record<string, unknown>;

    const settings: PortalSettingsRecord & {
      landingPageTitle: string;
      landingPageSubtitle: string;
    } = {
      defaultNotificationImageUrl: stringValue(settingsData.defaultNotificationImageUrl),
      defaultLanguage:
        stringValue(settingsData.defaultLanguage) === "te" ? "te" : "en",
      subscriptionExitVideo: {
        active: boolValue(settingsData.subscriptionExitVideo?.active, false),
        url: stringValue(settingsData.subscriptionExitVideo?.url),
        path: stringValue(settingsData.subscriptionExitVideo?.path),
        fileName: stringValue(settingsData.subscriptionExitVideo?.fileName),
        updatedAt: Number(settingsData.subscriptionExitVideo?.updatedAt || 0),
      },
      subscriptionThanksVideo: {
        active: boolValue(settingsData.subscriptionThanksVideo?.active, false),
        url: stringValue(settingsData.subscriptionThanksVideo?.url),
        path: stringValue(settingsData.subscriptionThanksVideo?.path),
        fileName: stringValue(settingsData.subscriptionThanksVideo?.fileName),
        updatedAt: Number(settingsData.subscriptionThanksVideo?.updatedAt || 0),
      },
      notifications: {
        morningEnabled: boolValue(settingsData.notifications?.morningEnabled, true),
        afternoonEnabled: boolValue(settingsData.notifications?.afternoonEnabled, true),
        nightEnabled: boolValue(settingsData.notifications?.nightEnabled, true),
      },
      ads: {
        homeExportRewardedEnabled: boolValue(settingsData.ads?.homeExportRewardedEnabled, false),
        homeExportManualAd: {
          active: boolValue(settingsData.ads?.homeExportManualAd?.active, false),
          url: stringValue(settingsData.ads?.homeExportManualAd?.url),
          path: stringValue(settingsData.ads?.homeExportManualAd?.path),
          contentType: stringValue(settingsData.ads?.homeExportManualAd?.contentType),
          fileName: stringValue(settingsData.ads?.homeExportManualAd?.fileName),
          updatedAt: Number(settingsData.ads?.homeExportManualAd?.updatedAt || 0),
        },
      },
      bannerVisibility: {
        appBannersVisible: boolValue(settingsData.bannerVisibility?.appBannersVisible, true),
        creatorBannersVisible: boolValue(
          settingsData.bannerVisibility?.creatorBannersVisible,
          true,
        ),
      },
      landingPageTitle: stringValue(hero.title),
      landingPageSubtitle: stringValue(hero.subtitle),
      updatedAt: Number(settingsData.updatedAt || 0),
      updatedByUid: stringValue(settingsData.updatedByUid),
      updatedByEmail: stringValue(settingsData.updatedByEmail),
    };

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load settings.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const body = (await req.json()) as {
      regionId?: string;
      defaultNotificationImageUrl?: string;
      defaultLanguage?: string;
      notifications?: {
        morningEnabled?: boolean;
        afternoonEnabled?: boolean;
        nightEnabled?: boolean;
      };
      ads?: {
        homeExportRewardedEnabled?: boolean;
      };
      targetRegionIds?: string[];
      subscriptionExitVideo?: {
        active?: boolean;
        url?: string;
      };
      subscriptionThanksVideo?: {
        active?: boolean;
        url?: string;
      };
      bannerVisibility?: {
        appBannersVisible?: boolean;
        creatorBannersVisible?: boolean;
      };
      landingPageTitle?: string;
      landingPageSubtitle?: string;
    };
    const region = await assertActorCanAccessRegion(actor, body.regionId);
    const requestedRegionIds = Array.isArray(body.targetRegionIds)
      ? body.targetRegionIds.map((item) => stringValue(item)).filter(Boolean)
      : [];
    const targetRegions = requestedRegionIds.length
      ? await Promise.all(
          Array.from(new Set(requestedRegionIds)).map((regionId) =>
            assertActorCanAccessRegion(actor, regionId),
          ),
        )
      : [region];

    const now = Date.now();
    const landingDocId = scopedDocId(LANDING_DOC_ID, region.id);
    const currentSettingsRef = adminDb.collection("websiteConfig").doc(scopedDocId(SETTINGS_DOC_ID, region.id));
    const existingSettingsSnap = await currentSettingsRef.get();
    const existingSettings = existingSettingsSnap.data() || {};
    const subscriptionExitVideo = mergeSubscriptionVideo(
      existingSettings.subscriptionExitVideo as Record<string, unknown> | undefined,
      body.subscriptionExitVideo,
    );
    const subscriptionThanksVideo = mergeSubscriptionVideo(
      existingSettings.subscriptionThanksVideo as Record<string, unknown> | undefined,
      body.subscriptionThanksVideo,
    );
    await Promise.all([
      ...targetRegions.map(async (targetRegion) => {
        const settingsDocId = scopedDocId(SETTINGS_DOC_ID, targetRegion.id);
        const settingsRef = adminDb.collection("websiteConfig").doc(settingsDocId);
        const targetExistingSnap = targetRegion.id === region.id ? existingSettingsSnap : await settingsRef.get();
        const targetExisting = targetExistingSnap.data() || {};
        return settingsRef.set(
          {
            defaultNotificationImageUrl:
              targetRegion.id === region.id
                ? stringValue(body.defaultNotificationImageUrl)
                : stringValue(targetExisting.defaultNotificationImageUrl),
            regionId: targetRegion.id,
            regionName: targetRegion.name,
            defaultLanguage:
              targetRegion.id === region.id
                ? body.defaultLanguage === "te"
                  ? "te"
                  : "en"
                : stringValue(targetExisting.defaultLanguage) === "te"
                  ? "te"
                  : "en",
            subscriptionExitVideo: targetRegion.id === region.id
              ? subscriptionExitVideo
              : targetExisting.subscriptionExitVideo || {
                  active: false,
                  url: "",
                  path: "",
                  fileName: "",
                  updatedAt: 0,
                },
            subscriptionThanksVideo: targetRegion.id === region.id
              ? subscriptionThanksVideo
              : targetExisting.subscriptionThanksVideo || {
                  active: false,
                  url: "",
                  path: "",
                  fileName: "",
                  updatedAt: 0,
                },
            notifications:
              targetRegion.id === region.id
                ? {
                    morningEnabled: boolValue(body.notifications?.morningEnabled, true),
                    afternoonEnabled: boolValue(body.notifications?.afternoonEnabled, true),
                    nightEnabled: boolValue(body.notifications?.nightEnabled, true),
                  }
                : targetExisting.notifications || {
                    morningEnabled: true,
                    afternoonEnabled: true,
                    nightEnabled: true,
                  },
            ads: {
              ...(targetExisting.ads || {}),
              homeExportRewardedEnabled: boolValue(body.ads?.homeExportRewardedEnabled, false),
            },
            bannerVisibility:
              targetRegion.id === region.id
                ? {
                    appBannersVisible: boolValue(body.bannerVisibility?.appBannersVisible, true),
                    creatorBannersVisible: boolValue(
                      body.bannerVisibility?.creatorBannersVisible,
                      true,
                    ),
                  }
                : targetExisting.bannerVisibility || {
                    appBannersVisible: true,
                    creatorBannersVisible: true,
                  },
            updatedAt: now,
            updatedByUid: actor.uid,
            updatedByEmail: actor.email ?? "",
          },
          { merge: true },
        );
      }),
      adminDb.collection("websiteConfig").doc(landingDocId).set(
        {
          regionId: region.id,
          regionName: region.name,
          hero: {
            title: stringValue(body.landingPageTitle),
            subtitle: stringValue(body.landingPageSubtitle),
          },
          updatedAt: now,
          updatedByUid: actor.uid,
          updatedByEmail: actor.email ?? "",
        },
        { merge: true },
      ),
    ]);

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "admin.settings.update",
      targetId: scopedDocId(SETTINGS_DOC_ID, region.id),
      targetType: "websiteConfig",
      message: "Updated portal settings configuration",
      metadata: {
        regionId: region.id,
        regionName: region.name,
        targetRegionIds: targetRegions.map((item) => item.id),
        homeExportRewardedEnabled: boolValue(body.ads?.homeExportRewardedEnabled, false),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save settings.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
