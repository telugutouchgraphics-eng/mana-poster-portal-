"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { RegionMultiSelectDropdown } from "@/components/regions/region-multi-select-dropdown";
import { portalLanguage, t } from "@/lib/i18n";

interface ManagerCreateResponse {
  ok: boolean;
  error?: string;
  managerUid?: string;
  managerPublicId?: string;
  email?: string;
  name?: string;
  loginLink?: string;
  setupLink?: string;
  recoveryResetLink?: string;
  initialPassword?: string;
}

export function ManagerCreateForm() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { regions, region } = useDashboardRegion();
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([region.id]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ManagerCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lang = portalLanguage(language);

  useEffect(() => {
    setSelectedRegionIds((prev) => {
      const allowed = new Set(regions.map((item) => item.id));
      const scoped = prev.filter((item) => allowed.has(item));
      return scoped.length > 0 ? scoped : [region.id];
    });
  }, [region.id, regions]);

  const copy = {
    loginRequired: t("manager.create.loginRequired", lang),
    creationFailed: t("manager.create.creationFailed", lang),
    title: t("manager.create.title", lang),
    help: t("manager.create.help", lang),
    name: t("manager.create.name", lang),
    email: t("manager.create.email", lang),
    phone: t("manager.create.phone", lang),
    creating: t("manager.create.creating", lang),
    create: t("manager.create.create", lang),
    ready: t("manager.create.ready", lang),
    managerId: t("manager.create.managerId", lang),
    loginEmail: t("manager.create.loginEmail", lang),
    loginLink: t("manager.create.loginLink", lang),
    setupLink: t("manager.create.setupLink", lang),
    initialPassword: t("manager.create.initialPassword", lang),
    loginSteps: t("manager.create.loginSteps", lang),
    recoveryLink: t("manager.create.recoveryLink", lang),
    recoveryHelp: t("manager.create.recoveryHelp", lang),
  };

  async function handleManagerCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error(copy.loginRequired);
      }
      const response = await fetch("/api/admin/managers/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: managerName.trim(),
          email: managerEmail.trim(),
          phone: managerPhone.trim(),
          regionIds: selectedRegionIds,
        }),
      });
      const data = (await response.json()) as ManagerCreateResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? copy.creationFailed);
      }
      setResult(data);
      setManagerName("");
      setManagerEmail("");
      setManagerPhone("");
      setSelectedRegionIds([region.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.creationFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-[var(--portal-border)] bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <h3 className="text-xl font-semibold text-slate-950">{copy.title}</h3>
      <p className="mt-2 text-sm text-slate-600">{copy.help}</p>
      <form onSubmit={handleManagerCreate} className="mt-6 grid gap-4 md:grid-cols-3">
        <input
          placeholder={copy.name}
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <div className="md:col-span-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Assign States / UTs
          </p>
          <div className="mt-3">
            <RegionMultiSelectDropdown
              regions={regions}
              selectedRegionIds={selectedRegionIds}
              onChange={setSelectedRegionIds}
            />
          </div>
        </div>
        <input
          placeholder={copy.email}
          type="email"
          value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <input
          placeholder={copy.phone}
          value={managerPhone}
          onChange={(e) => setManagerPhone(e.target.value)}
          required
          className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3.5 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
        />
        <button
          type="submit"
          disabled={busy}
          className="md:col-span-3 rounded-2xl bg-[var(--portal-purple)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)] disabled:opacity-60"
        >
          {busy ? copy.creating : copy.create}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {result?.ok && result.email ? (
        <div className="mt-4 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm shadow-sm">
          <p className="font-semibold text-emerald-900">
            {copy.ready}: {result.name}
          </p>
          <p className="mt-1 text-emerald-800">
            {copy.managerId}: {result.managerPublicId ?? "-"}
          </p>
          <p className="mt-1 text-emerald-800">
            {copy.loginEmail}: {result.email}
          </p>
          <p data-no-auto-translate="true" className="mt-1 break-all text-emerald-800">
            {copy.initialPassword}: {result.initialPassword ?? "-"}
          </p>
          <p className="mt-1 break-all text-emerald-800">
            {copy.loginLink}: {result.loginLink ?? "-"}
          </p>
          <p className="mt-2 text-xs text-emerald-800">{copy.loginSteps}</p>
          <p className="mt-2 break-all text-emerald-800">
            {copy.recoveryLink}: {result.recoveryResetLink ?? result.setupLink ?? "-"}
          </p>
          <p className="mt-1 text-xs text-emerald-700">{copy.recoveryHelp}</p>
        </div>
      ) : null}
    </section>
  );
}
