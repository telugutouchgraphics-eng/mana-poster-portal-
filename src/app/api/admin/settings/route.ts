import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";

const SETTINGS_DOC_ID = "portalSettings";
const LANDING_DOC_ID = "landingPage";

interface PortalSettingsRecord {
  defaultNotificationImageUrl: string;
  defaultLanguage: "en" | "te";
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
    await requireRole(req, ["admin"]);
    const [settingsSnap, landingSnap] = await Promise.all([
      adminDb.collection("websiteConfig").doc(SETTINGS_DOC_ID).get(),
      adminDb.collection("websiteConfig").doc(LANDING_DOC_ID).get(),
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
      defaultNotificationImageUrl?: string;
      defaultLanguage?: string;
      notifications?: {
        morningEnabled?: boolean;
        afternoonEnabled?: boolean;
        nightEnabled?: boolean;
      };
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

    const now = Date.now();
    const settingsRef = adminDb.collection("websiteConfig").doc(SETTINGS_DOC_ID);
    const existingSettingsSnap = await settingsRef.get();
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
      settingsRef.set(
        {
          defaultNotificationImageUrl: stringValue(body.defaultNotificationImageUrl),
          defaultLanguage: body.defaultLanguage === "te" ? "te" : "en",
          subscriptionExitVideo,
          subscriptionThanksVideo,
          notifications: {
            morningEnabled: boolValue(body.notifications?.morningEnabled, true),
            afternoonEnabled: boolValue(body.notifications?.afternoonEnabled, true),
            nightEnabled: boolValue(body.notifications?.nightEnabled, true),
          },
          bannerVisibility: {
            appBannersVisible: boolValue(body.bannerVisibility?.appBannersVisible, true),
            creatorBannersVisible: boolValue(
              body.bannerVisibility?.creatorBannersVisible,
              true,
            ),
          },
          updatedAt: now,
          updatedByUid: actor.uid,
          updatedByEmail: actor.email ?? "",
        },
        { merge: true },
      ),
      adminDb.collection("websiteConfig").doc(LANDING_DOC_ID).set(
        {
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
      targetId: SETTINGS_DOC_ID,
      targetType: "websiteConfig",
      message: "Updated portal settings configuration",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save settings.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
