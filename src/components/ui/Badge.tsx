import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "needs-review"
  | "mastered"
  /** The child said they had already been taught this. A claim, not a result. */
  | "already-known";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const statusTone: Record<BadgeStatus, BadgeTone> = {
  "not-started": "neutral",
  "in-progress": "accent",
  completed: "success",
  "needs-review": "warning",
  mastered: "success",
  "already-known": "neutral",
};

const statusLabel: Record<BadgeStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  completed: "Completed",
  "needs-review": "Needs review",
  mastered: "Mastered",
  "already-known": "Already known",
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-ink-muted",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  /** A known lesson/attempt status — sets both label and tone unless overridden. */
  status?: BadgeStatus;
  /** Explicit tone; inferred from `status` when omitted. */
  tone?: BadgeTone;
};

/** Small status chip. Pass `status` for a canonical label, or `tone` + children for a custom one. */
export function Badge({ status, tone, className, children, ...props }: BadgeProps) {
  const resolvedTone = tone ?? (status ? statusTone[status] : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[resolvedTone],
        className,
      )}
      {...props}
    >
      {children ?? (status ? statusLabel[status] : null)}
    </span>
  );
}
