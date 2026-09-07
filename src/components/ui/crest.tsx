/**
 * The bare crest as plain SVG elements with literal colours and no CSS variables.
 *
 * The icon routes render through Satori (`next/og`), which rasterises a limited subset of CSS
 * and cannot resolve custom properties or Tailwind classes — so the crest lives here in a form
 * both the app and the image generator can use.
 */
export const BRAND = {
  navy: "#17304c",
  green: "#1b4332",
  gold: "#c6a253",
} as const;

export function CrestSvg({ width = 120, height = 140 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 120 140" width={width} height={height} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 26 L60 8 L114 26 V72 C114 104 92 124 60 134 C28 124 6 104 6 72 Z"
        stroke={BRAND.navy}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M15 32 L60 17 L105 32 V71 C105 98 87 115 60 124 C33 115 15 98 15 71 Z"
        stroke={BRAND.gold}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M60 20c5 0 8 4 8 8 3-3 8-3 10 1 2 4 0 8-3 9 4 1 6 5 4 9-2 4-7 5-10 2 1 4-2 8-6 8h-6c-4 0-7-4-6-8-3 3-8 2-10-2-2-4 0-8 4-9-3-1-5-5-3-9 2-4 7-4 10-1 0-4 3-8 8-8z"
        fill={BRAND.green}
      />
      <path
        d="M28 52c4-2 8 0 9 4 2-3 6-4 9-1 3 3 3 7 0 9 4 0 6 4 5 8-2 4-6 5-9 3-1 4-5 6-9 4-3-2-4-6-2-9-4 1-8-2-8-6 0-4 3-7 7-7-2-3-1-7 2-9z"
        fill={BRAND.green}
      />
      <path
        d="M92 52c-4-2-8 0-9 4-2-3-6-4-9-1-3 3-3 7 0 9-4 0-6 4-5 8 2 4 6 5 9 3 1 4 5 6 9 4 3-2 4-6 2-9 4 1 8-2 8-6 0-4-3-7-7-7 2-3 1-7-2-9z"
        fill={BRAND.green}
      />
      <path d="M60 24 V96" stroke={BRAND.gold} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M40 56 L54 72" stroke={BRAND.gold} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M80 56 L66 72" stroke={BRAND.gold} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 66c6 0 10 5 10 11s-4 11-10 11-10-5-10-11 4-11 10-11z" fill={BRAND.gold} />
      <path d="M50 71c0-4 4-7 10-7s10 3 10 7z" fill={BRAND.gold} />
      <path d="M14 104c16-7 34-5 46 6-12 11-30 12-46 5z" fill={BRAND.navy} />
      <path d="M106 104c-16-7-34-5-46 6 12 11 30 12 46 5z" fill={BRAND.navy} />
    </svg>
  );
}
