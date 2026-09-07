import { cn } from "@/lib/cn";

export type ProgressBarProps = {
  /** 0–100 */
  value: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  size?: "sm" | "md";
};

/** Horizontal progress bar. */
export function ProgressBar({ value, className, trackClassName, barClassName, size = "md" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-stone-100", height, trackClassName, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width] duration-300 ease-out", barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
