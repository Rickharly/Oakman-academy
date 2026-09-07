/**
 * Turns the day's assignments into a timetable with real clock times.
 *
 * Periods run back to back from the school's start time, separated by a break. The times are
 * a guide, not a gate: nothing locks if a child starts late or takes longer, because a school
 * day that punishes a slow morning is worse than one that runs a little behind.
 */
export type TimetableEntry = {
  assignmentId: string;
  /** 1-based period number, counting only lessons (reviews sit inside the day, unnumbered). */
  period: number;
  startsAt: string; // "09:00"
  endsAt: string; // "09:45"
  minutes: number;
};

function parseTime(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 9 * 60;
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + m));
}

function formatTime(totalMinutes: number): string {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * @param items the day's assignments in order, each with its own length in minutes
 * @param startTime "HH:MM" the school day starts
 * @param breakMinutes the gap between one period ending and the next beginning
 */
export function buildTimetable(
  items: { id: string; estimatedMinutes: number; kind: string }[],
  startTime: string,
  breakMinutes: number,
): TimetableEntry[] {
  let cursor = parseTime(startTime);
  let period = 0;

  return items.map((item) => {
    const minutes = item.estimatedMinutes;
    const startsAt = cursor;
    cursor += minutes;
    const entry: TimetableEntry = {
      assignmentId: item.id,
      period: item.kind === "LESSON" ? ++period : 0,
      startsAt: formatTime(startsAt),
      endsAt: formatTime(cursor),
      minutes,
    };
    cursor += breakMinutes;
    return entry;
  });
}

/** Total teaching time, excluding breaks. */
export function teachingMinutes(items: { estimatedMinutes: number }[]): number {
  return items.reduce((n, i) => n + i.estimatedMinutes, 0);
}

/** When the last period ends, breaks included. */
export function dayEndsAt(
  items: { estimatedMinutes: number }[],
  startTime: string,
  breakMinutes: number,
): string {
  if (items.length === 0) return startTime;
  const total =
    teachingMinutes(items) + breakMinutes * Math.max(0, items.length - 1);
  return formatTime(parseTime(startTime) + total);
}
