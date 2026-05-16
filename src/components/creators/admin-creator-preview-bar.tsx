"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * Lets admins load a real creator workspace by appending `?asCreator=<creatorPublicId>`.
 */
export function AdminCreatorPreviewBar() {
  const { roles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("asCreator")?.trim() ?? "";
  const [draft, setDraft] = useState(current);

  useEffect(() => {
    setDraft(current);
  }, [current]);

  if (!roles.includes("admin")) {
    return null;
  }

  function apply(event?: FormEvent) {
    event?.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    const value = draft.trim();
    if (value) {
      next.set("asCreator", value);
    } else {
      next.delete("asCreator");
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
      <p className="font-semibold text-amber-900">Admin: preview creator dashboard</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
        Enter a creator&apos;s public ID (from Firestore <code className="rounded bg-white/60 px-1">creatorProfiles</code>)
        to load their real categories, uploads, and stats. Leave empty to clear.
      </p>
      <form onSubmit={apply} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="creatorPublicId"
          className="min-w-0 flex-1 rounded-xl border border-amber-300/80 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Apply
        </button>
      </form>
      {current ? (
        <p className="mt-2 text-xs font-medium text-amber-900">
          Active: <span className="break-all">{current}</span>
        </p>
      ) : null}
    </div>
  );
}
