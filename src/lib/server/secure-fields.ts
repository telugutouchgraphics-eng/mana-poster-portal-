import crypto from "crypto";

function getSecretKey() {
  const raw = process.env.PAYOUT_PROFILE_SECRET?.trim();
  if (!raw) {
    throw new Error("PAYOUT_PROFILE_SECRET is not configured.");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSensitiveField(value: string) {
  const plain = value.trim();
  if (!plain) {
    return "";
  }
  const iv = crypto.randomBytes(12);
  const key = getSecretKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), encrypted.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptSensitiveField(payload: string) {
  const raw = payload.trim();
  if (!raw) {
    return "";
  }
  const [ivRaw, encryptedRaw, tagRaw] = raw.split(".");
  if (!ivRaw || !encryptedRaw || !tagRaw) {
    return "";
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getSecretKey(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const value = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);
  return value.toString("utf8");
}

export function maskBankAccountNumber(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) {
    return compact;
  }
  return `${"*".repeat(Math.max(0, compact.length - 4))}${compact.slice(-4)}`;
}
