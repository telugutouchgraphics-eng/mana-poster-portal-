import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRole } from "@/lib/server/auth";
import { writeAuditLog } from "@/lib/server/audit-log";
import { uploadAdminAsset } from "@/lib/server/content-management";

export interface HomeHeaderConfigData {
  enabled: boolean;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl?: string;
  templateId?: string;
  themeTitle?: string;
  overlayOpacity?: number;
  updatedAt: number;
  updatedBy: string;
}

const DEFAULT_CONFIG: HomeHeaderConfigData = {
  enabled: false,
  mediaType: "image",
  imageUrl: "",
  videoUrl: "",
  templateId: "",
  themeTitle: "Default Gradient",
  overlayOpacity: 0.15,
  updatedAt: 0,
  updatedBy: "system",
};

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ["admin", "manager"]);
    const docSnap = await adminDb.collection("appConfig").doc("homeHeader").get();
    if (!docSnap.exists) {
      return NextResponse.json({ ok: true, config: DEFAULT_CONFIG });
    }
    const data = docSnap.data() as Partial<HomeHeaderConfigData>;
    return NextResponse.json({
      ok: true,
      config: {
        ...DEFAULT_CONFIG,
        ...data,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load header config";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, ["admin"]);
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      const enabled = formData.get("enabled") !== "false";
      const overlayOpacity = Math.min(0.6, Math.max(0, Number(formData.get("overlayOpacity") ?? 0.15)));
      const themeTitle = String(formData.get("themeTitle") ?? "Custom Upload").trim();

      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ ok: false, error: "A valid image or video file is required." }, { status: 400 });
      }

      const isVideo = file.type.startsWith("video/");
      const maxBytes = isVideo ? 3 * 1024 * 1024 : 1024 * 1024; // 3MB video, 1MB image
      if (file.size > maxBytes) {
        return NextResponse.json(
          { ok: false, error: `File too large. Maximum size is ${isVideo ? "3 MB for video" : "1 MB for image"}.` },
          { status: 400 },
        );
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "png");
      const storagePath = `home_headers/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { imageUrl } = await uploadAdminAsset(bytes, file.type, storagePath);

      const newConfig: HomeHeaderConfigData = {
        enabled,
        mediaType: isVideo ? "video" : "image",
        imageUrl,
        videoUrl: isVideo ? imageUrl : "",
        templateId: "",
        themeTitle,
        overlayOpacity,
        updatedAt: Date.now(),
        updatedBy: actor.email || actor.uid,
      };

      await adminDb.collection("appConfig").doc("homeHeader").set(newConfig, { merge: true });

      await writeAuditLog({
        actorUid: actor.uid,
        actorRole: actor.role,
        actorEmail: actor.email,
        action: "update_home_header",
        targetType: "appConfig",
        targetId: "homeHeader",
        message: `Updated home header background to ${isVideo ? "video" : "image"}`,
        metadata: { type: isVideo ? "video" : "image", imageUrl, themeTitle },
      });

      return NextResponse.json({ ok: true, config: newConfig });
    }

    // JSON Payload for templates or toggles
    const body = await req.json();
    const enabled = body.enabled !== false;
    const templateId = String(body.templateId ?? "").trim();
    const imageUrl = String(body.imageUrl ?? "").trim();
    const videoUrl = String(body.videoUrl ?? "").trim();
    const mediaType = body.mediaType === "video" ? "video" : "image";
    const themeTitle = String(body.themeTitle ?? "").trim() || (enabled ? "Festival Template" : "Default Gradient");
    const overlayOpacity = Math.min(0.6, Math.max(0, Number(body.overlayOpacity ?? 0.15)));

    const newConfig: HomeHeaderConfigData = {
      enabled,
      mediaType,
      imageUrl,
      videoUrl,
      templateId,
      themeTitle,
      overlayOpacity,
      updatedAt: Date.now(),
      updatedBy: actor.email || actor.uid,
    };

    await adminDb.collection("appConfig").doc("homeHeader").set(newConfig, { merge: true });

    await writeAuditLog({
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: "update_home_header",
      targetType: "appConfig",
      targetId: "homeHeader",
      message: `Updated home header background to ${themeTitle}`,
      metadata: { enabled, templateId, themeTitle, imageUrl },
    });

    return NextResponse.json({ ok: true, config: newConfig });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update header config";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
