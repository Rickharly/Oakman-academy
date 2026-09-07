/**
 * Subject colour tinting shared across the student UI. Tokens come from
 * `src/app/globals.css` (`--color-subject-*`); unknown/new subject slugs fall
 * back to the neutral accent so the UI never breaks on an unmapped subject.
 *
 * Classes are listed as full literal strings (not built with template
 * interpolation) so Tailwind's content scanner can find and generate them.
 */
export type SubjectTheme = {
  text: string;
  soft: string;
  border: string;
  stroke: string;
  bg: string;
};

const THEMES: Record<string, SubjectTheme> = {
  maths: {
    text: "text-subject-maths",
    soft: "bg-subject-maths-soft",
    border: "border-subject-maths",
    stroke: "stroke-subject-maths",
    bg: "bg-subject-maths",
  },
  english: {
    text: "text-subject-english",
    soft: "bg-subject-english-soft",
    border: "border-subject-english",
    stroke: "stroke-subject-english",
    bg: "bg-subject-english",
  },
  science: {
    text: "text-subject-science",
    soft: "bg-subject-science-soft",
    border: "border-subject-science",
    stroke: "stroke-subject-science",
    bg: "bg-subject-science",
  },
  history: {
    text: "text-subject-history",
    soft: "bg-subject-history-soft",
    border: "border-subject-history",
    stroke: "stroke-subject-history",
    bg: "bg-subject-history",
  },
  geography: {
    text: "text-subject-geography",
    soft: "bg-subject-geography-soft",
    border: "border-subject-geography",
    stroke: "stroke-subject-geography",
    bg: "bg-subject-geography",
  },
};

const FALLBACK: SubjectTheme = {
  text: "text-accent",
  soft: "bg-accent-soft",
  border: "border-accent",
  stroke: "stroke-accent",
  bg: "bg-accent",
};

/** Tailwind classes for a subject's tint. Pass `subject.slug`. */
export function subjectTheme(slug: string | null | undefined): SubjectTheme {
  if (!slug) return FALLBACK;
  return THEMES[slug] ?? FALLBACK;
}
