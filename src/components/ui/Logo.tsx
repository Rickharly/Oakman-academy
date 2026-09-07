/**
 * The Oakman Academy mark: an oak sprig and acorn rising from an open book, inside a shield.
 *
 * Drawn as inline SVG rather than loaded as an image so it stays crisp at every size, needs no
 * network request, and inherits the brand tokens. Drop `public/logo.svg` in and swap this for
 * the supplied artwork if you'd rather ship the original file.
 */
type LogoProps = {
  /** Height of the mark in pixels. Width follows the aspect ratio. */
  size?: number;
  className?: string;
  title?: string;
};

const NAVY = "var(--color-brand-navy, #17304c)";
const GREEN = "var(--color-brand-green, #1b4332)";
const GOLD = "var(--color-brand-gold, #c6a253)";

export function LogoMark({ size = 32, className, title = "Oakman Academy" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 120 140"
      height={size}
      width={(size * 120) / 140}
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      {/* Shield outline */}
      <path
        d="M6 26 L60 8 L114 26 V72 C114 104 92 124 60 134 C28 124 6 104 6 72 Z"
        stroke={NAVY}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M15 32 L60 17 L105 32 V71 C105 98 87 115 60 124 C33 115 15 98 15 71 Z"
        stroke={GOLD}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* Oak leaves */}
      <g fill={GREEN}>
        <path d="M60 20c5 0 8 4 8 8 3-3 8-3 10 1 2 4 0 8-3 9 4 1 6 5 4 9-2 4-7 5-10 2 1 4-2 8-6 8h-6c-4 0-7-4-6-8-3 3-8 2-10-2-2-4 0-8 4-9-3-1-5-5-3-9 2-4 7-4 10-1 0-4 3-8 8-8z" />
        <path d="M28 52c4-2 8 0 9 4 2-3 6-4 9-1 3 3 3 7 0 9 4 0 6 4 5 8-2 4-6 5-9 3-1 4-5 6-9 4-3-2-4-6-2-9-4 1-8-2-8-6 0-4 3-7 7-7-2-3-1-7 2-9z" />
        <path d="M92 52c-4-2-8 0-9 4-2-3-6-4-9-1-3 3-3 7 0 9-4 0-6 4-5 8 2 4 6 5 9 3 1 4 5 6 9 4 3-2 4-6 2-9 4 1 8-2 8-6 0-4-3-7-7-7 2-3 1-7-2-9z" />
      </g>

      {/* Leaf veins and stem */}
      <g stroke={GOLD} strokeWidth="2.2" strokeLinecap="round">
        <path d="M60 24 V96" />
        <path d="M60 40 L52 32 M60 40 L68 32 M60 54 L50 46 M60 54 L70 46" />
        <path d="M40 56 L54 72 M44 58 L42 50 M48 63 L45 56 M52 68 L49 61" />
        <path d="M80 56 L66 72 M76 58 L78 50 M72 63 L75 56 M68 68 L71 61" />
      </g>
      <path d="M60 24 V96" stroke={GREEN} strokeWidth="4" strokeLinecap="round" opacity="0.001" />

      {/* Acorn */}
      <g>
        <path d="M60 66c6 0 10 5 10 11s-4 11-10 11-10-5-10-11 4-11 10-11z" fill={GOLD} />
        <path d="M50 71c0-4 4-7 10-7s10 3 10 7z" fill={GOLD} />
        <path d="M49 71h22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M60 62v-4" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Open book */}
      <g>
        <path
          d="M18 100c14-6 30-5 42 4-12 9-28 10-42 4z"
          fill={NAVY}
        />
        <path d="M102 100c-14-6-30-5-42 4 12 9 28 10 42 4z" fill={NAVY} />
        <path d="M14 110c16-7 34-5 46 6-12 11-30 12-46 5z" fill={NAVY} />
        <path d="M106 110c-16-7-34-5-46 6 12 11 30 12 46 5z" fill={NAVY} />
        <g stroke={GOLD} strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M24 105c11-4 24-3 34 4" />
          <path d="M96 105c-11-4-24-3-34 4" />
          <path d="M22 116c12-5 26-3 38 6" />
          <path d="M98 116c-12-5-26-3-38 6" />
        </g>
      </g>
    </svg>
  );
}

/** The mark with the wordmark beside it, for headers and the login card. */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-semibold tracking-tight text-brand-navy"
          style={{ fontSize: size * 0.55 }}
        >
          Oakman
        </span>
        <span
          className="uppercase tracking-[0.22em] text-brand-gold"
          style={{ fontSize: size * 0.26 }}
        >
          Academy
        </span>
      </span>
    </span>
  );
}
