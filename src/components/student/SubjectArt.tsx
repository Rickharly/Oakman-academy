/**
 * A quiet illustration for each subject, used as a banner on the lesson page and on the
 * subject cards.
 *
 * Drawn rather than photographed: line art in the subject's own tint sits inside the calm
 * design instead of fighting it, carries no licensing baggage, costs no network request, and
 * stays sharp on an iPad. It is decorative — every one is `aria-hidden`, and nothing in the
 * lesson depends on seeing it.
 */
import { subjectTheme } from "./subjectTheme";

type SubjectArtProps = {
  subjectSlug: string | null | undefined;
  className?: string;
};

const STROKE = { strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Each drawing sits on a 220×80 canvas so they line up as banners. */
function Artwork({ slug }: { slug: string | undefined }) {
  switch (slug) {
    case "maths":
      return (
        <>
          {/* Circle split into quarters, a triangle, and a small grid: shape, fraction, number */}
          <circle cx="40" cy="40" r="22" fill="none" {...STROKE} />
          <path d="M40 18v44M18 40h44" fill="none" {...STROKE} />
          <path d="M40 40 L62 40 A22 22 0 0 1 40 62 Z" fillOpacity="0.18" stroke="none" />
          <path d="M100 60 L118 26 L136 60 Z" fill="none" {...STROKE} />
          <path d="M168 24h34M168 40h34M168 56h34M176 20v40M190 20v40" fill="none" {...STROKE} />
        </>
      );
    case "english":
      return (
        <>
          {/* Open book with a quill and a line of writing */}
          <path d="M22 26c14-6 30-5 40 4v34c-10-9-26-10-40-4z" fill="none" {...STROKE} />
          <path d="M102 26c-14-6-30-5-40 4v34c10-9 26-10 40-4z" fill="none" {...STROKE} />
          <path d="M32 38h20M32 48h20M72 38h20M72 48h20" fill="none" {...STROKE} opacity="0.55" />
          <path d="M150 58c6-22 20-34 38-38-4 20-16 32-38 38z" fill="none" {...STROKE} />
          <path d="M150 58l-8 8" fill="none" {...STROKE} />
          <path d="M124 66h76" fill="none" {...STROKE} opacity="0.4" />
        </>
      );
    case "science":
      return (
        <>
          {/* Conical flask with liquid, and a simple molecule */}
          <path d="M52 18h20M58 18v16L40 60a4 4 0 0 0 3 6h44a4 4 0 0 0 3-6L72 34V18" fill="none" {...STROKE} />
          <path d="M47 50h36l7 10a4 4 0 0 1-3 6H43a4 4 0 0 1-3-6z" fillOpacity="0.18" stroke="none" />
          <circle cx="140" cy="30" r="7" fill="none" {...STROKE} />
          <circle cx="176" cy="22" r="6" fill="none" {...STROKE} />
          <circle cx="168" cy="58" r="8" fill="none" {...STROKE} />
          <circle cx="130" cy="60" r="5" fill="none" {...STROKE} />
          <path d="M146 27l24-4M145 36l18 17M136 36l-3 19" fill="none" {...STROKE} opacity="0.7" />
        </>
      );
    case "history":
      return (
        <>
          {/* Classical columns and an unrolled scroll */}
          <path d="M26 24h44M30 30v34M42 30v34M54 30v34M66 30v34M22 68h52" fill="none" {...STROKE} />
          <path d="M26 24l22-8 22 8" fill="none" {...STROKE} />
          <path
            d="M112 26h72a8 8 0 0 1 0 16h-64v22a8 8 0 0 1-16 0V34a8 8 0 0 1 8-8z"
            fill="none"
            {...STROKE}
          />
          <path d="M132 50h44M132 58h32" fill="none" {...STROKE} opacity="0.5" />
        </>
      );
    case "geography":
      return (
        <>
          {/* Globe with meridians, and mountains with a river */}
          <circle cx="46" cy="40" r="24" fill="none" {...STROKE} />
          <path d="M22 40h48M46 16c9 10 9 38 0 48M46 16c-9 10-9 38 0 48" fill="none" {...STROKE} />
          <path d="M104 62l26-32 16 19 12-14 26 27z" fill="none" {...STROKE} />
          <path d="M130 30l7 9-6 7" fill="none" {...STROKE} opacity="0.6" />
          <path d="M104 62c14 6 26-6 40 0s26-6 40 0" fill="none" {...STROKE} opacity="0.5" />
        </>
      );
    default:
      return (
        <>
          {/* Neutral: an open book, matching the crest */}
          <path d="M62 26c16-7 34-6 46 5v35c-12-11-30-12-46-5z" fill="none" {...STROKE} />
          <path d="M158 26c-16-7-34-6-46 5v35c12-11 30-12 46-5z" fill="none" {...STROKE} />
          <path d="M74 40h24M74 50h24M122 40h24M122 50h24" fill="none" {...STROKE} opacity="0.5" />
        </>
      );
  }
}

/**
 * A full-width banner. Give it a height with `className` (defaults to a short strip);
 * the drawing is centred and the tint comes from the subject.
 */
export function SubjectArt({ subjectSlug, className }: SubjectArtProps) {
  const theme = subjectTheme(subjectSlug);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${theme.soft} ${className ?? "h-24"}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 220 80"
        preserveAspectRatio="xMidYMid meet"
        className={`h-full w-full ${theme.stroke}`}
        fill="currentColor"
      >
        <g className={theme.text}>
          <Artwork slug={subjectSlug ?? undefined} />
        </g>
      </svg>
    </div>
  );
}

/** The same drawing at icon size, for cards and list rows. */
export function SubjectGlyph({ subjectSlug, className }: SubjectArtProps) {
  const theme = subjectTheme(subjectSlug);
  return (
    <svg
      viewBox="0 0 220 80"
      className={`${theme.stroke} ${theme.text} ${className ?? "h-10 w-24"}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <Artwork slug={subjectSlug ?? undefined} />
    </svg>
  );
}
