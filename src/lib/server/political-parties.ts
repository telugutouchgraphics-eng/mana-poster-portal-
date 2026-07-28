import { adminDb } from "@/lib/firebase/admin";
import {
  POLITICAL_PARTY_CATEGORIES,
  PoliticalPartyCategory,
} from "@/lib/political-party-categories";
import {
  CategoryLabelsByLanguage,
  readCategoryLabelsByLanguage,
} from "@/lib/server/category-label-translations";

export const POLITICAL_PARTIES_COLLECTION = "politicalParties";

export interface ManagedPoliticalParty extends PoliticalPartyCategory {
  active: boolean;
  labelsByLanguage?: CategoryLabelsByLanguage;
  logoUrl?: string;
  logoPath?: string;
  source?: "default" | "dashboard";
  sortOrder?: number;
}

function normalizePartyId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCategoryId(partyId: string) {
  return `party_${normalizePartyId(partyId)}`;
}

function normalizeRegionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .filter((item, index, source) => source.indexOf(item) === index);
}

function fromDefaultParty(
  party: PoliticalPartyCategory,
  sortOrder: number,
): ManagedPoliticalParty {
  return {
    ...party,
    active: true,
    source: "default",
    sortOrder,
  };
}

function fromDoc(
  id: string,
  data: Record<string, unknown>,
): ManagedPoliticalParty {
  const partyId = normalizePartyId(String(data.partyId ?? id));
  const categoryId = String(
    data.id ?? data.categoryId ?? normalizeCategoryId(partyId),
  );
  return {
    id: categoryId.startsWith("party_")
      ? categoryId
      : normalizeCategoryId(partyId),
    partyId,
    label: String(data.label ?? data.name ?? partyId).trim(),
    shortName: String(data.shortName ?? partyId).trim(),
    regionIds: normalizeRegionIds(data.regionIds),
    active: data.active !== false,
    labelsByLanguage: readCategoryLabelsByLanguage(data.labelsByLanguage),
    logoUrl: String(data.logoUrl ?? "").trim() || undefined,
    logoPath: String(data.logoPath ?? "").trim() || undefined,
    source: "dashboard",
    sortOrder:
      typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder)
        ? data.sortOrder
        : undefined,
  };
}

export async function listManagedPoliticalParties(): Promise<
  ManagedPoliticalParty[]
> {
  const byPartyId = new Map<string, ManagedPoliticalParty>();
  POLITICAL_PARTY_CATEGORIES.forEach((party, index) => {
    byPartyId.set(party.partyId, fromDefaultParty(party, index));
  });

  const snapshot = await adminDb.collection(POLITICAL_PARTIES_COLLECTION).get();
  snapshot.forEach((doc) => {
    const managed = fromDoc(doc.id, doc.data());
    if (!managed.partyId || !managed.label || !managed.shortName) return;
    if (!managed.active) {
      byPartyId.delete(managed.partyId);
      return;
    }
    byPartyId.set(managed.partyId, managed);
  });

  return [...byPartyId.values()].sort((left, right) => {
    const leftOrder = left.sortOrder ?? 10000;
    const rightOrder = right.sortOrder ?? 10000;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.label.localeCompare(right.label);
  });
}

export async function politicalPartyCategoriesForRegionManaged(
  regionId?: string | null,
): Promise<ManagedPoliticalParty[]> {
  const parties = await listManagedPoliticalParties();
  return parties.filter(
    (party) =>
      party.regionIds.length === 0 || party.regionIds.includes(regionId ?? ""),
  );
}

export async function findManagedPoliticalParty(
  partyId: string,
): Promise<ManagedPoliticalParty | null> {
  const normalized = normalizePartyId(partyId);
  const parties = await listManagedPoliticalParties();
  return parties.find((party) => party.partyId === normalized) ?? null;
}

export function normalizeManagedPoliticalPartyId(value: string) {
  return normalizePartyId(value);
}
