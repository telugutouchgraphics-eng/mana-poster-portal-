import crypto from "crypto";

export function generateInviteToken(): string {
  const random = crypto.randomBytes(24).toString("base64url");
  return `mpl_${random}`;
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
