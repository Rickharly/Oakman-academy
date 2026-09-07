import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatProps = {
  label: string;
  value: ReactNode;
  /** Small trailing delta, e.g. "+3 this week". Colour follows `deltaTone`. */
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  className?: string;
};

const deltaTone = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-ink-muted",
};

/** Label + big value, with an optional delta line. */
export function Stat({ label, value, delta, deltaTone: tone = "neutral", className }: StatProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {delta ? <p className={cn("text-xs font-medium", deltaTone[tone])}>{delta}</p> : null}
    </div>
  );
}
