/** Small formatting helpers shared across student pages (server- and client-safe). */

/** "2h 45m" / "1h" / "45m" */
export function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest > 0) return `${hours}h ${rest}m`;
  if (hours > 0) return `${hours}h`;
  return `${rest}m`;
}

/** "Monday, 7 September 2026" for a "YYYY-MM-DD" date key (UTC, matches @db.Date storage). */
export function formatDateWords(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "Monday 7 September" — shorter, no year, for day drill-down headers. */
export function formatDateWordsShort(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    date
  );
}

/** "Good morning"/"afternoon"/"evening" for an hour-of-day (0–23) in the school timezone. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** First word of a display name, for a friendly greeting. */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

/** `LessonStatus` (SCREAMING_SNAKE) → the kebab-case token `Badge` expects. */
export function lessonStatusToBadge(
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_REVIEW" | "MASTERED" | "ALREADY_KNOWN"
): "not-started" | "in-progress" | "completed" | "needs-review" | "mastered" | "already-known" {
  switch (status) {
    case "NOT_STARTED":
      return "not-started";
    case "IN_PROGRESS":
      return "in-progress";
    case "COMPLETED":
      return "completed";
    case "NEEDS_REVIEW":
      return "needs-review";
    case "ALREADY_KNOWN":
      return "already-known";
    case "MASTERED":
      return "mastered";
  }
}
