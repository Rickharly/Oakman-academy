/**
 * `CurriculumProvider` backed by `fixtures/curriculum/*.json` — one file per subject + year,
 * written in exactly the Oak response shapes so the mapper/importer in `sync.ts` runs
 * unchanged whether the source is `oak` or `fixture`. Used whenever `CURRICULUM_PROVIDER`
 * is unset/"fixture", by all tests, and by `scripts/seed.ts` (which always forces it).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CurriculumProvider,
  ProviderAsset,
  ProviderAssets,
  ProviderLesson,
  ProviderProgramme,
  ProviderQuiz,
  ProviderSubject,
  ProviderTranscript,
  ProviderUnit,
  ProviderUnitRef,
} from "./provider";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** src/lib/curriculum -> project root -> fixtures/curriculum */
const DEFAULT_FIXTURES_DIR = path.resolve(HERE, "../../../fixtures/curriculum");

// ---------- fixture file shape (docs/ARCHITECTURE.md §9) ----------

interface FixtureUnit {
  unitSlug: string;
  unitTitle: string;
  unitOrder: number;
  description?: string;
  whyThisWhyNow?: string;
  priorKnowledgeRequirements?: string[];
  nationalCurriculumContent?: string[];
  threads?: { slug: string; title: string; order: number }[];
  categories?: { categoryTitle: string; categorySlug?: string }[];
  unitLessons: { lessonSlug: string; lessonTitle: string; lessonOrder: number; state: "published" | "new" }[];
}

interface FixtureLessonSummary {
  lessonTitle: string;
  pupilLessonOutcome?: string;
  keyLearningPoints?: { keyLearningPoint: string }[];
  lessonKeywords?: { keyword: string; description: string }[];
  misconceptionsAndCommonMistakes?: { misconception: string; response: string }[];
  teacherTips?: { teacherTip: string }[];
  contentGuidance?: unknown;
  supervisionLevel?: string | null;
  canonicalUrl?: string;
  oakUrl?: string;
  downloadsAvailable?: boolean;
}

export interface FixtureWorksheetQuestion {
  number: string;
  text: string;
  type?: string;
  answer?: string;
}

interface FixtureLessonBundle {
  summary: FixtureLessonSummary;
  quiz?: { starterQuiz: unknown[]; exitQuiz: unknown[] };
  transcript?: { transcript: string; vtt?: string };
  assets?: { assets: ProviderAsset[]; attribution: string[] };
  /** Native PRACTICE questions — no PDF/AI worksheet pipeline needed for fixture content. */
  worksheet?: { questions: FixtureWorksheetQuestion[] };
}

interface FixtureFile {
  subject: { slug: string; title: string };
  programme: { sequenceSlug: string; yearGroup: number; keyStage: string; phase?: string; title: string };
  units: FixtureUnit[];
  lessons: Record<string, FixtureLessonBundle>;
  licences: Record<string, "ogl-compatible" | "restricted">;
}

function loadFixtureFiles(dir: string): FixtureFile[] {
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const out: FixtureFile[] = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      out.push(JSON.parse(fs.readFileSync(full, "utf-8")) as FixtureFile);
    } catch (err) {
      console.warn(`[fixture-provider] failed to load ${full}: ${(err as Error).message}`);
    }
  }
  return out;
}

export class FixtureProvider implements CurriculumProvider {
  readonly name = "fixture";
  private readonly files: FixtureFile[];
  private readonly unitsBySlug = new Map<string, FixtureUnit>();
  private readonly lessonsBySlug = new Map<string, FixtureLessonBundle>();

  constructor(fixturesDir: string = DEFAULT_FIXTURES_DIR) {
    this.files = loadFixtureFiles(fixturesDir);
    for (const file of this.files) {
      for (const unit of file.units) this.unitsBySlug.set(unit.unitSlug, unit);
      for (const [slug, bundle] of Object.entries(file.lessons)) this.lessonsBySlug.set(slug, bundle);
    }
  }

  async getSubjects(): Promise<ProviderSubject[]> {
    const bySlug = new Map<string, ProviderSubject>();
    for (const file of this.files) bySlug.set(file.subject.slug, file.subject);
    return [...bySlug.values()];
  }

  async getProgrammes(subjectSlug: string): Promise<ProviderProgramme[]> {
    return this.files.filter((f) => f.subject.slug === subjectSlug).map((f) => f.programme);
  }

  async getUnits(sequenceSlug: string, yearGroup: number): Promise<ProviderUnitRef[]> {
    const file = this.files.find(
      (f) => f.programme.sequenceSlug === sequenceSlug && f.programme.yearGroup === yearGroup,
    );
    if (!file) return [];
    return [...file.units]
      .sort((a, b) => a.unitOrder - b.unitOrder)
      .map((u) => ({ slug: u.unitSlug, title: u.unitTitle, order: u.unitOrder }));
  }

  async getUnit(unitSlug: string): Promise<ProviderUnit | null> {
    const unit = this.unitsBySlug.get(unitSlug);
    if (!unit) return null;
    return {
      slug: unit.unitSlug,
      title: unit.unitTitle,
      order: unit.unitOrder,
      description: unit.description,
      whyThisWhyNow: unit.whyThisWhyNow,
      priorKnowledge: unit.priorKnowledgeRequirements ?? [],
      nationalCurriculum: unit.nationalCurriculumContent ?? [],
      threads: unit.threads ?? [],
      categories: unit.categories ?? [],
      lessons: unit.unitLessons.map((l) => ({
        slug: l.lessonSlug,
        title: l.lessonTitle,
        order: l.lessonOrder,
        state: l.state,
      })),
      raw: unit,
    };
  }

  async getLesson(lessonSlug: string): Promise<ProviderLesson | null> {
    const bundle = this.lessonsBySlug.get(lessonSlug);
    if (!bundle) return null;
    const s = bundle.summary;
    return {
      slug: lessonSlug,
      title: s.lessonTitle,
      pupilOutcome: s.pupilLessonOutcome,
      keyLearningPoints: (s.keyLearningPoints ?? []).map((k) => k.keyLearningPoint),
      keywords: (s.lessonKeywords ?? []).map((k) => ({ keyword: k.keyword, description: k.description })),
      misconceptions: (s.misconceptionsAndCommonMistakes ?? []).map((m) => ({
        misconception: m.misconception,
        response: m.response,
      })),
      teacherTips: (s.teacherTips ?? []).map((t) => t.teacherTip),
      contentGuidance: s.contentGuidance,
      supervisionLevel: s.supervisionLevel ?? null,
      canonicalUrl: s.canonicalUrl,
      providerUrl: s.oakUrl,
      downloadsAvailable: s.downloadsAvailable ?? false,
      raw: s,
    };
  }

  async getQuiz(lessonSlug: string): Promise<ProviderQuiz | null> {
    const quiz = this.lessonsBySlug.get(lessonSlug)?.quiz;
    if (!quiz) return null;
    return { starterQuiz: quiz.starterQuiz ?? [], exitQuiz: quiz.exitQuiz ?? [] };
  }

  async getTranscript(lessonSlug: string): Promise<ProviderTranscript | null> {
    return this.lessonsBySlug.get(lessonSlug)?.transcript ?? null;
  }

  async getAssets(lessonSlug: string): Promise<ProviderAssets | null> {
    return this.lessonsBySlug.get(lessonSlug)?.assets ?? null;
  }

  async getLicences(
    keyStage: string,
    subjectSlug: string,
    unitSlug?: string,
  ): Promise<Record<string, "ogl-compatible" | "restricted">> {
    const file = this.files.find((f) => f.subject.slug === subjectSlug && f.programme.keyStage === keyStage);
    if (!file) return {};
    const lessonSlugs = unitSlug
      ? (file.units.find((u) => u.unitSlug === unitSlug)?.unitLessons.map((l) => l.lessonSlug) ?? [])
      : file.units.flatMap((u) => u.unitLessons.map((l) => l.lessonSlug));
    const out: Record<string, "ogl-compatible" | "restricted"> = {};
    for (const slug of lessonSlugs) out[slug] = file.licences[slug] ?? "ogl-compatible";
    return out;
  }

  /**
   * Fixture-only extension (not part of `CurriculumProvider`): native worksheet practice
   * questions authored directly in the fixture, so `sync.ts` doesn't need a PDF or an AI
   * provider to populate the PRACTICE stage. `sync.ts` feature-detects this method.
   */
  async getWorksheetQuestions(lessonSlug: string): Promise<FixtureWorksheetQuestion[] | null> {
    return this.lessonsBySlug.get(lessonSlug)?.worksheet?.questions ?? null;
  }
}
