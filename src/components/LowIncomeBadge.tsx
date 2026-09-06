import { HeartHandshake } from "lucide-react";

/**
 * Marks a student whose family is in the low-income support register, so a
 * roster or list makes them visible at a glance without opening the profile.
 */
export function LowIncomeBadge({
  note,
  compact,
}: {
  note?: string | null;
  compact?: boolean;
}) {
  const label = compact ? "Kam ta'minlangan" : "Kam ta'minlangan oila";
  return (
    <span
      title={note ? `Kam ta'minlangan oila: ${note}` : "Kam ta'minlangan oila reyestrida"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/60 bg-amber-400/15 font-bold text-amber-600 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <HeartHandshake className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  );
}
