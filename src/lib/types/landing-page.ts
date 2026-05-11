export interface LandingLinkItem {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingImageItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  imagePath: string;
  buttonText: string;
  buttonLink: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingFeatureItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingCategoryItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  imageUrl: string;
  imagePath: string;
  buttonText: string;
  buttonLink: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingFaqItem {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingTestimonialItem {
  id: string;
  name: string;
  role: string;
  review: string;
  avatarUrl: string;
  avatarPath: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingSimpleItem {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  visible: boolean;
  published: boolean;
}

export interface LandingSectionBase {
  show: boolean;
  published: boolean;
  title: string;
  subtitle: string;
  description: string;
}

export interface LandingNavbarSection extends LandingSectionBase {
  logoText: string;
  logoImageUrl: string;
  logoImagePath: string;
  appName: string;
  buttonText: string;
  buttonLink: string;
  items: LandingLinkItem[];
}

export interface LandingHeroSection extends LandingSectionBase {
  helperText: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  previewImages: LandingImageItem[];
  promoBanners: LandingImageItem[];
}

export interface LandingAppPreviewSection extends LandingSectionBase {
  screenshots: LandingImageItem[];
}

export interface LandingFeaturesSection extends LandingSectionBase {
  items: LandingFeatureItem[];
}

export interface LandingCategoriesSection extends LandingSectionBase {
  items: LandingCategoryItem[];
}

export interface LandingDynamicEventsSection extends LandingSectionBase {
  badgeText: string;
  autoUpdateText: string;
  calendarTitle: string;
  calendarDescription: string;
  items: LandingSimpleItem[];
}

export interface LandingPlanSection extends LandingSectionBase {
  freeTitle: string;
  freeDescription: string;
  premiumTitle: string;
  premiumDescription: string;
  premiumBadge: string;
  buttonText: string;
  buttonLink: string;
  freeItems: LandingSimpleItem[];
  premiumItems: LandingSimpleItem[];
}

export interface LandingTestimonialsSection extends LandingSectionBase {
  items: LandingTestimonialItem[];
}

export interface LandingFaqSection extends LandingSectionBase {
  items: LandingFaqItem[];
}

export interface LandingFinalCtaSection extends LandingSectionBase {
  helperText: string;
  buttonText: string;
  buttonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  playStoreBadgeText: string;
  previewImages: LandingImageItem[];
}

export interface LandingFooterSection extends LandingSectionBase {
  contactEmail: string;
  logoImageUrl: string;
  logoImagePath: string;
  quickLinks: LandingLinkItem[];
  socialLinks: LandingLinkItem[];
}

export interface LandingPageRecord {
  id: "landingPage";
  updatedAt: number;
  createdAt: number;
  updatedByUid: string;
  updatedByEmail: string;
  publicPreviewUrl: string;
  navbar: LandingNavbarSection;
  hero: LandingHeroSection;
  appPreview: LandingAppPreviewSection;
  features: LandingFeaturesSection;
  categories: LandingCategoriesSection;
  dynamicEvents: LandingDynamicEventsSection;
  plans: LandingPlanSection;
  testimonials: LandingTestimonialsSection;
  faq: LandingFaqSection;
  finalCta: LandingFinalCtaSection;
  footer: LandingFooterSection;
  showHero: boolean;
  showPreview: boolean;
  showFeatures: boolean;
  showCategories: boolean;
  showDynamicEvents: boolean;
  showPlans: boolean;
  showTestimonials: boolean;
  showFaq: boolean;
  showDownloadCta: boolean;
  downloadUrl: string;
  watchDemoUrl: string;
  supportEmail: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
}
