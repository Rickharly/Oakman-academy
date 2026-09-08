import Image from "next/image";

/**
 * The Oakman Academy marks — the family's own artwork, not a redrawing of it.
 *
 * `public/logo-mark.png` is the crest alone; `public/logo-full.png` is the full lockup with
 * the wordmark. Both are transparent PNGs trimmed to their content, so a given `size` is the
 * height of the artwork itself with no invisible padding to reason about.
 *
 * `next/image` is used with explicit intrinsic dimensions so the browser reserves the right
 * space before the file loads and the header does not jump.
 */
type LogoProps = {
  /** Height of the mark in pixels. Width follows the artwork's aspect ratio. */
  size?: number;
  className?: string;
  title?: string;
};

/** Intrinsic sizes of the source files, so aspect ratios stay honest. */
const MARK = { width: 512, height: 627 };
const FULL = { width: 900, height: 749 };

/** The crest on its own — for navigation bars and anywhere tight. */
export function LogoMark({ size = 32, className, title = "Oakman Academy" }: LogoProps) {
  return (
    <Image
      src="/logo-mark.png"
      alt={title}
      width={MARK.width}
      height={MARK.height}
      className={className}
      style={{ height: size, width: "auto" }}
      // The crest is in the header of every page; loading it eagerly avoids a visible pop.
      priority
    />
  );
}

/** The full lockup, crest above the wordmark — for the login screen and letterheads. */
export function LogoLockup({ size = 96, className, title = "Oakman Academy" }: LogoProps) {
  return (
    <Image
      src="/logo-full.png"
      alt={title}
      width={FULL.width}
      height={FULL.height}
      className={className}
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}

/** The crest beside the name, for a compact horizontal lockup. */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span
        className="font-semibold tracking-tight text-brand-navy"
        style={{ fontSize: Math.round(size * 0.55) }}
      >
        Oakman Academy
      </span>
    </span>
  );
}
