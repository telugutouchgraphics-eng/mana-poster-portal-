import type { ReactNode } from "react";
import type { LandingCategoryItem, LandingFaqItem, LandingFeatureItem, LandingImageItem, LandingLinkItem, LandingPageRecord, LandingSimpleItem, LandingTestimonialItem } from "@/lib/types/landing-page";

interface WebsitePosterItem {
  id: string;
  category: string;
  imageUrl: string;
  imagePath?: string;
  active: boolean;
  sortOrder: number;
}

function visibleItems<T extends { visible: boolean; published: boolean; sortOrder: number }>(items: T[]) {
  return [...items]
    .filter((item) => item.visible && item.published)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function PreviewImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-[linear-gradient(135deg,#fed7aa,#f5d0fe,#ddd6fe)] text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 ${className ?? ""}`}
      >
        {fallback ?? "Image"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

function PreviewSection({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-6 rounded-[32px] bg-white/80 p-6 ring-1 ring-inset ring-white/70 backdrop-blur sm:p-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-600">{eyebrow}</p>
        <h3 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h3>
        {subtitle ? <p className="text-sm leading-7 text-slate-600 sm:text-base">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function LinkChip({ item }: { item: LandingLinkItem }) {
  return (
    <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
      {item.label || "Untitled"}
    </span>
  );
}

function HeroGallery({ items }: { items: LandingImageItem[] }) {
  const visible = visibleItems(items).slice(0, 3);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {visible.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-[28px] bg-white shadow-[0_22px_50px_rgba(15,23,42,0.14)] ring-1 ring-inset ring-slate-200">
          <PreviewImage
            src={item.imageUrl}
            alt={item.title || "Hero image"}
            className="h-64 w-full object-cover"
            fallback={item.title || "Poster"}
          />
          <div className="space-y-1 p-4">
            <p className="text-base font-bold text-slate-900">{item.title || "Hero poster"}</p>
            {item.subtitle ? <p className="text-sm text-slate-500">{item.subtitle}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function BannerGrid({ items }: { items: LandingImageItem[] }) {
  const visible = visibleItems(items);
  if (visible.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)] p-5 text-white shadow-[0_24px_60px_rgba(91,33,182,0.28)]"
        >
          <div className="grid gap-4 md:grid-cols-[1.25fr_0.75fr] md:items-center">
            <div className="space-y-2">
              <p className="text-lg font-black">{item.title || "Banner title"}</p>
              {item.description ? <p className="text-sm leading-6 text-white/80">{item.description}</p> : null}
              {item.buttonText ? (
                <span className="inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white">
                  {item.buttonText}
                </span>
              ) : null}
            </div>
            <PreviewImage
              src={item.imageUrl}
              alt={item.title || "Banner image"}
              className="h-40 w-full rounded-[22px] object-cover"
              fallback={item.title || "Banner"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureGrid({ items }: { items: LandingFeatureItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {visibleItems(items).map((item) => (
        <article key={item.id} className="rounded-[24px] bg-white p-5 shadow-[0_16px_35px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-slate-200">
          <div className="text-2xl">{item.icon || "âœ¨"}</div>
          <h4 className="mt-3 text-lg font-bold text-slate-950">{item.title || "Feature title"}</h4>
          {item.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p> : null}
        </article>
      ))}
    </div>
  );
}

function CategoryGrid({
  categories,
  posters,
}: {
  categories: LandingCategoryItem[];
  posters: WebsitePosterItem[];
}) {
  const activePosters = [...posters].filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {visibleItems(categories).map((item, index) => {
        const poster = activePosters[index];
        return (
          <article key={item.id} className="overflow-hidden rounded-[26px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.07)] ring-1 ring-inset ring-slate-200">
            <PreviewImage
              src={poster?.imageUrl || item.imageUrl}
              alt={item.title || "Category image"}
              className="h-52 w-full object-cover"
              fallback={item.emoji || item.title || "Category"}
            />
            <div className="space-y-2 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.emoji || "âœ¨"}</span>
                <h4 className="text-lg font-bold text-slate-950">{item.title || "Category title"}</h4>
              </div>
              {item.description ? <p className="text-sm leading-6 text-slate-600">{item.description}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SimpleList({ items }: { items: LandingSimpleItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {visibleItems(items).map((item) => (
        <article key={item.id} className="rounded-[24px] bg-amber-50 px-5 py-4 ring-1 ring-inset ring-amber-200">
          <h4 className="text-base font-bold text-slate-950">{item.title || "Item title"}</h4>
          {item.description ? <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p> : null}
        </article>
      ))}
    </div>
  );
}

function Plans({
  title,
  subtitle,
  freeTitle,
  freeDescription,
  freeItems,
  premiumTitle,
  premiumDescription,
  premiumBadge,
  premiumItems,
}: {
  title: string;
  subtitle: string;
  freeTitle: string;
  freeDescription: string;
  freeItems: LandingSimpleItem[];
  premiumTitle: string;
  premiumDescription: string;
  premiumBadge: string;
  premiumItems: LandingSimpleItem[];
}) {
  const renderItems = (items: LandingSimpleItem[]) =>
    visibleItems(items).map((item) => (
      <li key={item.id} className="flex gap-2 text-sm text-slate-700">
        <span className="mt-1 text-orange-500">â—</span>
        <span>{item.title || item.description || "Item"}</span>
      </li>
    ));

  return (
    <PreviewSection eyebrow="Plans" title={title} subtitle={subtitle}>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] bg-white p-6 ring-1 ring-inset ring-slate-200">
          <h4 className="text-2xl font-black text-slate-950">{freeTitle}</h4>
          <p className="mt-2 text-sm leading-6 text-slate-600">{freeDescription}</p>
          <ul className="mt-5 space-y-3">{renderItems(freeItems)}</ul>
        </article>
        <article className="rounded-[28px] bg-[linear-gradient(135deg,#fff7ed,#fae8ff,#ede9fe)] p-6 ring-1 ring-inset ring-violet-200">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-2xl font-black text-slate-950">{premiumTitle}</h4>
            {premiumBadge ? <span className="rounded-full bg-violet-700 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">{premiumBadge}</span> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{premiumDescription}</p>
          <ul className="mt-5 space-y-3">{renderItems(premiumItems)}</ul>
        </article>
      </div>
    </PreviewSection>
  );
}

function Testimonials({ items }: { items: LandingTestimonialItem[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {visibleItems(items).map((item) => (
        <article key={item.id} className="rounded-[24px] bg-white p-5 ring-1 ring-inset ring-slate-200">
          <div className="flex items-center gap-3">
            <PreviewImage
              src={item.avatarUrl}
              alt={item.name || "User"}
              className="h-14 w-14 rounded-full object-cover"
              fallback={(item.name || "U").slice(0, 1)}
            />
            <div>
              <p className="font-bold text-slate-950">{item.name || "User name"}</p>
              {item.role ? <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.role}</p> : null}
            </div>
          </div>
          {item.review ? <p className="mt-4 text-sm leading-7 text-slate-600">{item.review}</p> : null}
        </article>
      ))}
    </div>
  );
}

function FaqList({ items }: { items: LandingFaqItem[] }) {
  return (
    <div className="space-y-3">
      {visibleItems(items).map((item) => (
        <article key={item.id} className="rounded-[24px] bg-white px-5 py-4 ring-1 ring-inset ring-slate-200">
          <h4 className="text-base font-bold text-slate-950">{item.question || "Question"}</h4>
          {item.answer ? <p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function LandingPagePreview({
  data,
  websitePosters,
}: {
  data: LandingPageRecord;
  websitePosters: WebsitePosterItem[];
}) {
  const navItems = visibleItems(data.navbar.items);
  const socialLinks = visibleItems(data.footer.socialLinks);

  return (
    <article className="overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,#fff7ed_0%,#fff1f2_52%,#f5f3ff_100%)] shadow-[0_22px_80px_rgba(15,23,42,0.12)] ring-1 ring-inset ring-white/60">
      <div className="border-b border-white/70 bg-white/65 px-5 py-4 backdrop-blur sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PreviewImage
              src={data.navbar.logoImageUrl}
              alt={data.navbar.appName || "Mana Poster Ai"}
              className="h-12 w-12 rounded-2xl object-cover ring-1 ring-inset ring-slate-200"
              fallback={data.navbar.logoText || "M"}
            />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-600">Live Preview</p>
              <h2 className="text-lg font-black text-slate-950">{data.navbar.appName || "Mana Poster Ai"}</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {navItems.slice(0, 4).map((item) => (
              <LinkChip key={item.id} item={item} />
            ))}
            {data.navbar.buttonText ? (
              <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                {data.navbar.buttonText}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-4 py-5 sm:px-6 sm:py-6">
        {data.hero.show && data.hero.published ? (
          <section className="rounded-[32px] bg-[linear-gradient(135deg,#ffffff_0%,#fff7ed_45%,#fae8ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-inset ring-white/80 sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-600">{data.hero.helperText || "Hero"}</p>
                <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">{data.hero.title}</h1>
                {data.hero.subtitle ? <p className="text-lg font-semibold text-slate-700">{data.hero.subtitle}</p> : null}
                {data.hero.description ? <p className="max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">{data.hero.description}</p> : null}
                <div className="flex flex-wrap gap-3">
                  {data.hero.primaryButtonText ? (
                    <span className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">{data.hero.primaryButtonText}</span>
                  ) : null}
                  {data.hero.secondaryButtonText ? (
                    <span className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200">{data.hero.secondaryButtonText}</span>
                  ) : null}
                </div>
              </div>
              <div className="space-y-4">
                <HeroGallery items={data.hero.previewImages} />
                <BannerGrid items={data.hero.promoBanners} />
              </div>
            </div>
          </section>
        ) : null}

        {data.appPreview.show && data.appPreview.published ? (
          <PreviewSection id="app-preview" eyebrow="App Preview" title={data.appPreview.title} subtitle={data.appPreview.subtitle || data.appPreview.description}>
            <div className="grid gap-4 md:grid-cols-3">
              {visibleItems(data.appPreview.screenshots).map((item) => (
                <article key={item.id} className="overflow-hidden rounded-[28px] bg-white ring-1 ring-inset ring-slate-200">
                  <PreviewImage
                    src={item.imageUrl}
                    alt={item.title || "Screenshot"}
                    className="h-80 w-full object-cover"
                    fallback={item.title || "Screen"}
                  />
                  <div className="p-4 text-sm font-semibold text-slate-700">{item.title || "Screenshot"}</div>
                </article>
              ))}
            </div>
          </PreviewSection>
        ) : null}

        {data.features.show && data.features.published ? (
          <PreviewSection id="features" eyebrow="Features" title={data.features.title} subtitle={data.features.subtitle || data.features.description}>
            <FeatureGrid items={data.features.items} />
          </PreviewSection>
        ) : null}

        {data.categories.show && data.categories.published ? (
          <PreviewSection id="categories" eyebrow="Categories" title={data.categories.title} subtitle={data.categories.subtitle || data.categories.description}>
            <CategoryGrid categories={data.categories.items} posters={websitePosters} />
          </PreviewSection>
        ) : null}

        {data.dynamicEvents.show && data.dynamicEvents.published ? (
          <PreviewSection id="dynamic-events" eyebrow={data.dynamicEvents.badgeText || "Dynamic Events"} title={data.dynamicEvents.title} subtitle={data.dynamicEvents.subtitle || data.dynamicEvents.description}>
            <SimpleList items={data.dynamicEvents.items} />
          </PreviewSection>
        ) : null}

        {data.plans.show && data.plans.published ? (
          <Plans
            title={data.plans.title}
            subtitle={data.plans.subtitle || data.plans.description}
            freeTitle={data.plans.freeTitle}
            freeDescription={data.plans.freeDescription}
            freeItems={data.plans.freeItems}
            premiumTitle={data.plans.premiumTitle}
            premiumDescription={data.plans.premiumDescription}
            premiumBadge={data.plans.premiumBadge}
            premiumItems={data.plans.premiumItems}
          />
        ) : null}

        {data.testimonials.show && data.testimonials.published ? (
          <PreviewSection eyebrow="Testimonials" title={data.testimonials.title} subtitle={data.testimonials.subtitle || data.testimonials.description}>
            <Testimonials items={data.testimonials.items} />
          </PreviewSection>
        ) : null}

        {data.faq.show && data.faq.published ? (
          <PreviewSection eyebrow="FAQ" title={data.faq.title} subtitle={data.faq.subtitle || data.faq.description}>
            <FaqList items={data.faq.items} />
          </PreviewSection>
        ) : null}

        {data.finalCta.show && data.finalCta.published ? (
          <section className="rounded-[32px] bg-[linear-gradient(135deg,#1e1b4b,#7c3aed,#ec4899)] p-6 text-white shadow-[0_24px_65px_rgba(91,33,182,0.26)] sm:p-8">
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">{data.finalCta.playStoreBadgeText || "CTA"}</p>
                <h3 className="text-3xl font-black sm:text-5xl">{data.finalCta.title}</h3>
                {data.finalCta.subtitle ? <p className="text-lg text-white/85">{data.finalCta.subtitle}</p> : null}
                {data.finalCta.description ? <p className="text-sm leading-8 text-white/80 sm:text-base">{data.finalCta.description}</p> : null}
                <div className="flex flex-wrap gap-3">
                  {data.finalCta.buttonText ? <span className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900">{data.finalCta.buttonText}</span> : null}
                  {data.finalCta.secondaryButtonText ? <span className="rounded-full bg-white/15 px-5 py-3 text-sm font-bold text-white ring-1 ring-inset ring-white/25">{data.finalCta.secondaryButtonText}</span> : null}
                </div>
              </div>
              <HeroGallery items={data.finalCta.previewImages} />
            </div>
          </section>
        ) : null}

        {data.footer.show && data.footer.published ? (
          <footer className="rounded-[32px] bg-slate-950 px-6 py-8 text-white sm:px-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <PreviewImage
                    src={data.footer.logoImageUrl || data.navbar.logoImageUrl}
                    alt={data.footer.title || data.navbar.appName}
                    className="h-12 w-12 rounded-2xl object-cover"
                    fallback={data.navbar.logoText || "M"}
                  />
                  <div>
                    <p className="text-xl font-black">{data.footer.title || data.navbar.appName}</p>
                    {data.footer.subtitle ? <p className="text-sm text-white/65">{data.footer.subtitle}</p> : null}
                  </div>
                </div>
                {data.footer.description ? <p className="max-w-2xl text-sm leading-7 text-white/75">{data.footer.description}</p> : null}
                {data.footer.contactEmail ? <p className="text-sm font-semibold text-white/90">{data.footer.contactEmail}</p> : null}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-white/55">Quick Links</p>
                  {visibleItems(data.footer.quickLinks).map((item) => (
                    <div key={item.id} className="text-sm text-white/80">{item.label || "Link"}</div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-white/55">Social</p>
                  {socialLinks.map((item) => (
                    <div key={item.id} className="text-sm text-white/80">{item.label || "Social"}</div>
                  ))}
                </div>
              </div>
            </div>
          </footer>
        ) : null}
      </div>
    </article>
  );
}

