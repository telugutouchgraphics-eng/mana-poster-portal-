"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FESTIVAL_HEADER_TEMPLATES, FestivalHeaderTemplate } from "@/lib/festival-header-templates";

interface HeaderConfig {
  enabled: boolean;
  mediaType: "image" | "video";
  imageUrl: string;
  videoUrl?: string;
  templateId?: string;
  themeTitle?: string;
  overlayOpacity?: number;
  updatedAt?: number;
  updatedBy?: string;
}

const DEFAULT_GRADIENT = "linear-gradient(135deg, #D81B60 0%, #FF6F3C 58%, #FFB703 100%)";

export default function HomeHeaderAdminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Config
  const [config, setConfig] = useState<HeaderConfig>({
    enabled: false,
    mediaType: "image",
    imageUrl: "",
    videoUrl: "",
    templateId: "",
    themeTitle: "Default Gradient",
    overlayOpacity: 0.15,
  });

  // Local draft state for live preview
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewMediaType, setPreviewMediaType] = useState<"image" | "video">("image");
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewVideoUrl, setPreviewVideoUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("Default Gradient");
  const [previewOpacity, setPreviewOpacity] = useState(0.15);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  // Upload file state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        const token = await user?.getIdToken();
        const res = await fetch("/api/admin/home-header", {
          headers: { authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.ok && data.config) {
          setConfig(data.config);
          setPreviewEnabled(data.config.enabled);
          setPreviewMediaType(data.config.mediaType || "image");
          setPreviewImageUrl(data.config.imageUrl || "");
          setPreviewVideoUrl(data.config.videoUrl || "");
          setPreviewTitle(data.config.themeTitle || (data.config.enabled ? "Custom Header" : "Default Gradient"));
          setPreviewOpacity(data.config.overlayOpacity ?? 0.15);
          setSelectedTemplateId(data.config.templateId || "");
        }
      } catch (err) {
        setErrorMsg("Failed to load header configuration.");
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      void fetchConfig();
    }
  }, [user]);

  function handleSelectTemplate(tpl: FestivalHeaderTemplate) {
    setSelectedFile(null);
    setPreviewEnabled(true);
    setPreviewMediaType(tpl.mediaType);
    setPreviewImageUrl(tpl.imageUrl);
    setPreviewVideoUrl(tpl.videoUrl || "");
    setPreviewTitle(`${tpl.teluguName} (${tpl.name})`);
    setSelectedTemplateId(tpl.id);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSelectedTemplateId("");
    setPreviewEnabled(true);

    const isVideo = file.type.startsWith("video/");
    setPreviewMediaType(isVideo ? "video" : "image");
    setPreviewTitle(file.name);

    const objectUrl = URL.createObjectURL(file);
    if (isVideo) {
      setPreviewVideoUrl(objectUrl);
      setPreviewImageUrl("");
    } else {
      setPreviewImageUrl(objectUrl);
      setPreviewVideoUrl("");
    }
  }

  function handleResetDefault() {
    setSelectedFile(null);
    setSelectedTemplateId("");
    setPreviewEnabled(false);
    setPreviewImageUrl("");
    setPreviewVideoUrl("");
    setPreviewTitle("Default Gradient (పింక్-ఆరెంజ్-పసుపు)");
  }

  async function handleSaveLive() {
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const token = await user?.getIdToken();

      if (selectedFile) {
        // Upload custom file via multipart
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("enabled", "true");
        formData.append("overlayOpacity", String(previewOpacity));
        formData.append("themeTitle", previewTitle);

        const res = await fetch("/api/admin/home-header", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Upload failed");
        setConfig(data.config);
        setSelectedFile(null);
        setSuccessMsg("🎉 Header background updated and published live to app!");
      } else {
        if (previewImageUrl.startsWith("blob:") || previewVideoUrl.startsWith("blob:")) {
          throw new Error("Please click 'Upload & Publish Live' below or pick a template from the library.");
        }
        // Publish template or default gradient
        const res = await fetch("/api/admin/home-header", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            enabled: previewEnabled,
            mediaType: previewMediaType,
            imageUrl: previewImageUrl,
            videoUrl: previewVideoUrl,
            templateId: selectedTemplateId,
            themeTitle: previewTitle,
            overlayOpacity: previewOpacity,
          }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Failed to update header");
        setConfig(data.config);
        setSuccessMsg(
          previewEnabled
            ? `🎉 Header theme "${previewTitle}" published live to app!`
            : "✅ Default gradient restored successfully!",
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Header Information & Specs Banner */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400">
              Header Customization Studio
            </span>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              Home Screen Header Background & Themes
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Customize the top header background of the mobile app with festival themes, custom artwork, or looping videos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                config.enabled
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${config.enabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              {config.enabled ? `Active: ${config.themeTitle || "Custom Theme"}` : "Active: Default Gradient"}
            </span>
          </div>
        </div>

        {/* Dimension & File Guide */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-indigo-50/60 p-4 sm:grid-cols-4 dark:bg-indigo-950/20 dark:border dark:border-indigo-900/40">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Exact Dimensions</p>
            <p className="mt-0.5 text-sm font-black text-indigo-950 dark:text-white">1080 x 240 px</p>
            <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400">Aspect Ratio ~4.5 : 1</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Formats Supported</p>
            <p className="mt-0.5 text-sm font-black text-indigo-950 dark:text-white">PNG, JPG, WebP, MP4</p>
            <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400">Lightweight animated video ok</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Max File Size</p>
            <p className="mt-0.5 text-sm font-black text-indigo-950 dark:text-white">500 KB (Img) / 3 MB (Vid)</p>
            <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400">Ultra-fast 60 FPS loading</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">Graceful Fallback</p>
            <p className="mt-0.5 text-sm font-black text-indigo-950 dark:text-white">Built-in Pink Gradient</p>
            <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400">If disabled or empty</p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Live Mobile Header Preview */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live Device Simulation</span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Real-Time App Header Mockup</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <span>Dark Scrim / Overlay:</span>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={previewOpacity}
                onChange={(e) => setPreviewOpacity(parseFloat(e.target.value))}
                className="h-1.5 w-24 cursor-pointer rounded-lg bg-slate-200 accent-indigo-600"
              />
              <span className="w-8 text-[11px] font-mono font-bold">{Math.round(previewOpacity * 100)}%</span>
            </label>
          </div>
        </div>

        {/* Mockup Frame */}
        <div className="mt-5 mx-auto max-w-md overflow-hidden rounded-[28px] border-4 border-slate-800 bg-slate-950 p-2 shadow-2xl">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-5 py-1 text-[11px] font-bold text-white/90">
            <span>9:41</span>
            <div className="h-4 w-28 rounded-full bg-slate-900/90" />
            <div className="flex items-center gap-1.5 text-[10px]">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>

          {/* Actual Mobile Header Container */}
          <div
            className="relative mt-1 overflow-hidden rounded-b-2xl px-3 py-3 shadow-md"
            style={{
              background: previewEnabled
                ? previewMediaType === "image" && previewImageUrl
                  ? `url(${previewImageUrl}) center/cover no-repeat`
                  : DEFAULT_GRADIENT
                : DEFAULT_GRADIENT,
              minHeight: "70px",
            }}
          >
            {/* If video preview */}
            {previewEnabled && previewMediaType === "video" && previewVideoUrl && (
              <video
                src={previewVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}

            {/* Dark Scrim overlay for contrast */}
            {previewEnabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundColor: `rgba(0, 0, 0, ${previewOpacity})` }}
              />
            )}

            {/* Header Content Row: Search Bar & Profile */}
            <div className="relative z-10 flex items-center gap-2">
              <div className="flex h-9 flex-1 items-center gap-2 rounded-full border border-white/20 bg-white/18 px-3 backdrop-blur-md">
                <svg className="h-4 w-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs font-bold text-white/90">టెంప్లేట్‌లను శోధించండి</span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-gradient-to-tr from-amber-400 to-rose-500 shadow-sm">
                <span className="text-xs font-black text-white">మ</span>
              </div>
            </div>
          </div>

          {/* Dummy Home Body Feed */}
          <div className="h-28 bg-slate-100 p-3 dark:bg-slate-900/60">
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-16 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
              <div className="h-16 flex-1 rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Selected Theme Badge & Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <span>Live Preview Showing:</span>
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {previewTitle}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              🔄 Reset to Default Gradient
            </button>
            <button
              type="button"
              onClick={handleSaveLive}
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Publishing to App..." : "🚀 Publish Live to App"}
            </button>
          </div>
        </div>

        {successMsg && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            {successMsg}
          </p>
        )}
        {errorMsg && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMsg}
          </p>
        )}
      </div>

      {/* 3. Curated Festival Templates Library */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Curated Festival Collection
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Instant 1-Click Festival Header Themes
            </h2>
            <p className="text-xs text-slate-500">
              Specially designed lightweight themes for major Telugu & Indian festivals. Select any card to preview.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FESTIVAL_HEADER_TEMPLATES.map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`group cursor-pointer overflow-hidden rounded-2xl border transition-all ${
                  isSelected
                    ? "border-indigo-600 ring-2 ring-indigo-600 shadow-md"
                    : "border-slate-200 hover:border-indigo-300 hover:shadow-xs dark:border-slate-800"
                }`}
              >
                {/* Banner Thumbnail (exact 1080x240 aspect ratio) */}
                <div
                  className="relative flex h-24 w-full items-end overflow-hidden p-3 transition-transform group-hover:scale-105"
                  style={{
                    background: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.6)), url(${tpl.imageUrl}) center/cover no-repeat`,
                  }}
                >
                  {tpl.videoUrl && (
                    <video
                      src={tpl.videoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                  <div className="relative z-10 flex w-full items-center justify-between">
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur">
                      {tpl.festivalTag}
                    </span>
                    <span className="rounded-md bg-amber-400 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-slate-900 shadow-xs">
                      🎥 ANIMATED
                    </span>
                  </div>
                </div>
                <div className="bg-white p-3 dark:bg-slate-900">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{tpl.teluguName}</h3>
                  <p className="text-xs font-semibold text-slate-500">{tpl.name}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{tpl.description}</p>
                  <button
                    type="button"
                    className={`mt-2.5 w-full rounded-lg py-1.5 text-xs font-black transition ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {isSelected ? "✓ Selected (In Preview)" : "Preview Theme"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Custom Artwork / Video Upload Section */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            Manual Upload
          </span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            Upload Your Custom Header Background
          </h2>
          <p className="text-xs text-slate-500">
            Have a custom banner or video from your designer? Upload it here.
          </p>
        </div>

        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-indigo-400 dark:border-slate-700">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            📁
          </div>
          <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
            {selectedFile ? `Selected: ${selectedFile.name}` : "Click to select or drag and drop your image or video"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Recommended: <strong>1080 x 240 px</strong> (Aspect ratio ~4.5:1) • Max 500 KB (Image), 3 MB (Video)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,video/mp4"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-black text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              Browse Image / Video File
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={handleSaveLive}
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-md hover:bg-indigo-700"
              >
                {saving ? "Uploading..." : "Upload & Publish Live"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
