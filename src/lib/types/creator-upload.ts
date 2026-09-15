import type { CategoryType } from "@/lib/category-groups";
import type {
  PhotoEdgeStyle,
  PhotoFrameStyle,
  PhotoShape,
} from "@/lib/poster-photo-preview";
import type { VideoPhotoAnimation } from "@/lib/video-photo-animation";

export interface CreatorCategory {
  id: string;
  label: string;
  isDynamic?: boolean;
  categoryType?: CategoryType | string;
  allowPoliticalProtocol?: boolean;
  eventDateLabel?: string;
  eventStartAt?: number;
}

export interface CreatorPoster {
  id: string;
  categoryId: string;
  categoryLabel: string;
  mediaType?: string;
  imageUrl: string;
  videoUrl?: string;
  personalizationConfig?: Partial<PersonalizationConfig> | null;
  status: string;
  reviewComment?: string;
  createdAt: number;
  uploadDayKey?: string;
  requestedPublishAt?: number;
  publishAt?: number;
  performanceWindowEndAt?: number;
}

export interface PoliticalProtocolSlot {
  x: number;
  y: number;
  scale: number;
}

export interface PersonalizationConfig {
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
  photoAnimation: VideoPhotoAnimation;
  videoExtraPhotoAnimation: VideoPhotoAnimation;
  nameX: number;
  nameY: number;
  showBottomStrip: boolean;
  stripHeight: number;
  stripWidth: number;
  stripX: number;
  stripBottom: number;
  stripLayoutStyle: "full" | "split" | "badge";
  showPoliticalProtocol: boolean;
  politicalProtocolX: number;
  politicalProtocolY: number;
  politicalProtocolScale: number;
  politicalProtocolSlots: PoliticalProtocolSlot[];
  sampleName: string;
  sampleDesignation: string;
}

export interface CreatorDashboardResponse {
  ok: boolean;
  error?: string;
  previewOnly?: boolean;
  profile?: {
    creatorPublicId: string;
    name: string;
    email: string;
  } | null;
  assignedCategories?: CreatorCategory[];
  uploadWindow?: {
    isOpen: boolean;
    closesAt: number;
    opensAt: number;
    cutoffLabel: string;
    dayKey: string;
  };
  announcements?: Array<{
    id: string;
    title: string;
    message: string;
    priority: "normal" | "important" | "urgent";
    endAt: number;
  }>;
  posters?: CreatorPoster[];
}

export interface ImageMeta {
  width: number;
  height: number;
}

