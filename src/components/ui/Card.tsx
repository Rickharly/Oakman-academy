import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Adds a soft hover lift — use for cards that are clickable/linkable. */
  hover?: boolean;
  /** Padding scale. Defaults to "md". */
  padding?: "none" | "sm" | "md" | "lg";
};

const paddings: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

/** Base surface for grouped content: white card, rounded-2xl, restrained border. */
export function Card({ className, hover = false, padding = "md", ...props }: CardProps) {
  return (
    <div
      className={cn("card", paddings[padding], hover && "card-hover", className)}
      {...props}
    />
  );
}
