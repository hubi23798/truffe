import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type KpiDeltaDirection = "up" | "down" | "neutral";
export type KpiVariant = "default" | "hero";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: KpiDeltaDirection;
  icon?: LucideIcon;
  variant?: KpiVariant;
  className?: string;
}

function DeltaIcon({ direction }: { direction: KpiDeltaDirection }) {
  const props = { className: "h-3 w-3 shrink-0", strokeWidth: 2.2, "aria-hidden": true as const };
  if (direction === "up")   return <TrendingUp {...props} />;
  if (direction === "down") return <TrendingDown {...props} />;
  return <Minus {...props} />;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaDirection = "neutral",
  icon: Icon,
  variant = "default",
  className,
}: KpiCardProps) {
  const isHero = variant === "hero";

  /* Hero: slightly elevated with gold border accent
     Default: elevated card on dark bg */
  const card = isHero
    ? "bg-[#3A2414] border-[#C9A84C]/40"
    : "bg-[#3A2414] border-[#4A2E1A]";

  const labelColor = "text-[#C4B8A8]";
  const valueColor = isHero ? "text-[#C9A84C]" : "text-[#F7F4EE]";
  const iconBg = "bg-[rgba(201,168,76,0.12)]";
  const iconColor = "text-[#C9A84C]";

  const deltaColorMap: Record<KpiDeltaDirection, string> = {
    up:      "text-[#6BBF85]",
    down:    "text-[#E07070]",
    neutral: "text-[#C4B8A8]",
  };
  const deltaColor = deltaColorMap[deltaDirection];

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border p-5",
        "shadow-[0_1px_4px_rgba(0,0,0,0.3)]",
        card,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-xs font-semibold uppercase tracking-[0.06em]", labelColor)}>
          {label}
        </span>
        {Icon && (
          <div
            className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", iconBg)}
            aria-hidden="true"
          >
            <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={1.75} />
          </div>
        )}
      </div>

      <p className={cn("font-mono text-[26px] font-bold leading-none tracking-[-0.03em]", valueColor)}>
        {value}
      </p>

      {delta && (
        <div
          className={cn("flex items-center gap-1 text-[13px] font-semibold", deltaColor)}
          aria-label={`Change: ${delta}`}
        >
          <DeltaIcon direction={deltaDirection} />
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {children}
    </div>
  );
}
