import { createHash, randomUUID } from "crypto";
import { editorAdminDb, editorAdminStorage } from "@/lib/firebase/admin";
import { deleteAdminAsset, uploadAdminAsset } from "@/lib/server/content-management";

export const EDITOR_ASSET_CATEGORIES = "editorAssetCategories";
export const EDITOR_ASSETS = "editorAssets";
export const MAX_EDITOR_ASSET_BYTES = 8 * 1024 * 1024;
export const MAX_EDITOR_PSD_ASSET_BYTES = 100 * 1024 * 1024;

const REQUIRED_HOME_ASSET_CATEGORIES = [
  "home_banner",
  "home_trending",
  "home_festival",
];

export type EditorAssetCategoryRecord = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type EditorAssetRecord = {
  id: string;
  categoryId: string;
  name: string;
  kind: "file" | "text";
  value: string;
  fileUrl: string;
  filePath: string;
  thumbnailUrl: string;
  contentType: string;
  extension: string;
  byteSize: number;
  sha256: string;
  active: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

const allowedTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
  ["image/vnd.adobe.photoshop", "psd"],
  ["application/photoshop", "psd"],
  ["application/psd", "psd"],
]);

export function editorAssetExtension(file: File): string {
  const fileNameExtension = file.name.split(".").pop()?.trim().toLowerCase() ?? "";
  const extension =
    allowedTypes.get(file.type.toLowerCase()) ??
    (fileNameExtension === "psd" ? "psd" : undefined);
  if (!extension) throw new Error("Only PNG, JPG, WEBP, SVG and PSD files are allowed.");
  const maxBytes = extension === "psd" ? MAX_EDITOR_PSD_ASSET_BYTES : MAX_EDITOR_ASSET_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error(extension === "psd" ? "Each PSD must be 100 MB or smaller." : "Each asset must be 8 MB or smaller.");
  }
  return extension;
}

function validateEditorAssetContents(buffer: Buffer, extension: string) {
  const validRaster =
    (extension === "png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (extension === "jpg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) ||
    (extension === "webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") ||
    (extension === "psd" && buffer.subarray(0, 4).toString("ascii") === "8BPS");
  if (extension !== "svg" && !validRaster) throw new Error("The uploaded file contents do not match its file type.");
  if (extension === "svg") {
    const svg = buffer.toString("utf8");
    if (
      !/<svg[\s>]/i.test(svg) ||
      /<script|\son\w+\s*=|javascript:|data:text\/html|<(?:image|use)\b[^>]*(?:href|xlink:href)\s*=\s*["']https?:|url\(\s*["']?https?:/i.test(svg)
    ) {
      throw new Error("SVG must be self-contained and must not contain scripts or external links.");
    }
  }
}

export function normalizeEditorAssetName(value: unknown, fallback: string): string {
  const name = String(value ?? "").trim() || fallback;
  return name.slice(0, 80);
}

export function normalizeSortOrder(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(999999, Math.round(parsed))) : 0;
}

export async function listEditorAssetCatalog(includeInactive = false) {
  const [categorySnap, assetSnap] = await Promise.all([
    editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).get(),
    editorAdminDb.collection(EDITOR_ASSETS).get(),
  ]);
  const categories = categorySnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as EditorAssetCategoryRecord)
    .filter((item) => includeInactive || item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const visibleCategoryIds = new Set(categories.map((item) => item.id));
  const assets = assetSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as EditorAssetRecord)
    .filter((item) => visibleCategoryIds.has(item.categoryId))
    .filter((item) => includeInactive || item.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt);
  return { categories, assets };
}

export async function ensureHomeAssetCategories() {
  const snap = await editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).get();
  const existingNames = new Set(
    snap.docs.map((doc) => String(doc.data().name ?? "").trim().toLowerCase()),
  );
  const missing = REQUIRED_HOME_ASSET_CATEGORIES.filter(
    (name) => !existingNames.has(name.toLowerCase()),
  );
  if (missing.length === 0) {
    return;
  }
  const now = Date.now();
  const batch = editorAdminDb.batch();
  const baseSortOrder = snap.size * 10;
  missing.forEach((name, index) => {
    const ref = editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc();
    batch.set(ref, {
      id: ref.id,
      name,
      active: true,
      sortOrder: baseSortOrder + index * 10,
      createdAt: now,
      updatedAt: now,
    } satisfies EditorAssetCategoryRecord);
  });
  await batch.commit();
}

export async function createEditorAssetCategory(input: { name: string; sortOrder: number }) {
  const now = Date.now();
  const ref = editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc();
  const record: EditorAssetCategoryRecord = {
    id: ref.id,
    name: normalizeEditorAssetName(input.name, "New category"),
    active: true,
    sortOrder: normalizeSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return record;
}

export async function uploadEditorAsset(input: {
  categoryId: string;
  name: string;
  sortOrder: number;
  file: File;
}) {
  const category = await editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc(input.categoryId).get();
  if (!category.exists) throw new Error("Selected category does not exist.");
  const extension = editorAssetExtension(input.file);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  validateEditorAssetContents(buffer, extension);
  const id = randomUUID();
  const uploaded = await uploadAdminAsset(
    buffer,
    extension === "psd" ? "image/vnd.adobe.photoshop" : input.file.type.toLowerCase(),
    `portal_assets/editor_assets/${input.categoryId}/${id}.${extension}`,
    editorAdminStorage,
  );
  const now = Date.now();
  const record: EditorAssetRecord = {
    id,
    categoryId: input.categoryId,
    name: normalizeEditorAssetName(input.name, input.file.name.replace(/\.[^.]+$/, "")),
    kind: "file",
    value: "",
    fileUrl: uploaded.imageUrl,
    filePath: uploaded.filePath,
    thumbnailUrl: uploaded.imageUrl,
    contentType: extension === "psd" ? "image/vnd.adobe.photoshop" : input.file.type.toLowerCase(),
    extension,
    byteSize: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    active: true,
    sortOrder: normalizeSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await editorAdminDb.collection(EDITOR_ASSETS).doc(id).set(record);
  } catch (error) {
    await deleteAdminAsset(uploaded.filePath, editorAdminStorage);
    throw error;
  }
  return record;
}

export async function createEditorTextAsset(input: {
  categoryId: string;
  name: string;
  value: string;
  sortOrder: number;
}) {
  const category = await editorAdminDb.collection(EDITOR_ASSET_CATEGORIES).doc(input.categoryId).get();
  if (!category.exists) throw new Error("Selected category does not exist.");
  const value = input.value.trim();
  if (!value || value.length > 16) throw new Error("Symbol must contain 1 to 16 characters.");
  const now = Date.now();
  const ref = editorAdminDb.collection(EDITOR_ASSETS).doc();
  const record: EditorAssetRecord = {
    id: ref.id,
    categoryId: input.categoryId,
    name: normalizeEditorAssetName(input.name, value),
    kind: "text",
    value,
    fileUrl: "",
    filePath: "",
    thumbnailUrl: "",
    contentType: "text/plain",
    extension: "",
    byteSize: Buffer.byteLength(value, "utf8"),
    sha256: createHash("sha256").update(value, "utf8").digest("hex"),
    active: true,
    sortOrder: normalizeSortOrder(input.sortOrder),
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  return record;
}

export async function deleteEditorAsset(id: string) {
  const ref = editorAdminDb.collection(EDITOR_ASSETS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const record = snap.data() as EditorAssetRecord;
  await ref.delete();
  await deleteAdminAsset(record.filePath, editorAdminStorage);
  return true;
}
