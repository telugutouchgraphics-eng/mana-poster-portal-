import Link from "next/link";
import {
  LEGAL_LAST_UPDATED,
  SUPPORT_EMAIL,
  termsSections,
} from "@/lib/legal/public-legal-content";

export const metadata = {
  title: "Terms & Conditions | Mana Poster Ai",
  description: "Terms and conditions for Mana Poster Ai app and web portal.",
};

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Mana Poster Ai</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">Terms & Conditions</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Last updated: {LEGAL_LAST_UPDATED}. These terms apply to the Mana Poster Ai mobile app and the Mana Poster Ai web
          portal.
        </p>

        <div className="mt-8 space-y-6">
          {termsSections.map((section) => (
            <section key={section.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Support</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            For billing, cancellation, refund clarification, or platform questions, contact{" "}
            <a className="font-semibold text-slate-900 underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <Link className="rounded-full border border-slate-300 px-4 py-2 text-slate-800" href="/privacy-policy">
              Privacy Policy
            </Link>
            <Link className="rounded-full border border-slate-300 px-4 py-2 text-slate-800" href="/account-deletion">
              Account Deletion
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

