"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { CompetitionHub } from "@/components/competitions/competition-hub";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";

type OverviewBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTarget: string;
  placement: string;
};

type LiveCompetitionItem = {
  competition: {
    id: string;
    title: string;
    categoryIds: string[];
    rewardTiers: Array<{ rank: number; amount: number }>;
  };
  phase: string;
};

export default function CreatorOverviewPage() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
  const isTelugu = language === "telugu";
  const copy = {
    liveMarquee: isTelugu ? "లైవ్ · లైవ్ · లైవ్" : "LIVE · LIVE · LIVE",
    firstPrize: (amount: number) =>
      isTelugu ? `1వ బహుమతి ₹${amount}` : `1st Prize Rs.${amount}`,
    upload: isTelugu ? "అప్లోడ్ చేయండి" : "Upload",
    bannerFallbackAlt: isTelugu ? "ఓవర్వ్యూ బానర్" : "Overview banner",
    bannerPending: isTelugu
      ? "ఇంకా ఓవర్వ్యూ బానర్ అందుబాటులో లేదు."
      : "No overview banner is available yet.",
  };
  const searchParams = useSearchParams();
  const asCreatorParam = searchParams.get("asCreator")?.trim();
  const [banner, setBanner] = useState<OverviewBanner | null>(null);
  const [liveCompetitions, setLiveCompetitions] = useState<LiveCompetitionItem[]>([]);

  useEffect(() => {
    async function loadOverviewBanner() {
      const token = await user?.getIdToken();
      if (!token) return;
      const [response, competitionResponse] = await Promise.all([
        fetch(withCreatorImpersonationQuery(`/api/creator/dashboard?regionId=${encodeURIComponent(region.id)}`, searchParams), {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        }),
        fetch(withCreatorImpersonationQuery(`/api/creator/competitions?regionId=${encodeURIComponent(region.id)}`, searchParams), {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        }),
      ]);
      const data = (await response.json()) as {
        ok: boolean;
        liveBanners?: OverviewBanner[];
      };
      const competitionData = (await competitionResponse.json()) as {
        ok: boolean;
        competitions?: LiveCompetitionItem[];
      };
      if (response.ok && data.ok) {
        const creatorBanner =
          data.liveBanners?.find((item) => item.placement === "creator_overview_banner") ??
          data.liveBanners?.[0] ??
          null;
        setBanner(creatorBanner);
      }
      if (competitionResponse.ok && competitionData.ok) {
        setLiveCompetitions(
          (competitionData.competitions ?? []).filter((item) => item.phase === "live"),
        );
      }
    }

    void loadOverviewBanner();
  }, [user, searchParams, region.id]);

  return (
    <section className="space-y-6">
      {liveCompetitions.length > 0 ? (
        <div className="overflow-hidden rounded-[28px] border border-rose-200 bg-[linear-gradient(90deg,#7f1d1d_0%,#be123c_40%,#fb923c_100%)] py-3 text-white shadow-sm">
          <div className="flex min-w-max gap-4 px-4" style={{ animation: "scroll-live-events 24s linear infinite" }}>
            {[...liveCompetitions, ...liveCompetitions].map((item, index) => {
              const firstPrize =
                item.competition.rewardTiers.find((tier) => tier.rank === 1)?.amount ?? 0;
              const uploadCategoryId = item.competition.categoryIds[0] ?? "";
              return (
                <div
                  key={`${item.competition.id}-${index}`}
                  className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm"
                >
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-white/80">
                    {copy.liveMarquee}
                  </span>
                  <span className="text-sm font-black">{item.competition.title}</span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                    {copy.firstPrize(firstPrize)}
                  </span>
                  {uploadCategoryId ? (
                    <Link
                      href={
                        asCreatorParam
                          ? `/creator/dashboard/upload?categoryId=${encodeURIComponent(uploadCategoryId)}&asCreator=${encodeURIComponent(asCreatorParam)}`
                          : `/creator/dashboard/upload?categoryId=${encodeURIComponent(uploadCategoryId)}`
                      }
                      className="rounded-full bg-white px-4 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-50"
                    >
                      {copy.upload}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-white">
        {banner ? (
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.imageUrl}
              alt={banner.title || copy.bannerFallbackAlt}
              className="h-auto max-h-[420px] w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex min-h-[260px] w-full items-center justify-center bg-[var(--portal-surface-soft)] px-6 text-center text-sm font-semibold text-slate-500">
            {copy.bannerPending}
          </div>
        )}
      </div>

      <CompetitionHub mode="creator" />
    </section>
  );
}
