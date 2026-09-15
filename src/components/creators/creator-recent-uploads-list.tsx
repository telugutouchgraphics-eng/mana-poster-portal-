"use client";

import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import type { CreatorPoster } from "@/lib/types/creator-upload";

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClass(status: string): string {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-violet-200 bg-violet-50 text-violet-700";
}

function isVideoPoster(
  poster: Pick<CreatorPoster, "mediaType" | "videoUrl">,
): boolean {
  return poster.mediaType === "video" && Boolean(poster.videoUrl);
}

interface CreatorRecentUploadsListProps {
  reviewPosters: CreatorPoster[];
  selectedPosterIds: Set<string>;
  toggleAllVisiblePosters: () => void;
  togglePosterSelection: (poster: CreatorPoster) => void;
  canCreatorDeletePoster: (poster: CreatorPoster) => boolean;
  canCreatorEditPoster: (poster: CreatorPoster) => boolean;
  posterActionBusyMap: Record<string, boolean>;
  startEditPoster: (poster: CreatorPoster) => void;
  deletePoster: (poster: CreatorPoster) => void;
  deleteSelectedPosters: () => Promise<void>;
  loadDashboard: (refresh?: boolean) => Promise<void>;
  refreshing: boolean;
  uploadMessage: string | null;
  customizationCopy: {
    reviewTab: string;
    submittedPosters: string;
    refresh: string;
    refreshing: string;
    noSubmittedPosters: string;
    accepted: string;
    rejected: string;
    pending: string;
    reason: string;
    edit: string;
    delete: string;
    reupload: string;
  };
}

export function CreatorRecentUploadsList({
  reviewPosters,
  selectedPosterIds,
  toggleAllVisiblePosters,
  togglePosterSelection,
  canCreatorDeletePoster,
  canCreatorEditPoster,
  posterActionBusyMap,
  startEditPoster,
  deletePoster,
  deleteSelectedPosters,
  loadDashboard,
  refreshing,
  uploadMessage,
  customizationCopy,
}: CreatorRecentUploadsListProps) {
  return (
    <section className="space-y-6">
      <article className="px-1 py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--portal-purple)]">
              {customizationCopy.reviewTab}
            </p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">
              {customizationCopy.submittedPosters}
            </h3>
          </div>
          <button
            onClick={() => void loadDashboard(true)}
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
          >
            {refreshing
              ? customizationCopy.refreshing
              : customizationCopy.refresh}
          </button>
        </div>

        {uploadMessage ? (
          <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
            {uploadMessage}
          </p>
        ) : null}

        {reviewPosters.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={
                  reviewPosters.filter(canCreatorDeletePoster).length > 0 &&
                  reviewPosters
                    .filter(canCreatorDeletePoster)
                    .every((poster) => selectedPosterIds.has(poster.id))
                }
                onChange={toggleAllVisiblePosters}
                className="h-4 w-4 accent-rose-600"
              />
              Select visible
            </label>
            <span className="text-xs font-semibold text-slate-500">
              {selectedPosterIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => void deleteSelectedPosters()}
              disabled={selectedPosterIds.size === 0}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {reviewPosters.length === 0 ? (
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
              {customizationCopy.noSubmittedPosters}
            </div>
          ) : (
            reviewPosters.map((poster) => {
              const editable = canCreatorEditPoster(poster);
              const deletable = canCreatorDeletePoster(poster);
              const approved = poster.status === "approved";
              const busy = Boolean(posterActionBusyMap[poster.id]);
              return (
                <article
                  key={poster.id}
                  className="grid gap-4 rounded-[28px] border border-[var(--portal-border)] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)] md:grid-cols-[120px_minmax(0,1fr)]"
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={selectedPosterIds.has(poster.id)}
                      disabled={!deletable || busy}
                      onChange={() => togglePosterSelection(poster)}
                      className="h-4 w-4 accent-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    Select poster
                  </label>
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)]">
                    {isVideoPoster(poster) ? (
                      <video
                        src={poster.videoUrl}
                        className="h-full w-full bg-slate-950 object-cover"
                        controls
                        muted
                        playsInline
                      />
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={poster.imageUrl}
                          alt={poster.categoryLabel || poster.categoryId}
                          className="h-full w-full object-cover"
                        />
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-bold text-slate-950">
                          <CategoryLabelWithLogo
                            id={poster.categoryId}
                            label={
                              poster.categoryLabel || poster.categoryId
                            }
                          />
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(poster.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(poster.status)}`}
                      >
                        {poster.status === "approved"
                          ? customizationCopy.accepted
                          : poster.status === "rejected"
                            ? customizationCopy.rejected
                            : customizationCopy.pending}
                      </span>
                    </div>

                    {poster.reviewComment ? (
                      <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {customizationCopy.reason}: {poster.reviewComment}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-3">
                      {!approved ? (
                        <button
                          type="button"
                          onClick={() => startEditPoster(poster)}
                          disabled={!editable || busy}
                          className="rounded-xl border border-[var(--portal-purple)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-purple)] transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {customizationCopy.edit}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deletePoster(poster)}
                        disabled={!deletable || busy}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busy
                          ? customizationCopy.refreshing
                          : customizationCopy.delete}
                      </button>
                      {approved ? (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-[var(--portal-green)] px-4 py-2.5 text-sm font-semibold text-white opacity-50 disabled:cursor-not-allowed"
                        >
                          {customizationCopy.reupload}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}

