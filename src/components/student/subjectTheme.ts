/**
 * Subject colour tinting shared across the student UI. Tokens come from
 * `src/app/globals.css` (`--color-subject-*`); unknown/new subject slugs fall
 * back to the neutral accent so the UI never breaks on an unmapped subject.
 */
const KNOWN_SUBJECT_SLUGS = ["maths", "english", "science", "history", "geography"] as const;
type KnownSubjectSlug = (typeof KNOWN_SUBJECT_SLUGS)[number];

function isKnownSubject(slug: string): slug is KnownSubjectSlug {
  return (KNOWN_SUBJECT_SLUGS as readonly string[]).includes(slug);
}

export type SubjectTheme = {
  text: string;
  soft: string;
  border: string;
  stroke: string;
};

/** Tailwind classes for a subject's tint. Pass `subject.slug`. */
export function subjectTheme(slug: string | null | undefined): SubjectTheme {
  const key = slug && isKnownSubject(slug) ? slug : null;
  if (!key) {
    return { text: "text-accent", soft: "bg-accent-soft", border: "border-accent", stroke: "stroke-accent" };
  }
  return {
    text: `text-subject-${key}`,
    soft: `bg-subject-${key}-soft`,
    border: `border-subject-${key}`,
    stroke: `stroke-subject-${key}`,
  };
}
