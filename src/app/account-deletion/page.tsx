import Link from "next/link";

export const metadata = {
  title: "Account Deletion | Mana Poster Ai",
  description: "Account deletion information for Mana Poster Ai users.",
};

export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Mana Poster Ai</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl">Account Deletion</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Users can request account deletion from within the Mana Poster Ai app profile section. If in-app access is not
          available, send a deletion request from your registered email address to{" "}
          <a className="font-semibold text-slate-900 underline" href="mailto:telugutouchgraphics@gmail.com">
            telugutouchgraphics@gmail.com
          </a>
          .
        </p>

        <section className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">What to include in the request</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
            <li>Registered email address or phone number</li>
            <li>Any active subscription context, if support is needed before deletion</li>
            <li>Confirmation that you want permanent account deletion</li>
          </ul>
        </section>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">What happens after deletion</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Account access is removed, profile data is scheduled for deletion, and remaining records may be retained
            only where required for fraud prevention, legal compliance, billing reconciliation, or security logs.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-slate-800" href="/privacy-policy">
            Privacy Policy
          </Link>
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-slate-800" href="/terms-and-conditions">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </main>
  );
}

