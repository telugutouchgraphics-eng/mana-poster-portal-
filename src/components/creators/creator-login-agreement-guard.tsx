"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { languageCodeFor } from "@/lib/i18n/dashboard-languages";
import {
  CREATOR_BANK_AGREEMENT_SECTIONS,
  CREATOR_BANK_AGREEMENT_TITLE,
  CREATOR_BANK_AGREEMENT_VERSION,
} from "@/lib/legal/creator-bank-agreement";

interface AgreementContentState {
  title: string;
  badge: string;
  close: string;
  introNote: string;
  skipButton: string;
  acceptButton: string;
  sections: Array<{
    title: string;
    points: string[];
  }>;
}

const agreementCache = new Map<string, AgreementContentState>();

function sessionKey(uid: string) {
  return `creator-login-agreement-skip:${uid}:${CREATOR_BANK_AGREEMENT_VERSION}`;
}

export function CreatorLoginAgreementGuard() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState<AgreementContentState | null>(null);

  const buildEnglishContent = useCallback((): AgreementContentState => ({
    title: CREATOR_BANK_AGREEMENT_TITLE,
    badge: "Creator Declaration",
    close: "Close",
    introNote:
      "Before using the creator dashboard, please read this declaration. You may skip for now, but until you accept it, this declaration will appear again every time you log in.",
    skipButton: "Skip for Now",
    acceptButton: "Accept Declaration",
    sections: CREATOR_BANK_AGREEMENT_SECTIONS.map((section) => ({
      title: section.title,
      points: [...section.points],
    })),
  }), []);

  const loadContent = useCallback(async () => {
    if (agreementCache.has(language)) {
      setContent(agreementCache.get(language)!);
      return;
    }
    const english = buildEnglishContent();
    if (language === "english") {
      agreementCache.set(language, english);
      setContent(english);
      return;
    }
    const flat = [
      english.badge,
      english.title,
      english.close,
      english.introNote,
      english.skipButton,
      english.acceptButton,
      ...english.sections.flatMap((section) => [section.title, ...section.points]),
    ];
    const response = await fetch("/api/i18n/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetLanguage: languageCodeFor(language),
        texts: flat,
      }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      translations?: string[];
      error?: string;
    };
    if (!response.ok || !data.ok || !data.translations) {
      throw new Error(data.error ?? "Unable to load declaration.");
    }
    const translated = data.translations;
    let cursor = 6;
    const sections = english.sections.map((section) => {
      const title = translated[cursor++] ?? section.title;
      const points = section.points.map((point) => translated[cursor++] ?? point);
      return { title, points };
    });
    const localized: AgreementContentState = {
      badge: translated[0] ?? english.badge,
      title: translated[1] ?? english.title,
      close: translated[2] ?? english.close,
      introNote: translated[3] ?? english.introNote,
      skipButton: translated[4] ?? english.skipButton,
      acceptButton: translated[5] ?? english.acceptButton,
      sections,
    };
    agreementCache.set(language, localized);
    setContent(localized);
  }, [buildEnglishContent, language]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let cancelled = false;
    async function run() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/creator/login-agreement", {
          headers: withDeviceHeader({ authorization: `Bearer ${token}` }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          accepted?: boolean;
          error?: string;
        };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to check declaration.");
        }
        const skipped = window.sessionStorage.getItem(sessionKey(currentUser.uid)) === "1";
        if (!cancelled) {
          setVisible(!data.accepted && !skipped);
        }
      } catch {
        if (!cancelled) {
          setVisible(false);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!visible) return;
    void loadContent().catch(() => {});
  }, [visible, loadContent]);

  const agreement = useMemo(() => content ?? buildEnglishContent(), [content, buildEnglishContent]);

  async function acceptAgreement() {
    if (!user) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/creator/login-agreement", {
        method: "POST",
        headers: withDeviceHeader({
          authorization: `Bearer ${token}`,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to accept declaration.");
      }
      window.sessionStorage.removeItem(sessionKey(user.uid));
      setVisible(false);
    } finally {
      setBusy(false);
    }
  }

  function skipAgreement() {
    if (!user) return;
    window.sessionStorage.setItem(sessionKey(user.uid), "1");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4" data-no-auto-translate="true">
      <div className="mx-auto my-2 max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.3)] sm:my-4 sm:max-h-[92vh] sm:rounded-[32px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
              {agreement.badge}
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">{agreement.title}</h3>
          </div>
          <button
            onClick={skipAgreement}
            className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            {agreement.close}
          </button>
        </div>

        <div className="grid min-h-0 gap-0 overflow-visible lg:h-[calc(92vh-88px)] lg:grid-cols-[1.2fr_0.8fr] lg:overflow-hidden">
          <div className="min-h-0 overflow-y-auto border-b border-slate-200 px-4 py-5 sm:px-6 lg:border-r lg:border-b-0">
            <p className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 inline-flex">
              Version {CREATOR_BANK_AGREEMENT_VERSION}
            </p>
            <div className="mt-4 space-y-5">
              {agreement.sections.map((section) => (
                <section key={section.title}>
                  <h4 className="text-base font-semibold text-slate-950">{section.title}</h4>
                  <ol className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                    {section.points.map((point, index) => (
                      <li key={`${section.title}-${index}`}>{index + 1}. {point}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col justify-between gap-4 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4 text-sm leading-7 text-slate-700">
              {agreement.introNote}
            </div>
            <div className="grid gap-3">
              <button
                onClick={skipAgreement}
                className="w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                {agreement.skipButton}
              </button>
              <button
                onClick={() => void acceptAgreement()}
                disabled={busy}
                className="w-full rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? agreement.acceptButton : agreement.acceptButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
