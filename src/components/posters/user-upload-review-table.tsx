"use client";

import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CategoryLabelWithLogo } from "@/components/category/category-label-with-logo";
import { groupCategories, type CategoryType } from "@/lib/category-groups";
import { useDashboardLanguage } from "@/components/i18n/dashboard-language-provider";
import {
  AppStyleNameStrip,
  isPhotoInNameStripSafeZone,
  NameStripOverlapWarning,
  nameStripSafeZoneHeightPercent,
} from "@/components/posters/app-style-name-strip";
import { useDashboardRegion } from "@/components/regions/dashboard-region-provider";
import { PERSONALIZATION_SAMPLE } from "@/lib/constants/personalization-sample";
import type { DashboardRegionLanguage } from "@/lib/dashboard-regions";
import { portalLanguage, t } from "@/lib/i18n";
import {
  PHOTO_EDGE_STYLE_OPTIONS,
  PHOTO_SHAPE_GROUPS,
  photoShapeAspectRatio,
  photoShapeFrameStyle,
  renderPosterPhotoPreview,
  type PhotoEdgeStyle,
  type PhotoFrameStyle,
  type PhotoShape,
} from "@/lib/poster-photo-preview";

interface PersonalizationConfig {
  photoShape: PhotoShape;
  photoRenderMode: "cutout" | "original";
  edgeStyle: PhotoEdgeStyle;
  photoFrameStyle: PhotoFrameStyle;
  showSafeAreas: boolean;
  photoX: number;
  photoY: number;
  photoScale: number;
  showVideoExtraPhoto: boolean;
  videoExtraPhotoShape: PhotoShape;
  videoExtraPhotoRenderMode: "cutout" | "original";
  videoExtraPhotoEdgeStyle: PhotoEdgeStyle;
  videoExtraPhotoFrameStyle: PhotoFrameStyle;
  videoExtraPhotoX: number;
  videoExtraPhotoY: number;
  videoExtraPhotoScale: number;
  nameX: number;
  nameY: number;
  showBottomStrip: boolean;
  stripHeight: number;
  stripWidth: number;
  stripX: number;
  stripBottom: number;
  showPoliticalProtocol: boolean;
  politicalProtocolSlots: PoliticalProtocolSlot[];
  showWhatsapp: boolean;
  sampleName: string;
  sampleDesignation: string;
}

interface PoliticalProtocolSlot {
  x: number;
  y: number;
  scale: number;
}

interface ImageMeta {
  width: number;
  height: number;
}

interface UserUploadRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userMobile: string;
  imageUrl: string;
  imagePath: string;
  quoteText: string;
  submissionType: string;
  categoryId: string;
  categoryLabel: string;
  status: string;
  rejectionReason: string;
  approvedPosterTemplateId: string;
  shareCount: number;
  downloadCount: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

interface CategoryOption {
  id: string;
  label: string;
  categoryType?: CategoryType | string;
}

interface ManagerUploadAsset {
  imageUrl: string;
  imagePath: string;
}

const REVIEW_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

const defaultPersonalizationConfig: PersonalizationConfig = {
  photoShape: "transparent_bottom_fade",
  photoRenderMode: "cutout",
  edgeStyle: "soft_fade",
  photoFrameStyle: "none",
  showSafeAreas: false,
  photoX: 78,
  photoY: 42,
  photoScale: 44,
  showVideoExtraPhoto: false,
  videoExtraPhotoShape: "transparent_bottom_fade",
  videoExtraPhotoRenderMode: "cutout",
  videoExtraPhotoEdgeStyle: "soft_fade",
  videoExtraPhotoFrameStyle: "none",
  videoExtraPhotoX: 24,
  videoExtraPhotoY: 44,
  videoExtraPhotoScale: 28,
  nameX: 50,
  nameY: 82,
  showBottomStrip: true,
  stripHeight: 16,
  stripWidth: 100,
  stripX: 50,
  stripBottom: 0,
  showPoliticalProtocol: false,
  politicalProtocolSlots: [
    { x: 28, y: 8, scale: 85 },
    { x: 72, y: 8, scale: 85 },
  ],
  showWhatsapp: false,
  sampleName: PERSONALIZATION_SAMPLE.name,
  sampleDesignation: PERSONALIZATION_SAMPLE.designation,
};

const LAST_PHOTO_SHAPE_STORAGE_KEY = "mana-poster:last-customization-photo-shape";

function isKnownPhotoShape(value: string): value is PhotoShape {
  return PHOTO_SHAPE_GROUPS.some((group) =>
    group.options.some((option) => option.value === value),
  );
}

function readLastPhotoShape(): PhotoShape | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(LAST_PHOTO_SHAPE_STORAGE_KEY);
  return saved && isKnownPhotoShape(saved) ? saved : null;
}

function rememberPhotoShape(shape: PhotoShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_PHOTO_SHAPE_STORAGE_KEY, shape);
}

function createDefaultPersonalizationConfig(): PersonalizationConfig {
  const lastShape = readLastPhotoShape();
  return {
    ...defaultPersonalizationConfig,
    photoShape: lastShape ?? defaultPersonalizationConfig.photoShape,
    videoExtraPhotoShape:
      lastShape ?? defaultPersonalizationConfig.videoExtraPhotoShape,
    politicalProtocolSlots:
      defaultPersonalizationConfig.politicalProtocolSlots.map((slot) => ({
        ...slot,
      })),
  };
}

const PERMANENT_SAMPLE_NAME = PERSONALIZATION_SAMPLE.name;
const PERMANENT_SAMPLE_DESIGNATION = PERSONALIZATION_SAMPLE.designation;

function isJokesCategoryId(categoryId: string): boolean {
  const normalized = categoryId.trim().toLowerCase();
  return ["jokes", "funny", "humor", "comedy"].includes(normalized);
}

const REJECTION_REASON_OPTIONS: Record<DashboardRegionLanguage, string[]> = {
  assamese: [
    "আপুনি বাছনি কৰা শ্ৰেণীৰ সৈতে এই কন্টেন্ট মিল নাখায়।",
    "ইমেজৰ মান কম বা স্পষ্ট নহয়।",
    "লিখা/উক্তি অসম্পূৰ্ণ বা প্ৰকাশৰ বাবে উপযুক্ত নহয়।",
    "কপিৰাইট থকা বা তৃতীয় পক্ষৰ কন্টেন্ট অনুমোদন কৰিব নোৱাৰি।",
    "এই কন্টেন্ট ইতিমধ্যে app ত আছে।",
    "এই কন্টেন্ট community upload guidelines ৰ সৈতে মিল নাখায়।",
  ],
  bengali: [
    "নির্বাচিত ক্যাটাগরির সঙ্গে এই কনটেন্ট মেলে না।",
    "ইমেজের মান কম বা স্পষ্ট নয়।",
    "লেখা/উক্তি অসম্পূর্ণ বা প্রকাশের জন্য উপযুক্ত নয়।",
    "কপিরাইটযুক্ত বা তৃতীয় পক্ষের কনটেন্ট অনুমোদন করা যাবে না।",
    "এই কনটেন্ট ইতিমধ্যেই app-এ আছে।",
    "এই কনটেন্ট community upload guidelines মেনে নয়।",
  ],
  english: [
    "Content does not match the selected category.",
    "Image quality is low or unclear.",
    "Text/quote is incomplete or not suitable for publishing.",
    "Copyrighted or third-party content cannot be approved.",
    "Duplicate content already exists in the app.",
    "Content violates community upload guidelines.",
  ],
  gujarati: [
    "આ કન્ટેન્ટ પસંદ કરેલી કેટેગરી સાથે મેળ ખાતું નથી.",
    "ઇમેજની ગુણવત્તા ઓછી છે અથવા સ્પષ્ટ નથી.",
    "ટેક્સ્ટ/કોટ અધૂરું છે અથવા પ્રકાશન માટે યોગ્ય નથી.",
    "કૉપિરાઇટેડ અથવા તૃતીય-પક્ષ કન્ટેન્ટ મંજૂર કરી શકાતું નથી.",
    "આ કન્ટેન્ટ app માં પહેલેથી જ છે.",
    "આ કન્ટેન્ટ community upload guidelines મુજબ નથી.",
  ],
  hindi: [
    "यह content चुनी गई category से match नहीं करता.",
    "Image quality कम है या स्पष्ट नहीं है.",
    "Text/quote अधूरा है या publish करने के लिए suitable नहीं है.",
    "Copyright या third-party content approve नहीं किया जा सकता.",
    "यह content app में पहले से मौजूद है.",
    "यह content community upload guidelines के अनुसार नहीं है.",
  ],
  kannada: [
    "ಈ content ಆಯ್ಕೆ ಮಾಡಿದ category ಗೆ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.",
    "Image quality ಕಡಿಮೆ ಇದೆ ಅಥವಾ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ.",
    "Text/quote ಅಪೂರ್ಣವಾಗಿದೆ ಅಥವಾ publish ಮಾಡಲು ಸೂಕ್ತವಲ್ಲ.",
    "Copyright ಅಥವಾ third-party content approve ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    "ಈ content ಈಗಾಗಲೇ app ನಲ್ಲಿ ಇದೆ.",
    "ಈ content community upload guidelines ಗೆ ಹೊಂದಿಕೆಯಾಗುವುದಿಲ್ಲ.",
  ],
  kashmiri: [
    "یہ مواد منتخب category سے match نہیں کرتا۔",
    "Image quality کم ہے یا صاف نہیں ہے۔",
    "Text/quote مکمل نہیں ہے یا publish کرنے کے قابل نہیں ہے۔",
    "Copyright یا third-party content approve نہیں کیا جا سکتا۔",
    "یہ content app میں پہلے سے موجود ہے۔",
    "یہ content community upload guidelines کے مطابق نہیں ہے۔",
  ],
  konkani: [
    "ही content निवडिलेल्या category कडेन जुळना.",
    "Image quality कमी आसा वा साफ दिसना.",
    "Text/quote अपूर्ण आसा वा publish करपाक योग्य ना.",
    "Copyright वा third-party content approve करपाक मेळना.",
    "ही content appांत आदींच आसा.",
    "ही content community upload guidelines प्रमाणें ना.",
  ],
  ladakhi: [
    "This content does not match the selected category.",
    "Image quality is low or unclear.",
    "Text/quote is incomplete or not suitable for publishing.",
    "Copyrighted or third-party content cannot be approved.",
    "Duplicate content already exists in the app.",
    "Content violates community upload guidelines.",
  ],
  malayalam: [
    "തിരഞ്ഞെടുത്ത category-യുമായി ഈ content പൊരുത്തപ്പെടുന്നില്ല.",
    "Image quality കുറവാണ് അല്ലെങ്കിൽ വ്യക്തമായിട്ടില്ല.",
    "Text/quote പൂർണ്ണമല്ല അല്ലെങ്കിൽ publish ചെയ്യാൻ അനുയോജ്യമല്ല.",
    "Copyright ഉള്ളതോ third-party content ആയതോ approve ചെയ്യാൻ കഴിയില്ല.",
    "ഈ content app-ൽ ഇതിനകം ഉണ്ട്.",
    "ഈ content community upload guidelines പാലിക്കുന്നില്ല.",
  ],
  marathi: [
    "हे content निवडलेल्या category शी जुळत नाही.",
    "Image quality कमी आहे किंवा स्पष्ट नाही.",
    "Text/quote अपूर्ण आहे किंवा publish करण्यासाठी योग्य नाही.",
    "Copyright किंवा third-party content approve करता येणार नाही.",
    "हे content app मध्ये आधीच आहे.",
    "हे content community upload guidelines नुसार नाही.",
  ],
  meitei: [
    "This content does not match the selected category.",
    "Image quality is low or unclear.",
    "Text/quote is incomplete or not suitable for publishing.",
    "Copyrighted or third-party content cannot be approved.",
    "Duplicate content already exists in the app.",
    "Content violates community upload guidelines.",
  ],
  mizo: [
    "This content does not match the selected category.",
    "Image quality is low or unclear.",
    "Text/quote is incomplete or not suitable for publishing.",
    "Copyrighted or third-party content cannot be approved.",
    "Duplicate content already exists in the app.",
    "Content violates community upload guidelines.",
  ],
  nepali: [
    "यो content छानिएको category सँग मिल्दैन।",
    "Image quality कम छ वा स्पष्ट छैन।",
    "Text/quote अधुरो छ वा publish गर्न उपयुक्त छैन।",
    "Copyright वा third-party content approve गर्न सकिँदैन।",
    "यो content app मा पहिले नै छ।",
    "यो content community upload guidelines अनुसार छैन।",
  ],
  odia: [
    "ଏହି content ବାଛିଥିବା category ସହିତ ମେଳ ଖାଉନାହିଁ।",
    "Image quality କମ୍ କିମ୍ବା ସ୍ପଷ୍ଟ ନୁହେଁ।",
    "Text/quote ଅପୂର୍ଣ୍ଣ କିମ୍ବା publish ପାଇଁ ଉପଯୁକ୍ତ ନୁହେଁ।",
    "Copyright କିମ୍ବା third-party content approve କରିହେବ ନାହିଁ।",
    "ଏହି content app ରେ ପୂର୍ବରୁ ଅଛି।",
    "ଏହି content community upload guidelines ଅନୁସାରେ ନୁହେଁ।",
  ],
  punjabi: [
    "ਇਹ content ਚੁਣੀ category ਨਾਲ match ਨਹੀਂ ਕਰਦਾ।",
    "Image quality ਘੱਟ ਹੈ ਜਾਂ ਸਾਫ਼ ਨਹੀਂ ਹੈ।",
    "Text/quote ਅਧੂਰਾ ਹੈ ਜਾਂ publish ਕਰਨ ਲਈ suitable ਨਹੀਂ ਹੈ।",
    "Copyright ਜਾਂ third-party content approve ਨਹੀਂ ਕੀਤਾ ਜਾ ਸਕਦਾ।",
    "ਇਹ content app ਵਿੱਚ ਪਹਿਲਾਂ ਹੀ ਮੌਜੂਦ ਹੈ।",
    "ਇਹ content community upload guidelines ਦੇ ਅਨੁਸਾਰ ਨਹੀਂ ਹੈ।",
  ],
  tamil: [
    "இந்த content தேர்ந்தெடுத்த category-க்கு பொருந்தவில்லை.",
    "Image quality குறைவாக உள்ளது அல்லது தெளிவாக இல்லை.",
    "Text/quote முழுமையாக இல்லை அல்லது publish செய்ய ஏற்றதல்ல.",
    "Copyright அல்லது third-party content approve செய்ய முடியாது.",
    "இந்த content app-ல் ஏற்கனவே உள்ளது.",
    "இந்த content community upload guidelines-க்கு பொருந்தவில்லை.",
  ],
  telugu: [
    "మీరు ఎంచుకున్న కేటగిరీకి ఈ కంటెంట్ సరిపోలలేదు.",
    "ఇమేజ్ క్వాలిటీ స్పష్టంగా లేదు.",
    "Quote/text పూర్తిగా లేదు లేదా publish చేయడానికి సరిపోదు.",
    "Copyright ఉన్న content approve చేయలేము.",
    "ఇదే content ఇప్పటికే app లో ఉంది.",
    "Community upload guidelines కి ఈ content సరిపోలలేదు.",
  ],
};

function statusClass(status: string): string {
  if (status === "approved")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(epochMs: number): string {
  if (!epochMs) return "-";
  return new Date(epochMs).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sanitizeDownloadFileName(value: string): string {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "user-upload";
}

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function normalizePersonalization(
  raw?: Partial<PersonalizationConfig> | null,
): PersonalizationConfig {
  const fallback = raw
    ? defaultPersonalizationConfig
    : createDefaultPersonalizationConfig();
  const merged = {
    ...fallback,
    ...(raw ?? {}),
  };
  return {
    ...merged,
    politicalProtocolSlots: normalizePoliticalProtocolSlots(
      Array.isArray(raw?.politicalProtocolSlots)
        ? raw.politicalProtocolSlots
        : merged.politicalProtocolSlots,
    ),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function protocolSlotSidePercent(scale: number): number {
  return 15 * (clampNumber(scale, 45, 135) / 100);
}

function protocolSlotCenterPercent(value: number, sidePercent: number): number {
  const half = sidePercent / 2;
  return clampNumber(value, half, 100 - half);
}

function normalizePoliticalProtocolSlots(
  slots: PoliticalProtocolSlot[] | undefined,
): PoliticalProtocolSlot[] {
  const fallbackSlots = defaultPersonalizationConfig.politicalProtocolSlots.map(
    (slot) => ({ ...slot }),
  );
  const safeSlots = Array.from({ length: 2 }, (_, index) => {
    const fallback = fallbackSlots[index]!;
    const slot = slots?.[index] ?? fallback;
    const scale = clampNumber(Number(slot.scale ?? fallback.scale), 45, 135);
    const side = protocolSlotSidePercent(scale);
    return {
      x: protocolSlotCenterPercent(Number(slot.x ?? fallback.x), side),
      y: protocolSlotCenterPercent(Number(slot.y ?? fallback.y), side),
      scale,
    };
  });
  const first = safeSlots[0]!;
  const second = safeSlots[1]!;
  const firstSide = protocolSlotSidePercent(first.scale);
  const secondSide = protocolSlotSidePercent(second.scale);
  const minimumGap = (firstSide + secondSide) / 2 + 2;
  const deltaX = second.x - first.x;
  const deltaY = second.y - first.y;
  if (Math.hypot(deltaX, deltaY) >= minimumGap) return safeSlots;
  const averageX = (first.x + second.x) / 2;
  return [
    {
      ...first,
      x: protocolSlotCenterPercent(averageX - minimumGap / 2, firstSide),
    },
    {
      ...second,
      x: protocolSlotCenterPercent(averageX + minimumGap / 2, secondSide),
    },
  ];
}

function posterAspect(meta: ImageMeta | null): number {
  if (!meta || meta.width <= 0 || meta.height <= 0) return 1;
  return meta.width / meta.height;
}

function clampPhotoSafeArea(
  config: PersonalizationConfig,
  meta: ImageMeta | null,
): PersonalizationConfig {
  const margin = 0;
  const bleed = 0;
  const bottomBleed = config.showBottomStrip
    ? Math.max(1, Math.min(16, config.stripHeight * 0.75))
    : bleed;
  const aspect = posterAspect(meta);
  const maxScaleX = 100 - margin * 2;
  const maxScaleY = (100 - margin * 2) / aspect;
  const photoScale = clampNumber(
    config.photoScale,
    12,
    Math.max(12, Math.min(90, maxScaleX, maxScaleY)),
  );
  const videoExtraPhotoScale = clampNumber(
    config.videoExtraPhotoScale,
    12,
    Math.max(12, Math.min(90, maxScaleX, maxScaleY)),
  );
  const halfX = photoScale / 2;
  const halfY = (photoScale * aspect) / 2;
  const extraHalfX = videoExtraPhotoScale / 2;
  const extraHalfY = (videoExtraPhotoScale * aspect) / 2;
  const stripWidth = clampNumber(config.stripWidth, 35, 100);
  const stripHalfWidth = stripWidth / 2;
  return {
    ...config,
    stripHeight: clampNumber(config.stripHeight, 1, 40),
    stripWidth,
    stripX: clampNumber(config.stripX, stripHalfWidth, 100 - stripHalfWidth),
    stripBottom: clampNumber(config.stripBottom, 0, 20),
    politicalProtocolSlots: normalizePoliticalProtocolSlots(
      config.politicalProtocolSlots,
    ),
    photoScale,
    photoX: clampNumber(config.photoX, margin + halfX, 100 - margin - halfX),
    photoY: clampNumber(
      config.photoY,
      margin + halfY - bleed,
      100 - margin - halfY + bottomBleed,
    ),
    videoExtraPhotoScale,
    videoExtraPhotoX: clampNumber(
      config.videoExtraPhotoX,
      margin + extraHalfX,
      100 - margin - extraHalfX,
    ),
    videoExtraPhotoY: clampNumber(
      config.videoExtraPhotoY,
      margin + extraHalfY - bleed,
      100 - margin - extraHalfY + bottomBleed,
    ),
  };
}

function PoliticalProtocolSlotPreview({
  config,
  onStartDrag,
}: {
  config: PersonalizationConfig;
  onStartDrag?: (
    event: ReactPointerEvent<HTMLDivElement>,
    slotIndex: number,
  ) => void;
}) {
  if (!config.showPoliticalProtocol) return null;
  return (
    <>
      {config.politicalProtocolSlots.slice(0, 2).map((slot, index) => {
        const side = protocolSlotSidePercent(slot.scale);
        return (
          <div
            key={index}
            onPointerDown={(event) => onStartDrag?.(event, index)}
            className={`absolute z-[2] flex items-center justify-center rounded-full border border-white bg-emerald-500 text-sm font-bold text-white ${
              onStartDrag ? "touch-none cursor-grab select-none" : "pointer-events-none"
            }`}
            style={{
              left: `${protocolSlotCenterPercent(slot.x, side)}%`,
              top: `${protocolSlotCenterPercent(slot.y, side)}%`,
              width: `${side}%`,
              aspectRatio: "1 / 1",
              transform: "translate(-50%, -50%)",
            }}
          >
            {index + 1}
          </div>
        );
      })}
    </>
  );
}

function PreviewModal({
  row,
  onClose,
}: {
  row: UserUploadRow | null;
  onClose: () => void;
}) {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {row.userName || "User upload"}
            </h3>
            <p className="text-sm text-slate-600">
              {row.categoryLabel || row.categoryId ? (
                <CategoryLabelWithLogo
                  id={row.categoryId}
                  label={row.categoryLabel || row.categoryId}
                />
              ) : (
                "-"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Close
          </button>
        </div>
        {row.imageUrl ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={row.imageUrl}
              alt={row.categoryLabel || "User upload"}
              className="mx-auto h-auto max-h-[78vh] w-full object-contain"
            />
          </div>
        ) : null}
        {row.quoteText ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
            {row.quoteText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomizationModal({
  row,
  value,
  onChange,
  onClose,
  fileMeta,
  previewFrameRef,
  isPhotoDragging,
  isVideoExtraPhotoDragging,
  isNameDragging,
  onPhotoWheel,
  onVideoExtraPhotoWheel,
  startPhotoDrag,
  startVideoExtraPhotoDrag,
  startNameDrag,
  startStripResize,
  startPoliticalProtocolDrag,
  customizationCopy,
  selectedPhotoTarget,
  setSelectedPhotoTarget,
}: {
  row: UserUploadRow | null;
  value: PersonalizationConfig;
  onChange: (next: PersonalizationConfig) => void;
  onClose: () => void;
  fileMeta: ImageMeta | null;
  previewFrameRef: RefObject<HTMLDivElement | null>;
  isPhotoDragging: boolean;
  isVideoExtraPhotoDragging: boolean;
  isNameDragging: boolean;
  onPhotoWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onVideoExtraPhotoWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  startPhotoDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  startVideoExtraPhotoDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  startNameDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  startStripResize: (
    event: ReactPointerEvent<HTMLDivElement>,
    target: "strip-left" | "strip-right" | "strip-top",
  ) => void;
  startPoliticalProtocolDrag: (
    event: ReactPointerEvent<HTMLDivElement>,
    slotIndex: number,
  ) => void;
  selectedPhotoTarget: "photo" | "videoExtraPhoto";
  setSelectedPhotoTarget: (next: "photo" | "videoExtraPhoto") => void;
  customizationCopy: {
    customize: string;
    previewPlacement: string;
    close: string;
    photoShape: string;
    premiumShapes: string;
    transparentCutouts: string;
    photoMode: string;
    bgRemoved: string;
    originalPhoto: string;
    photoSize: string;
    dragHelp: string;
    showGradientStrip: string;
    apply: string;
    shapeLabels: Record<string, string>;
  };
}) {
  if (!row) return null;
  const isJokesCustomization = isJokesCategoryId(row.categoryId);
  const safePersonalization = clampPhotoSafeArea(value, fileMeta);
  const stripSafeZoneHeight = nameStripSafeZoneHeightPercent(value);
  const posterAspectRatio = posterAspect(fileMeta);
  const stripOverlapWarning =
    !isJokesCustomization &&
    (isPhotoInNameStripSafeZone({
      config: value,
      posterAspectRatio,
      photoY: safePersonalization.photoY,
      photoScale: safePersonalization.photoScale,
    }) ||
      (safePersonalization.showVideoExtraPhoto &&
        isPhotoInNameStripSafeZone({
          config: value,
          posterAspectRatio,
          photoY: safePersonalization.videoExtraPhotoY,
          photoScale: safePersonalization.videoExtraPhotoScale,
        })));
  return (
    <div
      data-no-auto-translate="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/82 p-2 backdrop-blur-sm sm:p-4"
    >
      <div className="mx-auto grid min-h-full max-w-7xl gap-3 py-2 sm:gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="max-h-none overflow-y-auto rounded-[22px] border border-white/10 bg-slate-950 p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.4)] sm:rounded-[28px] sm:p-5 xl:max-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                {customizationCopy.customize}
              </p>
              <h3 className="mt-2 text-lg font-bold text-white">
                {customizationCopy.previewPlacement}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/10"
            >
              {customizationCopy.close}
            </button>
          </div>

          <div className="mt-5 space-y-4 text-sm">
            {isJokesCustomization ? (
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50">
                Jokes posters are watermark-only. User photo, name, and name
                strip controls are disabled for this category.
              </div>
            ) : null}
            <div
              className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-white/6 p-4`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                Photo Controls
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Select photo slot, adjust shape and size, then drag it inside
                the preview.
              </p>

              <div className="mt-4 grid gap-3">
                <label className="flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90">
                  <span className="font-medium">Add Photo</span>
                  <span className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={value.showVideoExtraPhoto}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          showVideoExtraPhoto: event.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300" />
                    <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </span>
                </label>

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-1">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoTarget("photo")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        selectedPhotoTarget === "photo"
                          ? "bg-white text-slate-950"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      Main Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoTarget("videoExtraPhoto")}
                      disabled={!value.showVideoExtraPhoto}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                        selectedPhotoTarget === "videoExtraPhoto"
                          ? "bg-white text-slate-950"
                          : "text-white/80 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      Add Photo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <label className={`${isJokesCustomization ? "hidden " : ""}block`}>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {customizationCopy.photoShape}
              </span>
              <select
                data-no-auto-translate="true"
                value={
                  selectedPhotoTarget === "videoExtraPhoto"
                    ? value.videoExtraPhotoShape
                    : value.photoShape
                }
                onChange={(e) => {
                  const nextShape = e.target.value as PhotoShape;
                  rememberPhotoShape(nextShape);
                  onChange({
                    ...value,
                    ...(selectedPhotoTarget === "videoExtraPhoto"
                      ? { videoExtraPhotoShape: nextShape }
                      : { photoShape: nextShape }),
                  });
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
              >
                {PHOTO_SHAPE_GROUPS.map((group) => (
                  <optgroup
                    key={group.label}
                    label={
                      group.label === "Premium Shapes"
                        ? customizationCopy.premiumShapes
                        : customizationCopy.transparentCutouts
                    }
                  >
                    {group.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-white text-slate-950"
                      >
                        {customizationCopy.shapeLabels[option.value] ??
                          option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className={`${isJokesCustomization ? "hidden " : ""}block`}>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {customizationCopy.photoMode}
              </span>
              <select
                data-no-auto-translate="true"
                value={
                  selectedPhotoTarget === "videoExtraPhoto"
                    ? value.videoExtraPhotoRenderMode
                    : value.photoRenderMode
                }
                onChange={(e) =>
                  onChange({
                    ...value,
                    ...(selectedPhotoTarget === "videoExtraPhoto"
                      ? {
                          videoExtraPhotoRenderMode: e.target.value as
                            "cutout" | "original",
                        }
                      : {
                          photoRenderMode: e.target.value as
                            "cutout" | "original",
                        }),
                  })
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="cutout" className="bg-white text-slate-950">
                  {customizationCopy.bgRemoved}
                </option>
                <option value="original" className="bg-white text-slate-950">
                  {customizationCopy.originalPhoto}
                </option>
              </select>
            </label>

            {(selectedPhotoTarget === "videoExtraPhoto"
              ? value.videoExtraPhotoShape
              : value.photoShape) === "transparent_soft_round" ? (
              <label className={`${isJokesCustomization ? "hidden " : ""}block`}>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Blend / Feather
                </span>
                <select
                  data-no-auto-translate="true"
                  value={
                    selectedPhotoTarget === "videoExtraPhoto"
                      ? value.videoExtraPhotoEdgeStyle
                      : value.edgeStyle
                  }
                  onChange={(e) =>
                    onChange({
                      ...value,
                      ...(selectedPhotoTarget === "videoExtraPhoto"
                        ? {
                            videoExtraPhotoEdgeStyle: e.target
                              .value as PhotoEdgeStyle,
                          }
                        : { edgeStyle: e.target.value as PhotoEdgeStyle }),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/6 px-3 py-2.5 text-sm text-white outline-none"
                >
                  {PHOTO_EDGE_STYLE_OPTIONS.filter(
                    (option) =>
                      option.value === "bottom_fade" ||
                      option.value === "feather",
                  ).map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-white text-slate-950"
                    >
                      {option.value === "bottom_fade"
                        ? "Bottom Blend"
                        : "Feather"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className={`${isJokesCustomization ? "hidden " : ""}block`}>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {customizationCopy.photoSize} (
                {Math.round(
                  selectedPhotoTarget === "videoExtraPhoto"
                    ? safePersonalization.videoExtraPhotoScale
                    : safePersonalization.photoScale,
                )}
                %)
              </span>
              <input
                type="range"
                min={12}
                max={90}
                value={
                  selectedPhotoTarget === "videoExtraPhoto"
                    ? safePersonalization.videoExtraPhotoScale
                    : safePersonalization.photoScale
                }
                onChange={(event) =>
                  onChange(
                    clampPhotoSafeArea(
                      selectedPhotoTarget === "videoExtraPhoto"
                        ? {
                            ...value,
                            videoExtraPhotoScale: Number(event.target.value),
                          }
                        : { ...value, photoScale: Number(event.target.value) },
                      fileMeta,
                    ),
                  )
                }
                className="mt-3 w-full accent-[var(--portal-green)]"
              />
            </label>

            <div
              className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-white/6 p-3 text-xs leading-5 text-slate-300`}
            >
              {customizationCopy.dragHelp}
            </div>

            <label
              className={`${isJokesCustomization ? "hidden " : ""}flex items-center justify-between rounded-full border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-white/90`}
            >
              <span className="font-medium">
                {customizationCopy.showGradientStrip}
              </span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={value.showBottomStrip}
                  onChange={(event) =>
                    onChange(
                      clampPhotoSafeArea(
                        {
                          ...value,
                          showBottomStrip: event.target.checked,
                        },
                        fileMeta,
                      ),
                    )
                  }
                  className="peer sr-only"
                />
                <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300" />
                <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </span>
            </label>

            <div
              className={`${isJokesCustomization ? "hidden " : ""}rounded-2xl border border-white/10 bg-slate-900/50 p-4`}
            >
              <label className="flex items-center justify-between gap-3 text-sm text-white/90">
                <span className="font-medium">Political protocol photos</span>
                <span className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={value.showPoliticalProtocol}
                    onChange={(event) =>
                      onChange(
                        clampPhotoSafeArea(
                          {
                            ...value,
                            showPoliticalProtocol: event.target.checked,
                          },
                          fileMeta,
                        ),
                      )
                    }
                    className="peer sr-only"
                  />
                  <span className="h-7 w-12 rounded-full bg-white/18 transition peer-checked:bg-emerald-500/90 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300" />
                  <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                </span>
              </label>

              {value.showPoliticalProtocol ? (
                <div className="mt-4 grid gap-3">
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Protocol size (
                      {Math.round(
                        safePersonalization.politicalProtocolSlots[0]
                          ?.scale ?? 85,
                      )}
                      %)
                    </span>
                    <input
                      type="range"
                      min={45}
                      max={135}
                      value={
                        safePersonalization.politicalProtocolSlots[0]
                          ?.scale ?? 85
                      }
                      onChange={(event) => {
                        const nextScale = Number(event.target.value);
                        onChange(
                          clampPhotoSafeArea(
                            {
                              ...value,
                              politicalProtocolSlots:
                                safePersonalization.politicalProtocolSlots
                                  .slice(0, 2)
                                  .map((slot) => ({
                                    ...slot,
                                    scale: nextScale,
                                  })),
                            },
                            fileMeta,
                          ),
                        );
                      }}
                      className="mt-3 w-full accent-[var(--portal-green)]"
                    />
                  </label>
                  <p className="text-xs leading-5 text-slate-300">
                    Drag each round icon separately inside the poster safe area.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
              >
                {customizationCopy.apply}
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center p-0 sm:p-2">
          <div className="flex w-full max-w-4xl flex-col items-center gap-4">
            <div className="w-full overflow-auto p-0 sm:p-1">
              <div className="mx-auto inline-block max-w-full align-top leading-none">
                <div
                  ref={previewFrameRef}
                  className="relative overflow-visible align-top"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.imageUrl}
                    alt={row.categoryLabel || "User upload"}
                    className="block h-auto max-h-[62vh] w-auto max-w-full object-contain align-top sm:max-h-[72vh]"
                  />

                  {!isJokesCustomization ? (
                  <div
                    onPointerDown={startPhotoDrag}
                    onWheel={onPhotoWheel}
                    className={`absolute touch-none overflow-hidden ${
                      isPhotoDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{
                      left: `${safePersonalization.photoX}%`,
                      top: `${safePersonalization.photoY}%`,
                      width: `${safePersonalization.photoScale}%`,
                      zIndex: 1,
                      aspectRatio: photoShapeAspectRatio(
                        safePersonalization.photoShape,
                      ),
                      ...photoShapeFrameStyle(safePersonalization.photoShape),
                    }}
                  >
                    {renderPosterPhotoPreview({
                      shape: safePersonalization.photoShape,
                      renderMode: safePersonalization.photoRenderMode,
                      edgeStyle: safePersonalization.edgeStyle,
                      frameStyle: safePersonalization.photoFrameStyle,
                      src: PERSONALIZATION_SAMPLE.photoUrl,
                      alt: "Sample user",
                    })}
                  </div>
                  ) : null}

                  {value.showVideoExtraPhoto && !isJokesCustomization ? (
                    <div
                      onPointerDown={startVideoExtraPhotoDrag}
                      onWheel={onVideoExtraPhotoWheel}
                      className={`absolute touch-none overflow-hidden ${
                        isVideoExtraPhotoDragging
                          ? "cursor-grabbing"
                          : "cursor-grab"
                      }`}
                      style={{
                        left: `${safePersonalization.videoExtraPhotoX}%`,
                        top: `${safePersonalization.videoExtraPhotoY}%`,
                        width: `${safePersonalization.videoExtraPhotoScale}%`,
                        zIndex: 2,
                        aspectRatio: photoShapeAspectRatio(
                          safePersonalization.videoExtraPhotoShape,
                        ),
                        ...photoShapeFrameStyle(
                          safePersonalization.videoExtraPhotoShape,
                        ),
                      }}
                    >
                      {renderPosterPhotoPreview({
                        shape: safePersonalization.videoExtraPhotoShape,
                        renderMode:
                          safePersonalization.videoExtraPhotoRenderMode,
                        edgeStyle: safePersonalization.videoExtraPhotoEdgeStyle,
                        frameStyle:
                          safePersonalization.videoExtraPhotoFrameStyle,
                        src: PERSONALIZATION_SAMPLE.photoUrl,
                        alt: "Add photo sample user",
                      })}
                      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-slate-950/82 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white shadow-lg">
                        Add Photo
                      </div>
                    </div>
                  ) : null}

                  {!isJokesCustomization ? (
                    <PoliticalProtocolSlotPreview
                      config={safePersonalization}
                      onStartDrag={startPoliticalProtocolDrag}
                    />
                  ) : null}

                  {stripOverlapWarning ? (
                    <NameStripOverlapWarning
                      heightPercent={stripSafeZoneHeight}
                    />
                  ) : null}
                  {!isJokesCustomization && !value.showBottomStrip ? (
                    <div
                      onPointerDown={startNameDrag}
                      className={`absolute max-w-[92%] -translate-x-1/2 -translate-y-1/2 select-none ${
                        isNameDragging ? "cursor-grabbing" : "cursor-grab"
                      }`}
                      style={{
                        left: `${value.nameX}%`,
                        top: `${value.nameY}%`,
                        touchAction: "none",
                        zIndex: 3,
                      }}
                    >
                      <p
                        className="truncate text-center text-2xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                        style={{
                          fontFamily:
                            "'Anek Telugu Condensed Bold','Noto Sans Telugu Condensed Bold',sans-serif",
                        }}
                      >
                        {PERMANENT_SAMPLE_NAME}
                      </p>
                      <p className="mt-1 truncate text-center text-sm font-semibold leading-tight tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                        {PERMANENT_SAMPLE_DESIGNATION}
                      </p>
                    </div>
                  ) : null}
                  {!isJokesCustomization && value.showBottomStrip ? (
                    <div
                      className="absolute z-[3] touch-none"
                      style={{
                        left: `${safePersonalization.stripX}%`,
                        bottom: `${safePersonalization.stripBottom}%`,
                        width: `${safePersonalization.stripWidth}%`,
                        height: `${Math.max(0.5, safePersonalization.stripHeight * 0.5)}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <AppStyleNameStrip
                        config={value}
                        imageSeed={row.imageUrl || "user-upload-review"}
                        sampleName={PERMANENT_SAMPLE_NAME}
                        sampleDesignation={PERMANENT_SAMPLE_DESIGNATION}
                      />
                      <div
                        onPointerDown={(event) =>
                          startStripResize(event, "strip-left")
                        }
                        className="absolute -left-2 top-1/2 h-8 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/80 bg-sky-500/90 shadow-lg"
                        aria-label="Resize name strip left"
                      />
                      <div
                        onPointerDown={(event) =>
                          startStripResize(event, "strip-right")
                        }
                        className="absolute -right-2 top-1/2 h-8 w-4 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/80 bg-sky-500/90 shadow-lg"
                        aria-label="Resize name strip right"
                      />
                      <div
                        onPointerDown={(event) =>
                          startStripResize(event, "strip-top")
                        }
                        className="absolute left-1/2 top-0 h-4 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-white/80 bg-emerald-500/90 shadow-lg"
                        aria-label="Resize name strip height"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex w-full justify-end">
              <button
                onClick={onClose}
                className="rounded-2xl bg-[var(--portal-green)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--portal-green-dark)]"
              >
                {customizationCopy.apply}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function UserUploadReviewTable() {
  const { user } = useAuth();
  const { language } = useDashboardLanguage();
  const { region } = useDashboardRegion();
  const [rows, setRows] = useState<UserUploadRow[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const categoryOptionGroups = groupCategories(categoryOptions);
  const [status, setStatus] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [rejectionReasonMap, setRejectionReasonMap] = useState<
    Record<string, string>
  >({});
  const [previewRow, setPreviewRow] = useState<UserUploadRow | null>(null);
  const [customizeRow, setCustomizeRow] = useState<UserUploadRow | null>(null);
  const [personalizationMap, setPersonalizationMap] = useState<
    Record<string, PersonalizationConfig>
  >({});
  const [selectedCategoryMap, setSelectedCategoryMap] = useState<
    Record<string, string>
  >({});
  const [managerImageMap, setManagerImageMap] = useState<
    Record<string, ManagerUploadAsset>
  >({});
  const [customizeFileMeta, setCustomizeFileMeta] = useState<ImageMeta | null>(
    null,
  );
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [isVideoExtraPhotoDragging, setIsVideoExtraPhotoDragging] =
    useState(false);
  const [isNameDragging, setIsNameDragging] = useState(false);
  const [selectedPhotoTarget, setSelectedPhotoTarget] = useState<
    "photo" | "videoExtraPhoto"
  >("photo");
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    target:
      | "photo"
      | "videoExtraPhoto"
      | "name"
      | "strip-left"
      | "strip-right"
      | "strip-top"
      | "politicalProtocolSlot"
      | null;
    dragging: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    slotIndex: number;
  }>({
    target: null,
    dragging: false,
    startX: 0,
    startY: 0,
    initialX: 50,
    initialY: 45,
    initialWidth: 100,
    initialHeight: 16,
    slotIndex: -1,
  });

  const authHeader = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) throw new Error("Login required.");
    return { authorization: `Bearer ${token}` };
  }, [user]);

  const loadUploads = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const headers = await authHeader();
        const response = await fetch(
          `/api/manager/user-uploads/list?status=${encodeURIComponent(status)}&q=${encodeURIComponent(query)}&regionId=${encodeURIComponent(region.id)}`,
          { headers, cache: "no-store" },
        );
        const data = (await response.json()) as {
          ok: boolean;
          uploads?: UserUploadRow[];
          error?: string;
        };
        if (!response.ok || !data.ok || !data.uploads) {
          throw new Error(data.error ?? "Unable to load user uploads.");
        }
        const uploads = data.uploads;
        setRows(uploads);
        const visibleIds = new Set(uploads.map((item) => item.id));
        setSelectedUploadIds((prev) => {
          const next = new Set<string>();
          prev.forEach((id) => {
            if (visibleIds.has(id)) next.add(id);
          });
          return next;
        });
        setRejectionReasonMap((prev) => {
          const next: Record<string, string> = {};
          uploads.forEach((item) => {
            if (Object.prototype.hasOwnProperty.call(prev, item.id)) {
              // Keep in-progress local typing during auto-refresh.
              next[item.id] = prev[item.id] ?? "";
              return;
            }
            next[item.id] = item.rejectionReason ?? "";
          });
          return next;
        });
        setPersonalizationMap((prev) => {
          const next = { ...prev };
          uploads.forEach((item) => {
            next[item.id] = next[item.id] ?? normalizePersonalization();
          });
          return next;
        });
        setSelectedCategoryMap((prev) => {
          const next = { ...prev };
          uploads.forEach((item) => {
            next[item.id] = next[item.id] ?? item.categoryId;
          });
          return next;
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load user uploads.",
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      authHeader,
      query,
      region.id,
      setError,
      setLoading,
      setPersonalizationMap,
      setRejectionReasonMap,
      setRows,
      setSelectedCategoryMap,
      setSelectedUploadIds,
      status,
    ],
  );

  const loadCategories = useCallback(async () => {
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/categories/list?regionId=${encodeURIComponent(region.id)}`,
        { headers },
      );
      const data = (await response.json()) as {
        ok: boolean;
        categories?: CategoryOption[];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.categories) {
        throw new Error(data.error ?? "Unable to load categories.");
      }
      setCategoryOptions(data.categories.filter((item) => item.id !== "all"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load categories.",
      );
    }
  }, [authHeader, region.id]);

  useEffect(() => {
    if (!user) return;
    void loadUploads();
    void loadCategories();
  }, [user, loadUploads, loadCategories]);

  useEffect(() => {
    if (!user) return;

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadUploads({ silent: true });
    }, 10_000);

    return () => window.clearInterval(refreshInterval);
  }, [user, loadUploads]);

  useEffect(() => {
    if (!customizeRow) {
      setCustomizeFileMeta(null);
      return;
    }
    const image = new window.Image();
    image.onload = () => {
      setCustomizeFileMeta({
        width: image.naturalWidth || 1080,
        height: image.naturalHeight || 1080,
      });
    };
    image.onerror = () => {
      setCustomizeFileMeta({
        width: 1080,
        height: 1080,
      });
    };
    if (!customizeRow.imageUrl) {
      setCustomizeFileMeta(null);
      return;
    }
    image.src = customizeRow.imageUrl;
  }, [customizeRow]);

  function effectiveRow(row: UserUploadRow): UserUploadRow {
    const managerImage = managerImageMap[row.id];
    const selectedCategoryId = selectedCategoryMap[row.id] ?? row.categoryId;
    const selectedCategory = categoryOptions.find(
      (item) => item.id === selectedCategoryId,
    );
    return {
      ...row,
      imageUrl: managerImage?.imageUrl ?? row.imageUrl,
      imagePath: managerImage?.imagePath ?? row.imagePath,
      categoryId: selectedCategoryId,
      categoryLabel: selectedCategory?.label ?? row.categoryLabel,
    };
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCustomizeRow(null);
      }
    }
    if (customizeRow) {
      window.addEventListener("keydown", closeOnEscape);
    }
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [customizeRow]);

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!dragRef.current.dragging || !customizeRow) return;
      const frame = previewFrameRef.current;
      if (!frame) return;
      const bounds = frame.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const deltaXPercent =
        ((event.clientX - dragRef.current.startX) / bounds.width) * 100;
      const deltaYPercent =
        ((event.clientY - dragRef.current.startY) / bounds.height) * 100;
      const nextX = Math.max(
        0,
        Math.min(100, dragRef.current.initialX + deltaXPercent),
      );
      const nextY = Math.max(
        0,
        Math.min(100, dragRef.current.initialY + deltaYPercent),
      );
      setPersonalizationMap((prev) => {
        const current = normalizePersonalization(prev[customizeRow.id]);
        let next: PersonalizationConfig;
        if (dragRef.current.target === "photo") {
          next = clampPhotoSafeArea(
            { ...current, photoX: nextX, photoY: nextY },
            customizeFileMeta,
          );
        } else if (dragRef.current.target === "videoExtraPhoto") {
          next = clampPhotoSafeArea(
            { ...current, videoExtraPhotoX: nextX, videoExtraPhotoY: nextY },
            customizeFileMeta,
          );
        } else if (dragRef.current.target === "politicalProtocolSlot") {
          const slotIndex = dragRef.current.slotIndex;
          const slots =
            current.politicalProtocolSlots.length >= 2
              ? current.politicalProtocolSlots.slice(0, 2).map((slot) => ({
                  ...slot,
                }))
              : defaultPersonalizationConfig.politicalProtocolSlots.map(
                  (slot) => ({ ...slot }),
                );
          if (slotIndex >= 0 && slotIndex < slots.length) {
            slots[slotIndex] = {
              ...slots[slotIndex],
              x: nextX,
              y: nextY,
            };
          }
          next = clampPhotoSafeArea(
            { ...current, politicalProtocolSlots: slots },
            customizeFileMeta,
          );
        } else if (
          dragRef.current.target === "strip-left" ||
          dragRef.current.target === "strip-right"
        ) {
          const startLeft =
            dragRef.current.initialX - dragRef.current.initialWidth / 2;
          const startRight =
            dragRef.current.initialX + dragRef.current.initialWidth / 2;
          const nextLeft =
            dragRef.current.target === "strip-left"
              ? clampNumber(startLeft + deltaXPercent, 0, startRight - 35)
              : startLeft;
          const nextRight =
            dragRef.current.target === "strip-right"
              ? clampNumber(startRight + deltaXPercent, nextLeft + 35, 100)
              : startRight;
          const stripWidth = clampNumber(nextRight - nextLeft, 35, 100);
          next = clampPhotoSafeArea(
            { ...current, stripWidth, stripX: nextLeft + stripWidth / 2 },
            customizeFileMeta,
          );
        } else if (dragRef.current.target === "strip-top") {
          next = clampPhotoSafeArea(
            {
              ...current,
              stripHeight: clampNumber(
                dragRef.current.initialHeight - deltaYPercent,
                1,
                40,
              ),
            },
            customizeFileMeta,
          );
        } else {
          next = { ...current, nameX: nextX, nameY: nextY };
        }
        return {
          ...prev,
          [customizeRow.id]: next,
        };
      });
    }

    function stopDragging() {
      dragRef.current.dragging = false;
      dragRef.current.target = null;
      setIsPhotoDragging(false);
      setIsVideoExtraPhotoDragging(false);
      setIsNameDragging(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [customizeFileMeta, customizeRow]);

  useEffect(() => {
    if (!customizeRow) return;
    setPersonalizationMap((prev) => ({
      ...prev,
      [customizeRow.id]: clampPhotoSafeArea(
        normalizePersonalization(prev[customizeRow.id]),
        customizeFileMeta,
      ),
    }));
  }, [customizeFileMeta, customizeRow]);

  useEffect(() => {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    if (
      !current.showVideoExtraPhoto &&
      selectedPhotoTarget === "videoExtraPhoto"
    ) {
      setSelectedPhotoTarget("photo");
    }
  }, [customizeRow, personalizationMap, selectedPhotoTarget]);

  function startPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target: "photo",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: current.photoX,
      initialY: current.photoY,
      initialWidth: current.photoScale,
      initialHeight: current.photoScale,
      slotIndex: -1,
    };
    setIsPhotoDragging(true);
    setIsVideoExtraPhotoDragging(false);
  }

  function startVideoExtraPhotoDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setSelectedPhotoTarget("videoExtraPhoto");
    dragRef.current = {
      target: "videoExtraPhoto",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: current.videoExtraPhotoX,
      initialY: current.videoExtraPhotoY,
      initialWidth: current.videoExtraPhotoScale,
      initialHeight: current.videoExtraPhotoScale,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(true);
    setIsNameDragging(false);
  }

  function startNameDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target: "name",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: current.nameX,
      initialY: current.nameY,
      initialWidth: current.stripWidth,
      initialHeight: current.stripHeight,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(true);
  }

  function startStripResize(
    event: ReactPointerEvent<HTMLDivElement>,
    target: "strip-left" | "strip-right" | "strip-top",
  ) {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target,
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: current.stripX,
      initialY: current.nameY,
      initialWidth: current.stripWidth,
      initialHeight: current.stripHeight,
      slotIndex: -1,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(true);
  }

  function startPoliticalProtocolDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    slotIndex: number,
  ) {
    if (!customizeRow) return;
    const current = normalizePersonalization(
      personalizationMap[customizeRow.id],
    );
    const slots =
      current.politicalProtocolSlots.length >= 2
        ? current.politicalProtocolSlots.slice(0, 2)
        : defaultPersonalizationConfig.politicalProtocolSlots;
    const slot =
      slots[slotIndex] ??
      defaultPersonalizationConfig.politicalProtocolSlots[slotIndex];
    if (!slot) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      target: "politicalProtocolSlot",
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialX: slot.x,
      initialY: slot.y,
      initialWidth: slot.scale,
      initialHeight: slot.scale,
      slotIndex,
    };
    setIsPhotoDragging(false);
    setIsVideoExtraPhotoDragging(false);
    setIsNameDragging(false);
  }

  function onPhotoWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!customizeRow) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalizationMap((prev) => {
      const current = normalizePersonalization(prev[customizeRow.id]);
      return {
        ...prev,
        [customizeRow.id]: clampPhotoSafeArea(
          {
            ...current,
            photoScale: current.photoScale + direction * 2,
          },
          customizeFileMeta,
        ),
      };
    });
  }

  function onVideoExtraPhotoWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!customizeRow) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setPersonalizationMap((prev) => {
      const current = normalizePersonalization(prev[customizeRow.id]);
      return {
        ...prev,
        [customizeRow.id]: clampPhotoSafeArea(
          {
            ...current,
            videoExtraPhotoScale: current.videoExtraPhotoScale + direction * 2,
          },
          customizeFileMeta,
        ),
      };
    });
  }

  async function reviewUpload(
    uploadId: string,
    nextStatus: "approved" | "rejected" | "deleted",
  ) {
    const row = rows.find((item) => item.id === uploadId);
    const managerImage = managerImageMap[uploadId];
    const selectedCategoryId =
      selectedCategoryMap[uploadId] ?? row?.categoryId ?? "";
    const selectedCategory = categoryOptions.find(
      (item) => item.id === selectedCategoryId,
    );
    const reason = (rejectionReasonMap[uploadId] ?? "").trim();
    if (nextStatus === "rejected" && !reason) {
      setError("Rejection reason is required.");
      return;
    }
    if (
      nextStatus === "approved" &&
      !((row?.imageUrl ?? "") || managerImage?.imageUrl)
    ) {
      setError("Please pick poster image before upload.");
      return;
    }
    if (nextStatus === "approved" && !selectedCategoryId) {
      setError("Please select category before upload.");
      return;
    }
    setBusyMap((prev) => ({ ...prev, [uploadId]: true }));
    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/user-uploads/${encodeURIComponent(uploadId)}/review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify({
            status: nextStatus,
            rejectionReason: reason,
            categoryId:
              nextStatus === "approved" ? selectedCategoryId : undefined,
            categoryLabel:
              nextStatus === "approved"
                ? (selectedCategory?.label ??
                  row?.categoryLabel ??
                  selectedCategoryId)
                : undefined,
            imageUrl:
              nextStatus === "approved"
                ? (managerImage?.imageUrl ?? row?.imageUrl)
                : undefined,
            imagePath:
              nextStatus === "approved"
                ? (managerImage?.imagePath ?? row?.imagePath)
                : undefined,
            personalizationConfig:
              nextStatus === "approved"
                ? normalizePersonalization(personalizationMap[uploadId])
                : undefined,
          }),
        },
      );
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to review upload.");
      }
      if (previewRow?.id === uploadId) {
        setPreviewRow(null);
      }
      if (customizeRow?.id === uploadId) {
        setCustomizeRow(null);
      }
      setManagerImageMap((prev) => {
        const next = { ...prev };
        delete next[uploadId];
        return next;
      });
      setSelectedUploadIds((prev) => {
        const next = new Set(prev);
        next.delete(uploadId);
        return next;
      });
      setRows((prev) => prev.filter((item) => item.id !== uploadId));
      await loadUploads({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review upload.");
    } finally {
      setBusyMap((prev) => ({ ...prev, [uploadId]: false }));
    }
  }

  async function uploadManagerImage(row: UserUploadRow, file: File | null) {
    if (!file) return;
    if (!file.type.toLowerCase().startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusyMap((prev) => ({ ...prev, [row.id]: true }));
    setError(null);
    try {
      const headers = await authHeader();
      const body = new FormData();
      body.set("image", file);
      body.set("folder", `creator-posters/community_user_pending/${row.id}`);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers,
        body,
      });
      const data = (await response.json()) as {
        ok: boolean;
        imageUrl?: string;
        imagePath?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.imageUrl || !data.imagePath) {
        throw new Error(data.error ?? "Unable to upload image.");
      }
      const nextAsset = {
        imageUrl: data.imageUrl,
        imagePath: data.imagePath,
      };
      setManagerImageMap((prev) => ({
        ...prev,
        [row.id]: nextAsset,
      }));
      setCustomizeRow({ ...row, imageUrl: nextAsset.imageUrl });
      setNotice("Image added. You can customize and upload now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image.");
    } finally {
      setBusyMap((prev) => ({ ...prev, [row.id]: false }));
    }
  }

  const selectableUploadIds = rows
    .filter((row) => row.status === "approved" || row.status === "rejected")
    .map((row) => row.id);
  const selectedCount = selectedUploadIds.size;
  const allVisibleSelected =
    selectableUploadIds.length > 0 &&
    selectableUploadIds.every((id) => selectedUploadIds.has(id));

  function toggleUploadSelection(uploadId: string) {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  }

  function toggleAllVisibleUploads() {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableUploadIds.forEach((id) => next.delete(id));
      } else {
        selectableUploadIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function deleteSelectedUploads() {
    const ids = Array.from(selectedUploadIds).filter((id) =>
      selectableUploadIds.includes(id),
    );
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} selected upload(s) permanently?`,
    );
    if (!confirmed) return;
    setError(null);
    setBusyMap((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));
    try {
      const headers = await authHeader();
      for (const uploadId of ids) {
        const response = await fetch(
          `/api/manager/user-uploads/${encodeURIComponent(uploadId)}/review`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...headers,
            },
            body: JSON.stringify({ status: "deleted" }),
          },
        );
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to delete selected uploads.");
        }
      }
      if (previewRow && ids.includes(previewRow.id)) setPreviewRow(null);
      if (customizeRow && ids.includes(customizeRow.id)) setCustomizeRow(null);
      setManagerImageMap((prev) => {
        const next = { ...prev };
        ids.forEach((id) => delete next[id]);
        return next;
      });
      setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
      setSelectedUploadIds(new Set());
      setNotice(`${ids.length} upload(s) deleted.`);
      await loadUploads({ silent: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete selected uploads.",
      );
    } finally {
      setBusyMap((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
    }
  }

  async function copyQuote(row: UserUploadRow) {
    const quote = row.quoteText.trim();
    if (!quote) return;
    try {
      await navigator.clipboard.writeText(quote);
      setError(null);
      setNotice(
        "Quote copied. Create poster image and upload it in the related category.",
      );
    } catch {
      setNotice(null);
      setError("Unable to copy quote. Please select and copy manually.");
    }
  }

  async function downloadUserImage(row: UserUploadRow) {
    const imageUrl = row.imageUrl.trim();
    if (!imageUrl) {
      setNotice(null);
      setError("No user image is available for this upload.");
      return;
    }

    const fileName = `${sanitizeDownloadFileName(
      `mana-poster-user-upload-${row.id}`,
    )}.jpg`;

    setError(null);
    try {
      const headers = await authHeader();
      const response = await fetch(
        `/api/manager/user-uploads/${encodeURIComponent(row.id)}/download`,
        { headers, cache: "no-store" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Image download failed.");
      }
      const blob = await response.blob();
      const contentDisposition =
        response.headers.get("content-disposition") ?? "";
      const headerFileName =
        contentDisposition.match(/filename="([^"]+)"/)?.[1];
      const objectUrl = URL.createObjectURL(blob);
      try {
        triggerBrowserDownload(objectUrl, headerFileName ?? fileName);
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
      setNotice("User image download started.");
    } catch (err) {
      setNotice(null);
      setError(
        err instanceof Error ? err.message : "Unable to download image.",
      );
    }
  }

  const count = useMemo(() => rows.length, [rows]);
  const rejectionReasonOptions = useMemo(
    () =>
      REJECTION_REASON_OPTIONS[region.language] ??
      REJECTION_REASON_OPTIONS.english,
    [region.language],
  );
  const lang = portalLanguage(language);
  const isTelugu = language === "telugu";
  const customizationCopy = {
    customize: isTelugu ? "కస్టమైజ్" : "Customize",
    previewPlacement: isTelugu ? "ప్రివ్యూ ప్లేస్‌మెంట్" : "Preview Placement",
    close: isTelugu ? "క్లోజ్" : "Close",
    photoShape: isTelugu ? "ఫోటో షేప్" : "Photo Shape",
    premiumShapes: isTelugu ? "ప్రీమియం షేప్స్" : "Premium Shapes",
    transparentCutouts: isTelugu
      ? "ట్రాన్స్‌పరెంట్ కటౌట్స్"
      : "Transparent Cutouts",
    photoMode: isTelugu ? "ఫోటో మోడ్" : "Photo Mode",
    bgRemoved: isTelugu ? "బ్యాక్‌గ్రౌండ్ తొలగించినది" : "BG Removed",
    originalPhoto: isTelugu ? "ఒరిజినల్ ఫోటో" : "Original Photo",
    photoSize: isTelugu ? "ఫోటో సైజ్" : "Photo Size",
    dragHelp: isTelugu
      ? "ఫోటో, నేమ్‌ని డైరెక్ట్‌గా డ్రాగ్ చేయండి. ఫోటో సైజ్ మార్చడానికి మౌస్ వీల్ వాడండి."
      : "Drag the photo and name directly. Use the mouse wheel to adjust photo size.",
    showGradientStrip: isTelugu
      ? "షో గ్రాడియెంట్ స్ట్రిప్"
      : "Show gradient strip",
    apply: isTelugu ? "అప్లై" : "Apply",
    shapeLabels: {
      transparent_bottom_fade: isTelugu ? "బాటమ్ బ్లెండ్" : "Bottom Blend",
      transparent_clean: isTelugu ? "క్లీన్ కటౌట్" : "Clean Cutout",
      transparent_soft_round: isTelugu ? "సాఫ్ట్ రౌండ్" : "Soft Round",
      transparent_sharp_round: isTelugu ? "షార్ప్ రౌండ్" : "Sharp Round",
    } as Record<string, string>,
  };
  Object.assign(customizationCopy, {
    customize: t("creator.upload.customize", lang),
    previewPlacement: t("creator.upload.previewPlacement", lang),
    close: t("creator.upload.close", lang),
    photoShape: t("creator.upload.photoShape", lang),
    premiumShapes: t("creator.upload.premiumShapes", lang),
    transparentCutouts: t("creator.upload.transparentCutouts", lang),
    photoMode: t("creator.upload.photoMode", lang),
    bgRemoved: t("creator.upload.bgRemoved", lang),
    originalPhoto: t("creator.upload.originalPhoto", lang),
    photoSize: t("creator.upload.photoSize", lang),
    dragHelp: t("creator.upload.dragHelp", lang),
    showGradientStrip: t("creator.upload.showGradientStrip", lang),
    apply: t("creator.upload.apply", lang),
    shapeLabels: {
      transparent_bottom_fade: t(
        "creator.upload.shape.transparent_bottom_fade",
        lang,
      ),
      transparent_clean: t("creator.upload.shape.transparent_clean", lang),
      transparent_soft_round: t(
        "creator.upload.shape.transparent_soft_round",
        lang,
      ),
      transparent_sharp_round: t(
        "creator.upload.shape.transparent_sharp_round",
        lang,
      ),
    } as Record<string, string>,
  });

  return (
    <>
      <section className="px-1 py-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              User Uploads
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Review community submitted posters, customize them, and publish
              them with the app scheduling rules.
            </p>
          </div>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
            Current list: {count}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search user / category"
            className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-3 text-sm outline-none transition focus:border-[var(--portal-border-strong)] focus:bg-white"
          />
          <button
            onClick={() => void loadUploads()}
            className="rounded-2xl bg-[var(--portal-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--portal-purple-dark)]"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {REVIEW_TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border-[var(--portal-purple)] bg-[var(--portal-purple)] text-white"
                    : "border-[var(--portal-border)] bg-white text-slate-700 hover:bg-[var(--portal-surface-soft)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        {selectableUploadIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisibleUploads}
                className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)]"
              />
              Select visible
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">
                {selectedCount} selected
              </span>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => void deleteSelectedUploads()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete selected
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          {loading && rows.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-8 text-center text-sm text-slate-600">
              Loading user uploads...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] px-4 py-8 text-center text-sm text-slate-600">
              No uploads found for selected filters.
            </div>
          ) : (
            rows.map((row) => {
              const displayRow = effectiveRow(row);
              const hasPosterImage = Boolean(displayRow.imageUrl);
              return (
                <article
                  key={row.id}
                  className="grid gap-4 rounded-[24px] border border-[var(--portal-border)] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 lg:col-span-2">
                    <input
                      type="checkbox"
                      checked={selectedUploadIds.has(row.id)}
                      disabled={
                        busyMap[row.id] ||
                        (row.status !== "approved" && row.status !== "rejected")
                      }
                      onChange={() => toggleUploadSelection(row.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--portal-purple)] disabled:opacity-50"
                    />
                    Select upload
                  </label>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                    {displayRow.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayRow.imageUrl}
                        alt={displayRow.categoryLabel || "User upload"}
                        className="mx-auto h-auto max-h-[56vh] w-full object-contain"
                      />
                    ) : (
                      <div className="flex min-h-56 items-center justify-center rounded-lg bg-amber-50 p-4 text-center text-sm font-semibold text-amber-900">
                        Quote-only submission
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(row.createdAt)}
                      </span>
                      <span className="text-xs text-slate-400">
                        Expires: {formatDate(row.expiresAt)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {row.userName || "Unknown user"}
                      </p>
                      <p>{row.userEmail || row.userMobile || "-"}</p>
                      <p className="mt-1 inline-flex items-center gap-2">
                        <span>User selected category:</span>
                        {row.categoryLabel || row.categoryId ? (
                          <CategoryLabelWithLogo
                            id={row.categoryId}
                            label={row.categoryLabel || row.categoryId}
                          />
                        ) : (
                          "-"
                        )}
                      </p>
                      {row.status !== "approved" ? (
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Publish category
                          </span>
                          <select
                            value={
                              selectedCategoryMap[row.id] ?? row.categoryId
                            }
                            onChange={(event) =>
                              setSelectedCategoryMap((prev) => ({
                                ...prev,
                                [row.id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--portal-purple)]"
                          >
                            {categoryOptions.length === 0 ? (
                              <option value={row.categoryId}>
                                {row.categoryLabel ||
                                  row.categoryId ||
                                  "Category"}
                              </option>
                            ) : (
                              categoryOptionGroups.map((group) => (
                                <optgroup key={group.type} label={group.label}>
                                  {group.categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))
                            )}
                          </select>
                        </label>
                      ) : null}
                      {row.quoteText ? (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                            User quote
                          </p>
                          <p className="whitespace-pre-wrap text-sm font-semibold leading-6">
                            {row.quoteText}
                          </p>
                        </div>
                      ) : null}
                      {row.status === "rejected" && row.rejectionReason ? (
                        <p className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">
                          Reason: {row.rejectionReason}
                        </p>
                      ) : null}
                      {row.status === "approved" ? (
                        <p className="mt-1 text-slate-600">
                          Downloads: {row.downloadCount} | Shares:{" "}
                          {row.shareCount}
                        </p>
                      ) : null}
                    </div>

                    {row.status !== "approved" ? (
                      <div className="grid gap-2">
                        <select
                          value={
                            rejectionReasonOptions.includes(
                              rejectionReasonMap[row.id] ?? "",
                            )
                              ? (rejectionReasonMap[row.id] ?? "")
                              : ""
                          }
                          onChange={(event) => {
                            const reason = event.target.value;
                            if (!reason) return;
                            setRejectionReasonMap((prev) => ({
                              ...prev,
                              [row.id]: reason,
                            }));
                          }}
                          className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-[var(--portal-purple)]"
                        >
                          <option value="">
                            Select reject reason ({region.primaryLanguage})
                          </option>
                          {rejectionReasonOptions.map((reason) => (
                            <option key={reason} value={reason}>
                              {reason}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={rejectionReasonMap[row.id] ?? ""}
                          onChange={(e) =>
                            setRejectionReasonMap((prev) => ({
                              ...prev,
                              [row.id]: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Rejection reason (required for reject)"
                          className="w-full rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--portal-purple)]"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewRow(displayRow)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={!row.imageUrl}
                        onClick={() => void downloadUserImage(row)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Download
                      </button>
                      {row.status !== "approved" ? (
                        <>
                          <label className="cursor-pointer rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100">
                            Pick image
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              disabled={busyMap[row.id]}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                event.target.value = "";
                                void uploadManagerImage(row, file);
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={!hasPosterImage}
                            onClick={() => setCustomizeRow(displayRow)}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                          >
                            Customization
                          </button>
                          {row.quoteText ? (
                            <button
                              type="button"
                              onClick={() => void copyQuote(row)}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                            >
                              Copy quote
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busyMap[row.id] || !hasPosterImage}
                            onClick={() =>
                              void reviewUpload(row.id, "approved")
                            }
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            disabled={busyMap[row.id]}
                            onClick={() =>
                              void reviewUpload(row.id, "rejected")
                            }
                            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {row.status === "approved" ||
                      row.status === "rejected" ? (
                        <button
                          type="button"
                          disabled={busyMap[row.id]}
                          onClick={() => void reviewUpload(row.id, "deleted")}
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <PreviewModal row={previewRow} onClose={() => setPreviewRow(null)} />
      <CustomizationModal
        row={customizeRow}
        value={normalizePersonalization(
          customizeRow ? personalizationMap[customizeRow.id] : null,
        )}
        onChange={(next) => {
          if (!customizeRow) return;
          setPersonalizationMap((prev) => ({
            ...prev,
            [customizeRow.id]: normalizePersonalization(next),
          }));
        }}
        fileMeta={customizeFileMeta}
        previewFrameRef={previewFrameRef}
        isPhotoDragging={isPhotoDragging}
        isVideoExtraPhotoDragging={isVideoExtraPhotoDragging}
        isNameDragging={isNameDragging}
        onPhotoWheel={onPhotoWheel}
        onVideoExtraPhotoWheel={onVideoExtraPhotoWheel}
        startPhotoDrag={startPhotoDrag}
        startVideoExtraPhotoDrag={startVideoExtraPhotoDrag}
        startNameDrag={startNameDrag}
        startStripResize={startStripResize}
        startPoliticalProtocolDrag={startPoliticalProtocolDrag}
        selectedPhotoTarget={selectedPhotoTarget}
        setSelectedPhotoTarget={setSelectedPhotoTarget}
        customizationCopy={customizationCopy}
        onClose={() => setCustomizeRow(null)}
      />
    </>
  );
}
