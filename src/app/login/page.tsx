"use client";

import Image from "next/image";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import { getClientAuth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import { getOrCreateDeviceId, withDeviceHeader } from "@/lib/client/device-id";

const BRAND_TAGLINE = "Your Daily Telugu Poster App";

type LoginCopy = {
  dashboardLogin: string;
  simpleLogin: (roleLabel: string) => string;
  loginHelp: string;
  twoStepTitle: string;
  twoStepBody: string;
  sessionTitle: string;
  sessionBody: string;
  signIn: string;
  continueToDashboard: string;
  signInHelp: string;
  firebaseConfigMissing: string;
  emailLoginId: string;
  emailPlaceholder: string;
  password: string;
  hidePassword: string;
  showPassword: string;
  sendingOtp: string;
  sendOtp: string;
  pleaseWait: string;
  forgotPassword: string;
  enterOtp: string;
  enterOtpHelp: string;
  emailOtp: string;
  otpPlaceholder: string;
  verifying: string;
  verifyOtpAndLogin: string;
  change: string;
  resetPassword: string;
  resetPasswordHelp: string;
  resetOtp: string;
  newPassword: string;
  newPasswordPlaceholder: string;
  resetting: string;
  resetPasswordAction: string;
  cancel: string;
  loading: string;
  roleBased: string;
  infoOtpSent: (maskedEmail: string) => string;
  infoResetOtpSent: (maskedEmail: string) => string;
  infoPasswordResetComplete: string;
};

const LOGIN_COPY: Record<"english" | "telugu", LoginCopy> = {
  english: {
    dashboardLogin: "Secure dashboard access",
    simpleLogin: (roleLabel) => `${roleLabel} dashboard access`,
    loginHelp:
      "Sign in with your assigned account credentials, then verify the OTP sent to your registered email address.",
    twoStepTitle: "OTP verification",
    twoStepBody:
      "Once your password is verified, an OTP will be sent to your registered email address.",
    sessionTitle: "Account access",
    sessionBody:
      "Use only the assigned account details approved for your dashboard role.",
    signIn: "Sign in",
    continueToDashboard: "Access your dashboard",
    signInHelp:
      "Enter your authorized login details below to continue securely.",
    firebaseConfigMissing:
      "Firebase config missing. Fill `.env.local` before login.",
    emailLoginId: "Email / Login ID",
    emailPlaceholder: "Enter same email or role login ID",
    password: "Password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    sendingOtp: "Sending OTP...",
    sendOtp: "Send OTP",
    pleaseWait: "Please wait...",
    forgotPassword: "Forgot Password?",
    enterOtp: "Enter OTP",
    enterOtpHelp: "Enter the 6-digit OTP received in the mail.",
    emailOtp: "Email OTP",
    otpPlaceholder: "Enter 6-digit OTP",
    verifying: "Verifying...",
    verifyOtpAndLogin: "Verify OTP & Login",
    change: "Edit",
    resetPassword: "Reset Password",
    resetPasswordHelp:
      "Enter the OTP from the mail and set a new password.",
    resetOtp: "Reset OTP",
    newPassword: "New Password",
    newPasswordPlaceholder: "Enter new password",
    resetting: "Resetting...",
    resetPasswordAction: "Reset Password",
    cancel: "Cancel",
    loading: "Loading...",
    roleBased: "role-based",
    infoOtpSent: (maskedEmail) => `OTP sent to ${maskedEmail}.`,
    infoResetOtpSent: (maskedEmail) =>
      `Password reset OTP sent to ${maskedEmail}.`,
    infoPasswordResetComplete:
      "Password reset complete. Now login with the new password.",
  },
  telugu: {
    dashboardLogin: "సెక్యూర్ డాష్‌బోర్డ్ యాక్సెస్",
    simpleLogin: (roleLabel) => `${roleLabel} డాష్‌బోర్డ్ యాక్సెస్`,
    loginHelp:
      "మీకు అసైన్ చేసిన అకౌంట్ క్రెడెన్షియల్స్‌తో సైన్ ఇన్ చేయండి. తర్వాత రిజిస్టర్డ్ ఇమెయిల్‌కి వచ్చిన ఓటీపీని వెరిఫై చేయండి.",
    twoStepTitle: "ఓటీపీ వెరిఫికేషన్",
    twoStepBody:
      "పాస్‌వర్డ్ కరెక్ట్ అయితే రిజిస్టర్డ్ ఇమెయిల్‌కి ఓటీపీ సెండ్ అవుతుంది.",
    sessionTitle: "అకౌంట్ యాక్సెస్",
    sessionBody:
      "మీ డాష్‌బోర్డ్ రోల్‌కి అసైన్ చేసిన అకౌంట్ డీటైల్స్ మాత్రమే యూజ్ చేయండి.",
    signIn: "సైన్ ఇన్",
    continueToDashboard: "డాష్‌బోర్డ్‌కి కంటిన్యూ చేయండి",
    signInHelp:
      "సెక్యూర్‌గా కంటిన్యూ అవ్వడానికి కింద ఆథరైజ్డ్ లాగిన్ డీటైల్స్ ఎంటర్ చేయండి.",
    firebaseConfigMissing:
      "ఫైర్‌బేస్ కాన్ఫిగ్ లేదు. లాగిన్ ముందు `.env.local` ఫిల్ చేయాలి.",
    emailLoginId: "Email / Login ID",
    emailPlaceholder: "సేమ్ ఇమెయిల్ లేదా రోల్ లాగిన్ ఐడి ఎంటర్ చేయండి",
    password: "పాస్‌వర్డ్",
    hidePassword: "పాస్‌వర్డ్ హైడ్ చేయండి",
    showPassword: "పాస్‌వర్డ్ షో చేయండి",
    sendingOtp: "ఓటీపీ సెండ్ అవుతోంది...",
    sendOtp: "ఓటీపీ సెండ్ చేయండి",
    pleaseWait: "ప్లీజ్ వెయిట్...",
    forgotPassword: "ఫర్‌గాట్ పాస్‌వర్డ్?",
    enterOtp: "ఓటీపీ ఎంటర్ చేయండి",
    enterOtpHelp: "మెయిల్‌లో వచ్చిన 6-డిజిట్ ఓటీపీని ఎంటర్ చేయండి.",
    emailOtp: "ఇమెయిల్ ఓటీపీ",
    otpPlaceholder: "6-డిజిట్ ఓటీపీ ఎంటర్ చేయండి",
    verifying: "వెరిఫై అవుతోంది...",
    verifyOtpAndLogin: "ఓటీపీ వెరిఫై చేసి లాగిన్ అవ్వండి",
    change: "ఎడిట్",
    resetPassword: "రీసెట్ పాస్‌వర్డ్",
    resetPasswordHelp:
      "మెయిల్‌లో వచ్చిన ఓటీపీని ఎంటర్ చేసి కొత్త పాస్‌వర్డ్ సెట్ చేయండి.",
    resetOtp: "రీసెట్ ఓటీపీ",
    newPassword: "న్యూ పాస్‌వర్డ్",
    newPasswordPlaceholder: "న్యూ పాస్‌వర్డ్ ఎంటర్ చేయండి",
    resetting: "రీసెట్ అవుతోంది...",
    resetPasswordAction: "పాస్‌వర్డ్ రీసెట్ చేయండి",
    cancel: "క్యాన్సెల్",
    loading: "లోడింగ్...",
    roleBased: "role-based",
    infoOtpSent: (maskedEmail) => `ఓటీపీని ${maskedEmail} కి సెండ్ చేశాం.`,
    infoResetOtpSent: (maskedEmail) =>
      `పాస్‌వర్డ్ రీసెట్ ఓటీపీని ${maskedEmail} కి సెండ్ చేశాం.`,
    infoPasswordResetComplete:
      "పాస్‌వర్డ్ రీసెట్ కంప్లీట్ అయింది. ఇప్పుడు న్యూ పాస్‌వర్డ్‌తో లాగిన్ అవ్వండి.",
  },
};

async function registerDevice(idToken: string) {
  const response = await fetch("/api/auth/register-device", {
    method: "POST",
    headers: withDeviceHeader({
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    }),
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      platform: "web",
    }),
  });
  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    role?: string;
    roles?: string[];
  };
  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? "Login setup failed.");
  }
  return {
    role: data.role ?? "user",
    roles:
      Array.isArray(data.roles) && data.roles.length > 0
        ? data.roles
        : [data.role ?? "user"],
  };
}

async function logoutDevice(idToken: string) {
  await fetch("/api/auth/logout-device", {
    method: "POST",
    headers: withDeviceHeader({
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    }),
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
    }),
  });
}

function LoginContent() {
  const { language } = useDashboardLanguage();
  const copy = LOGIN_COPY[language === "telugu" ? "telugu" : "english"];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [, setOtpAuthEmail] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetChallengeId, setResetChallengeId] = useState<string | null>(null);
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const firebaseReady =
    isFirebaseClientConfigured() || process.env.NODE_ENV === "production";
  const requestedRole = (searchParams.get("as") ?? "").trim();
  const hostRole =
    typeof window === "undefined"
      ? ""
      : window.location.hostname.toLowerCase().startsWith("admin.")
        ? "admin"
        : window.location.hostname.toLowerCase().startsWith("manager.")
          ? "manager"
          : window.location.hostname.toLowerCase().startsWith("creator.")
            ? "creator"
            : "";
  const requiredRole = requestedRole || hostRole;
  const requestedNextPath = (searchParams.get("next") ?? "").trim();
  const nextPath =
    requestedNextPath ||
    (requiredRole === "admin"
      ? "/admin/dashboard"
      : requiredRole === "manager"
        ? "/manager/dashboard"
        : requiredRole === "creator"
          ? "/creator/dashboard"
          : "");

  const canSubmit = useMemo(
    () =>
      firebaseReady &&
      identifier.trim().length > 2 &&
      password.trim().length >= 6 &&
      !busy,
    [identifier, password, busy, firebaseReady],
  );
  const canVerifyOtp = useMemo(
    () =>
      firebaseReady && Boolean(otpChallengeId) && otp.trim().length === 6 && !busy,
    [firebaseReady, otpChallengeId, otp, busy],
  );
  const canRequestReset = useMemo(
    () => firebaseReady && identifier.trim().length > 2 && !busy,
    [firebaseReady, identifier, busy],
  );
  const canConfirmReset = useMemo(
    () =>
      firebaseReady &&
      Boolean(resetChallengeId) &&
      resetOtp.trim().length === 6 &&
      newPassword.trim().length >= 6 &&
      !busy,
    [firebaseReady, resetChallengeId, resetOtp, newPassword, busy],
  );

  async function finishLogin() {
    const auth = getClientAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error("Login succeeded but token is missing.");
    }
    const authResult = await registerDevice(idToken);
    const role = authResult.role;
    const roles = authResult.roles;

    if (requiredRole.length > 0 && !roles.includes(requiredRole)) {
      await logoutDevice(idToken);
      await firebaseSignOut(auth);
      throw new Error(
        `Please login with ${requiredRole} account. Current account roles: ${roles.join(", ")}.`,
      );
    }

    if (nextPath.startsWith("/")) {
      router.replace(nextPath);
      return;
    }

    if (role === "admin") {
      router.replace("/admin/dashboard");
      return;
    }
    if (role === "manager") {
      router.replace("/manager/dashboard");
      return;
    }
    if (role === "creator") {
      router.replace("/creator/dashboard");
      return;
    }
    router.replace("/");
  }

  async function handleRequestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!requiredRole) {
        throw new Error("Dashboard role is missing.");
      }
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          role: requiredRole,
          password,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        challengeId?: string;
        maskedEmail?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.challengeId) {
        throw new Error(data.error ?? "Unable to send OTP.");
      }
      setOtpChallengeId(data.challengeId);
      setOtpAuthEmail(null);
      setOtp("");
      setInfo(copy.infoOtpSent(data.maskedEmail ?? "your email"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!otpChallengeId) {
        throw new Error("Request OTP first.");
      }
      const verifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: otpChallengeId,
          otp: otp.trim(),
        }),
      });
      const verifyData = (await verifyResponse.json()) as {
        ok: boolean;
        authEmail?: string;
        error?: string;
      };
      if (!verifyResponse.ok || !verifyData.ok || !verifyData.authEmail) {
        throw new Error(verifyData.error ?? "OTP verification failed.");
      }
      setOtpAuthEmail(verifyData.authEmail);

      const auth = getClientAuth();
      await signInWithEmailAndPassword(auth, verifyData.authEmail, password);
      await finishLogin();
    } catch (err) {
      try {
        await firebaseSignOut(getClientAuth());
      } catch {}
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestPasswordReset() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!requiredRole) {
        throw new Error("Dashboard role is missing.");
      }
      const response = await fetch("/api/auth/request-password-reset-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          role: requiredRole,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        challengeId?: string;
        maskedEmail?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.challengeId) {
        throw new Error(data.error ?? "Unable to send reset OTP.");
      }
      setResetMode(true);
      setResetChallengeId(data.challengeId);
      setResetOtp("");
      setNewPassword("");
      setInfo(copy.infoResetOtpSent(data.maskedEmail ?? "your email"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!resetChallengeId) {
        throw new Error("Request reset OTP first.");
      }
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: resetChallengeId,
          otp: resetOtp.trim(),
          password: newPassword,
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to reset password.");
      }
      setResetMode(false);
      setResetChallengeId(null);
      setResetOtp("");
      setPassword("");
      setNewPassword("");
      setInfo(copy.infoPasswordResetComplete);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setBusy(false);
    }
  }

  const roleLabel = requiredRole.length > 0 ? requiredRole : copy.roleBased;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
        <div className="border-b border-slate-200 bg-slate-50 p-8 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-2">
              <Image
                src="/mana-poster-logo.png"
                alt="Mana Poster Ai"
                width={52}
                height={52}
                className="h-12 w-12 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Mana Poster Ai
              </p>
              <p className="text-sm font-medium text-slate-600">
                {BRAND_TAGLINE}
              </p>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {copy.simpleLogin(roleLabel)}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            {copy.loginHelp}
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">
                {copy.twoStepTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {copy.twoStepBody}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">
                {copy.sessionTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {copy.sessionBody}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {copy.signIn}
          </p>
          <h2 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">
            {copy.continueToDashboard}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {copy.signInHelp}
          </p>

          {!firebaseReady && process.env.NODE_ENV !== "production" ? (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {copy.firebaseConfigMissing}
            </p>
          ) : null}

          <form onSubmit={handleRequestOtp} className="mt-7 space-y-4">
            <label className="block text-sm font-medium text-slate-800">
              {copy.emailLoginId}
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                type="text"
                required
                placeholder={copy.emailPlaceholder}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              {copy.password}
              <div className="relative mt-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  className="absolute inset-y-0 right-3 my-auto flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.4 5.5A10.7 10.7 0 0 1 12 5c5 0 9.3 3 11 7-1 2.1-2.6 3.8-4.5 5" />
                      <path d="M6.2 6.2C4.3 7.5 2.8 9.4 2 12c1.7 4 6 7 10 7 1.6 0 3.1-.4 4.5-1" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            <button
              disabled={!canSubmit}
              type="submit"
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? copy.sendingOtp : copy.sendOtp}
            </button>
            <button
              type="button"
              disabled={!canRequestReset}
              onClick={() => void handleRequestPasswordReset()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? copy.pleaseWait : copy.forgotPassword}
            </button>
          </form>

          {otpChallengeId ? (
            <form
              onSubmit={handleVerifyOtp}
              className="mt-5 space-y-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {copy.enterOtp}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  {copy.enterOtpHelp}
                </p>
              </div>
              <label className="block text-sm font-medium text-slate-800">
                {copy.emailOtp}
                <input
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  pattern="\d{6}"
                  placeholder={copy.otpPlaceholder}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!canVerifyOtp}
                  className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? copy.verifying : copy.verifyOtpAndLogin}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOtpChallengeId(null);
                    setOtpAuthEmail(null);
                    setOtp("");
                    setInfo(null);
                    setError(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {copy.change}
                </button>
              </div>
            </form>
          ) : null}

          {resetMode ? (
            <form
              onSubmit={handleResetPassword}
              className="mt-5 space-y-4 rounded-[24px] border border-slate-200 bg-amber-50 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {copy.resetPassword}
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-600">
                  {copy.resetPasswordHelp}
                </p>
              </div>
              <label className="block text-sm font-medium text-slate-800">
                {copy.resetOtp}
                <input
                  value={resetOtp}
                  onChange={(e) =>
                    setResetOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  pattern="\d{6}"
                  placeholder={copy.otpPlaceholder}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {copy.newPassword}
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder={copy.newPasswordPlaceholder}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={!canConfirmReset}
                  className="flex-1 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? copy.resetting : copy.resetPasswordAction}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setResetMode(false);
                    setResetChallengeId(null);
                    setResetOtp("");
                    setNewPassword("");
                    setInfo(null);
                    setError(null);
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {copy.cancel}
                </button>
              </div>
            </form>
          ) : null}

          {error ? (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {info}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center bg-slate-100 px-6 py-12">
          <section className="mx-auto w-full max-w-3xl rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading...</p>
          </section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
