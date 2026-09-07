/**
 * Authoring types for the bundled curriculum. Each file in this directory exports one
 * `SubjectYearSpec`: a subject for one year group, with its units, lessons, transcripts and
 * questions. `scripts/dev/gen-fixtures.ts` turns them into the Oak-shaped JSON in
 * `fixtures/curriculum/`, which is the artefact the app actually reads.
 */

export interface McSpec {
  kind: "mc";
  question: string;
  correct: string[];
  distractors: string[];
}
export interface ShortSpec {
  kind: "short";
  question: string;
  answers: string[];
}
export interface MatchSpec {
  kind: "match";
  question: string;
  pairs: [string, string][];
}
export interface OrderSpec {
  kind: "order";
  question: string;
  items: string[];
}
export type QuizSpec = McSpec | ShortSpec | MatchSpec | OrderSpec;

export interface WorksheetQSpec {
  text: string;
  type?: "numeric" | "short" | "extended";
  answer?: string;
}

export interface LessonSpec {
  slug: string;
  title: string;
  pupilLessonOutcome: string;
  keyLearningPoints: string[];
  keywords: { keyword: string; description: string }[];
  misconceptions: { misconception: string; response: string }[];
  teacherTips: string[];
  transcript: string;
  starterQuiz: QuizSpec[];
  exitQuiz: QuizSpec[];
  worksheet: WorksheetQSpec[];
}

export interface UnitSpec {
  slug: string;
  title: string;
  description: string;
  whyThisWhyNow: string;
  priorKnowledge: string[];
  nationalCurriculum: string[];
  lessons: LessonSpec[];
}

export interface SubjectYearSpec {
  subject: { slug: string; title: string };
  programme: {
    sequenceSlug: string;
    yearGroup: number;
    keyStage: string;
    phase: string;
    title: string;
  };
  units: UnitSpec[];
}

