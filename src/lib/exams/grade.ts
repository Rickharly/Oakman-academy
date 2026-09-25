/**
 * A percentage, said the way a North American school says it.
 *
 * "68%" means little to a nine year old and less to a parent comparing a homeschool record
 * against the school their children will walk into next year. A letter is read at a glance and
 * it is the language the receiving system already speaks.
 *
 * The scale is the ordinary one used across the US and most of Canada. It sits beside the
 * percentage rather than replacing it: the number is the measurement, the letter is the
 * translation, and a record that shows only the letter has thrown away what it measured.
 */
export interface LetterGrade {
  letter: string;
  /** What it means, in a few words a child can read without flinching. */
  meaning: string;
}

const SCALE: { min: number; letter: string; meaning: string }[] = [
  { min: 97, letter: "A+", meaning: "Just about perfect." },
  { min: 93, letter: "A", meaning: "Excellent — you know this." },
  { min: 90, letter: "A-", meaning: "Excellent, with one or two slips." },
  { min: 87, letter: "B+", meaning: "Strong. A couple of things to tidy up." },
  { min: 83, letter: "B", meaning: "Good. You have the idea." },
  { min: 80, letter: "B-", meaning: "Good, with some gaps worth closing." },
  { min: 77, letter: "C+", meaning: "Fair. Parts of this need another go." },
  { min: 73, letter: "C", meaning: "Fair. Several things to go back over." },
  { min: 70, letter: "C-", meaning: "Scraping through — let's go back over it properly." },
  { min: 67, letter: "D+", meaning: "This one didn't land. We'll reteach it." },
  { min: 63, letter: "D", meaning: "This one didn't land. We'll reteach it." },
  { min: 60, letter: "D-", meaning: "This one didn't land. We'll reteach it." },
  { min: 0, letter: "F", meaning: "Not yet — and that's what next week is for." },
];

export function letterGrade(percentage: number): LetterGrade {
  const clamped = Math.max(0, Math.min(100, percentage));
  const band = SCALE.find((b) => clamped >= b.min) ?? SCALE[SCALE.length - 1];
  return { letter: band.letter, meaning: band.meaning };
}
