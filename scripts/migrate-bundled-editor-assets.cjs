/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const admin = require("firebase-admin");

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index > 0) env[line.slice(0, index).trim()] = line.slice(index + 1);
  }
  return env;
}

function initialize() {
  const root = path.resolve(__dirname, "..");
  const env = loadEnv(path.join(root, ".env.local"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: (env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  return { db: admin.firestore(), bucket: admin.storage().bucket() };
}

const appRoot = path.resolve(__dirname, "..", "..", "mana_poster new features");
const categorySources = [
  { name: "Emojis", texts: ["😀", "😁", "😎", "🥳", "❤️", "✨"] },
  { name: "DesignPro Shapes", directory: "assets/designpro_reference_full/assets/shapes", include: ["circle.svg", "square.svg", "rectangle.svg", "triangle.svg", "star.svg", "heart.svg", "arrow.svg", "cloud.svg", "crown.svg", "diamond.svg", "hexagon.svg", "octagon.svg", "lightning.svg", "flower.svg", "sunflower1.svg", "paint_line.svg", "boom.svg", "callout.svg", "default_shape_circle.svg", "default_shape_square.svg", "default_shape_star.svg", "default_shape_triangle.svg", "default_shape_heart.svg"] },
  { name: "Callouts", directory: "assets/designpro_reference_full/assets/callouts" },
  { name: "SVG Marks", directory: "assets/designpro_reference_full/assets/shapes", include: ["default_shape_x.svg", "default_shape_star.svg", "default_shape_star_2.svg", "default_shape_heart.svg", "arrow.svg", "lightning.svg", "paint_line.svg", "boom.svg", "lines.svg", "drops.svg", "foot_print.svg", "crown.svg", "cloud_down.svg", "melt.svg"] },
  { name: "Shapes", texts: ["●", "○", "◐", "◑", "■", "□", "▣", "▢", "◆", "◇", "◈", "▲", "△", "▼", "▽", "◀", "▶", "◁", "▷", "⬟", "⬢", "⬡", "★", "☆", "✦", "✧", "✚", "✖", "✓", "✔", "⬆", "⬇", "⬅", "➡", "↗", "↘", "↙", "↖", "━", "┃", "┏", "┓", "┗", "┛", "⌜", "⌝", "⌞", "⌟", "⬛", "⬜", "🔶", "🔷", "🔺", "🔻"] },
  { name: "Hearts", texts: ["❤️", "💚", "💙", "💜", "🧡", "💕"] },
  { name: "Stars", texts: ["⭐", "🌟", "✨", "💫", "🔆", "✳️"] },
  { name: "Festival", texts: ["🎉", "🎊", "🪔", "🪙", "🕯️", "🌸"] },
  { name: "Political", directory: "assets/elements/political/logos" },
];

function safeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mimeFor(extension) {
  return extension === "svg" ? "image/svg+xml" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : "image/png";
}

async function main() {
  const { db, bucket } = initialize();
  const existingCategories = await db.collection("editorAssetCategories").get();
  const categoryByName = new Map(existingCategories.docs.map((doc) => [String(doc.data().name || "").trim().toLowerCase(), doc.id]));
  let uploaded = 0;
  let skipped = 0;
  for (let categoryIndex = 0; categoryIndex < categorySources.length; categoryIndex += 1) {
    const source = categorySources[categoryIndex];
    const categoryId = categoryByName.get(source.name.toLowerCase()) || `bundled-${safeId(source.name)}`;
    const now = Date.now();
    await db.collection("editorAssetCategories").doc(categoryId).set({ id: categoryId, name: source.name, active: true, sortOrder: categoryIndex * 10, createdAt: now, updatedAt: now }, { merge: true });
    const sourceDirectory = source.directory ? path.join(appRoot, source.directory) : "";
    const sourceFiles = source.include
      ? source.include.filter((name) => sourceDirectory && fs.existsSync(path.join(sourceDirectory, name)))
      : (sourceDirectory && fs.existsSync(sourceDirectory)
        ? fs.readdirSync(sourceDirectory).filter((name) => fs.statSync(path.join(sourceDirectory, name)).isFile())
        : []);
    const entries = source.texts
      ? source.texts.map((value, index) => ({ kind: "text", value, name: value, sortOrder: index * 10 }))
      : sourceFiles.map((name, index) => ({ kind: "file", name: name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), fileName: name, sortOrder: index * 10 }));
    for (const entry of entries) {
      const stableKey = entry.kind === "text" ? entry.value : `${source.directory}/${entry.fileName}`;
      const id = `bundled-${crypto.createHash("sha1").update(`${categoryId}|${stableKey}`).digest("hex").slice(0, 24)}`;
      const ref = db.collection("editorAssets").doc(id);
      if ((await ref.get()).exists) { skipped += 1; continue; }
      if (entry.kind === "text") {
        const buffer = Buffer.from(entry.value, "utf8");
        await ref.set({ id, categoryId, name: entry.name, kind: "text", value: entry.value, fileUrl: "", filePath: "", thumbnailUrl: "", contentType: "text/plain", extension: "", byteSize: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), active: true, sortOrder: entry.sortOrder, createdAt: now, updatedAt: now });
      } else {
        const localPath = path.join(appRoot, source.directory, entry.fileName);
        const buffer = fs.readFileSync(localPath);
        const extension = path.extname(entry.fileName).slice(1).toLowerCase();
        const storagePath = `portal_assets/editor_assets/${categoryId}/${id}.${extension}`;
        const token = crypto.randomUUID();
        await bucket.file(storagePath).save(buffer, { resumable: false, contentType: mimeFor(extension), metadata: { cacheControl: "public,max-age=31536000", metadata: { firebaseStorageDownloadTokens: token, migratedFromBundle: "true" } } });
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
        await ref.set({ id, categoryId, name: entry.name, kind: "file", value: "", fileUrl, filePath: storagePath, thumbnailUrl: fileUrl, contentType: mimeFor(extension), extension, byteSize: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), active: true, sortOrder: entry.sortOrder, createdAt: now, updatedAt: now });
      }
      uploaded += 1;
    }
  }
  const [categoryAudit, assetAudit] = await Promise.all([
    db.collection("editorAssetCategories").get(),
    db.collection("editorAssets").get(),
  ]);
  console.log(JSON.stringify({ categories: categoryAudit.size, assets: assetAudit.size, uploaded, skipped }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
