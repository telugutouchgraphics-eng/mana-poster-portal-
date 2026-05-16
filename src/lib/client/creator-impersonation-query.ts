/**
 * Append `asCreator` from the current page URL to API paths so admin preview
 * uses the same creator workspace across creator dashboard APIs.
 */
export function withCreatorImpersonationQuery(
  path: string,
  searchParams: Pick<URLSearchParams, "get">,
): string {
  const asCreator = searchParams.get("asCreator")?.trim();
  if (!asCreator) {
    return path;
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}asCreator=${encodeURIComponent(asCreator)}`;
}
