import crypto from "crypto";
import { Firestore } from "firebase-admin/firestore";

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const NUMERIC_SUFFIX = "0123456789";

export type ManagedPasswordRole = "admin" | "manager" | "creator";

const PASSWORD_PREFIX: Record<ManagedPasswordRole, string> = {
  admin: "admin@",
  manager: "manager@",
  creator: "creator@",
};

export function generateStrongPassword(length = 6): string {
  const size = length > 0 ? Math.min(length, 6) : 6;
  const chars = [
    LETTERS[crypto.randomInt(0, LETTERS.length)],
    DIGITS[crypto.randomInt(0, DIGITS.length)],
  ];
  while (chars.length < size) {
    chars.push(PASSWORD_CHARS[crypto.randomInt(0, PASSWORD_CHARS.length)]);
  }
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

function buildManagedPassword(role: ManagedPasswordRole): string {
  const numericPart = Array.from(
    { length: 3 },
    () => NUMERIC_SUFFIX[crypto.randomInt(0, NUMERIC_SUFFIX.length)],
  ).join("");
  const letterPart = Array.from(
    { length: 3 },
    () => LOWERCASE[crypto.randomInt(0, LOWERCASE.length)],
  ).join("");
  return `${PASSWORD_PREFIX[role]}${numericPart}${letterPart}`;
}

export async function generateManagedPassword(
  db: Firestore,
  role: ManagedPasswordRole,
): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const password = buildManagedPassword(role);
    const passwordRef = db.collection("managedPasswordIndex").doc(password);
    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(passwordRef);
        if (existing.exists) {
          throw new Error("PASSWORD_EXISTS");
        }
        tx.create(passwordRef, {
          password,
          role,
          createdAt: Date.now(),
        });
      });
      return password;
    } catch (error) {
      if (error instanceof Error && error.message === "PASSWORD_EXISTS") {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to generate unique password.");
}
