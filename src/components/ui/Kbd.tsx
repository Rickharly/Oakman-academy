import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type KbdProps = {
  children: ReactNode;
  className?: string;
};

/** Small keyboard-shortcut chip. */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-line bg-stone-50 px-1.5 py-0.5 text-xs font-medium text-ink-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
