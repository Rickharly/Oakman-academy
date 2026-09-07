import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Large, touch-friendly multi-line input. */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full min-h-[6rem] rounded-xl border border-line bg-surface-raised px-4 py-3 text-base text-ink placeholder:text-ink-faint transition-colors duration-150 outline-none resize-y",
        "focus:border-accent focus:ring-2 focus:ring-accent-soft",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}
