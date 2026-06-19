"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import {
  landingSectionHref,
  landingSectionLinks,
  type LandingTabId,
} from "@/lib/landing-page-sections";
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

type MessageTone = "success" | "error";

interface WebsitePosterItem {
  id: string;
  category: string;
  imageUrl: string;
  imagePath?: string;
  active: boolean;
  sortOrder: number;
}

type EditableSectionKey =
  | "navbar"
  | "hero"
  | "appPreview"
  | "features"
  | "categories"
  | "dynamicEvents"
  | "plans"
  | "testimonials"
  | "faq"
  | "finalCta"
  | "footer";

const baseInputClass =
  "w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[var(--portal-border-strong)]";
const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
const MAX_IMAGE_UPLOAD_LABEL = "500 KB";

function SectionToggleRow({
  show,
  published,
  onShowChange,
  onPublishedChange,
}: {
  show: boolean;
  published: boolean;
  onShowChange: (value: boolean) => void;
  onPublishedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-5">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => onShowChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
        />
        Show section
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => onPublishedChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
        />
        Published
      </label>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-sm font-semibold text-slate-700">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInputClass} ${props.className ?? ""}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 ${baseInputClass} ${props.className ?? ""}`}
    />
  );
}

function PillButton({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[var(--portal-purple)] text-white"
          : "bg-white text-slate-700 ring-1 ring-inset ring-[var(--portal-border)] hover:bg-[var(--portal-surface-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

function ItemToolbar({
  visible,
  published,
  onVisibleChange,
  onPublishedChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  visible: boolean;
  published: boolean;
  onVisibleChange: (value: boolean) => void;
  onPublishedChange: (value: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onVisibleChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
        />
        Show
      </label>
      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => onPublishedChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
        />
        Publish
      </label>
      <button
        type="button"
        onClick={onMoveUp}
        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
      >
        Up
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
      >
        Down
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
      >
        Delete
      </button>
    </div>
  );
}

function AssetPreview({ label, imageUrl }: { label: string; imageUrl: string }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={label}
      className="h-28 w-full rounded-2xl object-cover ring-1 ring-inset ring-[var(--portal-border)]"
    />
  ) : (
    <div className="flex h-28 items-center justify-center rounded-2xl bg-[var(--portal-surface-soft)] text-xs font-medium text-slate-500 ring-1 ring-inset ring-[var(--portal-border)]">
      No image
    </div>
  );
}

function AssetField({
  label,
  imageUrl,
  uploadLabel = "Upload image",
  uploading,
  onUpload,
  onDelete,
}: {
  label: string;
  imageUrl: string;
  uploadLabel?: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <AssetPreview label={label} imageUrl={imageUrl} />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]">
          {imageUrl ? "Replace image" : uploadLabel}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={onDelete}
          disabled={!imageUrl}
          className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete image
        </button>
      </div>
      {uploading ? <p className="text-xs text-slate-500">Uploading...</p> : null}
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-[28px] bg-white px-6 py-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-[var(--portal-border)]">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-6 space-y-6">{children}</div>
    </article>
  );
}

function Subsection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionTextFields({
  title,
  subtitle,
  description,
  onTitleChange,
  onSubtitleChange,
  onDescriptionChange,
}: {
  title: string;
  subtitle: string;
  description: string;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>Title</FieldLabel>
        <TextInput value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>Subtitle</FieldLabel>
        <TextInput value={subtitle} onChange={(e) => onSubtitleChange(e.target.value)} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>Description</FieldLabel>
        <TextArea value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
      </div>
    </div>
  );
}

function moveItem<T extends { sortOrder: number }>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const clone = [...items];
  const [picked] = clone.splice(index, 1);
  clone.splice(target, 0, picked);
  return clone.map((item, itemIndex) => ({ ...item, sortOrder: (itemIndex + 1) * 10 }));
}

function updateArrayItem<T extends { id: string }>(items: T[], id: string, patchValue: Partial<T>) {
  return items.map((item) => (item.id === id ? { ...item, ...patchValue } : item));
}

function removeArrayItem<T extends { id: string; sortOrder: number }>(items: T[], id: string) {
  return items
    .filter((item) => item.id !== id)
    .map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

function LinkItemGroup({
  label,
  items,
  onAdd,
  onChange,
}: {
  label: string;
  items: LandingLinkItem[];
  onAdd: () => void;
  onChange: (items: LandingLinkItem[]) => void;
}) {
  return (
    <Subsection
      title={label}
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add item
        </button>
      }
    >
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                value={item.label}
                placeholder="Label"
                onChange={(e) => onChange(updateArrayItem(items, item.id, { label: e.target.value }))}
              />
              <TextInput
                value={item.href}
                placeholder="Link"
                onChange={(e) => onChange(updateArrayItem(items, item.id, { href: e.target.value }))}
              />
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) => onChange(updateArrayItem(items, item.id, { published: value }))}
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function ImageItemGroup({
  label,
  items,
  uploadPrefix,
  uploadingKey,
  onAdd,
  onChange,
  onUpload,
}: {
  label: string;
  items: LandingImageItem[];
  uploadPrefix: string;
  uploadingKey: string | null;
  onAdd: () => void;
  onChange: (items: LandingImageItem[]) => void;
  onUpload: (
    itemId: string,
    file: File,
    previousImagePath: string,
    onApply: (result: { imageUrl: string; imagePath: string }) => void,
  ) => void;
}) {
  return (
    <Subsection
      title={label}
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add image
        </button>
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <AssetField
                label={item.title || "Image asset"}
                imageUrl={item.imageUrl}
                uploading={uploadingKey === `${uploadPrefix}:${item.id}`}
                onUpload={(file) =>
                  onUpload(item.id, file, item.imagePath, ({ imageUrl, imagePath }) =>
                    onChange(updateArrayItem(items, item.id, { imageUrl, imagePath })),
                  )
                }
                onDelete={() => onChange(updateArrayItem(items, item.id, { imageUrl: "", imagePath: "" }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Title</FieldLabel>
                  <TextInput
                    value={item.title}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Subtitle</FieldLabel>
                  <TextInput
                    value={item.subtitle}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { subtitle: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextArea
                    value={item.description}
                    onChange={(e) =>
                      onChange(updateArrayItem(items, item.id, { description: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button text</FieldLabel>
                  <TextInput
                    value={item.buttonText}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { buttonText: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button link</FieldLabel>
                  <TextInput
                    value={item.buttonLink}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { buttonLink: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function FeatureItemGroup({
  items,
  onAdd,
  onChange,
}: {
  items: LandingFeatureItem[];
  onAdd: () => void;
  onChange: (items: LandingFeatureItem[]) => void;
}) {
  return (
    <Subsection
      title="Feature items"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add feature
        </button>
      }
    >
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Icon</FieldLabel>
                <TextInput
                  value={item.icon}
                  onChange={(e) => onChange(updateArrayItem(items, item.id, { icon: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={item.title}
                  onChange={(e) => onChange(updateArrayItem(items, item.id, { title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Subtitle</FieldLabel>
                <TextInput
                  value={item.subtitle}
                  onChange={(e) =>
                    onChange(updateArrayItem(items, item.id, { subtitle: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={item.description}
                  onChange={(e) =>
                    onChange(updateArrayItem(items, item.id, { description: e.target.value }))
                  }
                />
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function CategoryItemGroup({
  items,
  uploadingKey,
  onAdd,
  onChange,
  onUpload,
}: {
  items: LandingCategoryItem[];
  uploadingKey: string | null;
  onAdd: () => void;
  onChange: (items: LandingCategoryItem[]) => void;
  onUpload: (
    itemId: string,
    file: File,
    previousImagePath: string,
    onApply: (result: { imageUrl: string; imagePath: string }) => void,
  ) => void;
}) {
  return (
    <Subsection
      title="Category items"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add category
        </button>
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <AssetField
                label={item.title || "Category image"}
                imageUrl={item.imageUrl}
                uploading={uploadingKey === `categories:${item.id}`}
                onUpload={(file) =>
                  onUpload(item.id, file, item.imagePath, ({ imageUrl, imagePath }) =>
                    onChange(updateArrayItem(items, item.id, { imageUrl, imagePath })),
                  )
                }
                onDelete={() => onChange(updateArrayItem(items, item.id, { imageUrl: "", imagePath: "" }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Emoji</FieldLabel>
                  <TextInput
                    value={item.emoji}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { emoji: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Title</FieldLabel>
                  <TextInput
                    value={item.title}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Subtitle</FieldLabel>
                  <TextInput
                    value={item.subtitle}
                    onChange={(e) =>
                      onChange(updateArrayItem(items, item.id, { subtitle: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextArea
                    value={item.description}
                    onChange={(e) =>
                      onChange(updateArrayItem(items, item.id, { description: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button text</FieldLabel>
                  <TextInput
                    value={item.buttonText}
                    onChange={(e) =>
                      onChange(updateArrayItem(items, item.id, { buttonText: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button link</FieldLabel>
                  <TextInput
                    value={item.buttonLink}
                    onChange={(e) =>
                      onChange(updateArrayItem(items, item.id, { buttonLink: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function SimpleItemGroup({
  label,
  items,
  onAdd,
  onChange,
}: {
  label: string;
  items: LandingSimpleItem[];
  onAdd: () => void;
  onChange: (items: LandingSimpleItem[]) => void;
}) {
  return (
    <Subsection
      title={label}
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add item
        </button>
      }
    >
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={item.title}
                  onChange={(e) => onChange(updateArrayItem(items, item.id, { title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={item.description}
                  onChange={(e) =>
                    onChange(updateArrayItem(items, item.id, { description: e.target.value }))
                  }
                />
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function FaqGroup({
  items,
  onAdd,
  onChange,
}: {
  items: LandingFaqItem[];
  onAdd: () => void;
  onChange: (items: LandingFaqItem[]) => void;
}) {
  return (
    <Subsection
      title="FAQ items"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add FAQ
        </button>
      }
    >
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="space-y-2">
              <FieldLabel>Question</FieldLabel>
              <TextInput
                value={item.question}
                onChange={(e) => onChange(updateArrayItem(items, item.id, { question: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Answer</FieldLabel>
              <TextArea
                value={item.answer}
                onChange={(e) => onChange(updateArrayItem(items, item.id, { answer: e.target.value }))}
              />
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function TestimonialGroup({
  items,
  uploadingKey,
  onAdd,
  onChange,
  onUpload,
}: {
  items: LandingTestimonialItem[];
  uploadingKey: string | null;
  onAdd: () => void;
  onChange: (items: LandingTestimonialItem[]) => void;
  onUpload: (
    itemId: string,
    file: File,
    previousImagePath: string,
    onApply: (result: { imageUrl: string; imagePath: string }) => void,
  ) => void;
}) {
  return (
    <Subsection
      title="Testimonial items"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
        >
          Add testimonial
        </button>
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <AssetField
                label={item.name || "Avatar"}
                imageUrl={item.avatarUrl}
                uploadLabel="Upload avatar"
                uploading={uploadingKey === `testimonials:${item.id}`}
                onUpload={(file) =>
                  onUpload(item.id, file, item.avatarPath, ({ imageUrl, imagePath }) =>
                    onChange(updateArrayItem(items, item.id, { avatarUrl: imageUrl, avatarPath: imagePath })),
                  )
                }
                onDelete={() => onChange(updateArrayItem(items, item.id, { avatarUrl: "", avatarPath: "" }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Name</FieldLabel>
                  <TextInput
                    value={item.name}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Role</FieldLabel>
                  <TextInput
                    value={item.role}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { role: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Review</FieldLabel>
                  <TextArea
                    value={item.review}
                    onChange={(e) => onChange(updateArrayItem(items, item.id, { review: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) => onChange(updateArrayItem(items, item.id, { visible: value }))}
              onPublishedChange={(value) =>
                onChange(updateArrayItem(items, item.id, { published: value }))
              }
              onMoveUp={() => onChange(moveItem(items, index, -1))}
              onMoveDown={() => onChange(moveItem(items, index, 1))}
              onRemove={() => onChange(removeArrayItem(items, item.id))}
            />
          </div>
        ))}
      </div>
    </Subsection>
  );
}

function WebsitePosterManager({
  items,
  onChange,
  onCreate,
  onSave,
  onDelete,
}: {
  items: WebsitePosterItem[];
  onChange: (items: WebsitePosterItem[]) => void;
  onCreate: (category: string, sortOrder: number, file: File) => Promise<void>;
  onSave: (item: WebsitePosterItem, imageFile?: File | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<Record<string, File | null>>({});
  const [savingPosterId, setSavingPosterId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--portal-surface-soft)] p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <FieldLabel>Category</FieldLabel>
            <TextInput value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          </div>
          <label className="inline-flex h-fit cursor-pointer items-center justify-center rounded-xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white">
            {creating ? "Uploading..." : "Add poster"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !newCategory.trim()) return;
                setCreating(true);
                try {
                  await onCreate(newCategory.trim(), (items.length + 1) * 10, file);
                  setNewCategory("");
                } finally {
                  setCreating(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </div>
      {items.map((item, index) => (
        <div key={item.id} className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4">
          <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-3">
              <AssetPreview label={item.category} imageUrl={item.imageUrl} />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]">
                {pendingFiles[item.id] ? "Image selected" : "Replace image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPendingFiles((current) => ({ ...current, [item.id]: file }));
                    e.target.value = "";
                  }}
                />
              </label>
              {pendingFiles[item.id] ? (
                <p className="text-xs text-slate-500">{pendingFiles[item.id]?.name}</p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Category</FieldLabel>
                <TextInput
                  value={item.category}
                  onChange={(e) =>
                    onChange(updateArrayItem(items, item.id, { category: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Sort order</FieldLabel>
                <TextInput
                  type="number"
                  value={item.sortOrder}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        sortOrder: Number(e.target.value || 0),
                      }),
                    )
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={item.active}
                onChange={(e) => onChange(updateArrayItem(items, item.id, { active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
              />
              Active
            </label>
            <button
              type="button"
              onClick={() => onChange(moveItem(items, index, -1))}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => onChange(moveItem(items, index, 1))}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
            >
              Down
            </button>
            <button
              type="button"
              onClick={async () => {
                setSavingPosterId(item.id);
                try {
                  await onSave(item, pendingFiles[item.id]);
                  setPendingFiles((current) => ({ ...current, [item.id]: null }));
                } finally {
                  setSavingPosterId(null);
                }
              }}
              className="rounded-xl bg-[var(--portal-purple)] px-3 py-2 text-xs font-semibold text-white"
            >
              {savingPosterId === item.id ? "Saving..." : "Save row"}
            </button>
            <button
              type="button"
              onClick={() => void onDelete(item.id)}
              className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getTabSnapshot(source: LandingPageRecord | null, posters: WebsitePosterItem[], tab: LandingTabId) {
  if (!source) return null;
  switch (tab) {
    case "overview":
      return {
        navbar: source.navbar.show,
        hero: source.hero.show,
        appPreview: source.appPreview.show,
        features: source.features.show,
        categories: source.categories.show,
        dynamicEvents: source.dynamicEvents.show,
        plans: source.plans.show,
        testimonials: source.testimonials.show,
        faq: source.faq.show,
        finalCta: source.finalCta.show,
        footer: source.footer.show,
      };
    case "navbar":
      return source.navbar;
    case "hero":
      return { ...source.hero, promoBanners: [] };
    case "banners":
      return source.hero.promoBanners;
    case "appPreview":
      return source.appPreview;
    case "features":
      return source.features;
    case "categories":
      return source.categories;
    case "website-posters":
      return posters;
    case "dynamicEvents":
      return source.dynamicEvents;
    case "plans":
      return source.plans;
    case "testimonials":
      return source.testimonials;
    case "faq":
      return source.faq;
    case "finalCta":
      return source.finalCta;
    case "footer":
      return source.footer;
    case "seo":
      return {
        publicPreviewUrl: source.publicPreviewUrl,
        supportEmail: source.footer.contactEmail,
        socialLinks: source.footer.socialLinks,
        navbarButtonLink: source.navbar.buttonLink,
        heroPrimaryButtonLink: source.hero.primaryButtonLink,
        heroSecondaryButtonLink: source.hero.secondaryButtonLink,
        plansButtonLink: source.plans.buttonLink,
        finalCtaButtonLink: source.finalCta.buttonLink,
        finalCtaSecondaryButtonLink: source.finalCta.secondaryButtonLink,
      };
  }
}

export function LandingPageEditor({ initialSection = "overview" }: { initialSection?: LandingTabId }) {
  const { user } = useAuth();
  const { region } = useDashboardRegion();
  const router = useRouter();
  const [data, setData] = useState<LandingPageRecord | null>(null);
  const [savedData, setSavedData] = useState<LandingPageRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [websitePosters, setWebsitePosters] = useState<WebsitePosterItem[]>([]);
  const [savedWebsitePosters, setSavedWebsitePosters] = useState<WebsitePosterItem[]>([]);
  const [activeTab, setActiveTab] = useState<LandingTabId>(initialSection);
  const [previewReloadKey, setPreviewReloadKey] = useState(() => Date.now());

  const publicPreviewUrl = useMemo(
    () => data?.publicPreviewUrl || "https://manaposter.in/",
    [data],
  );

  const iframePreviewUrl = useMemo(() => {
    const raw = publicPreviewUrl.trim() || "https://manaposter.in/";
    const [beforeHash, hash = ""] = raw.split("#", 2);
    const separator = beforeHash.includes("?") ? "&" : "?";
    return `${beforeHash}${separator}portalPreviewTs=${previewReloadKey}${hash ? `#${hash}` : ""}`;
  }, [publicPreviewUrl, previewReloadKey]);

  useEffect(() => {
    setActiveTab(initialSection);
  }, [initialSection]);

  function navigateToTab(nextTab: LandingTabId) {
    if (nextTab === activeTab) {
      return;
    }
    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        "You have unsaved changes in the landing page editor. Open another section anyway?",
      );
      if (!proceed) {
        return;
      }
    }
    setMessage(null);
    setActiveTab(nextTab);
    router.push(landingSectionHref(nextTab));
  }

  const hasUnsavedChanges =
    JSON.stringify(data) !== JSON.stringify(savedData) ||
    JSON.stringify(websitePosters) !== JSON.stringify(savedWebsitePosters);

  const isCurrentTabDirty =
    JSON.stringify(getTabSnapshot(data, websitePosters, activeTab)) !==
    JSON.stringify(getTabSnapshot(savedData, savedWebsitePosters, activeTab));

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  async function load() {
    const token = await user?.getIdToken();
    if (!token) return;
    setLoading(true);
    const [landingResponse, postersResponse] = await Promise.all([
      fetch("/api/admin/landing-page", {
        headers: { authorization: `Bearer ${token}` },
      }),
      fetch(`/api/admin/website-posters?regionId=${encodeURIComponent(region.id)}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    ]);
    const payload = (await landingResponse.json()) as {
      ok: boolean;
      landingPage?: LandingPageRecord;
      error?: string;
    };
    const posterPayload = (await postersResponse.json()) as {
      ok: boolean;
      posters?: WebsitePosterItem[];
    };
    if (landingResponse.ok && payload.ok && payload.landingPage) {
      setData(payload.landingPage);
      setSavedData(payload.landingPage);
      const posters = posterPayload.posters ?? [];
      setWebsitePosters(posters);
      setSavedWebsitePosters(posters);
      setMessage(null);
    } else {
      setMessageTone("error");
      setMessage(payload.error ?? "Unable to load landing page config.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, region.id]);

  function patch(next: LandingPageRecord) {
    setData(next);
  }

  function patchSection<K extends EditableSectionKey>(
    key: K,
    updater: (section: LandingPageRecord[K]) => LandingPageRecord[K],
  ) {
    setData((current) => (current ? { ...current, [key]: updater(current[key]) } : current));
  }

  function addLinkItem(items: LandingLinkItem[], prefix: string) {
    return [
      ...items,
      {
        id: `${prefix}-${Date.now()}`,
        label: "",
        href: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addImageItem(items: LandingImageItem[], prefix: string) {
    return [
      ...items,
      {
        id: `${prefix}-${Date.now()}`,
        title: "",
        subtitle: "",
        description: "",
        imageUrl: "",
        imagePath: "",
        buttonText: "",
        buttonLink: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addFeatureItem(items: LandingFeatureItem[]) {
    return [
      ...items,
      {
        id: `feature-${Date.now()}`,
        title: "",
        subtitle: "",
        description: "",
        icon: "âœ¨",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addCategoryItem(items: LandingCategoryItem[]) {
    return [
      ...items,
      {
        id: `category-${Date.now()}`,
        title: "",
        subtitle: "",
        description: "",
        emoji: "âœ¨",
        imageUrl: "",
        imagePath: "",
        buttonText: "",
        buttonLink: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addSimpleItem(items: LandingSimpleItem[], prefix: string) {
    return [
      ...items,
      {
        id: `${prefix}-${Date.now()}`,
        title: "",
        description: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addFaqItem(items: LandingFaqItem[]) {
    return [
      ...items,
      {
        id: `faq-${Date.now()}`,
        question: "",
        answer: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  function addTestimonial(items: LandingTestimonialItem[]) {
    return [
      ...items,
      {
        id: `testimonial-${Date.now()}`,
        name: "",
        role: "",
        review: "",
        avatarUrl: "",
        avatarPath: "",
        sortOrder: (items.length + 1) * 10,
        visible: true,
        published: true,
      },
    ];
  }

  async function uploadImage(
    section: string,
    itemId: string,
    file: File,
    onApply: (result: { imageUrl: string; imagePath: string }) => void,
    previousImagePath = "",
  ) {
    const token = await user?.getIdToken();
    if (!token) return;
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      const message = `Image must be ${MAX_IMAGE_UPLOAD_LABEL} or smaller.`;
      alert(message);
      setMessageTone("error");
      setMessage(message);
      return;
    }
    setUploadingKey(`${section}:${itemId}`);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("section", section);
      body.set("itemId", itemId);
      body.set("image", file);
      const response = await fetch("/api/admin/landing-page/assets", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        imageUrl?: string;
        imagePath?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.imageUrl || !payload.imagePath) {
        throw new Error(payload.error ?? "Unable to upload image.");
      }
      onApply({ imageUrl: payload.imageUrl, imagePath: payload.imagePath });
      if (previousImagePath && previousImagePath !== payload.imagePath) {
        await deleteImageAsset(section, itemId, previousImagePath, false);
      }
      setMessageTone("success");
      setMessage("Image uploaded.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to upload image.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function deleteImageAsset(
    section: string,
    itemId: string,
    imagePath: string,
    showSuccess = true,
  ) {
    const token = await user?.getIdToken();
    if (!token || !imagePath) return;
    const response = await fetch("/api/admin/landing-page/assets", {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ section, itemId, imagePath }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to delete image.");
    }
    if (showSuccess) {
      setMessageTone("success");
      setMessage("Image deleted.");
    }
  }

  function resetCurrentTab() {
    if (!data || !savedData || activeTab === "overview") return;
    if (activeTab === "website-posters") {
      setWebsitePosters(savedWebsitePosters);
      setMessage(null);
      return;
    }
    if (activeTab === "banners") {
      patchSection("hero", (section) => ({ ...section, promoBanners: savedData.hero.promoBanners }));
      return;
    }
    if (activeTab === "seo") {
      setData({
        ...data,
        publicPreviewUrl: savedData.publicPreviewUrl,
        navbar: { ...data.navbar, buttonLink: savedData.navbar.buttonLink },
        hero: {
          ...data.hero,
          primaryButtonLink: savedData.hero.primaryButtonLink,
          secondaryButtonLink: savedData.hero.secondaryButtonLink,
        },
        plans: { ...data.plans, buttonLink: savedData.plans.buttonLink },
        finalCta: {
          ...data.finalCta,
          buttonLink: savedData.finalCta.buttonLink,
          secondaryButtonLink: savedData.finalCta.secondaryButtonLink,
        },
        footer: {
          ...data.footer,
          contactEmail: savedData.footer.contactEmail,
          socialLinks: savedData.footer.socialLinks,
        },
      });
      return;
    }
    const keyMap: Record<
      Exclude<LandingTabId, "overview" | "banners" | "website-posters" | "seo">,
      EditableSectionKey
    > = {
      navbar: "navbar",
      hero: "hero",
      appPreview: "appPreview",
      features: "features",
      categories: "categories",
      dynamicEvents: "dynamicEvents",
      plans: "plans",
      testimonials: "testimonials",
      faq: "faq",
      finalCta: "finalCta",
      footer: "footer",
    };
    const key = keyMap[activeTab as keyof typeof keyMap];
    if (!key) return;
    setData({ ...data, [key]: savedData[key] });
    setMessage(null);
  }

  async function saveCurrentTab() {
    if (!data) return;
    const token = await user?.getIdToken();
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/landing-page", {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        landingPage?: LandingPageRecord;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.landingPage) {
        throw new Error(payload.error ?? "Unable to save landing page.");
      }
      setData(payload.landingPage);
      setSavedData(payload.landingPage);
      setMessageTone("success");
      setMessage("Section updated.");
      setPreviewReloadKey(Date.now());
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to save landing page.");
    } finally {
      setBusy(false);
    }
  }

  async function createWebsitePoster(category: string, sortOrder: number, file: File) {
    const token = await user?.getIdToken();
    if (!token) return;
    const body = new FormData();
    body.set("category", category);
    body.set("sortOrder", String(sortOrder));
    body.set("active", "true");
    body.set("regionId", region.id);
    body.set("image", file);
    const response = await fetch("/api/admin/website-posters", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to create website poster.");
    }
    await load();
  }

  async function updateWebsitePoster(item: WebsitePosterItem, imageFile?: File | null) {
    const token = await user?.getIdToken();
    if (!token) return;
    const hasImageFile = imageFile instanceof File;
    const response = await fetch(`/api/admin/website-posters/${item.id}`, {
      method: "PATCH",
      headers: hasImageFile
        ? {
            authorization: `Bearer ${token}`,
          }
        : {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
      body: hasImageFile
        ? (() => {
            const body = new FormData();
            body.set("category", item.category);
            body.set("active", String(item.active));
            body.set("sortOrder", String(item.sortOrder));
            body.set("imagePath", item.imagePath ?? "");
            body.set("image", imageFile);
            return body;
          })()
        : JSON.stringify({
            category: item.category,
            active: item.active,
            sortOrder: item.sortOrder,
          }),
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to update website poster.");
    }
    await load();
  }

  async function deleteWebsitePoster(id: string) {
    const token = await user?.getIdToken();
    if (!token) return;
    const response = await fetch(`/api/admin/website-posters/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    const payload = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Unable to delete website poster.");
    }
    await load();
  }

  if (loading || !data) {
    return (
      <div className="rounded-[28px] bg-white px-6 py-8 text-sm text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-[var(--portal-border)]">
        Loading landing page configuration...
      </div>
    );
  }

  const overviewItems = [
    { id: "hero" as LandingTabId, label: "Hero", enabled: data.hero.show },
    { id: "banners" as LandingTabId, label: "Banners", enabled: data.hero.promoBanners.some((item) => item.visible) },
    { id: "appPreview" as LandingTabId, label: "App Screens", enabled: data.appPreview.show },
    { id: "features" as LandingTabId, label: "Features", enabled: data.features.show },
    { id: "categories" as LandingTabId, label: "Categories", enabled: data.categories.show },
    { id: "dynamicEvents" as LandingTabId, label: "Dynamic Events", enabled: data.dynamicEvents.show },
    { id: "plans" as LandingTabId, label: "Plans", enabled: data.plans.show },
    { id: "testimonials" as LandingTabId, label: "Testimonials", enabled: data.testimonials.show },
    { id: "faq" as LandingTabId, label: "FAQ", enabled: data.faq.show },
    { id: "finalCta" as LandingTabId, label: "CTA", enabled: data.finalCta.show },
    { id: "footer" as LandingTabId, label: "Footer", enabled: data.footer.show },
    { id: "seo" as LandingTabId, label: "SEO / Links", enabled: true },
  ];

  return (
    <section className="space-y-6">
      <article className="rounded-[28px] bg-white px-6 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-[var(--portal-border)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
              Landing Page Management
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Manage public website content</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              The landing page is split into sections so each panel can manage content, images, links, and visibility clearly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={publicPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)] transition hover:bg-[var(--portal-surface-soft)]"
            >
              Open Landing Page
            </a>
            {activeTab !== "overview" ? (
              <>
                <button
                  type="button"
                  onClick={resetCurrentTab}
                  disabled={!isCurrentTabDirty || busy}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset Section
                </button>
                <button
                  type="button"
                  onClick={() => void saveCurrentTab()}
                  disabled={!isCurrentTabDirty || busy}
                  className="rounded-2xl bg-[var(--portal-purple)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save Section"}
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {landingSectionLinks.map((section) => (
            <PillButton
              key={section.id}
              active={activeTab === section.id}
              onClick={() => navigateToTab(section.id)}
            >
              {section.label}
            </PillButton>
          ))}
        </div>
        {message ? (
          <div
            className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
              messageTone === "success"
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
            }`}
          >
            {message}
          </div>
        ) : null}
        {hasUnsavedChanges ? (
          <p className="mt-4 text-xs font-medium text-amber-700">You have unsaved changes.</p>
        ) : null}
      </article>

      {data ? (
        <article className="space-y-4 rounded-[28px] bg-white px-4 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-[var(--portal-border)] sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--portal-purple)]">
                Public Landing
              </p>
              <h3 className="mt-2 text-2xl font-bold text-slate-950">Idi exact `manaposter.in` landing page live frame</h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                This preview shows the public site. Save form changes to update the public site, then refresh the frame to reload the latest render.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewReloadKey(Date.now())}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)] transition hover:bg-[var(--portal-surface-soft)]"
              >
                Refresh Frame
              </button>
              <a
                href={publicPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
              >
                Open Public Site
              </a>
            </div>
          </div>
          <div className="overflow-hidden rounded-[32px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
            <iframe
              key={iframePreviewUrl}
              src={iframePreviewUrl}
              title="Mana Poster Ai public landing page"
              className="h-[980px] w-full bg-white"
            />
          </div>
        </article>
      ) : null}

      {activeTab === "overview" ? (
        <SectionCard
          eyebrow="Overview"
          title="Landing page sections"
          description="Overview shows enabled state, quick edit shortcuts, and last updated summary for each website area."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {overviewItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl bg-[var(--portal-surface-soft)] px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.enabled ? "Enabled" : "Hidden"}
                    {data.updatedAt ? ` â€¢ Updated ${new Date(data.updatedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab(item.id)}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-[var(--portal-border)]"
                >
                  Quick edit
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "navbar" ? (
        <SectionCard
          eyebrow="Navbar"
          title="Navbar"
          description="This section controls the logo, app name, nav links, and top CTA shown in the public website header."
        >
          <SectionToggleRow
            show={data.navbar.show}
            published={data.navbar.published}
            onShowChange={(value) => patchSection("navbar", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("navbar", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Logo text</FieldLabel>
                <TextInput value={data.navbar.logoText} onChange={(e) => patchSection("navbar", (section) => ({ ...section, logoText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>App name</FieldLabel>
                <TextInput value={data.navbar.appName} onChange={(e) => patchSection("navbar", (section) => ({ ...section, appName: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <Subsection title="Buttons / Links">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Button text</FieldLabel>
                <TextInput value={data.navbar.buttonText} onChange={(e) => patchSection("navbar", (section) => ({ ...section, buttonText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Button link</FieldLabel>
                <TextInput value={data.navbar.buttonLink} onChange={(e) => patchSection("navbar", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <Subsection title="Images">
            <AssetField
              label="Navbar logo"
              imageUrl={data.navbar.logoImageUrl}
              uploadLabel="Upload navbar logo"
              uploading={uploadingKey === "navbar_branding:navbar-logo"}
              onUpload={(file) =>
                void uploadImage("navbar_branding", "navbar-logo", file, ({ imageUrl, imagePath }) =>
                  patchSection("navbar", (section) => ({ ...section, logoImageUrl: imageUrl, logoImagePath: imagePath })),
                )
              }
              onDelete={() => patchSection("navbar", (section) => ({ ...section, logoImageUrl: "", logoImagePath: "" }))}
            />
          </Subsection>
          <LinkItemGroup
            label="Ordering"
            items={data.navbar.items}
            onAdd={() => patchSection("navbar", (section) => ({ ...section, items: addLinkItem(section.items, "nav") }))}
            onChange={(items) => patchSection("navbar", (section) => ({ ...section, items }))}
          />
        </SectionCard>
      ) : null}

      {activeTab === "hero" ? (
        <SectionCard
          eyebrow="Hero"
          title="Hero"
          description="This section controls the main hero text, buttons, and hero poster images shown at the top of the landing page."
        >
          <SectionToggleRow
            show={data.hero.show}
            published={data.hero.published}
            onShowChange={(value) => patchSection("hero", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("hero", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.hero.title}
              subtitle={data.hero.subtitle}
              description={data.hero.description}
              onTitleChange={(value) => patchSection("hero", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("hero", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("hero", (section) => ({ ...section, description: value }))}
            />
            <div className="space-y-2">
              <FieldLabel>Helper text</FieldLabel>
              <TextInput value={data.hero.helperText} onChange={(e) => patchSection("hero", (section) => ({ ...section, helperText: e.target.value }))} />
            </div>
          </Subsection>
          <Subsection title="Buttons / Links">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Primary button text</FieldLabel>
                <TextInput value={data.hero.primaryButtonText} onChange={(e) => patchSection("hero", (section) => ({ ...section, primaryButtonText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Primary button link</FieldLabel>
                <TextInput value={data.hero.primaryButtonLink} onChange={(e) => patchSection("hero", (section) => ({ ...section, primaryButtonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Secondary button text</FieldLabel>
                <TextInput value={data.hero.secondaryButtonText} onChange={(e) => patchSection("hero", (section) => ({ ...section, secondaryButtonText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Secondary button link</FieldLabel>
                <TextInput value={data.hero.secondaryButtonLink} onChange={(e) => patchSection("hero", (section) => ({ ...section, secondaryButtonLink: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <ImageItemGroup
            label="Images"
            items={data.hero.previewImages}
            uploadPrefix="hero_preview_images"
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("hero", (section) => ({ ...section, previewImages: addImageItem(section.previewImages, "hero-preview") }))}
            onChange={(items) => patchSection("hero", (section) => ({ ...section, previewImages: items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("hero_preview_images", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "banners" ? (
        <SectionCard
          eyebrow="Banners"
          title="Promo banners"
          description="This section controls promo banner visuals shown around the hero area of the public website."
        >
          <ImageItemGroup
            label="Images"
            items={data.hero.promoBanners}
            uploadPrefix="hero_promo_banners"
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("hero", (section) => ({ ...section, promoBanners: addImageItem(section.promoBanners, "hero-banner") }))}
            onChange={(items) => patchSection("hero", (section) => ({ ...section, promoBanners: items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("hero_promo_banners", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "appPreview" ? (
        <SectionCard
          eyebrow="App Screens"
          title="App screens"
          description="This section controls app screenshots and supporting copy shown in the app preview area."
        >
          <SectionToggleRow
            show={data.appPreview.show}
            published={data.appPreview.published}
            onShowChange={(value) => patchSection("appPreview", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("appPreview", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.appPreview.title}
              subtitle={data.appPreview.subtitle}
              description={data.appPreview.description}
              onTitleChange={(value) => patchSection("appPreview", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("appPreview", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("appPreview", (section) => ({ ...section, description: value }))}
            />
          </Subsection>
          <ImageItemGroup
            label="Images"
            items={data.appPreview.screenshots}
            uploadPrefix="app_preview_screenshots"
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("appPreview", (section) => ({ ...section, screenshots: addImageItem(section.screenshots, "app-preview") }))}
            onChange={(items) => patchSection("appPreview", (section) => ({ ...section, screenshots: items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("app_preview_screenshots", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "features" ? (
        <SectionCard
          eyebrow="Features"
          title="Features"
          description="This section controls the feature list and the supporting copy shown in the public website features block."
        >
          <SectionToggleRow
            show={data.features.show}
            published={data.features.published}
            onShowChange={(value) => patchSection("features", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("features", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.features.title}
              subtitle={data.features.subtitle}
              description={data.features.description}
              onTitleChange={(value) => patchSection("features", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("features", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("features", (section) => ({ ...section, description: value }))}
            />
          </Subsection>
          <FeatureItemGroup
            items={data.features.items}
            onAdd={() => patchSection("features", (section) => ({ ...section, items: addFeatureItem(section.items) }))}
            onChange={(items) => patchSection("features", (section) => ({ ...section, items }))}
          />
        </SectionCard>
      ) : null}

      {activeTab === "categories" ? (
        <SectionCard
          eyebrow="Categories"
          title="Categories"
          description="This section controls category chips, preview text, and category images shown on the public landing page."
        >
          <SectionToggleRow
            show={data.categories.show}
            published={data.categories.published}
            onShowChange={(value) => patchSection("categories", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("categories", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.categories.title}
              subtitle={data.categories.subtitle}
              description={data.categories.description}
              onTitleChange={(value) => patchSection("categories", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("categories", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("categories", (section) => ({ ...section, description: value }))}
            />
          </Subsection>
          <CategoryItemGroup
            items={data.categories.items}
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("categories", (section) => ({ ...section, items: addCategoryItem(section.items) }))}
            onChange={(items) => patchSection("categories", (section) => ({ ...section, items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("categories", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "website-posters" ? (
        <SectionCard
          eyebrow="Poster Strip"
          title="Poster strip"
          description="This section controls the websitePosters collection already read by the public Flutter landing page."
        >
          <WebsitePosterManager
            items={websitePosters}
            onChange={setWebsitePosters}
            onCreate={async (category, sortOrder, file) => {
              try {
                await createWebsitePoster(category, sortOrder, file);
                setMessageTone("success");
                setMessage("Website poster added.");
              } catch (error) {
                setMessageTone("error");
                setMessage(error instanceof Error ? error.message : "Unable to add website poster.");
              }
            }}
            onSave={async (item) => {
              try {
                await updateWebsitePoster(item);
                setMessageTone("success");
                setMessage("Website poster updated.");
              } catch (error) {
                setMessageTone("error");
                setMessage(error instanceof Error ? error.message : "Unable to update website poster.");
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteWebsitePoster(id);
                setMessageTone("success");
                setMessage("Website poster deleted.");
              } catch (error) {
                setMessageTone("error");
                setMessage(error instanceof Error ? error.message : "Unable to delete website poster.");
              }
            }}
          />
        </SectionCard>
      ) : null}

      {activeTab === "dynamicEvents" ? (
        <SectionCard
          eyebrow="Dynamic Events"
          title="Dynamic events"
          description="This section controls the event calendar copy and event rows shown in the dynamic events section."
        >
          <SectionToggleRow
            show={data.dynamicEvents.show}
            published={data.dynamicEvents.published}
            onShowChange={(value) => patchSection("dynamicEvents", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("dynamicEvents", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.dynamicEvents.title}
              subtitle={data.dynamicEvents.subtitle}
              description={data.dynamicEvents.description}
              onTitleChange={(value) => patchSection("dynamicEvents", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("dynamicEvents", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("dynamicEvents", (section) => ({ ...section, description: value }))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Badge text</FieldLabel>
                <TextInput value={data.dynamicEvents.badgeText} onChange={(e) => patchSection("dynamicEvents", (section) => ({ ...section, badgeText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Calendar title</FieldLabel>
                <TextInput value={data.dynamicEvents.calendarTitle} onChange={(e) => patchSection("dynamicEvents", (section) => ({ ...section, calendarTitle: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Auto update text</FieldLabel>
                <TextArea value={data.dynamicEvents.autoUpdateText} onChange={(e) => patchSection("dynamicEvents", (section) => ({ ...section, autoUpdateText: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Calendar description</FieldLabel>
                <TextArea value={data.dynamicEvents.calendarDescription} onChange={(e) => patchSection("dynamicEvents", (section) => ({ ...section, calendarDescription: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <SimpleItemGroup
            label="Ordering"
            items={data.dynamicEvents.items}
            onAdd={() => patchSection("dynamicEvents", (section) => ({ ...section, items: addSimpleItem(section.items, "dynamic") }))}
            onChange={(items) => patchSection("dynamicEvents", (section) => ({ ...section, items }))}
          />
        </SectionCard>
      ) : null}

      {activeTab === "plans" ? (
        <SectionCard
          eyebrow="Plans"
          title="Plans"
          description="This section controls the Free vs Premium comparison text, lists, badge, and CTA."
        >
          <SectionToggleRow
            show={data.plans.show}
            published={data.plans.published}
            onShowChange={(value) => patchSection("plans", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("plans", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.plans.title}
              subtitle={data.plans.subtitle}
              description={data.plans.description}
              onTitleChange={(value) => patchSection("plans", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("plans", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("plans", (section) => ({ ...section, description: value }))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Free title</FieldLabel>
                <TextInput value={data.plans.freeTitle} onChange={(e) => patchSection("plans", (section) => ({ ...section, freeTitle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Premium title</FieldLabel>
                <TextInput value={data.plans.premiumTitle} onChange={(e) => patchSection("plans", (section) => ({ ...section, premiumTitle: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Free description</FieldLabel>
                <TextArea value={data.plans.freeDescription} onChange={(e) => patchSection("plans", (section) => ({ ...section, freeDescription: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Premium description</FieldLabel>
                <TextArea value={data.plans.premiumDescription} onChange={(e) => patchSection("plans", (section) => ({ ...section, premiumDescription: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <Subsection title="Buttons / Links">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Premium badge</FieldLabel>
                <TextInput value={data.plans.premiumBadge} onChange={(e) => patchSection("plans", (section) => ({ ...section, premiumBadge: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Button text</FieldLabel>
                <TextInput value={data.plans.buttonText} onChange={(e) => patchSection("plans", (section) => ({ ...section, buttonText: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Button link</FieldLabel>
                <TextInput value={data.plans.buttonLink} onChange={(e) => patchSection("plans", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <div className="grid gap-6 xl:grid-cols-2">
            <SimpleItemGroup
              label="Free items"
              items={data.plans.freeItems}
              onAdd={() => patchSection("plans", (section) => ({ ...section, freeItems: addSimpleItem(section.freeItems, "free") }))}
              onChange={(items) => patchSection("plans", (section) => ({ ...section, freeItems: items }))}
            />
            <SimpleItemGroup
              label="Premium items"
              items={data.plans.premiumItems}
              onAdd={() => patchSection("plans", (section) => ({ ...section, premiumItems: addSimpleItem(section.premiumItems, "premium") }))}
              onChange={(items) => patchSection("plans", (section) => ({ ...section, premiumItems: items }))}
            />
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "testimonials" ? (
        <SectionCard
          eyebrow="Testimonials"
          title="Testimonials"
          description="This section controls testimonial names, profile images, and review text shown in the landing page review area."
        >
          <SectionToggleRow
            show={data.testimonials.show}
            published={data.testimonials.published}
            onShowChange={(value) => patchSection("testimonials", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("testimonials", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.testimonials.title}
              subtitle={data.testimonials.subtitle}
              description={data.testimonials.description}
              onTitleChange={(value) => patchSection("testimonials", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("testimonials", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("testimonials", (section) => ({ ...section, description: value }))}
            />
          </Subsection>
          <TestimonialGroup
            items={data.testimonials.items}
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("testimonials", (section) => ({ ...section, items: addTestimonial(section.items) }))}
            onChange={(items) => patchSection("testimonials", (section) => ({ ...section, items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("testimonials", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "faq" ? (
        <SectionCard
          eyebrow="FAQ"
          title="FAQ"
          description="This section controls the question and answer accordion shown near the bottom of the landing page."
        >
          <SectionToggleRow
            show={data.faq.show}
            published={data.faq.published}
            onShowChange={(value) => patchSection("faq", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("faq", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.faq.title}
              subtitle={data.faq.subtitle}
              description={data.faq.description}
              onTitleChange={(value) => patchSection("faq", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("faq", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("faq", (section) => ({ ...section, description: value }))}
            />
          </Subsection>
          <FaqGroup
            items={data.faq.items}
            onAdd={() => patchSection("faq", (section) => ({ ...section, items: addFaqItem(section.items) }))}
            onChange={(items) => patchSection("faq", (section) => ({ ...section, items }))}
          />
        </SectionCard>
      ) : null}

      {activeTab === "finalCta" ? (
        <SectionCard
          eyebrow="CTA"
          title="Final CTA"
          description="This section controls the closing CTA text, buttons, and preview images shown before the footer."
        >
          <SectionToggleRow
            show={data.finalCta.show}
            published={data.finalCta.published}
            onShowChange={(value) => patchSection("finalCta", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("finalCta", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.finalCta.title}
              subtitle={data.finalCta.subtitle}
              description={data.finalCta.description}
              onTitleChange={(value) => patchSection("finalCta", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("finalCta", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("finalCta", (section) => ({ ...section, description: value }))}
            />
            <div className="space-y-2">
              <FieldLabel>Helper text</FieldLabel>
              <TextInput value={data.finalCta.helperText} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, helperText: e.target.value }))} />
            </div>
          </Subsection>
          <Subsection title="Buttons / Links">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Primary button text</FieldLabel>
                <TextInput value={data.finalCta.buttonText} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, buttonText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Primary button link</FieldLabel>
                <TextInput value={data.finalCta.buttonLink} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Secondary button text</FieldLabel>
                <TextInput value={data.finalCta.secondaryButtonText} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, secondaryButtonText: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Secondary button link</FieldLabel>
                <TextInput value={data.finalCta.secondaryButtonLink} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, secondaryButtonLink: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Play Store badge text</FieldLabel>
                <TextInput value={data.finalCta.playStoreBadgeText} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, playStoreBadgeText: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <ImageItemGroup
            label="Images"
            items={data.finalCta.previewImages}
            uploadPrefix="final_cta_preview_images"
            uploadingKey={uploadingKey}
            onAdd={() => patchSection("finalCta", (section) => ({ ...section, previewImages: addImageItem(section.previewImages, "final-cta") }))}
            onChange={(items) => patchSection("finalCta", (section) => ({ ...section, previewImages: items }))}
            onUpload={(itemId, file, previousImagePath, onApply) =>
              void uploadImage("final_cta_preview_images", itemId, file, onApply, previousImagePath)
            }
          />
        </SectionCard>
      ) : null}

      {activeTab === "footer" ? (
        <SectionCard
          eyebrow="Footer"
          title="Footer"
          description="This section controls footer copy, contact details, footer logo, quick links, and social links."
        >
          <SectionToggleRow
            show={data.footer.show}
            published={data.footer.published}
            onShowChange={(value) => patchSection("footer", (section) => ({ ...section, show: value }))}
            onPublishedChange={(value) => patchSection("footer", (section) => ({ ...section, published: value }))}
          />
          <Subsection title="Content">
            <SectionTextFields
              title={data.footer.title}
              subtitle={data.footer.subtitle}
              description={data.footer.description}
              onTitleChange={(value) => patchSection("footer", (section) => ({ ...section, title: value }))}
              onSubtitleChange={(value) => patchSection("footer", (section) => ({ ...section, subtitle: value }))}
              onDescriptionChange={(value) => patchSection("footer", (section) => ({ ...section, description: value }))}
            />
            <div className="space-y-2">
              <FieldLabel>Contact email</FieldLabel>
              <TextInput value={data.footer.contactEmail} onChange={(e) => patchSection("footer", (section) => ({ ...section, contactEmail: e.target.value }))} />
            </div>
          </Subsection>
          <Subsection title="Images">
            <AssetField
              label="Footer logo"
              imageUrl={data.footer.logoImageUrl}
              uploadLabel="Upload footer logo"
              uploading={uploadingKey === "footer_branding:footer-logo"}
              onUpload={(file) =>
                void uploadImage("footer_branding", "footer-logo", file, ({ imageUrl, imagePath }) =>
                  patchSection("footer", (section) => ({ ...section, logoImageUrl: imageUrl, logoImagePath: imagePath })),
                )
              }
              onDelete={() => patchSection("footer", (section) => ({ ...section, logoImageUrl: "", logoImagePath: "" }))}
            />
          </Subsection>
          <LinkItemGroup
            label="Quick links"
            items={data.footer.quickLinks}
            onAdd={() => patchSection("footer", (section) => ({ ...section, quickLinks: addLinkItem(section.quickLinks, "footer-link") }))}
            onChange={(items) => patchSection("footer", (section) => ({ ...section, quickLinks: items }))}
          />
          <LinkItemGroup
            label="Social links"
            items={data.footer.socialLinks}
            onAdd={() => patchSection("footer", (section) => ({ ...section, socialLinks: addLinkItem(section.socialLinks, "social-link") }))}
            onChange={(items) => patchSection("footer", (section) => ({ ...section, socialLinks: items }))}
          />
        </SectionCard>
      ) : null}

      {activeTab === "seo" ? (
        <SectionCard
          eyebrow="SEO / Links"
          title="SEO and links"
          description="This section controls preview URL, support email, CTA links, and social links used across the public landing page."
        >
          <Subsection title="Links">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Public preview URL</FieldLabel>
                <TextInput value={data.publicPreviewUrl} onChange={(e) => patch({ ...data, publicPreviewUrl: e.target.value })} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Navbar button link</FieldLabel>
                <TextInput value={data.navbar.buttonLink} onChange={(e) => patchSection("navbar", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Hero primary link</FieldLabel>
                <TextInput value={data.hero.primaryButtonLink} onChange={(e) => patchSection("hero", (section) => ({ ...section, primaryButtonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Hero secondary link</FieldLabel>
                <TextInput value={data.hero.secondaryButtonLink} onChange={(e) => patchSection("hero", (section) => ({ ...section, secondaryButtonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Plans button link</FieldLabel>
                <TextInput value={data.plans.buttonLink} onChange={(e) => patchSection("plans", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>CTA primary link</FieldLabel>
                <TextInput value={data.finalCta.buttonLink} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, buttonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>CTA secondary link</FieldLabel>
                <TextInput value={data.finalCta.secondaryButtonLink} onChange={(e) => patchSection("finalCta", (section) => ({ ...section, secondaryButtonLink: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Support email</FieldLabel>
                <TextInput value={data.footer.contactEmail} onChange={(e) => patchSection("footer", (section) => ({ ...section, contactEmail: e.target.value }))} />
              </div>
            </div>
          </Subsection>
          <LinkItemGroup
            label="Social links"
            items={data.footer.socialLinks}
            onAdd={() => patchSection("footer", (section) => ({ ...section, socialLinks: addLinkItem(section.socialLinks, "social-link") }))}
            onChange={(items) => patchSection("footer", (section) => ({ ...section, socialLinks: items }))}
          />
        </SectionCard>
      ) : null}
    </section>
  );
}

