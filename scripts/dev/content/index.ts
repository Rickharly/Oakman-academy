/**
 * Every subject-year in the bundled curriculum. Add a new file in this directory and
 * register it here, then run `npx tsx scripts/dev/gen-fixtures.ts`.
 */
import type { SubjectYearSpec } from "./types";
import { mathsYear7 } from "./maths-year-7";
import { englishYear7 } from "./english-year-7";
import { scienceYear7 } from "./science-year-7";
import { historyYear7 } from "./history-year-7";
import { geographyYear7 } from "./geography-year-7";
import { mathsYear5 } from "./maths-year-5";
import { englishYear5 } from "./english-year-5";
import { scienceYear5 } from "./science-year-5";
import { historyYear5 } from "./history-year-5";
import { geographyYear5 } from "./geography-year-5";

export const SUBJECT_YEARS: SubjectYearSpec[] = [
  mathsYear7,
  englishYear7,
  scienceYear7,
  historyYear7,
  geographyYear7,
  mathsYear5,
  englishYear5,
  scienceYear5,
  historyYear5,
  geographyYear5,
];
