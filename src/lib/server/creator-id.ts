const CREATOR_ID_PREFIX = "Mana-";

function toBase36Padded(value: number): string {
  const encoded = value.toString(36).toUpperCase();
  return encoded.padStart(6, "0");
}

export function makeCreatorPublicId(serial: number): string {
  return `${CREATOR_ID_PREFIX}${toBase36Padded(serial)}`;
}
