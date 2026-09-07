/**
 * Curriculum provider interface (docs/CONTRACTS.md). `OakProvider` and `FixtureProvider` both
 * implement this against the same Oak response shapes, so the sync service and mapper run
 * unchanged regardless of source.
 */
import { FixtureProvider } from "./fixture-provider";
import { OakProvider } from "./oak-provider";

export interface ProviderSubject {
  slug: string;
  title: string;
}

export interface ProviderProgramme {
  sequenceSlug: string;
  yearGroup: number;
  keyStage: string;
  phase?: string;
  title: string;
}

export interface ProviderUnitRef {
  slug: string;
  title: string;
  order: number;
}

export interface ProviderUnit extends ProviderUnitRef {
  description?: string;
  whyThisWhyNow?: string;
  priorKnowledge: string[];
  nationalCurriculum: string[];
  threads: { slug: string; title: string; order: number }[];
  categories: { categoryTitle: string; categorySlug?: string }[];
  lessons: { slug: string; title: string; order: number; state: "published" | "new" }[];
  raw?: unknown;
}

export interface ProviderLesson {
  slug: string;
  title: string;
  pupilOutcome?: string;
  keyLearningPoints: string[];
  keywords: { keyword: string; description: string }[];
  misconceptions: { misconception: string; response: string }[];
  teacherTips: string[];
  contentGuidance?: unknown;
  supervisionLevel?: string | null;
  canonicalUrl?: string;
  providerUrl?: string;
  downloadsAvailable: boolean;
  raw?: unknown;
}

/** Oak quiz question shapes (see `src/lib/questions/oak-mapper.ts`). */
export interface ProviderQuiz {
  starterQuiz: unknown[];
  exitQuiz: unknown[];
}

export interface ProviderTranscript {
  transcript: string;
  vtt?: string;
}

export interface ProviderAsset {
  type:
    | "slideDeck"
    | "exitQuiz"
    | "exitQuizAnswers"
    | "starterQuiz"
    | "starterQuizAnswers"
    | "supplementaryResource"
    | "video"
    | "worksheet"
    | "worksheetAnswers";
  label: string;
  url: string;
}

export interface ProviderAssets {
  assets: ProviderAsset[];
  attribution: string[];
}

export interface CurriculumProvider {
  readonly name: string; // "oak" | "fixture"
  getSubjects(): Promise<ProviderSubject[]>;
  getProgrammes(subjectSlug: string): Promise<ProviderProgramme[]>;
  getUnits(sequenceSlug: string, yearGroup: number): Promise<ProviderUnitRef[]>;
  getUnit(unitSlug: string): Promise<ProviderUnit | null>;
  getLesson(lessonSlug: string): Promise<ProviderLesson | null>;
  getQuiz(lessonSlug: string): Promise<ProviderQuiz | null>;
  getTranscript(lessonSlug: string): Promise<ProviderTranscript | null>;
  getAssets(lessonSlug: string): Promise<ProviderAssets | null>;
  getLicences(keyStage: string, subjectSlug: string, unitSlug?: string): Promise<Record<string, "ogl-compatible" | "restricted">>;
}

let cached: CurriculumProvider | undefined;

/**
 * Resolves the active `CurriculumProvider` from `CURRICULUM_PROVIDER` ("oak" | "fixture",
 * default "fixture"). Cached per process; pass an explicit provider to sync functions to
 * bypass this (used by tests and the seed script, which always force the fixture provider).
 */
export function getCurriculumProvider(): CurriculumProvider {
  if (cached) return cached;

  const kind = (process.env.CURRICULUM_PROVIDER ?? "fixture").toLowerCase();
  if (kind === "oak") {
    const apiKey = process.env.OAK_API_KEY;
    if (!apiKey) {
      throw new Error("CURRICULUM_PROVIDER=oak requires OAK_API_KEY to be set");
    }
    cached = new OakProvider({ apiKey, baseUrl: process.env.OAK_API_URL });
    return cached;
  }

  cached = new FixtureProvider();
  return cached;
}

/** Test-only: clear the cached provider so a changed env var takes effect. */
export function resetCurriculumProviderCache(): void {
  cached = undefined;
}
