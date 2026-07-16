import { createHash, randomUUID } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";

export const EDITOR_FONTS = "editorFonts";
export const MAX_EDITOR_FONT_BYTES = 12 * 1024 * 1024;

export type EditorFontLanguage = "telugu" | "english" | "hindi";

export type EditorFontRecord = {
  id: string;
  family: string;
  displayName: string;
  language: EditorFontLanguage;
  fileUrl: string;
  filePath: string;
  contentType: string;
  extension: "ttf" | "otf";
  byteSize: number;
  sha256: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

const allowedContentTypes = new Set([
  "font/ttf",
  "font/otf",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/octet-stream",
]);

export function normalizeEditorFontName(value: unknown, fallback: string): string {
  const name = String(value ?? "").trim().replace(/\s+/g, " ") || fallback;
  return name.replace(/[\u0000-\u001f]/g, "").slice(0, 80);
}

export function normalizeFontSortOrder(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(999999, Math.round(parsed))) : 0;
}

export function normalizeFontLanguage(value: unknown): EditorFontLanguage {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "english" || normalized === "en") return "english";
  if (normalized === "hindi" || normalized === "hi") return "hindi";
  return "telugu";
}

function extensionFromFile(file: File): "ttf" | "otf" {
  const contentType = file.type.trim().toLowerCase();
  if (contentType && !allowedContentTypes.has(contentType)) {
    throw new Error("Only TTF and OTF font files are allowed.");
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".otf")) return "otf";
  if (name.endsWith(".ttf")) return "ttf";
  if (contentType.includes("otf")) return "otf";
  if (contentType.includes("ttf") || contentType.includes("sfnt")) return "ttf";
  throw new Error("Font file must use .ttf or .otf extension.");
}

function validateFontContents(buffer: Buffer, extension: "ttf" | "otf") {
  if (buffer.length <= 0 || buffer.length > MAX_EDITOR_FONT_BYTES) {
    throw new Error("Each font must be 12 MB or smaller.");
  }
  const signature = buffer.subarray(0, 4);
  const asciiSignature = signature.toString("ascii");
  const isTtf =
    signature.equals(Buffer.from([0x00, 0x01, 0x00, 0x00])) ||
    asciiSignature === "true" ||
    asciiSignature === "typ1";
  const isOtf = asciiSignature === "OTTO";
  if ((extension === "ttf" && !isTtf) || (extension === "otf" && !isOtf)) {
    throw new Error("The uploaded file contents do not match its font type.");
  }
}

export async function listEditorFonts(includeInactive = false) {
  const snap = await adminDb.collection(EDITOR_FONTS).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as EditorFontRecord)
    .filter((item) => includeInactive || item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
}

export async function uploadEditorFont(input: {
  family: string;
  displayName: string;
  language: EditorFontLanguage;
  sortOrder: number;
  file: File;
}) {
  const extension = extensionFromFile(input.file);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  validateFontContents(buffer, extension);
  const id = randomUUID();
  const family = normalizeEditorFontName(input.family, input.file.name.replace(/\.[^.]+$/, ""));
  const displayName = normalizeEditorFontName(input.displayName, family);
  const duplicate = await adminDb.collection(EDITOR_FONTS).get();
  if (
    duplicate.docs.some((doc) => {
      const item = doc.data() as Partial<EditorFontRecord>;
      return item.family === family && item.language === input.language;
    })
  ) {
    throw new Error("A font with this family and language already exists.");
  }
  const contentType = extension === "otf" ? "font/otf" : "font/ttf";
  const uploaded = await uploadAdminAsset(
    buffer,
    contentType,
    `portal_assets/editor_fonts/${id}.${extension}`,
  );
  const now = Date.now();
  const record: EditorFontRecord = {
    id,
    family,
    displayName,
    language: input.language,
    fileUrl: uploaded.imageUrl,
    filePath: uploaded.filePath,
    contentType,
    extension,
    byteSize: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    active: true,
    sortOrder: normalizeFontSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await adminDb.collection(EDITOR_FONTS).doc(id).set(record);
  } catch (error) {
    await deleteAdminAsset(uploaded.filePath);
    throw error;
  }
  return record;
}

export async function deleteEditorFont(id: string) {
  const ref = adminDb.collection(EDITOR_FONTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const record = snap.data() as EditorFontRecord;
  await ref.delete();
  await deleteAdminAsset(record.filePath);
  return true;
}
