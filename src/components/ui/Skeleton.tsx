import { cn } from "@/lib/cn";

export type SkeletonProps = {
  className?: string;
};

/** Loading placeholder block. Compose with width/height utility classes. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}
