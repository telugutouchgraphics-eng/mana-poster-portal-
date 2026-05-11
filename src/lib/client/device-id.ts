const KEY = "mana_portal_device_id_v1";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }
  const existing = window.localStorage.getItem(KEY);
  if (existing) {
    return existing;
  }
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(KEY, generated);
  return generated;
}

export function withDeviceHeader(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    ...headers,
    "x-device-id": getOrCreateDeviceId(),
  };
}
