export type LandingTabId =
  | "overview"
  | "navbar"
  | "hero"
  | "banners"
  | "appPreview"
  | "features"
  | "categories"
  | "website-posters"
  | "dynamicEvents"
  | "plans"
  | "testimonials"
  | "faq"
  | "finalCta"
  | "footer"
  | "seo";

export const landingSectionLinks: { id: LandingTabId; label: string; slug: string }[] = [
  { id: "overview", label: "Overview", slug: "overview" },
  { id: "hero", label: "Hero", slug: "hero" },
  { id: "banners", label: "Banners", slug: "banners" },
  { id: "website-posters", label: "Posters", slug: "posters" },
  { id: "categories", label: "Categories", slug: "categories" },
  { id: "features", label: "Features", slug: "features" },
  { id: "dynamicEvents", label: "Dynamic Events", slug: "dynamic-events" },
  { id: "appPreview", label: "App Screenshots", slug: "app-screenshots" },
  { id: "plans", label: "Free vs Premium", slug: "free-vs-premium" },
  { id: "faq", label: "FAQ", slug: "faq" },
  { id: "testimonials", label: "Testimonials", slug: "testimonials" },
  { id: "finalCta", label: "CTA / Links", slug: "cta-links" },
  { id: "footer", label: "Footer / Support", slug: "footer-support" },
  { id: "navbar", label: "Header", slug: "header" },
  { id: "seo", label: "SEO", slug: "seo" },
];

export function landingSectionFromSlug(slug?: string): LandingTabId | null {
  if (!slug) return "overview";
  return landingSectionLinks.find((section) => section.slug === slug)?.id ?? null;
}

export function landingSectionHref(id: LandingTabId) {
  const section = landingSectionLinks.find((item) => item.id === id);
  return `/admin/dashboard/landing-page/${section?.slug ?? "overview"}`;
}
