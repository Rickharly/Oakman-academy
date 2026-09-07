import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  className?: string;
};

/** Centred placeholder for empty lists / not-yet-built pages. */
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="h-6 w-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {description ? <p className="text-sm text-ink-muted max-w-sm">{description}</p> : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
