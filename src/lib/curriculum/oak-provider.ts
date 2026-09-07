/**
 * `CurriculumProvider` backed by the live Oak Open API. Endpoint order and mapping follow
 * docs/ARCHITECTURE.md §9. No network access exists in this sandbox — this module is verified
 * by types plus `src/lib/oak/client.test.ts` (mocked fetch); exercise it for real with
 * `pnpm oak:sync` once `OAK_API_KEY` is set.
 */
import { createOakClient, oakGet, OakApiError, type OakClient } from "@/lib/oak/client";
import type {
  CurriculumProvider,
  ProviderAssets,
  ProviderLesson,
  ProviderProgramme,
  ProviderQuiz,
  ProviderSubject,
  ProviderTranscript,
  ProviderUnit,
  ProviderUnitRef,
} from "./provider";

export interface OakProviderOptions {
  apiKey: string;
  baseUrl?: string;
}

const KNOWN_SUBJECT_SLUGS = [
  "art",
  "citizenship",
  "computing",
  "cooking-nutrition",
  "design-technology",
  "english",
  "french",
  "geography",
  "german",
  "history",
  "maths",
  "music",
  "physical-education",
  "religious-education",
  "rshe-pshe",
  "science",
  "spanish",
] as const;
type KnownSubjectSlug = (typeof KNOWN_SUBJECT_SLUGS)[number];

function asSubjectSlug(slug: string): KnownSubjectSlug {
  // The Oak spec pins subject slugs to a closed union; we accept any string at the interface
  // boundary (subjects are configured per-family) and let the API 404 on anything invalid.
  return slug as KnownSubjectSlug;
}

async function orNullOn404<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OakApiError && err.status === 404) return null;
    throw err;
  }
}

function keyStageForYear(year: number, available: { keyStageSlug: string }[]): string {
  if (available.length === 1) return available[0]!.keyStageSlug;
  const standard = year <= 2 ? "ks1" : year <= 6 ? "ks2" : year <= 9 ? "ks3" : "ks4";
  if (available.some((k) => k.keyStageSlug === standard)) return standard;
  return available[0]?.keyStageSlug ?? standard;
}

interface RawUnitEntry {
  unitTitle: string;
  unitOrder: number;
  unitSlug?: string;
  unitOptions?: { unitTitle: string; unitSlug: string }[];
}

function toUnitRef(entry: RawUnitEntry): ProviderUnitRef | null {
  const slug = entry.unitSlug ?? entry.unitOptions?.[0]?.unitSlug;
  const title = entry.unitOptions?.[0]?.unitTitle ?? entry.unitTitle;
  if (!slug) return null;
  return { slug, title, order: entry.unitOrder };
}

/**
 * Flattens one year-entry of `GET /sequences/{sequence}/units` into a flat unit list. The
 * response is an untagged union: a plain year-group entry (`units[]`), a secondary-science
 * entry (`examSubjects[].units[]` or `examSubjects[].tiers[].units[]`), or a tiered entry
 * (`tiers[].units[]`). Unknown shapes are skipped with a warning rather than failing the sync.
 */
function flattenUnitEntries(yearEntry: unknown, warn: (msg: string) => void): RawUnitEntry[] {
  const entry = yearEntry as {
    units?: RawUnitEntry[];
    examSubjects?: { examSubjectSlug?: string; examSubjectTitle?: string; units?: RawUnitEntry[]; tiers?: { tierSlug?: string; tierTitle?: string; units?: RawUnitEntry[] }[] }[];
    tiers?: { tierSlug?: string; tierTitle?: string; units?: RawUnitEntry[] }[];
  };

  if (Array.isArray(entry.units)) return entry.units;

  if (Array.isArray(entry.examSubjects)) {
    const out: RawUnitEntry[] = [];
    for (const examSubject of entry.examSubjects) {
      if (Array.isArray(examSubject.units)) {
        out.push(...examSubject.units);
      } else if (Array.isArray(examSubject.tiers)) {
        for (const tier of examSubject.tiers) {
          if (Array.isArray(tier.units)) out.push(...tier.units);
          else warn(`unknown tier shape under examSubject ${examSubject.examSubjectSlug ?? examSubject.examSubjectTitle}`);
        }
      } else {
        warn(`unknown examSubject shape: ${examSubject.examSubjectSlug ?? examSubject.examSubjectTitle}`);
      }
    }
    return out;
  }

  if (Array.isArray(entry.tiers)) {
    const out: RawUnitEntry[] = [];
    for (const tier of entry.tiers) {
      if (Array.isArray(tier.units)) out.push(...tier.units);
      else warn(`unknown tier shape: ${tier.tierSlug ?? tier.tierTitle}`);
    }
    return out;
  }

  warn("unknown year-entry shape in /sequences/{sequence}/units response");
  return [];
}

export class OakProvider implements CurriculumProvider {
  readonly name = "oak";
  private readonly client: OakClient;

  constructor(options: OakProviderOptions) {
    this.client = createOakClient(options);
  }

  async getSubjects(): Promise<ProviderSubject[]> {
    const slugs = await oakGet(this.client, "/subjects");
    const subjects: ProviderSubject[] = [];
    for (const slug of slugs) {
      const detail = await orNullOn404(() =>
        oakGet(this.client, "/subjects/{subject}", { params: { path: { subject: slug } } }),
      );
      subjects.push({ slug, title: detail?.subjectTitle ?? slug });
    }
    return subjects;
  }

  async getProgrammes(subjectSlug: string): Promise<ProviderProgramme[]> {
    const data = await oakGet(this.client, "/subjects/{subject}", {
      params: { path: { subject: asSubjectSlug(subjectSlug) } },
    });
    const programmes: ProviderProgramme[] = [];
    for (const seq of data.sequenceSlugs) {
      for (const year of seq.years) {
        programmes.push({
          sequenceSlug: seq.sequenceSlug,
          yearGroup: year,
          keyStage: keyStageForYear(year, seq.keyStages),
          phase: seq.phaseSlug,
          title: `${data.subjectTitle} — Year ${year}`,
        });
      }
    }
    return programmes;
  }

  async getUnits(sequenceSlug: string, yearGroup: number): Promise<ProviderUnitRef[]> {
    const data = await oakGet(this.client, "/sequences/{sequence}/units", {
      params: {
        path: { sequence: sequenceSlug },
        query: { year: String(yearGroup) as never },
      },
    });
    const entries = (data ?? []) as unknown[];
    const yearEntry = entries.find((e) => String((e as { year: unknown }).year) === String(yearGroup));
    if (!yearEntry) return [];

    const warn = (msg: string) => console.warn(`[oak-provider] getUnits(${sequenceSlug}, ${yearGroup}): ${msg}`);
    const raw = flattenUnitEntries(yearEntry, warn);
    const refs: ProviderUnitRef[] = [];
    for (const entry of raw) {
      const ref = toUnitRef(entry);
      if (ref) refs.push(ref);
      else warn(`skipping unit with no resolvable slug: ${JSON.stringify(entry).slice(0, 200)}`);
    }
    return refs;
  }

  async getUnit(unitSlug: string): Promise<ProviderUnit | null> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/units/{unit}/summary", { params: { path: { unit: unitSlug } } }),
    );
    if (!data) return null;
    return {
      slug: data.unitSlug,
      title: data.unitTitle,
      // Unit summary carries no unitOrder; the caller (sync.ts) supplies the real order from
      // the getUnits() listing this slug came from.
      order: 0,
      description: data.description,
      whyThisWhyNow: data.whyThisWhyNow,
      priorKnowledge: data.priorKnowledgeRequirements ?? [],
      nationalCurriculum: data.nationalCurriculumContent ?? [],
      threads: (data.threads ?? []).map((t) => ({ slug: t.slug, title: t.title, order: t.order })),
      categories: (data.categories ?? []).map((c) => ({ categoryTitle: c.categoryTitle, categorySlug: c.categorySlug })),
      lessons: (data.unitLessons ?? []).map((l, i) => ({
        slug: l.lessonSlug,
        title: l.lessonTitle,
        order: l.lessonOrder ?? i + 1,
        state: l.state === "new" ? "new" : "published",
      })),
      raw: data,
    };
  }

  async getLesson(lessonSlug: string): Promise<ProviderLesson | null> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/lessons/{lesson}/summary", { params: { path: { lesson: lessonSlug } } }),
    );
    if (!data) return null;
    return {
      slug: lessonSlug,
      title: data.lessonTitle,
      pupilOutcome: data.pupilLessonOutcome,
      keyLearningPoints: (data.keyLearningPoints ?? []).map((k) => k.keyLearningPoint),
      keywords: (data.lessonKeywords ?? []).map((k) => ({ keyword: k.keyword, description: k.description })),
      misconceptions: (data.misconceptionsAndCommonMistakes ?? []).map((m) => ({
        misconception: m.misconception,
        response: m.response,
      })),
      teacherTips: (data.teacherTips ?? []).map((t) => t.teacherTip),
      contentGuidance: data.contentGuidance,
      supervisionLevel: data.supervisionLevel,
      canonicalUrl: data.canonicalUrl,
      providerUrl: data.oakUrl,
      downloadsAvailable: data.downloadsAvailable,
      raw: data,
    };
  }

  async getQuiz(lessonSlug: string): Promise<ProviderQuiz | null> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/lessons/{lesson}/quiz", { params: { path: { lesson: lessonSlug } } }),
    );
    if (!data) return null;
    return { starterQuiz: data.starterQuiz ?? [], exitQuiz: data.exitQuiz ?? [] };
  }

  async getTranscript(lessonSlug: string): Promise<ProviderTranscript | null> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/lessons/{lesson}/transcript", { params: { path: { lesson: lessonSlug } } }),
    );
    if (!data) return null;
    return { transcript: data.transcript, vtt: data.vtt };
  }

  async getAssets(lessonSlug: string): Promise<ProviderAssets | null> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/lessons/{lesson}/assets", { params: { path: { lesson: lessonSlug } } }),
    );
    if (!data) return null;
    return {
      assets: (data.assets ?? []).map((a) => ({ type: a.type, label: a.label, url: a.url })),
      attribution: data.attribution ?? [],
    };
  }

  async getLicences(
    keyStage: string,
    subjectSlug: string,
    unitSlug?: string,
  ): Promise<Record<string, "ogl-compatible" | "restricted">> {
    const data = await orNullOn404(() =>
      oakGet(this.client, "/key-stages/{keyStage}/subject/{subject}/check-restricted", {
        params: {
          path: { keyStage: keyStage as never, subject: asSubjectSlug(subjectSlug) },
          query: unitSlug ? { unit: unitSlug } : undefined,
        },
      }),
    );
    return data ?? {};
  }
}
