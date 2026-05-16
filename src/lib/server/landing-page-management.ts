import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import type {
  LandingCategoryItem,
  LandingFaqItem,
  LandingFeatureItem,
  LandingImageItem,
  LandingLinkItem,
  LandingPageRecord,
  LandingSimpleItem,
  LandingTestimonialItem,
} from "@/lib/types/landing-page";

export const LANDING_PAGE_COLLECTION = "websiteConfig";
export const LANDING_PAGE_DOC_ID = "landingPage";
export const DEFAULT_PUBLIC_PREVIEW_URL = "https://manaposter.in/#/web";

const safeText = (value: unknown, fallback = "", max = 4000) => {
  if (typeof value !== "string") {
    return fallback;
  }
  return value.replace(/<[^>]*>/g, "").trim().slice(0, max);
};

const safeUrl = (
  value: unknown,
  fallback = "",
  options: { allowRelative?: boolean; allowMailto?: boolean } = {},
) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const raw = value.trim();
  if (!raw) {
    return fallback;
  }
  if (options.allowRelative && (raw.startsWith("/") || raw.startsWith("#"))) {
    return raw;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return raw;
    }
    if (options.allowMailto && parsed.protocol === "mailto:") {
      return raw;
    }
  } catch {
    return fallback;
  }
  return fallback;
};

const boolValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const intValue = (value: unknown, fallback: number) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.trunc(normalized) : fallback;
};

function orderBySort<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function createLinkItem(
  id: string,
  label: string,
  href: string,
  sortOrder: number,
): LandingLinkItem {
  return {
    id,
    label,
    href,
    sortOrder,
    visible: true,
    published: true,
  };
}

function createImageItem(
  id: string,
  title: string,
  imageUrl: string,
  sortOrder: number,
  extra?: Partial<LandingImageItem>,
): LandingImageItem {
  return {
    id,
    title,
    subtitle: "",
    description: "",
    imageUrl,
    imagePath: "",
    buttonText: "",
    buttonLink: "",
    sortOrder,
    visible: true,
    published: true,
    ...extra,
  };
}

function createFeatureItem(
  id: string,
  title: string,
  description: string,
  sortOrder: number,
  icon: string,
): LandingFeatureItem {
  return {
    id,
    title,
    subtitle: "",
    description,
    icon,
    sortOrder,
    visible: true,
    published: true,
  };
}

function createCategoryItem(
  id: string,
  title: string,
  emoji: string,
  sortOrder: number,
): LandingCategoryItem {
  return {
    id,
    title,
    subtitle: "",
    description: `${title} posters ready for Telugu audience.`,
    emoji,
    imageUrl: "https://manaposter.in/icons/Icon-512.png",
    imagePath: "",
    buttonText: "View posters",
    buttonLink: "#categories",
    sortOrder,
    visible: true,
    published: true,
  };
}

function createSimpleItem(
  id: string,
  title: string,
  description: string,
  sortOrder: number,
): LandingSimpleItem {
  return {
    id,
    title,
    description,
    sortOrder,
    visible: true,
    published: true,
  };
}

function createFaqItem(
  id: string,
  question: string,
  answer: string,
  sortOrder: number,
): LandingFaqItem {
  return {
    id,
    question,
    answer,
    sortOrder,
    visible: true,
    published: true,
  };
}

function createTestimonialItem(
  id: string,
  name: string,
  review: string,
  sortOrder: number,
  role: string,
): LandingTestimonialItem {
  return {
    id,
    name,
    role,
    review,
    avatarUrl: "",
    avatarPath: "",
    sortOrder,
    visible: true,
    published: true,
  };
}

export function createDefaultLandingPageRecord(): LandingPageRecord {
  const now = Date.now();
  const previewUrl = DEFAULT_PUBLIC_PREVIEW_URL;
  const footerSocialLinks = [
    createLinkItem("facebook", "Facebook", "https://facebook.com/manaposterapp", 10),
    createLinkItem("instagram", "Instagram", "https://instagram.com/manaposterapp", 20),
    createLinkItem("youtube", "YouTube", "https://youtube.com/@manaposter", 30),
  ];

  return {
    id: "landingPage",
    createdAt: now,
    updatedAt: now,
    updatedByUid: "",
    updatedByEmail: "",
    publicPreviewUrl: previewUrl,
    navbar: {
      show: true,
      published: true,
      title: "Mana Poster Ai",
      subtitle: "Your Daily Telugu Poster App",
      description: "Main top navigation for the public landing page.",
      logoText: "M",
      logoImageUrl: "",
      logoImagePath: "",
      appName: "Mana Poster Ai",
      buttonText: "Download App",
      buttonLink:
        "https://play.google.com/store/apps/details?id=com.telugutouch.manaposter",
      items: [
        createLinkItem("home", "Home", "#home", 10),
        createLinkItem("features", "Features", "#features", 20),
        createLinkItem("categories", "Categories", "#categories", 30),
        createLinkItem("download", "Download", "#download", 40),
      ],
    },
    hero: {
      show: true,
      published: true,
      title: "Create Telugu Posters in Seconds",
      subtitle: "Ready-made Telugu festival, birthday, devotional and daily share posters.",
      description:
        "Users can create, customize and share Telugu posters instantly with personal photo, name and one-tap WhatsApp share.",
      helperText: "Free & Premium Posters Available",
      primaryButtonText: "Download App",
      primaryButtonLink:
        "https://play.google.com/store/apps/details?id=com.telugutouch.manaposter",
      secondaryButtonText: "Watch Demo",
      secondaryButtonLink: previewUrl,
      previewImages: [
        createImageItem(
          "hero-poster-1",
          "Festival Poster",
          "https://manaposter.in/icons/Icon-512.png",
          10,
          { subtitle: "Telugu festival sample" },
        ),
        createImageItem(
          "hero-poster-2",
          "Birthday Poster",
          "https://manaposter.in/icons/Icon-512.png",
          20,
          { subtitle: "Birthday sample" },
        ),
        createImageItem(
          "hero-poster-3",
          "Motivational Poster",
          "https://manaposter.in/icons/Icon-512.png",
          30,
          { subtitle: "Motivational sample" },
        ),
      ],
      promoBanners: [
        createImageItem(
          "hero-banner-1",
          "Daily Dynamic Posters",
          "https://manaposter.in/icons/Icon-512.png",
          10,
          {
            description: "Every day automatic poster updates.",
            buttonText: "Explore",
            buttonLink: "#dynamic-events",
          },
        ),
      ],
    },
    appPreview: {
      show: true,
      published: true,
      title: "App Preview",
      subtitle: "See how posters look inside Mana Poster Ai.",
      description: "Screens, editor previews and ready-share posters.",
      screenshots: [
        createImageItem("app-preview-1", "Home Screen", "https://manaposter.in/icons/Icon-512.png", 10),
        createImageItem("app-preview-2", "Editor Screen", "https://manaposter.in/icons/Icon-512.png", 20),
        createImageItem("app-preview-3", "Poster Share Screen", "https://manaposter.in/icons/Icon-512.png", 30),
      ],
    },
    features: {
      show: true,
      published: true,
      title: "Premium Features",
      subtitle: "Everything needed to build and share Telugu posters fast.",
      description: "Feature grid shown on the public landing page.",
      items: [
        createFeatureItem("feature-1", "Telugu Poster Templates", "Ready-made Telugu poster designs.", 10, "ðŸ–¼ï¸"),
        createFeatureItem("feature-2", "One Tap Share to WhatsApp", "Send posters instantly to WhatsApp.", 20, "ðŸ“¤"),
        createFeatureItem("feature-3", "Free & Premium Posters", "Mix of free and advanced premium content.", 30, "â­"),
        createFeatureItem("feature-4", "Personal Photo & Name Auto Placement", "Quick personalization for every poster.", 40, "ðŸ‘¤"),
        createFeatureItem("feature-5", "Festival & Birthday Categories", "Popular categories ready every day.", 50, "ðŸŽ‰"),
        createFeatureItem("feature-6", "Daily Dynamic Event Posters", "Auto-changing posters for current dates.", 60, "ðŸ“…"),
        createFeatureItem("feature-7", "Background Removal", "Remove image background directly in editor.", 70, "âœ‚ï¸"),
        createFeatureItem("feature-8", "Full Poster Customization", "Text, colors, layers and export control.", 80, "ðŸŽ¨"),
      ],
    },
    categories: {
      show: true,
      published: true,
      title: "Popular Categories",
      subtitle: "Most-used Telugu poster categories.",
      description: "Category chips and poster showcase items.",
      items: [
        createCategoryItem("cat-1", "Good Morning", "ðŸŒ…", 10),
        createCategoryItem("cat-2", "Good Night", "ðŸŒ™", 20),
        createCategoryItem("cat-3", "Motivational", "ðŸ”¥", 30),
        createCategoryItem("cat-4", "Birthday", "ðŸŽ‚", 40),
        createCategoryItem("cat-5", "Devotional", "ðŸ™", 50),
        createCategoryItem("cat-6", "Love Quotes", "â¤ï¸", 60),
        createCategoryItem("cat-7", "Mahabharatam", "ðŸ¹", 70),
        createCategoryItem("cat-8", "Bhagavad Gita", "ðŸ“œ", 80),
        createCategoryItem("cat-9", "Today Special", "âœ¨", 90),
        createCategoryItem("cat-10", "News", "ðŸ“°", 100),
      ],
    },
    dynamicEvents: {
      show: true,
      published: true,
      title: "Todayâ€™s Special Posters",
      subtitle: "Dynamic poster updates for events and important dates.",
      description: "Visual calendar section for daily changing poster highlights.",
      badgeText: "Every Day New Posters Automatically",
      autoUpdateText: "Mana Poster Ai automatically updates poster suggestions based on selected date.",
      calendarTitle: "Event Calendar",
      calendarDescription: "Showcase upcoming festival, jayanthi and special day content.",
      items: [
        createSimpleItem("dyn-1", "Festivals", "Festival posters appear automatically on the right day.", 10),
        createSimpleItem("dyn-2", "Jayanthi", "Relevant leaders and remembrance day posters.", 20),
        createSimpleItem("dyn-3", "Vardhanthi", "Special remembrance content on matching dates.", 30),
        createSimpleItem("dyn-4", "National Days", "National celebration posters for key dates.", 40),
        createSimpleItem("dyn-5", "Telugu State Events", "Regional events and important day posters.", 50),
      ],
    },
    plans: {
      show: true,
      published: true,
      title: "Free vs Premium",
      subtitle: "Clear poster plan comparison for users.",
      description: "Free and premium comparison section.",
      freeTitle: "Free Posters",
      freeDescription: "Basic ready-to-share posters.",
      premiumTitle: "Premium Posters",
      premiumDescription: "Advanced poster editing and export tools.",
      premiumBadge: "Most Popular",
      buttonText: "Buy Premium",
      buttonLink:
        "https://play.google.com/store/apps/details?id=com.telugutouch.manaposter",
      freeItems: [
        createSimpleItem("free-1", "Basic templates", "", 10),
        createSimpleItem("free-2", "WhatsApp share", "", 20),
        createSimpleItem("free-3", "Download", "", 30),
        createSimpleItem("free-4", "Limited customization", "", 40),
      ],
      premiumItems: [
        createSimpleItem("premium-1", "Fully editable posters", "", 10),
        createSimpleItem("premium-2", "Premium templates", "", 20),
        createSimpleItem("premium-3", "Unlimited customization", "", 30),
        createSimpleItem("premium-4", "Personal photo auto placement", "", 40),
        createSimpleItem("premium-5", "HD export", "", 50),
      ],
    },
    testimonials: {
      show: true,
      published: true,
      title: "User Reviews",
      subtitle: "Real style testimonials for the public landing page.",
      description: "Short reviews about poster creation, Telugu festivals and WhatsApp sharing.",
      items: [
        createTestimonialItem("review-1", "Suresh Kumar", "Poster chala easy ga create chesanu. Telugu festival templates ready ga unnayi.", 10, "Daily user"),
        createTestimonialItem("review-2", "Lakshmi Priya", "Birthday and devotional posters fast ga create chesi WhatsApp lo share cheyyadam easy ayyindi.", 20, "Premium user"),
        createTestimonialItem("review-3", "Ravi Teja", "Mana Poster Ai lo Telugu designs neat ga unnayi and editing fast ga complete avutundi.", 30, "Regular user"),
      ],
    },
    faq: {
      show: true,
      published: true,
      title: "Frequently Asked Questions",
      subtitle: "Common answers for new users.",
      description: "FAQ accordion section for landing page.",
      items: [
        createFaqItem("faq-1", "Is Mana Poster Ai free?", "Yes. Free posters are available, with premium upgrade for advanced editing and more designs.", 10),
        createFaqItem("faq-2", "Can I add my own photo and name?", "Yes. You can personalize posters with your photo and name directly in the app.", 20),
        createFaqItem("faq-3", "Are Telugu festival posters available daily?", "Yes. Daily dynamic posters are shown based on current dates and events.", 30),
        createFaqItem("faq-4", "Can I download posters in HD?", "Premium users can export posters in higher quality.", 40),
        createFaqItem("faq-5", "Do I need to design from scratch?", "No. Ready-made templates are available for quick editing and sharing.", 50),
      ],
    },
    finalCta: {
      show: true,
      published: true,
      title: "Start Creating Beautiful Telugu Posters Today",
      subtitle: "Download Mana Poster Ai and start making share-ready Telugu posters in seconds.",
      description: "Final CTA band shown near footer.",
      helperText: "Ready for festivals, birthdays, devotion and daily special content.",
      buttonText: "Download App",
      buttonLink:
        "https://play.google.com/store/apps/details?id=com.telugutouch.manaposter",
      secondaryButtonText: "Watch Demo",
      secondaryButtonLink: previewUrl,
      playStoreBadgeText: "Available on Play Store",
      previewImages: [
        createImageItem("cta-preview-1", "Festival", "https://manaposter.in/icons/Icon-512.png", 10),
        createImageItem("cta-preview-2", "Birthday", "https://manaposter.in/icons/Icon-512.png", 20),
        createImageItem("cta-preview-3", "Motivational", "https://manaposter.in/icons/Icon-512.png", 30),
      ],
    },
    footer: {
      show: true,
      published: true,
      title: "Mana Poster Ai",
      subtitle: "Your Daily Telugu Poster App",
      description: "Quick links, contact details and social profile links.",
      contactEmail: "telugutouchgraphics@gmail.com",
      logoImageUrl: "",
      logoImagePath: "",
      quickLinks: [
        createLinkItem("footer-home", "Home", "#home", 10),
        createLinkItem("footer-features", "Features", "#features", 20),
        createLinkItem("footer-categories", "Categories", "#categories", 30),
        createLinkItem("footer-download", "Download", "#download", 40),
      ],
      socialLinks: footerSocialLinks,
    },
    showHero: true,
    showPreview: true,
    showFeatures: true,
    showCategories: true,
    showDynamicEvents: true,
    showPlans: true,
    showTestimonials: true,
    showFaq: true,
    showDownloadCta: true,
    downloadUrl: "https://play.google.com/store/apps/details?id=com.telugutouch.manaposter",
    watchDemoUrl: previewUrl,
    supportEmail: "telugutouchgraphics@gmail.com",
    facebookUrl: "https://facebook.com/manaposterapp",
    instagramUrl: "https://instagram.com/manaposterapp",
    youtubeUrl: "https://youtube.com/@manaposter",
  };
}

const uploadAssetSchema = z.object({
  section: z.string().trim().min(1).max(80),
  itemId: z.string().trim().min(1).max(120),
});

function sanitizeLinkItems(value: unknown): LandingLinkItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingLinkItem>;
      return {
        id: safeText(source.id, `link-${index + 1}`, 120),
        label: safeText(source.label, "", 120),
        href: safeUrl(source.href, "", { allowRelative: true, allowMailto: true }),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.label.length > 0),
  );
}

function sanitizeImageItems(value: unknown): LandingImageItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingImageItem>;
      return {
        id: safeText(source.id, `image-${index + 1}`, 120),
        title: safeText(source.title, "", 160),
        subtitle: safeText(source.subtitle, "", 240),
        description: safeText(source.description, "", 1000),
        imageUrl: safeUrl(source.imageUrl, ""),
        imagePath: safeText(source.imagePath, "", 400),
        buttonText: safeText(source.buttonText, "", 120),
        buttonLink: safeUrl(source.buttonLink, "", {
          allowRelative: true,
          allowMailto: true,
        }),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.title.length > 0 || item.imageUrl.length > 0),
  );
}

function sanitizeFeatureItems(value: unknown): LandingFeatureItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingFeatureItem>;
      return {
        id: safeText(source.id, `feature-${index + 1}`, 120),
        title: safeText(source.title, "", 160),
        subtitle: safeText(source.subtitle, "", 240),
        description: safeText(source.description, "", 1000),
        icon: safeText(source.icon, "âœ¨", 16),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.title.length > 0),
  );
}

function sanitizeCategoryItems(value: unknown): LandingCategoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingCategoryItem>;
      return {
        id: safeText(source.id, `category-${index + 1}`, 120),
        title: safeText(source.title, "", 160),
        subtitle: safeText(source.subtitle, "", 240),
        description: safeText(source.description, "", 1000),
        emoji: safeText(source.emoji, "âœ¨", 8),
        imageUrl: safeUrl(source.imageUrl, ""),
        imagePath: safeText(source.imagePath, "", 400),
        buttonText: safeText(source.buttonText, "", 120),
        buttonLink: safeUrl(source.buttonLink, "", {
          allowRelative: true,
          allowMailto: true,
        }),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.title.length > 0),
  );
}

function sanitizeSimpleItems(value: unknown, prefix: string): LandingSimpleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingSimpleItem>;
      return {
        id: safeText(source.id, `${prefix}-${index + 1}`, 120),
        title: safeText(source.title, "", 160),
        description: safeText(source.description, "", 800),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.title.length > 0),
  );
}

function sanitizeFaqItems(value: unknown): LandingFaqItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingFaqItem>;
      return {
        id: safeText(source.id, `faq-${index + 1}`, 120),
        question: safeText(source.question, "", 240),
        answer: safeText(source.answer, "", 4000),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.question.length > 0),
  );
}

function sanitizeTestimonials(value: unknown): LandingTestimonialItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return orderBySort(
    value.map((item, index) => {
      const source = item as Partial<LandingTestimonialItem>;
      return {
        id: safeText(source.id, `testimonial-${index + 1}`, 120),
        name: safeText(source.name, "", 120),
        role: safeText(source.role, "", 120),
        review: safeText(source.review, "", 1200),
        avatarUrl: safeUrl(source.avatarUrl, ""),
        avatarPath: safeText(source.avatarPath, "", 400),
        sortOrder: intValue(source.sortOrder, (index + 1) * 10),
        visible: boolValue(source.visible, true),
        published: boolValue(source.published, true),
      };
    }).filter((item) => item.name.length > 0),
  );
}

async function assertReachableImageUrls(urls: string[]) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))].slice(0, 24);
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`Image URL is not reachable: ${url}`);
        }
      } catch {
        throw new Error(`Image URL is not reachable: ${url}`);
      }
    }),
  );
}

function validateRequiredContent(record: LandingPageRecord) {
  const errors: string[] = [];
  if (record.navbar.show && record.navbar.published && !record.navbar.appName.trim()) {
    errors.push("Navbar app name is required.");
  }
  if (record.hero.show && record.hero.published && !record.hero.title.trim()) {
    errors.push("Hero title is required.");
  }
  if (
    record.finalCta.show &&
    record.finalCta.published &&
    !record.finalCta.title.trim()
  ) {
    errors.push("Final CTA title is required.");
  }
  if (
    record.footer.show &&
    record.footer.published &&
    !record.footer.contactEmail.trim()
  ) {
    errors.push("Footer contact email is required.");
  }
  const invalidLinks = [
    record.navbar.buttonLink,
    record.hero.primaryButtonLink,
    record.hero.secondaryButtonLink,
    record.finalCta.buttonLink,
    record.finalCta.secondaryButtonLink,
    record.plans.buttonLink,
    record.downloadUrl,
    record.watchDemoUrl,
    record.facebookUrl,
    record.instagramUrl,
    record.youtubeUrl,
  ].filter((value) => value.length > 0 && safeUrl(value, "", { allowRelative: true, allowMailto: true }) !== value);
  if (invalidLinks.length > 0) {
    errors.push("One or more button or social URLs are invalid.");
  }
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
}

function mergeWithDefaults(input?: Partial<LandingPageRecord> | null): LandingPageRecord {
  const base = createDefaultLandingPageRecord();
  const source = input ?? {};
  const navbar = (source.navbar ?? {}) as Partial<LandingPageRecord["navbar"]>;
  const hero = (source.hero ?? {}) as Partial<LandingPageRecord["hero"]>;
  const appPreview = (source.appPreview ?? {}) as Partial<LandingPageRecord["appPreview"]>;
  const features = (source.features ?? {}) as Partial<LandingPageRecord["features"]>;
  const categories = (source.categories ?? {}) as Partial<LandingPageRecord["categories"]>;
  const dynamicEvents = (source.dynamicEvents ?? {}) as Partial<LandingPageRecord["dynamicEvents"]>;
  const plans = (source.plans ?? {}) as Partial<LandingPageRecord["plans"]>;
  const testimonials = (source.testimonials ?? {}) as Partial<LandingPageRecord["testimonials"]>;
  const faq = (source.faq ?? {}) as Partial<LandingPageRecord["faq"]>;
  const finalCta = (source.finalCta ?? {}) as Partial<LandingPageRecord["finalCta"]>;
  const footer = (source.footer ?? {}) as Partial<LandingPageRecord["footer"]>;

  const record: LandingPageRecord = {
    ...base,
    ...source,
    id: "landingPage",
    publicPreviewUrl: safeUrl(source.publicPreviewUrl, base.publicPreviewUrl),
    updatedAt: intValue(source.updatedAt, base.updatedAt),
    createdAt: intValue(source.createdAt, base.createdAt),
    updatedByUid: safeText(source.updatedByUid, ""),
    updatedByEmail: safeText(source.updatedByEmail, ""),
    navbar: {
      ...base.navbar,
      show: boolValue(navbar.show, base.navbar.show),
      published: boolValue(navbar.published, base.navbar.published),
      title: safeText(navbar.title, base.navbar.title, 160),
      subtitle: safeText(navbar.subtitle, base.navbar.subtitle, 240),
      description: safeText(navbar.description, base.navbar.description, 1000),
      logoText: safeText(navbar.logoText, base.navbar.logoText, 12),
      logoImageUrl: safeUrl(navbar.logoImageUrl, base.navbar.logoImageUrl),
      logoImagePath: safeText(navbar.logoImagePath, base.navbar.logoImagePath, 400),
      appName: safeText(navbar.appName, base.navbar.appName, 120),
      buttonText: safeText(navbar.buttonText, base.navbar.buttonText, 120),
      buttonLink: safeUrl(navbar.buttonLink, base.navbar.buttonLink, {
        allowRelative: true,
        allowMailto: true,
      }),
      items: sanitizeLinkItems(navbar.items).length > 0
        ? sanitizeLinkItems(navbar.items)
        : base.navbar.items,
    },
    hero: {
      ...base.hero,
      show: boolValue(hero.show, base.hero.show),
      published: boolValue(hero.published, base.hero.published),
      title: safeText(hero.title, base.hero.title, 240),
      subtitle: safeText(hero.subtitle, base.hero.subtitle, 280),
      description: safeText(hero.description, base.hero.description, 2000),
      helperText: safeText(hero.helperText, base.hero.helperText, 160),
      primaryButtonText: safeText(hero.primaryButtonText, base.hero.primaryButtonText, 120),
      primaryButtonLink: safeUrl(hero.primaryButtonLink, base.hero.primaryButtonLink, {
        allowRelative: true,
        allowMailto: true,
      }),
      secondaryButtonText: safeText(hero.secondaryButtonText, base.hero.secondaryButtonText, 120),
      secondaryButtonLink: safeUrl(hero.secondaryButtonLink, base.hero.secondaryButtonLink, {
        allowRelative: true,
        allowMailto: true,
      }),
      previewImages: sanitizeImageItems(hero.previewImages).length > 0
        ? sanitizeImageItems(hero.previewImages)
        : base.hero.previewImages,
      promoBanners: sanitizeImageItems(hero.promoBanners).length > 0
        ? sanitizeImageItems(hero.promoBanners)
        : base.hero.promoBanners,
    },
    appPreview: {
      ...base.appPreview,
      show: boolValue(appPreview.show, base.appPreview.show),
      published: boolValue(appPreview.published, base.appPreview.published),
      title: safeText(appPreview.title, base.appPreview.title, 240),
      subtitle: safeText(appPreview.subtitle, base.appPreview.subtitle, 280),
      description: safeText(appPreview.description, base.appPreview.description, 2000),
      screenshots: sanitizeImageItems(appPreview.screenshots).length > 0
        ? sanitizeImageItems(appPreview.screenshots)
        : base.appPreview.screenshots,
    },
    features: {
      ...base.features,
      show: boolValue(features.show, base.features.show),
      published: boolValue(features.published, base.features.published),
      title: safeText(features.title, base.features.title, 240),
      subtitle: safeText(features.subtitle, base.features.subtitle, 280),
      description: safeText(features.description, base.features.description, 2000),
      items: sanitizeFeatureItems(features.items).length > 0
        ? sanitizeFeatureItems(features.items)
        : base.features.items,
    },
    categories: {
      ...base.categories,
      show: boolValue(categories.show, base.categories.show),
      published: boolValue(categories.published, base.categories.published),
      title: safeText(categories.title, base.categories.title, 240),
      subtitle: safeText(categories.subtitle, base.categories.subtitle, 280),
      description: safeText(categories.description, base.categories.description, 2000),
      items: sanitizeCategoryItems(categories.items).length > 0
        ? sanitizeCategoryItems(categories.items)
        : base.categories.items,
    },
    dynamicEvents: {
      ...base.dynamicEvents,
      show: boolValue(dynamicEvents.show, base.dynamicEvents.show),
      published: boolValue(dynamicEvents.published, base.dynamicEvents.published),
      title: safeText(dynamicEvents.title, base.dynamicEvents.title, 240),
      subtitle: safeText(dynamicEvents.subtitle, base.dynamicEvents.subtitle, 280),
      description: safeText(dynamicEvents.description, base.dynamicEvents.description, 2000),
      badgeText: safeText(dynamicEvents.badgeText, base.dynamicEvents.badgeText, 120),
      autoUpdateText: safeText(dynamicEvents.autoUpdateText, base.dynamicEvents.autoUpdateText, 400),
      calendarTitle: safeText(dynamicEvents.calendarTitle, base.dynamicEvents.calendarTitle, 120),
      calendarDescription: safeText(
        dynamicEvents.calendarDescription,
        base.dynamicEvents.calendarDescription,
        600,
      ),
      items: sanitizeSimpleItems(dynamicEvents.items, "dynamic").length > 0
        ? sanitizeSimpleItems(dynamicEvents.items, "dynamic")
        : base.dynamicEvents.items,
    },
    plans: {
      ...base.plans,
      show: boolValue(plans.show, base.plans.show),
      published: boolValue(plans.published, base.plans.published),
      title: safeText(plans.title, base.plans.title, 240),
      subtitle: safeText(plans.subtitle, base.plans.subtitle, 280),
      description: safeText(plans.description, base.plans.description, 2000),
      freeTitle: safeText(plans.freeTitle, base.plans.freeTitle, 120),
      freeDescription: safeText(plans.freeDescription, base.plans.freeDescription, 600),
      premiumTitle: safeText(plans.premiumTitle, base.plans.premiumTitle, 120),
      premiumDescription: safeText(plans.premiumDescription, base.plans.premiumDescription, 600),
      premiumBadge: safeText(plans.premiumBadge, base.plans.premiumBadge, 80),
      buttonText: safeText(plans.buttonText, base.plans.buttonText, 120),
      buttonLink: safeUrl(plans.buttonLink, base.plans.buttonLink, {
        allowRelative: true,
        allowMailto: true,
      }),
      freeItems: sanitizeSimpleItems(plans.freeItems, "free").length > 0
        ? sanitizeSimpleItems(plans.freeItems, "free")
        : base.plans.freeItems,
      premiumItems: sanitizeSimpleItems(plans.premiumItems, "premium").length > 0
        ? sanitizeSimpleItems(plans.premiumItems, "premium")
        : base.plans.premiumItems,
    },
    testimonials: {
      ...base.testimonials,
      show: boolValue(testimonials.show, base.testimonials.show),
      published: boolValue(testimonials.published, base.testimonials.published),
      title: safeText(testimonials.title, base.testimonials.title, 240),
      subtitle: safeText(testimonials.subtitle, base.testimonials.subtitle, 280),
      description: safeText(testimonials.description, base.testimonials.description, 2000),
      items: sanitizeTestimonials(testimonials.items).length > 0
        ? sanitizeTestimonials(testimonials.items)
        : base.testimonials.items,
    },
    faq: {
      ...base.faq,
      show: boolValue(faq.show, base.faq.show),
      published: boolValue(faq.published, base.faq.published),
      title: safeText(faq.title, base.faq.title, 240),
      subtitle: safeText(faq.subtitle, base.faq.subtitle, 280),
      description: safeText(faq.description, base.faq.description, 2000),
      items: sanitizeFaqItems(faq.items).length > 0
        ? sanitizeFaqItems(faq.items)
        : base.faq.items,
    },
    finalCta: {
      ...base.finalCta,
      show: boolValue(finalCta.show, base.finalCta.show),
      published: boolValue(finalCta.published, base.finalCta.published),
      title: safeText(finalCta.title, base.finalCta.title, 240),
      subtitle: safeText(finalCta.subtitle, base.finalCta.subtitle, 280),
      description: safeText(finalCta.description, base.finalCta.description, 2000),
      helperText: safeText(finalCta.helperText, base.finalCta.helperText, 240),
      buttonText: safeText(finalCta.buttonText, base.finalCta.buttonText, 120),
      buttonLink: safeUrl(finalCta.buttonLink, base.finalCta.buttonLink, {
        allowRelative: true,
        allowMailto: true,
      }),
      secondaryButtonText: safeText(
        finalCta.secondaryButtonText,
        base.finalCta.secondaryButtonText,
        120,
      ),
      secondaryButtonLink: safeUrl(
        finalCta.secondaryButtonLink,
        base.finalCta.secondaryButtonLink,
        { allowRelative: true, allowMailto: true },
      ),
      playStoreBadgeText: safeText(
        finalCta.playStoreBadgeText,
        base.finalCta.playStoreBadgeText,
        120,
      ),
      previewImages: sanitizeImageItems(finalCta.previewImages).length > 0
        ? sanitizeImageItems(finalCta.previewImages)
        : base.finalCta.previewImages,
    },
    footer: {
      ...base.footer,
      show: boolValue(footer.show, base.footer.show),
      published: boolValue(footer.published, base.footer.published),
      title: safeText(footer.title, base.footer.title, 160),
      subtitle: safeText(footer.subtitle, base.footer.subtitle, 240),
      description: safeText(footer.description, base.footer.description, 1000),
      contactEmail: safeText(footer.contactEmail, base.footer.contactEmail, 160),
      logoImageUrl: safeUrl(footer.logoImageUrl, base.footer.logoImageUrl),
      logoImagePath: safeText(footer.logoImagePath, base.footer.logoImagePath, 400),
      quickLinks: sanitizeLinkItems(footer.quickLinks).length > 0
        ? sanitizeLinkItems(footer.quickLinks)
        : base.footer.quickLinks,
      socialLinks: sanitizeLinkItems(footer.socialLinks).length > 0
        ? sanitizeLinkItems(footer.socialLinks)
        : base.footer.socialLinks,
    },
    showHero: boolValue(source.showHero, boolValue(hero.show, base.showHero)),
    showPreview: boolValue(source.showPreview, boolValue(appPreview.show, base.showPreview)),
    showFeatures: boolValue(source.showFeatures, boolValue(features.show, base.showFeatures)),
    showCategories: boolValue(source.showCategories, boolValue(categories.show, base.showCategories)),
    showDynamicEvents: boolValue(
      source.showDynamicEvents,
      boolValue(dynamicEvents.show, base.showDynamicEvents),
    ),
    showPlans: boolValue(source.showPlans, boolValue(plans.show, base.showPlans)),
    showTestimonials: boolValue(
      source.showTestimonials,
      boolValue(testimonials.show, base.showTestimonials),
    ),
    showFaq: boolValue(source.showFaq, boolValue(faq.show, base.showFaq)),
    showDownloadCta: boolValue(
      source.showDownloadCta,
      boolValue(finalCta.show, base.showDownloadCta),
    ),
    downloadUrl: safeUrl(
      source.downloadUrl,
      safeUrl(hero.primaryButtonLink, base.downloadUrl, {
        allowRelative: true,
        allowMailto: true,
      }),
      { allowRelative: true, allowMailto: true },
    ),
    watchDemoUrl: safeUrl(
      source.watchDemoUrl,
      safeUrl(hero.secondaryButtonLink, base.watchDemoUrl, {
        allowRelative: true,
        allowMailto: true,
      }),
      { allowRelative: true, allowMailto: true },
    ),
    supportEmail: safeText(
      source.supportEmail,
      safeText(footer.contactEmail, base.supportEmail, 160),
      160,
    ),
    facebookUrl: safeUrl(
      source.facebookUrl,
      footer.socialLinks?.find?.((item) => item.id === "facebook")?.href ?? base.facebookUrl,
    ),
    instagramUrl: safeUrl(
      source.instagramUrl,
      footer.socialLinks?.find?.((item) => item.id === "instagram")?.href ?? base.instagramUrl,
    ),
    youtubeUrl: safeUrl(
      source.youtubeUrl,
      footer.socialLinks?.find?.((item) => item.id === "youtube")?.href ?? base.youtubeUrl,
    ),
  };
  return record;
}

export async function loadLandingPageRecord(): Promise<LandingPageRecord> {
  const snap = await adminDb.collection(LANDING_PAGE_COLLECTION).doc(LANDING_PAGE_DOC_ID).get();
  if (!snap.exists) {
    return createDefaultLandingPageRecord();
  }
  return mergeWithDefaults(snap.data() as Partial<LandingPageRecord>);
}

export async function saveLandingPageRecord(
  input: Partial<LandingPageRecord>,
  actor: { uid: string; email?: string },
) {
  const merged = mergeWithDefaults(input);
  validateRequiredContent(merged);

  const imageUrls = [
    ...merged.hero.previewImages.map((item) => item.imageUrl),
    ...merged.hero.promoBanners.map((item) => item.imageUrl),
    ...merged.appPreview.screenshots.map((item) => item.imageUrl),
    ...merged.categories.items.map((item) => item.imageUrl),
    ...merged.testimonials.items.map((item) => item.avatarUrl),
    ...merged.finalCta.previewImages.map((item) => item.imageUrl),
  ].filter(Boolean);
  await assertReachableImageUrls(imageUrls);

  const now = Date.now();
  const finalRecord: LandingPageRecord = {
    ...merged,
    updatedAt: now,
    createdAt: merged.createdAt || now,
    updatedByUid: actor.uid,
    updatedByEmail: actor.email ?? "",
    publicPreviewUrl: safeUrl(merged.publicPreviewUrl, DEFAULT_PUBLIC_PREVIEW_URL),
    showHero: merged.hero.show && merged.hero.published,
    showPreview: merged.appPreview.show && merged.appPreview.published,
    showFeatures: merged.features.show && merged.features.published,
    showCategories: merged.categories.show && merged.categories.published,
    showDynamicEvents: merged.dynamicEvents.show && merged.dynamicEvents.published,
    showPlans: merged.plans.show && merged.plans.published,
    showTestimonials: merged.testimonials.show && merged.testimonials.published,
    showFaq: merged.faq.show && merged.faq.published,
    showDownloadCta: merged.finalCta.show && merged.finalCta.published,
    downloadUrl: merged.hero.primaryButtonLink || merged.finalCta.buttonLink,
    watchDemoUrl: merged.hero.secondaryButtonLink || merged.finalCta.secondaryButtonLink,
    supportEmail: merged.footer.contactEmail,
    facebookUrl:
      merged.footer.socialLinks.find((item) => item.id === "facebook")?.href ?? "",
    instagramUrl:
      merged.footer.socialLinks.find((item) => item.id === "instagram")?.href ?? "",
    youtubeUrl:
      merged.footer.socialLinks.find((item) => item.id === "youtube")?.href ?? "",
  };

  await adminDb
    .collection(LANDING_PAGE_COLLECTION)
    .doc(LANDING_PAGE_DOC_ID)
    .set(finalRecord, { merge: true });

  return finalRecord;
}

export function validateLandingAssetInput(formData: FormData) {
  return uploadAssetSchema.parse({
    section: formData.get("section"),
    itemId: formData.get("itemId"),
  });
}

