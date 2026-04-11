const MANAGER_ID_PREFIX = "Mana-MGR-";

function toBase36Padded(value: number): string {
  const encoded = value.toString(36).toUpperCase();
  return encoded.padStart(4, "0");
}

export function makeManagerPublicId(serial: number): string {
  return `${MANAGER_ID_PREFIX}${toBase36Padded(serial)}`;
}

