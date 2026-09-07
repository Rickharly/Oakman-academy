"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** "bottom" (default, mobile-style sheet) or "right" (desktop side panel). */
  side?: "bottom" | "right";
  title?: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Bottom sheet on mobile, side panel on desktop. Controlled — render it always and
 * toggle `open`; it handles its own backdrop, escape-to-close, and scroll lock.
 */
export function Sheet({ open, onClose, side = "bottom", title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelPosition =
    side === "right"
      ? "inset-y-0 right-0 h-full w-full max-w-md rounded-l-3xl"
      : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl pb-safe-nav";

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-[1px] transition-opacity duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute flex flex-col bg-surface-raised border border-line shadow-xl",
          panelPosition,
          className,
        )}
      >
        {side === "bottom" ? (
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-10 rounded-full bg-stone-200" />
          </div>
        ) : null}
        {title ? (
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-stone-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
