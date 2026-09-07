import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Large, touch-friendly text input. */
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-line bg-surface-raised px-4 text-base text-ink placeholder:text-ink-faint transition-colors duration-150 outline-none",
        "focus:border-accent focus:ring-2 focus:ring-accent-soft",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}
