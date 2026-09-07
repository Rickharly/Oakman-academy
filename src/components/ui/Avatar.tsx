import { cn } from "@/lib/cn";

export type AvatarProps = {
  /** A single emoji (or short glyph) used as the avatar. */
  emoji: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-14 w-14 text-2xl",
};

/** Emoji avatar in a soft accent circle. */
export function Avatar({ emoji, size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft leading-none",
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
