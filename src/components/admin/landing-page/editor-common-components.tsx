"use client";

import { useState, type ReactNode } from "react";
import type {
  LandingCategoryItem,
  LandingFaqItem,
  LandingFeatureItem,
  LandingImageItem,
  LandingLinkItem,
  LandingSimpleItem,
  LandingTestimonialItem,
} from "@/lib/types/landing-page";

export interface WebsitePosterItem {
  id: string;
  category: string;
  imageUrl: string;
  imagePath?: string;
  active: boolean;
  sortOrder: number;
}

export const baseInputClass =
  "w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[var(--portal-border-strong)]";
export const MAX_IMAGE_UPLOAD_BYTES = 500 * 1024;
export const MAX_IMAGE_UPLOAD_LABEL = "500 KB";

export function SectionToggleRow({
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

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="text-sm font-semibold text-slate-700">{children}</label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={`${baseInputClass} ${props.className ?? ""}`}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`min-h-28 ${baseInputClass} ${props.className ?? ""}`}
    />
  );
}

export function PillButton({
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

export function ItemToolbar({
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

export function AssetPreview({
  label,
  imageUrl,
}: {
  label: string;
  imageUrl: string;
}) {
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

export function AssetField({
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
      {uploading ? (
        <p className="text-xs text-slate-500">Uploading...</p>
      ) : null}
    </div>
  );
}

export function SectionCard({
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
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
        {description}
      </p>
      <div className="mt-6 space-y-6">{children}</div>
    </article>
  );
}

export function Subsection({
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
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SectionTextFields({
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
        <TextInput
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>Subtitle</FieldLabel>
        <TextInput
          value={subtitle}
          onChange={(e) => onSubtitleChange(e.target.value)}
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>Description</FieldLabel>
        <TextArea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function moveItem<T extends { sortOrder: number }>(
  items: T[],
  index: number,
  direction: -1 | 1,
) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const clone = [...items];
  const [picked] = clone.splice(index, 1);
  clone.splice(target, 0, picked);
  return clone.map((item, itemIndex) => ({
    ...item,
    sortOrder: (itemIndex + 1) * 10,
  }));
}

export function updateArrayItem<T extends { id: string }>(
  items: T[],
  id: string,
  patchValue: Partial<T>,
) {
  return items.map((item) =>
    item.id === id ? { ...item, ...patchValue } : item,
  );
}

export function removeArrayItem<T extends { id: string; sortOrder: number }>(
  items: T[],
  id: string,
) {
  return items
    .filter((item) => item.id !== id)
    .map((item, index) => ({ ...item, sortOrder: (index + 1) * 10 }));
}

export function LinkItemGroup({
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
          <div
            key={item.id}
            className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                value={item.label}
                placeholder="Label"
                onChange={(e) =>
                  onChange(
                    updateArrayItem(items, item.id, { label: e.target.value }),
                  )
                }
              />
              <TextInput
                value={item.href}
                placeholder="Link"
                onChange={(e) =>
                  onChange(
                    updateArrayItem(items, item.id, { href: e.target.value }),
                  )
                }
              />
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function ImageItemGroup({
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
          <div
            key={item.id}
            className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <AssetField
                label={item.title || "Image asset"}
                imageUrl={item.imageUrl}
                uploading={uploadingKey === `${uploadPrefix}:${item.id}`}
                onUpload={(file) =>
                  onUpload(
                    item.id,
                    file,
                    item.imagePath,
                    ({ imageUrl, imagePath }) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          imageUrl,
                          imagePath,
                        }),
                      ),
                  )
                }
                onDelete={() =>
                  onChange(
                    updateArrayItem(items, item.id, {
                      imageUrl: "",
                      imagePath: "",
                    }),
                  )
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Title</FieldLabel>
                  <TextInput
                    value={item.title}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          title: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Subtitle</FieldLabel>
                  <TextInput
                    value={item.subtitle}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          subtitle: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextArea
                    value={item.description}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          description: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button text</FieldLabel>
                  <TextInput
                    value={item.buttonText}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          buttonText: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button link</FieldLabel>
                  <TextInput
                    value={item.buttonLink}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          buttonLink: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function FeatureItemGroup({
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
          <div
            key={item.id}
            className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Icon</FieldLabel>
                <TextInput
                  value={item.icon}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, { icon: e.target.value }),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={item.title}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        title: e.target.value,
                      }),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Subtitle</FieldLabel>
                <TextInput
                  value={item.subtitle}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        subtitle: e.target.value,
                      }),
                    )
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={item.description}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        description: e.target.value,
                      }),
                    )
                  }
                />
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function CategoryItemGroup({
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
          <div
            key={item.id}
            className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <AssetField
                label={item.title || "Category image"}
                imageUrl={item.imageUrl}
                uploading={uploadingKey === `categories:${item.id}`}
                onUpload={(file) =>
                  onUpload(
                    item.id,
                    file,
                    item.imagePath,
                    ({ imageUrl, imagePath }) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          imageUrl,
                          imagePath,
                        }),
                      ),
                  )
                }
                onDelete={() =>
                  onChange(
                    updateArrayItem(items, item.id, {
                      imageUrl: "",
                      imagePath: "",
                    }),
                  )
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Emoji</FieldLabel>
                  <TextInput
                    value={item.emoji}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          emoji: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Title</FieldLabel>
                  <TextInput
                    value={item.title}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          title: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Subtitle</FieldLabel>
                  <TextInput
                    value={item.subtitle}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          subtitle: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <TextArea
                    value={item.description}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          description: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button text</FieldLabel>
                  <TextInput
                    value={item.buttonText}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          buttonText: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Button link</FieldLabel>
                  <TextInput
                    value={item.buttonLink}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          buttonLink: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function SimpleItemGroup({
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
          <div
            key={item.id}
            className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-4">
              <div className="space-y-2">
                <FieldLabel>Title</FieldLabel>
                <TextInput
                  value={item.title}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        title: e.target.value,
                      }),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Description</FieldLabel>
                <TextArea
                  value={item.description}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        description: e.target.value,
                      }),
                    )
                  }
                />
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function FaqGroup({
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
          <div
            key={item.id}
            className="space-y-3 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="space-y-2">
              <FieldLabel>Question</FieldLabel>
              <TextInput
                value={item.question}
                onChange={(e) =>
                  onChange(
                    updateArrayItem(items, item.id, {
                      question: e.target.value,
                    }),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Answer</FieldLabel>
              <TextArea
                value={item.answer}
                onChange={(e) =>
                  onChange(
                    updateArrayItem(items, item.id, { answer: e.target.value }),
                  )
                }
              />
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function TestimonialGroup({
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
          <div
            key={item.id}
            className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
          >
            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <AssetField
                label={item.name || "Avatar"}
                imageUrl={item.avatarUrl}
                uploadLabel="Upload avatar"
                uploading={uploadingKey === `testimonials:${item.id}`}
                onUpload={(file) =>
                  onUpload(
                    item.id,
                    file,
                    item.avatarPath,
                    ({ imageUrl, imagePath }) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          avatarUrl: imageUrl,
                          avatarPath: imagePath,
                        }),
                      ),
                  )
                }
                onDelete={() =>
                  onChange(
                    updateArrayItem(items, item.id, {
                      avatarUrl: "",
                      avatarPath: "",
                    }),
                  )
                }
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Name</FieldLabel>
                  <TextInput
                    value={item.name}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          name: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Role</FieldLabel>
                  <TextInput
                    value={item.role}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          role: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Review</FieldLabel>
                  <TextArea
                    value={item.review}
                    onChange={(e) =>
                      onChange(
                        updateArrayItem(items, item.id, {
                          review: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </div>
            <ItemToolbar
              visible={item.visible}
              published={item.published}
              onVisibleChange={(value) =>
                onChange(updateArrayItem(items, item.id, { visible: value }))
              }
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

export function WebsitePosterManager({
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
  const [pendingFiles, setPendingFiles] = useState<
    Record<string, File | null>
  >({});
  const [savingPosterId, setSavingPosterId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--portal-surface-soft)] p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-2">
            <FieldLabel>Category</FieldLabel>
            <TextInput
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
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
                  await onCreate(
                    newCategory.trim(),
                    (items.length + 1) * 10,
                    file,
                  );
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
        <div
          key={item.id}
          className="space-y-4 rounded-2xl bg-[var(--portal-surface-soft)] p-4"
        >
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
                    setPendingFiles((current) => ({
                      ...current,
                      [item.id]: file,
                    }));
                    e.target.value = "";
                  }}
                />
              </label>
              {pendingFiles[item.id] ? (
                <p className="text-xs text-slate-500">
                  {pendingFiles[item.id]?.name}
                </p>
              ) : null}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Category</FieldLabel>
                <TextInput
                  value={item.category}
                  onChange={(e) =>
                    onChange(
                      updateArrayItem(items, item.id, {
                        category: e.target.value,
                      }),
                    )
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
                onChange={(e) =>
                  onChange(
                    updateArrayItem(items, item.id, {
                      active: e.target.checked,
                    }),
                  )
                }
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
                  setPendingFiles((current) => ({
                    ...current,
                    [item.id]: null,
                  }));
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

