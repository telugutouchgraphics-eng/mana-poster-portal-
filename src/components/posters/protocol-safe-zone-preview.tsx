"use client";

interface ProtocolSafeZonePreviewProps {
  visible?: boolean;
  slots?: number;
}

export function ProtocolSafeZonePreview({
  visible = true,
  slots = 6,
}: ProtocolSafeZonePreviewProps) {
  if (!visible) {
    return null;
  }
  const safeSlots = Math.max(1, Math.min(6, Math.round(slots)));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[3.5%] z-[4] flex justify-center px-[5%]">
      <div className="flex max-w-[92%] items-center justify-center gap-[1.3%] rounded-full border border-dashed border-amber-300/85 bg-amber-50/32 px-[2%] py-[1%] shadow-[0_6px_18px_rgba(15,23,42,0.12)]">
        {Array.from({ length: safeSlots }).map((_, index) => (
          <div
            key={index}
            className="aspect-square w-[11.5%] min-w-7 max-w-12 rounded-full border border-white bg-white/82 shadow-[0_2px_8px_rgba(15,23,42,0.2)]"
          />
        ))}
      </div>
    </div>
  );
}
