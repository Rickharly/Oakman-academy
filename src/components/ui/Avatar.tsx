import { cn } from "@/lib/cn";

export type AvatarProps = {
  /**
   * Either a photo (a `data:` URL or an image path) or a single emoji. Photographs of the
   * children read better than emoji once they are using this every day, but an emoji is a
   * perfectly good fallback before a photo is uploaded.
   */
  emoji: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Used as alt text when the avatar is a photo. */
  name?: string;
};

const sizes = {
  sm: "h-8 w-8 text-base",
  md: "h-10 w-10 text-lg",
  lg: "h-14 w-14 text-2xl",
  xl: "h-20 w-20 text-4xl",
};

/** True when the stored avatar is an image rather than an emoji. */
export function isPhotoAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith("data:image/") || avatar.startsWith("/") || avatar.startsWith("http");
}

/** The child's photo, or an emoji, in a soft circle. */
export function Avatar({ emoji, size = "md", className, name }: AvatarProps) {
  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft leading-none",
    sizes[size],
    className,
  );

  if (isPhotoAvatar(emoji)) {
    return (
      // A plain <img>: the source is a data URL held in the database, which next/image cannot
      // optimise, and these are already small square crops.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={emoji as string} alt={name ? `${name}` : ""} className={cn(base, "object-cover")} />
    );
  }

  return (
    <span className={base} aria-hidden="true">
      {emoji || "🙂"}
    </span>
  );
}
