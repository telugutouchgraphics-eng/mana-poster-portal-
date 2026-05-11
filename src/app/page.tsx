import { LandingPagePreview } from "@/components/admin/landing-page/landing-page-preview";
import { loadWebsitePosters } from "@/lib/server/content-management";
import { loadLandingPageRecord } from "@/lib/server/landing-page-management";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Script from "next/script";

export const dynamic = "force-dynamic";

export default async function Home() {
  const headerStore = await headers();
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").toLowerCase();

  if (host.startsWith("admin.")) {
    redirect("/login?as=admin&next=/admin/dashboard");
  }
  if (host.startsWith("manager.")) {
    redirect("/login?as=manager&next=/manager/dashboard");
  }
  if (host.startsWith("creator.")) {
    redirect("/login?as=creator&next=/creator/dashboard");
  }

  const [landingPage, websitePosters] = await Promise.all([
    loadLandingPageRecord(),
    loadWebsitePosters(),
  ]);

  return (
    <>
      <Script
        id="adsense-script"
        async
        strategy="afterInteractive"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6393573098485696"
        crossOrigin="anonymous"
      />
      <main className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fff1f2_52%,#f5f3ff_100%)] px-3 py-3 sm:px-5 sm:py-5">
        <LandingPagePreview data={landingPage} websitePosters={websitePosters} />
      </main>
    </>
  );
}
