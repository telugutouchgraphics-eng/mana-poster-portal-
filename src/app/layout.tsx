import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { DashboardLanguageProvider } from "@/components/i18n/dashboard-language-provider";
import { DashboardRegionProvider } from "@/components/regions/dashboard-region-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mana Poster Ai Web Portal",
  description: "Admin, manager, and creator operations portal",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/mana-poster-logo.png",
    shortcut: "/mana-poster-logo.png",
    apple: "/mana-poster-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>
          <DashboardLanguageProvider>
            <DashboardRegionProvider>{children}</DashboardRegionProvider>
          </DashboardLanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
