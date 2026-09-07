/**
 * Every subject-year in the bundled curriculum. Add a new file in this directory and
 * register it here, then run `npx tsx scripts/dev/gen-fixtures.ts`.
 */
import type { SubjectYearSpec } from "./types";
import { mathsYear7 } from "./maths-year-7";
import { englishYear7 } from "./english-year-7";

export const SUBJECT_YEARS: SubjectYearSpec[] = [mathsYear7, englishYear7];
