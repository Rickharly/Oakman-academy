import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

/** Page-level title + optional description and trailing actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="text-sm sm:text-base text-ink-muted max-w-2xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
