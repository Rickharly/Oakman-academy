import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ProgressRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
  /** Rendered centred inside the ring, e.g. a percentage or an icon. */
  label?: ReactNode;
};

/** Circular SVG progress indicator. */
export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 6,
  className,
  trackClassName,
  progressClassName,
  label,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={cn("stroke-stone-200", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("stroke-accent transition-[stroke-dashoffset] duration-300 ease-out", progressClassName)}
        />
      </svg>
      {label !== undefined ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-ink">
          {label}
        </span>
      ) : null}
    </span>
  );
}
