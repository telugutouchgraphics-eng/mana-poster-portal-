"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

interface InviteResponse {
  ok: boolean;
  error?: string;
  code?: string;
  creatorPublicId?: string;
  existingStatus?: string;
  existingName?: string;
  loginEmail?: string;
  loginLink?: string;
  initialPassword?: string;
  setupLink?: string;
  whatsappMessage?: string;
}

export function CreatorInviteForm({ actorLabel }: { actorLabel: string }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Login required.");
      }
      const response = await fetch("/api/manager/creators/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = (await response.json()) as InviteResponse;
      if (
        response.status === 409 &&
        data.code === "creator_access_exists_inactive" &&
        data.creatorPublicId
      ) {
        const shouldReactivate = window.confirm(
          data.error ??
            "Creator access already exists for this email or phone number. Do you want to reactivate it instead?",
        );
        if (!shouldReactivate) {
          return;
        }
        const reactivateResponse = await fetch(
          `/api/manager/creators/${encodeURIComponent(data.creatorPublicId)}/access-status`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: "active" }),
          },
        );
        const reactivateData = (await reactivateResponse.json()) as {
          ok: boolean;
          error?: string;
        };
        if (!reactivateResponse.ok || !reactivateData.ok) {
          throw new Error(reactivateData.error ?? "Unable to reactivate creator access.");
        }
        setResult({
          ok: true,
          creatorPublicId: data.creatorPublicId,
        });
        setError(null);
        setName("");
        setEmail("");
        setPhone("");
        return;
      }
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Invite generation failed.");
      }
      setResult(data);
      setName("");
      setEmail("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h3 className="text-xl font-semibold text-slate-950">Grant Creator Access</h3>
      <p className="mt-2 text-sm text-slate-600">
        {actorLabel} can grant access with the creator&apos;s normal email, phone, and system-generated
        creator@ password; login uses the same email plus OTP.
      </p>

      <form onSubmit={handleInvite} className="mt-6 grid gap-4 md:grid-cols-3">
        <input
          placeholder="Creator name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="md:col-span-3 rounded-2xl bg-[var(--portal-green)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)] disabled:opacity-60"
        >
          {busy ? "Creating creator..." : "Create Creator Access"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result?.ok && result.creatorPublicId ? (
        <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm shadow-sm">
          <p className="font-semibold text-emerald-900">
            Creator created: {result.creatorPublicId}
          </p>
          {result.loginLink ? (
            <>
              <p className="mt-2 text-emerald-800">
                Login email (type this on the login page):{" "}
                <span data-no-auto-translate="true" className="font-medium">
                  {result.loginEmail ?? "-"}
                </span>
              </p>
              <p data-no-auto-translate="true" className="mt-2 break-all text-emerald-800">
                System password (copy exactly): {result.initialPassword}
              </p>
              <p className="mt-2 break-all text-emerald-800">Login URL: {result.loginLink}</p>
              <p className="mt-2 break-all text-emerald-800 text-xs">
                Optional password-change / setup link: {result.setupLink}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-emerald-800">
                WhatsApp message:
                {"\n"}
                {result.whatsappMessage}
              </p>
            </>
          ) : (
            <p className="mt-2 text-emerald-800">
              Existing creator access was reactivated successfully.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
