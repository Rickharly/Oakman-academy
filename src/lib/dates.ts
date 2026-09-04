import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE || "Europe/London";

/** "YYYY-MM-DD" for the school day that contains `now` in the family's timezone. */
export function schoolDayKey(now: Date = new Date()): string {
  return formatInTimeZone(now, SCHOOL_TIMEZONE, "yyyy-MM-dd");
}

/** Convert a "YYYY-MM-DD" key into the UTC-midnight Date stored in `@db.Date` columns. */
export function toDateOnly(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Convert a `@db.Date` value (UTC midnight) back to its "YYYY-MM-DD" key. */
export function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC-midnight Date for today's school day. */
export function todayDateOnly(now: Date = new Date()): Date {
  return toDateOnly(schoolDayKey(now));
}

/** ISO weekday 1 (Mon) … 7 (Sun) for a date key. */
export function isoWeekday(key: string): number {
  const d = toDateOnly(key).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Add days to a date key. */
export function addDaysKey(key: string, days: number): string {
  const d = toDateOnly(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnlyKey(d);
}

/** Monday key of the ISO week containing `key`. */
export function weekStartKey(key: string): string {
  return addDaysKey(key, 1 - isoWeekday(key));
}

/** Start of the school day as an absolute instant (for filtering timestamps). */
export function schoolDayStart(key: string): Date {
  return fromZonedTime(`${key}T00:00:00`, SCHOOL_TIMEZONE);
}

export function schoolDayEnd(key: string): Date {
  return fromZonedTime(`${addDaysKey(key, 1)}T00:00:00`, SCHOOL_TIMEZONE);
}

export function zonedNow(now: Date = new Date()): Date {
  return toZonedTime(now, SCHOOL_TIMEZONE);
}
