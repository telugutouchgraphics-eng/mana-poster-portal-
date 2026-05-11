"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface SettingsResponse {
  ok: boolean;
  settings?: {
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
    landingPageTitle: string;
    landingPageSubtitle: string;
  };
  error?: string;
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [defaultNotificationImageUrl, setDefaultNotificationImageUrl] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState<"en" | "te">("en");
  const [subscriptionVideoUrl, setSubscriptionVideoUrl] = useState("");
  const [subscriptionVideoActive, setSubscriptionVideoActive] = useState(false);
  const [subscriptionVideoFileName, setSubscriptionVideoFileName] = useState("");
  const [thanksVideoUrl, setThanksVideoUrl] = useState("");
  const [thanksVideoActive, setThanksVideoActive] = useState(false);
  const [thanksVideoFileName, setThanksVideoFileName] = useState("");
  const [videoUploading, setVideoUploading] = useState<"exit" | "thanks" | null>(null);
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [afternoonEnabled, setAfternoonEnabled] = useState(true);
  const [nightEnabled, setNightEnabled] = useState(true);
  const [landingPageTitle, setLandingPageTitle] = useState("");
  const [landingPageSubtitle, setLandingPageSubtitle] = useState("");
  const [appBannersVisible, setAppBannersVisible] = useState(true);
  const [creatorBannersVisible, setCreatorBannersVisible] = useState(true);
  const notificationToggleItems = [
    { label: "Enable morning notifications", value: morningEnabled, setter: setMorningEnabled },
    { label: "Enable afternoon notifications", value: afternoonEnabled, setter: setAfternoonEnabled },
    { label: "Enable night notifications", value: nightEnabled, setter: setNightEnabled },
  ];
  const bannerToggleItems = [
    { label: "Show app banners", value: appBannersVisible, setter: setAppBannersVisible },
    { label: "Show creator banners", value: creatorBannersVisible, setter: setCreatorBannersVisible },
  ];

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "Unable to load settings.");
      }
      setDefaultNotificationImageUrl(data.settings.defaultNotificationImageUrl || "");
      setDefaultLanguage(data.settings.defaultLanguage || "en");
      setSubscriptionVideoUrl(data.settings.subscriptionExitVideo?.url || "");
      setSubscriptionVideoActive(Boolean(data.settings.subscriptionExitVideo?.active));
      setSubscriptionVideoFileName(data.settings.subscriptionExitVideo?.fileName || "");
      setThanksVideoUrl(data.settings.subscriptionThanksVideo?.url || "");
      setThanksVideoActive(Boolean(data.settings.subscriptionThanksVideo?.active));
      setThanksVideoFileName(data.settings.subscriptionThanksVideo?.fileName || "");
      setMorningEnabled(Boolean(data.settings.notifications?.morningEnabled));
      setAfternoonEnabled(Boolean(data.settings.notifications?.afternoonEnabled));
      setNightEnabled(Boolean(data.settings.notifications?.nightEnabled));
      setLandingPageTitle(data.settings.landingPageTitle || "");
      setLandingPageSubtitle(data.settings.landingPageSubtitle || "");
      setAppBannersVisible(Boolean(data.settings.bannerVisibility?.appBannersVisible));
      setCreatorBannersVisible(Boolean(data.settings.bannerVisibility?.creatorBannersVisible));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await user?.getIdToken();
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          defaultNotificationImageUrl,
          defaultLanguage,
          notifications: {
            morningEnabled,
            afternoonEnabled,
            nightEnabled,
          },
          subscriptionExitVideo: {
            active: subscriptionVideoActive,
            url: subscriptionVideoUrl,
          },
          subscriptionThanksVideo: {
            active: thanksVideoActive,
            url: thanksVideoUrl,
          },
          bannerVisibility: {
            appBannersVisible,
            creatorBannersVisible,
          },
          landingPageTitle,
          landingPageSubtitle,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save settings.");
      }
      setMessage("Settings saved successfully.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubscriptionVideoUpload(file: File | null, type: "exit" | "thanks") {
    if (!file) return;
    const token = await user?.getIdToken();
    if (!token) return;
    setVideoUploading(type);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("video", file);
      body.set("type", type);
      const response = await fetch("/api/admin/settings/subscription-video", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const data = (await response.json()) as {
        ok: boolean;
        subscriptionVideo?: {
          active: boolean;
          url: string;
          fileName: string;
        };
        error?: string;
      };
      if (!response.ok || !data.ok || !data.subscriptionVideo) {
        throw new Error(data.error ?? "Unable to upload subscription video.");
      }
      if (type === "thanks") {
        setThanksVideoUrl(data.subscriptionVideo.url || "");
        setThanksVideoActive(Boolean(data.subscriptionVideo.active));
        setThanksVideoFileName(data.subscriptionVideo.fileName || file.name);
      } else {
        setSubscriptionVideoUrl(data.subscriptionVideo.url || "");
        setSubscriptionVideoActive(Boolean(data.subscriptionVideo.active));
        setSubscriptionVideoFileName(data.subscriptionVideo.fileName || file.name);
      }
      setMessage("Subscription video uploaded successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload subscription video.");
    } finally {
      setVideoUploading(null);
    }
  }

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
          Settings
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Portal configuration</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Manage default notification values, landing page text, notification toggles, and banner visibility.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Default notification image URL</span>
              <input
                value={defaultNotificationImageUrl}
                onChange={(event) => setDefaultNotificationImageUrl(event.target.value)}
                placeholder="https://..."
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Default language</span>
              <select
                value={defaultLanguage}
                onChange={(event) => setDefaultLanguage(event.target.value as "en" | "te")}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              >
                <option value="en">English</option>
                <option value="te">Telugu</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {notificationToggleItems.map(({ label, value, setter }) => (
              <label
                key={label}
                className="flex items-center justify-between rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => setter(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-[var(--portal-purple)] focus:ring-[var(--portal-purple)]"
                />
              </label>
            ))}
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">Subscription exit video</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This video plays in the mobile app when a user leaves subscription without subscribing.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={subscriptionVideoActive}
                  onChange={(event) => setSubscriptionVideoActive(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-[var(--portal-purple)] focus:ring-[var(--portal-purple)]"
                />
                Active
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">Video URL</span>
                <input
                  value={subscriptionVideoUrl}
                  onChange={(event) => setSubscriptionVideoUrl(event.target.value)}
                  placeholder="Upload a video or paste https://..."
                  className="w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--portal-border-strong)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--portal-purple)] transition hover:bg-violet-50">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={videoUploading !== null}
                  onChange={(event) => void handleSubscriptionVideoUpload(event.target.files?.[0] ?? null, "exit")}
                  className="hidden"
                />
                {videoUploading === "exit" ? "Uploading..." : "Upload Video"}
              </label>
            </div>

            {subscriptionVideoFileName || subscriptionVideoUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                {subscriptionVideoFileName ? <p className="font-semibold text-slate-800">{subscriptionVideoFileName}</p> : null}
                {subscriptionVideoUrl ? <p className="mt-1 break-all">{subscriptionVideoUrl}</p> : null}
                {subscriptionVideoUrl ? (
                  <video className="mt-3 max-h-56 w-full rounded-xl bg-slate-950" src={subscriptionVideoUrl} controls />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">Subscription thanks video</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This video plays in the mobile app after subscription payment succeeds.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={thanksVideoActive}
                  onChange={(event) => setThanksVideoActive(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-[var(--portal-purple)] focus:ring-[var(--portal-purple)]"
                />
                Active
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold">Thanks video URL</span>
                <input
                  value={thanksVideoUrl}
                  onChange={(event) => setThanksVideoUrl(event.target.value)}
                  placeholder="Upload a video or paste https://..."
                  className="w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--portal-border-strong)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--portal-purple)] transition hover:bg-violet-50">
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={videoUploading !== null}
                  onChange={(event) => void handleSubscriptionVideoUpload(event.target.files?.[0] ?? null, "thanks")}
                  className="hidden"
                />
                {videoUploading === "thanks" ? "Uploading..." : "Upload Thanks Video"}
              </label>
            </div>

            {thanksVideoFileName || thanksVideoUrl ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
                {thanksVideoFileName ? <p className="font-semibold text-slate-800">{thanksVideoFileName}</p> : null}
                {thanksVideoUrl ? <p className="mt-1 break-all">{thanksVideoUrl}</p> : null}
                {thanksVideoUrl ? (
                  <video className="mt-3 max-h-56 w-full rounded-xl bg-slate-950" src={thanksVideoUrl} controls />
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Landing page title</span>
              <input
                value={landingPageTitle}
                onChange={(event) => setLandingPageTitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold">Landing page subtitle</span>
              <input
                value={landingPageSubtitle}
                onChange={(event) => setLandingPageSubtitle(event.target.value)}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {bannerToggleItems.map(({ label, value, setter }) => (
              <label
                key={label}
                className="flex items-center justify-between rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) => setter(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-[var(--portal-purple)] focus:ring-[var(--portal-purple)]"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {loading ? <p className="text-sm text-slate-500">Loading settings...</p> : null}
          </div>

          {message ? (
            <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              {message}
            </p>
          ) : null}
        </form>
      </article>
    </section>
  );
}
