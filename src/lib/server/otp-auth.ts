import crypto from "crypto";
import { cookies } from "next/headers";
import nodemailer from "nodemailer";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import {
  ManagedPortalRole,
  normalizeLoginIdentifier,
  resolveManagedAuthEmail,
} from "@/lib/server/managed-auth";

const OTP_COLLECTION = "loginOtpChallenges";
const OTP_COOKIE_NAME = "mp_portal_otp";
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function otpSecret(): string {
  const base =
    process.env.PORTAL_OTP_SECRET?.trim() ||
    `${process.env.FIREBASE_PROJECT_ID ?? ""}:${process.env.FIREBASE_PRIVATE_KEY ?? ""}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

function signValue(value: string): string {
  return crypto.createHmac("sha256", otpSecret()).update(value).digest("hex");
}

function hashOtp(challengeId: string, code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${challengeId}:${code}:${otpSecret()}`)
    .digest("hex");
}

function randomOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const first = local.slice(0, 2);
  const masked = `${first}${"*".repeat(Math.max(local.length - 2, 2))}`;
  return `${masked}@${domain}`;
}

function buildCookieValue(uid: string, expiresAt: number) {
  const payload = JSON.stringify({ uid, expiresAt });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signValue(encoded);
  return `${encoded}.${signature}`;
}

function parseCookieValue(value: string | undefined | null): { uid: string; expiresAt: number } | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (signValue(encoded) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      uid?: string;
      expiresAt?: number;
    };
    if (!parsed.uid || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
      return null;
    }
    return { uid: parsed.uid, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

async function transporter() {
  return nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port: Number(requiredEnv("SMTP_PORT")),
    secure: Number(process.env.SMTP_PORT ?? "587") === 465,
    auth: {
      user: requiredEnv("SMTP_LOGIN"),
      pass: requiredEnv("SMTP_PASSWORD"),
    },
  });
}

export async function verifyManagedPassword(authEmail: string, password: string) {
  const apiKey = requiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: authEmail,
        password,
        returnSecureToken: true,
      }),
    },
  );

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;
  const message = data?.error?.message ?? "";
  if (
    message.includes("INVALID_PASSWORD") ||
    message.includes("EMAIL_NOT_FOUND") ||
    message.includes("INVALID_LOGIN_CREDENTIALS")
  ) {
    throw new Error("Invalid login credentials.");
  }
  throw new Error("Unable to verify login password.");
}

export async function createOtpChallenge(identifier: string, role: ManagedPortalRole, password: string) {
  let resolved;
  try {
    resolved = await resolveManagedAuthEmail(adminDb, identifier, role);
    await verifyManagedPassword(resolved.authEmail, password);
  } catch {
    throw new Error("Invalid login credentials.");
  }
  return issueOtpChallenge({
    uid: resolved.uid,
    role,
    authEmail: resolved.authEmail,
    contactEmail: resolved.contactEmail,
    purpose: "login",
  });
}

export async function createPasswordResetChallenge(identifier: string, role: ManagedPortalRole) {
  let resolved;
  try {
    resolved = await resolveManagedAuthEmail(adminDb, identifier, role);
  } catch {
    return issueDecoyPasswordResetChallenge(identifier, role);
  }
  return issueOtpChallenge({
    uid: resolved.uid,
    role,
    authEmail: resolved.authEmail,
    contactEmail: resolved.contactEmail,
    purpose: "password_reset",
  });
}

async function issueDecoyPasswordResetChallenge(identifier: string, role: ManagedPortalRole) {
  const challengeRef = adminDb.collection(OTP_COLLECTION).doc();
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;
  const code = randomOtp();
  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  await challengeRef.set({
    uid: "__decoy__",
    role,
    authEmail: "__decoy__@invalid.local",
    contactEmail: normalizedIdentifier,
    purpose: "password_reset",
    createdAt: now,
    expiresAt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    codeHash: hashOtp(challengeRef.id, code),
    decoy: true,
  });

  return {
    challengeId: challengeRef.id,
    authEmail: "",
    maskedEmail: "your registered email",
    expiresAt,
  };
}

async function issueOtpChallenge(input: {
  uid: string;
  role: ManagedPortalRole;
  authEmail: string;
  contactEmail: string;
  purpose: "login" | "password_reset";
}) {
  const challengeRef = adminDb.collection(OTP_COLLECTION).doc();
  const code = randomOtp();
  const now = Date.now();
  const expiresAt = now + OTP_TTL_MS;

  await challengeRef.set({
    uid: input.uid,
    role: input.role,
    authEmail: input.authEmail,
    contactEmail: input.contactEmail,
    purpose: input.purpose,
    createdAt: now,
    expiresAt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    codeHash: hashOtp(challengeRef.id, code),
  });

  const fromEmail = requiredEnv("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Mana Poster Ai";
  const mailer = await transporter();
  await mailer.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.contactEmail,
    subject:
      input.purpose === "password_reset"
        ? "Your Mana Poster Ai password reset OTP"
        : "Your Mana Poster Ai login OTP",
    text:
      input.purpose === "password_reset"
        ? `Your Mana Poster Ai password reset OTP is ${code}. This code will expire in 10 minutes.`
        : `Your Mana Poster Ai login OTP is ${code}. This code will expire in 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;padding:24px;color:#111827">
      <p style="margin:0 0 12px;font-size:14px;color:#6b7280">${
        input.purpose === "password_reset" ? "Mana Poster Ai password reset" : "Mana Poster Ai secure login"
      }</p>
      <h2 style="margin:0 0 16px;font-size:28px;letter-spacing:4px">${code}</h2>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#374151">Use this OTP to complete your dashboard login. This code expires in 10 minutes.</p>
    </div>`,
  });

  return {
    challengeId: challengeRef.id,
    authEmail: input.authEmail,
    maskedEmail: maskEmail(input.contactEmail),
    expiresAt,
  };
}

export async function verifyOtpChallenge(challengeId: string, otp: string) {
  const challengeRef = adminDb.collection(OTP_COLLECTION).doc(challengeId);
  const snapshot = await challengeRef.get();
  if (!snapshot.exists) {
    throw new Error("OTP session not found.");
  }

  const data = snapshot.data() as
    | {
        uid?: string;
        authEmail?: string;
        role?: ManagedPortalRole;
        contactEmail?: string;
        purpose?: "login" | "password_reset";
        decoy?: boolean;
        expiresAt?: number;
        attempts?: number;
        maxAttempts?: number;
        codeHash?: string;
      }
    | undefined;

  const now = Date.now();
  const expiresAt = Number(data?.expiresAt ?? 0);
  const attempts = Number(data?.attempts ?? 0);
  const maxAttempts = Number(data?.maxAttempts ?? OTP_MAX_ATTEMPTS);

  if (!data?.uid || !data?.authEmail) {
    throw new Error("OTP session is invalid.");
  }
  if (expiresAt < now) {
    await challengeRef.delete().catch(() => undefined);
    throw new Error("OTP expired. Please request a new code.");
  }
  if (attempts >= maxAttempts) {
    await challengeRef.delete().catch(() => undefined);
    throw new Error("Too many invalid OTP attempts. Please request a new code.");
  }

  if (data.decoy === true) {
    await challengeRef.set({ attempts: attempts + 1 }, { merge: true });
    throw new Error("Invalid OTP.");
  }

  const nextHash = hashOtp(challengeId, otp);
  if (nextHash !== String(data.codeHash ?? "")) {
    await challengeRef.set({ attempts: attempts + 1 }, { merge: true });
    throw new Error("Invalid OTP.");
  }

  await challengeRef.delete().catch(() => undefined);
  return {
    uid: data.uid,
    authEmail: data.authEmail,
    role: data.role ?? "creator",
    contactEmail: String(data.contactEmail ?? ""),
    purpose: data.purpose ?? "login",
    sessionExpiresAt: now + OTP_SESSION_TTL_MS,
  };
}

export async function resetManagedPasswordAfterOtp(input: {
  challengeId: string;
  otp: string;
  nextPassword: string;
}) {
  const verified = await verifyOtpChallenge(input.challengeId, input.otp);
  if (verified.purpose !== "password_reset") {
    throw new Error("Invalid password reset session.");
  }
  const now = Date.now();

  await adminAuth.updateUser(verified.uid, {
    password: input.nextPassword,
    disabled: false,
  });

  await adminDb.collection("users").doc(verified.uid).set(
    {
      loginPassword: FieldValue.delete(),
      updatedAt: now,
      ...(verified.role === "manager" ? { managerStatus: "active" } : {}),
      ...(verified.role === "admin" ? { dashboardAdminStatus: "active" } : {}),
    },
    { merge: true },
  );

  if (verified.role === "creator") {
    const creatorQuery = await adminDb
      .collection("creatorProfiles")
      .where("authUid", "==", verified.uid)
      .limit(1)
      .get();
    const creatorDoc = creatorQuery.docs[0];
    if (creatorDoc) {
      await creatorDoc.ref.set(
        {
          status: "active",
      loginPassword: FieldValue.delete(),
          updatedAt: now,
          selfPasswordResetAt: now,
        },
        { merge: true },
      );
    }
  }

  return verified;
}

export async function setOtpSessionCookie(uid: string, expiresAt: number) {
  const store = await cookies();
  store.set(OTP_COOKIE_NAME, buildCookieValue(uid, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearOtpSessionCookie() {
  const store = await cookies();
  store.set(OTP_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function requireOtpSession(uid: string) {
  const store = await cookies();
  const parsed = parseCookieValue(store.get(OTP_COOKIE_NAME)?.value);
  if (!parsed || parsed.uid !== uid) {
    throw new Error("OTP verification required.");
  }
}

