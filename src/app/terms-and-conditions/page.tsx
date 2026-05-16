import Link from "next/link";

const sections = [
  {
    title: "Subscriptions",
    body:
      "Certain app features require an active subscription. Trial and paid plans, if offered, renew automatically unless cancelled through the Google Play subscription management screen before the renewal date.",
  },
  {
    title: "Refunds and Cancellation",
    body:
      "Refund eligibility is subject to Google Play policies and applicable law. Users may cancel future renewals at any time from their Google Play account. Cancellation stops the next renewal cycle and does not retroactively void already-used service periods unless Google approves a refund.",
  },
  {
    title: "Account Access",
    body:
      "Mana Poster Ai role-based accounts are assigned to a single user identity, but the same account may be used across multiple devices and systems unless access is disabled by admin controls or policy enforcement.",
  },
  {
    title: "Content and Usage",
    body:
      "Users must not misuse the app, web portal, payment systems, or uploaded content. We may suspend access where fraud, abuse, policy violations, or illegal usage is detected.",
  },
];

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
          Effective date: April 15, 2026. These terms apply to the Mana Poster Ai mobile app and the Mana Poster Ai web
          portal.
        </p>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
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
            <a className="font-semibold text-slate-900 underline" href="mailto:telugutouchgraphics@gmail.com">
              telugutouchgraphics@gmail.com
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

