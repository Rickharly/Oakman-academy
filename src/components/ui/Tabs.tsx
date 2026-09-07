"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type TabsProps = {
  items: TabItem[];
  /** Controlled value. Omit to let Tabs manage its own state (uses `defaultValue`). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

/** Simple pill tab switcher. Controlled or uncontrolled. */
export function Tabs({ items, value, defaultValue, onChange, className }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;

  function select(next: string) {
    setInternal(next);
    onChange?.(next);
  }

  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-1 rounded-full bg-stone-100 p-1", className)}
    >
      {items.map((item) => {
        const isActive = item.value === active;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={item.disabled}
            onClick={() => select(item.value)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none",
              isActive ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
