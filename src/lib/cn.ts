/** Tiny classnames joiner. Falsy values are dropped; no dedupe/merge logic. */
export type ClassValue = string | number | null | false | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((v) => v !== null && v !== undefined && v !== false && v !== "").join(" ");
}
