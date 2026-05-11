"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { withDeviceHeader } from "@/lib/client/device-id";
import { withCreatorImpersonationQuery } from "@/lib/client/creator-impersonation-query";
import { languageCodeFor } from "@/lib/i18n/dashboard-languages";
import {
  CREATOR_BANK_AGREEMENT_TITLE,
  CREATOR_BANK_AGREEMENT_SECTIONS,
  CREATOR_BANK_AGREEMENT_VERSION,
} from "@/lib/legal/creator-bank-agreement";

interface ApprovedPosterRow {
  id: string;
  title: string;
  categoryLabel: string;
  approvedAt: number;
  createdAt: number;
  rewardAmount: number;
}

interface PayoutProfileSummary {
  status: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  accountNumberMasked: string;
  reviewComment: string;
  signatureName: string;
  submittedAt: number;
  reviewedAt: number;
}

interface EarningsPayload {
  ok: boolean;
  error?: string;
  earnings?: {
    rewardPerApprovedPoster: number;
    approvedPosterCount: number;
    totalApprovedReward: number;
    paidOut: number;
    readyForPayout: number;
    onHoldAmount: number;
    pendingBalance: number;
  };
  payoutProfile?: PayoutProfileSummary | null;
  approvedPosters?: ApprovedPosterRow[];
  payoutHistory?: Array<{
    id: string;
    amount: number;
    status: string;
    note: string;
    createdAt: number;
    settledAt: number;
  }>;
}

interface PayoutFormState {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  signatureName: string;
}

interface AgreementContentState {
  title: string;
  badge: string;
  close: string;
  introNote: string;
  checkboxLabel: string;
  continueButton: string;
  accountHolderLabel: string;
  bankNameLabel: string;
  branchNameLabel: string;
  accountNumberLabel: string;
  confirmAccountNumberLabel: string;
  ifscCodeLabel: string;
  digitalSignatureLabel: string;
  digitalSignaturePlaceholder: string;
  submitButton: string;
  savingButton: string;
  signatureInfo: string;
  sections: Array<{
    title: string;
    points: string[];
  }>;
}

const initialForm: PayoutFormState = {
  accountHolderName: "",
  bankName: "",
  branchName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  signatureName: "",
};

const agreementCache = new Map<string, AgreementContentState>();

function formatDate(epochMs?: number) {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusTone(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "changes_requested") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved_for_payout") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "on_hold") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

export function CreatorEarningsConsole() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { language } = useDashboardLanguage();
  const [payload, setPayload] = useState<EarningsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PayoutFormState>(initialForm);
  const [agreementContent, setAgreementContent] = useState<AgreementContentState | null>(null);

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) {
      throw new Error("Login required.");
    }
    return withDeviceHeader({ authorization: `Bearer ${token}` });
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        withCreatorImpersonationQuery("/api/creator/earnings", searchParams),
        { headers },
      );
      const data = (await response.json()) as EarningsPayload;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to load earnings.");
      }
      setPayload(data);
      const payoutProfile = data.payoutProfile ?? null;
      if (payoutProfile && payoutProfile.signatureName) {
        setForm((prev) => ({
          ...prev,
          accountHolderName: payoutProfile.accountHolderName,
          bankName: payoutProfile.bankName,
          branchName: payoutProfile.branchName,
          ifscCode: payoutProfile.ifscCode,
          signatureName: payoutProfile.signatureName,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load earnings.");
    } finally {
      setLoading(false);
    }
  }, [authHeader, searchParams]);

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadData();
  }, [user, loadData]);

  const earnings = payload?.earnings;
  const payoutProfile = payload?.payoutProfile ?? null;
  const approvedPosters = useMemo(() => payload?.approvedPosters ?? [], [payload]);
  const payoutHistory = useMemo(() => payload?.payoutHistory ?? [], [payload]);

  const buildEnglishAgreement = useCallback((): AgreementContentState => {
    return {
      title: CREATOR_BANK_AGREEMENT_TITLE,
      badge: "Legal Agreement",
      close: "Close",
      introNote:
        "After accepting this declaration, you can submit bank account details. Your typed full name will be stored as a digital signature along with the accepted legal version.",
      checkboxLabel:
        "I have read and understood all legal conditions, content restrictions, payout verification rules, compliance duties and admin review rights, and I agree to them.",
      continueButton: "I Agree and Continue",
      accountHolderLabel: "Account Holder Name",
      bankNameLabel: "Bank Name",
      branchNameLabel: "Branch Name",
      accountNumberLabel: "Account Number",
      confirmAccountNumberLabel: "Confirm Account Number",
      ifscCodeLabel: "IFSC Code",
      digitalSignatureLabel: "Digital Signature",
      digitalSignaturePlaceholder: "Type your full legal name as signature",
      submitButton: "Submit Bank Details",
      savingButton: "Submitting...",
      signatureInfo:
        "The accepted declaration version, timestamp and your digital signature will be stored and shown for admin review and audit.",
      sections: CREATOR_BANK_AGREEMENT_SECTIONS.map((section) => ({
        title: section.title,
        points: [...section.points],
      })),
    };
  }, []);

  const loadAgreementContent = useCallback(async () => {
    const cacheKey = language;
    if (agreementCache.has(cacheKey)) {
      setAgreementContent(agreementCache.get(cacheKey)!);
      return;
    }

    const english = buildEnglishAgreement();
    if (language === "english") {
      agreementCache.set(cacheKey, english);
      setAgreementContent(english);
      return;
    }

    const flatTexts = [
      english.badge,
      english.title,
      english.close,
      english.introNote,
      english.checkboxLabel,
      english.continueButton,
      english.accountHolderLabel,
      english.bankNameLabel,
      english.branchNameLabel,
      english.accountNumberLabel,
      english.confirmAccountNumberLabel,
      english.ifscCodeLabel,
      english.digitalSignatureLabel,
      english.digitalSignaturePlaceholder,
      english.submitButton,
      english.savingButton,
      english.signatureInfo,
      ...english.sections.flatMap((section) => [section.title, ...section.points]),
    ];

    const response = await fetch("/api/i18n/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetLanguage: languageCodeFor(language),
        texts: flatTexts,
      }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      translations?: string[];
      error?: string;
    };
    if (!response.ok || !data.ok || !data.translations) {
      throw new Error(data.error ?? "Unable to load legal agreement translation.");
    }

    const translated = data.translations;
    const fixedCount = 17;
    let cursor = fixedCount;
    const translatedSections = english.sections.map((section) => {
      const title = translated[cursor++] ?? section.title;
      const points = section.points.map((point) => translated[cursor++] ?? point);
      return { title, points };
    });

    const localized: AgreementContentState = {
      badge: translated[0] ?? english.badge,
      title: translated[1] ?? english.title,
      close: translated[2] ?? english.close,
      introNote: translated[3] ?? english.introNote,
      checkboxLabel: translated[4] ?? english.checkboxLabel,
      continueButton: translated[5] ?? english.continueButton,
      accountHolderLabel: translated[6] ?? english.accountHolderLabel,
      bankNameLabel: translated[7] ?? english.bankNameLabel,
      branchNameLabel: translated[8] ?? english.branchNameLabel,
      accountNumberLabel: translated[9] ?? english.accountNumberLabel,
      confirmAccountNumberLabel:
        translated[10] ?? english.confirmAccountNumberLabel,
      ifscCodeLabel: translated[11] ?? english.ifscCodeLabel,
      digitalSignatureLabel:
        translated[12] ?? english.digitalSignatureLabel,
      digitalSignaturePlaceholder:
        translated[13] ?? english.digitalSignaturePlaceholder,
      submitButton: translated[14] ?? english.submitButton,
      savingButton: translated[15] ?? english.savingButton,
      signatureInfo: translated[16] ?? english.signatureInfo,
      sections: translatedSections,
    };

    agreementCache.set(cacheKey, localized);
    setAgreementContent(localized);
  }, [buildEnglishAgreement, language]);

  useEffect(() => {
    if (!agreementOpen) {
      return;
    }
    void loadAgreementContent().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load legal agreement.");
    });
  }, [agreementOpen, loadAgreementContent]);

  async function submitPayoutProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const headers = await authHeader();
      const response = await fetch("/api/creator/payout-profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          ...form,
          ifscCode: form.ifscCode.toUpperCase(),
          agreed,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save payout profile.");
      }
      setMessage("Bank details sent for admin review.");
      setAgreementOpen(false);
      setShowForm(false);
      setAgreed(false);
      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save payout profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <article className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Reward
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              Rs.{earnings?.rewardPerApprovedPoster ?? 10}
            </p>
            <p className="mt-1 text-sm text-slate-600">Per manager-approved poster</p>
          </article>
          <article className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Approved
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {earnings?.approvedPosterCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-600">Reward eligible posters</p>
          </article>
          <article className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Total Earnings
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              Rs.{earnings?.totalApprovedReward ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-600">Approved poster rewards</p>
          </article>
          <article className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pending Balance
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              Rs.{earnings?.pendingBalance ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-600">Paid out: Rs.{earnings?.paidOut ?? 0}</p>
          </article>
          <article className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Payout Queue
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              Rs.{earnings?.readyForPayout ?? 0}
            </p>
            <p className="mt-1 text-sm text-slate-600">On hold: Rs.{earnings?.onHoldAmount ?? 0}</p>
          </article>
        </div>

        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                  Earnings Tab
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Bank Account Details</h2>
              </div>
              {payoutProfile ? (
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(payoutProfile.status)}`}>
                  {payoutProfile.status.replaceAll("_", " ")}
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-6 text-sm text-slate-600">
                Loading earnings...
              </div>
            ) : payoutProfile ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4 text-sm text-slate-700">
                  <p>Account holder: {payoutProfile.accountHolderName}</p>
                  <p>Bank: {payoutProfile.bankName}</p>
                  <p>Branch: {payoutProfile.branchName}</p>
                  <p>IFSC: {payoutProfile.ifscCode}</p>
                  <p>Account: {payoutProfile.accountNumberMasked}</p>
                  <p>Signature: {payoutProfile.signatureName}</p>
                  <p>Submitted: {formatDate(payoutProfile.submittedAt)}</p>
                  {payoutProfile.reviewedAt ? <p>Reviewed: {formatDate(payoutProfile.reviewedAt)}</p> : null}
                </div>
                {payoutProfile.reviewComment ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Admin note: {payoutProfile.reviewComment}
                  </div>
                ) : null}
                <button
                  onClick={() => {
                    setAgreementOpen(true);
                    setShowForm(Boolean(payoutProfile.status === "changes_requested" || payoutProfile.status === "rejected"));
                    setAgreed(false);
                  }}
                  className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  {payoutProfile.status === "approved" ? "View Agreement Again" : "Update Bank Details"}
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-5 text-sm text-slate-600">
                  Submitted bank details will appear in the admin review queue.
                </div>
                <button
                  onClick={() => {
                    setAgreementOpen(true);
                    setShowForm(false);
                    setAgreed(false);
                  }}
                  className="rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white"
                >
                  Upload Bank Details
                </button>
              </div>
            )}
          </article>

          <div className="space-y-6">
            <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                  Earnings Ledger
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Approved Poster Rewards</h2>
              </div>
              <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--portal-surface-soft)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Poster</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Approved On</th>
                      <th className="px-4 py-3 text-right">Reward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedPosters.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No approved reward posters yet.
                        </td>
                      </tr>
                    ) : (
                      approvedPosters.map((poster) => (
                        <tr key={poster.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-900">{poster.title}</td>
                          <td className="px-4 py-3 text-slate-600">{poster.categoryLabel || "-"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(poster.approvedAt || poster.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            Rs.{poster.rewardAmount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                  Payout Audit
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Payout Status History</h2>
              </div>
              <div className="mt-5 overflow-x-auto rounded-[24px] border border-[var(--portal-border)]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--portal-surface-soft)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Updated</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          No payout history yet.
                        </td>
                      </tr>
                    ) : (
                      payoutHistory.map((item) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                              {item.status.replaceAll("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">Rs.{item.amount}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(item.settledAt || item.createdAt)}</td>
                          <td className="px-4 py-3 text-slate-600">{item.note || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      </section>

      {agreementOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4" data-no-auto-translate="true">
          <div className="mx-auto my-2 max-w-5xl overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.3)] sm:my-4 sm:max-h-[92vh] sm:rounded-[32px]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--portal-purple)]">
                  {agreementContent?.badge ?? "Legal Agreement"}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  {agreementContent?.title ?? CREATOR_BANK_AGREEMENT_TITLE}
                </h3>
              </div>
              <button
                onClick={() => {
                  setAgreementOpen(false);
                  setShowForm(false);
                  setAgreed(false);
                }}
                className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {agreementContent?.close ?? "Close"}
              </button>
            </div>

            <div className="grid min-h-0 gap-0 overflow-visible lg:h-[calc(92vh-88px)] lg:grid-cols-[1.15fr_0.85fr] lg:overflow-hidden">
              <div className="min-h-0 overflow-y-auto border-b border-slate-200 px-4 py-5 sm:px-6 lg:border-r lg:border-b-0">
                <p className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 inline-flex">
                  Version {CREATOR_BANK_AGREEMENT_VERSION}
                </p>
                <div className="mt-4 space-y-5">
                  {(agreementContent?.sections ?? CREATOR_BANK_AGREEMENT_SECTIONS).map((section) => (
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

              <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
                {!showForm ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4 text-sm text-slate-700">
                      {agreementContent?.introNote ??
                        "After accepting this declaration, you can submit bank account details."}
                    </div>
                    <label className="flex items-start gap-3 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(event) => setAgreed(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        {agreementContent?.checkboxLabel ??
                          "I have read all legal conditions and agree to them."}
                      </span>
                    </label>
                    <button
                      onClick={() => setShowForm(true)}
                      disabled={!agreed}
                      className="w-full rounded-2xl bg-[var(--portal-purple)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {agreementContent?.continueButton ?? "I Agree and Continue"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submitPayoutProfile} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.accountHolderLabel ?? "Account Holder Name"}
                      </label>
                      <input
                        value={form.accountHolderName}
                        onChange={(event) => setForm((prev) => ({ ...prev, accountHolderName: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.bankNameLabel ?? "Bank Name"}
                      </label>
                      <input
                        value={form.bankName}
                        onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.branchNameLabel ?? "Branch Name"}
                      </label>
                      <input
                        value={form.branchName}
                        onChange={(event) => setForm((prev) => ({ ...prev, branchName: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.accountNumberLabel ?? "Account Number"}
                      </label>
                      <input
                        value={form.accountNumber}
                        onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value.replace(/[^0-9]/g, "") }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.confirmAccountNumberLabel ?? "Confirm Account Number"}
                      </label>
                      <input
                        value={form.confirmAccountNumber}
                        onChange={(event) => setForm((prev) => ({ ...prev, confirmAccountNumber: event.target.value.replace(/[^0-9]/g, "") }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.ifscCodeLabel ?? "IFSC Code"}
                      </label>
                      <input
                        value={form.ifscCode}
                        onChange={(event) => setForm((prev) => ({ ...prev, ifscCode: event.target.value.toUpperCase() }))}
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm uppercase outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {agreementContent?.digitalSignatureLabel ?? "Digital Signature"}
                      </label>
                      <input
                        value={form.signatureName}
                        onChange={(event) => setForm((prev) => ({ ...prev, signatureName: event.target.value }))}
                        placeholder={
                          agreementContent?.digitalSignaturePlaceholder ??
                          "Type your full legal name as signature"
                        }
                        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                      {agreementContent?.signatureInfo ??
                        "Accepted declaration version and digital signature will be stored for admin review."}
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full rounded-2xl bg-[var(--portal-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving
                        ? agreementContent?.savingButton ?? "Submitting..."
                        : agreementContent?.submitButton ?? "Submit Bank Details"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
