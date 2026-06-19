import {
  categoryIconFor,
  partyLogoPathForCategory,
  stripCategoryIcon,
} from "@/lib/category-display";

interface CategoryLabelWithLogoProps {
  id: string;
  label: string;
  className?: string;
  logoClassName?: string;
}

export function CategoryLabelWithLogo({
  id,
  label,
  className = "",
  logoClassName = "",
}: CategoryLabelWithLogoProps) {
  const logoPath = partyLogoPathForCategory(id);
  const cleanLabel = stripCategoryIcon(label);
  const fallbackIcon = logoPath ? "" : categoryIconFor(id, cleanLabel);

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`.trim()}>
      {logoPath ? (
        <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white p-0.5 ${logoClassName}`.trim()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoPath} alt="" className="h-full w-full object-contain" loading="lazy" />
        </span>
      ) : fallbackIcon ? (
        <span className="shrink-0" aria-hidden="true">{fallbackIcon}</span>
      ) : null}
      <span className="min-w-0 truncate">{cleanLabel}</span>
    </span>
  );
}
