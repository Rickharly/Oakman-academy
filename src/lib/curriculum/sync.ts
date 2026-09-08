/**
 * Curriculum sync (ARCHITECTURE §9). The ONLY module permitted to write curriculum tables
 * (Subject, Programme, Unit, Lesson, LessonResource, Question) — see CLAUDE.md rule 1.
 *
 * Everything here is idempotent and additive: rows are upserted by their provider identity,
 * nothing is ever deleted, and a lesson that loses a field upstream keeps what it already had.
 * Student learning data is never touched.
 */
import fs from "node:fs/promises";
import { OakRateLimitError } from "@/lib/oak/client";
import path from "node:path";
import { prisma } from "@/lib/db";
import type { Prisma, ResourceType, LicenceStatus } from "@/generated/prisma/client";
import { mapOakQuizQuestion, mapWorksheetQuestion, type MappedQuestion } from "@/lib/questions/oak-mapper";
import { FixtureProvider } from "./fixture-provider";
import { getCurriculumProvider, type CurriculumProvider, type ProviderAsset } from "./provider";

export interface SyncScope {
  subjectSlug: string;
  yearGroup: number;
  lessonSlugs?: string[];
  includeAssets?: boolean;
}

export interface SyncStats extends Record<string, number> {
  units: number;
  lessons: number;
  questions: number;
  resources: number;
  skipped: number;
  failed: number;
}

export interface SyncResult {
  jobId: string;
  programmeId: string;
  stats: SyncStats;
}

interface SyncOptions {
  provider?: CurriculumProvider;
  log?: (line: string) => void;
}

/** Oak asset type → our ResourceType. Unknown types are ignored rather than failing the sync. */
const RESOURCE_TYPE_BY_ASSET: Record<ProviderAsset["type"], ResourceType> = {
  video: "VIDEO",
  slideDeck: "SLIDE_DECK",
  worksheet: "WORKSHEET",
  worksheetAnswers: "WORKSHEET_ANSWERS",
  starterQuiz: "STARTER_QUIZ",
  starterQuizAnswers: "STARTER_QUIZ_ANSWERS",
  exitQuiz: "EXIT_QUIZ",
  exitQuizAnswers: "EXIT_QUIZ_ANSWERS",
  supplementaryResource: "SUPPLEMENTARY",
};

const SUBJECT_ICONS: Record<string, string> = {
  maths: "Sigma",
  english: "BookOpen",
  science: "FlaskConical",
  history: "Landmark",
  geography: "Globe2",
};

/**
 * Estimated lesson length in minutes (ARCHITECTURE §9): a 45-minute base, plus time for a
 * video to watch and a worksheet to work through. Kept deliberately coarse — the scheduler
 * only needs it to keep a day inside the family's target, not to be exact.
 */
function estimateMinutes(hasVideo: boolean, hasWorksheet: boolean): number {
  return 45 + (hasVideo ? 5 : 0) + (hasWorksheet ? 10 : 0);
}

function toLicence(value: "ogl-compatible" | "restricted" | undefined): LicenceStatus {
  if (value === "ogl-compatible") return "OGL_COMPATIBLE";
  if (value === "restricted") return "RESTRICTED";
  return "UNKNOWN";
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Downloads one asset into ASSET_STORAGE_DIR. Best-effort: a failure never fails the sync. */
async function downloadAsset(
  lessonSlug: string,
  asset: ProviderAsset,
  log: (line: string) => void,
): Promise<string | null> {
  if (!/^https?:/i.test(asset.url)) return null;
  const baseDir = process.env.ASSET_STORAGE_DIR || "./storage/assets";
  const dir = path.resolve(baseDir, lessonSlug);
  try {
    const res = await fetch(asset.url);
    if (!res.ok) {
      log(`  asset ${asset.type}: HTTP ${res.status}, keeping the provider URL`);
      return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const ext = contentType.includes("pdf")
      ? "pdf"
      : contentType.includes("presentation")
        ? "pptx"
        : contentType.includes("mp4")
          ? "mp4"
          : "bin";
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(/* turbopackIgnore: true */ dir, `${asset.type}.${ext}`);
    await fs.writeFile(filePath, Buffer.from(await res.arrayBuffer()));
    return filePath;
  } catch (err) {
    log(`  asset ${asset.type}: download failed (${(err as Error).message}), keeping the provider URL`);
    return null;
  }
}

/** Upserts the mapped questions for one lesson. Existing rows are updated in place by providerRef. */
async function upsertQuestions(lessonId: string, mapped: MappedQuestion[], sourceOf: (m: MappedQuestion) => string) {
  let count = 0;
  for (const q of mapped) {
    const source = sourceOf(q) as Prisma.QuestionCreateInput["source"];
    const data = {
      stage: q.stage,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      promptImage: (q.promptImage ?? null) as Prisma.InputJsonValue,
      options: (q.options ?? null) as Prisma.InputJsonValue,
      answerKey: q.answerKey as Prisma.InputJsonValue,
      explanation: q.explanation ?? null,
      maxScore: q.maxScore,
      gradingMode: q.gradingMode,
    };
    await prisma.question.upsert({
      where: { lessonId_source_providerRef: { lessonId, source, providerRef: q.providerRef } },
      create: { lessonId, source, providerRef: q.providerRef, ...data },
      update: data,
    });
    count += 1;
  }
  return count;
}

/**
 * Imports one subject-year programme from the active provider.
 *
 * Records a `CurriculumSyncJob` throughout so the admin Curriculum page can show progress and,
 * on failure, exactly which lesson broke and why. Individual lesson failures are counted and
 * logged rather than aborting the run: a single bad lesson upstream must not cost the family
 * the rest of the subject.
 */
export async function syncProgramme(scope: SyncScope, opts: SyncOptions = {}): Promise<SyncResult> {
  const provider = opts.provider ?? getCurriculumProvider();
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    opts.log?.(line);
  };

  const stats: SyncStats = { units: 0, lessons: 0, questions: 0, resources: 0, skipped: 0, failed: 0 };

  const job = await prisma.curriculumSyncJob.create({
    data: {
      provider: provider.name,
      scope: scope as unknown as Prisma.InputJsonValue,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  try {
    log(`Syncing ${scope.subjectSlug} year ${scope.yearGroup} from ${provider.name}`);

    const programmes = await provider.getProgrammes(scope.subjectSlug);
    const programmeSpec = programmes.find((p) => p.yearGroup === scope.yearGroup);
    if (!programmeSpec) {
      throw new Error(`No programme for ${scope.subjectSlug} year ${scope.yearGroup} from ${provider.name}`);
    }

    const subjects = await provider.getSubjects();
    const subjectSpec = subjects.find((s) => s.slug === scope.subjectSlug) ?? {
      slug: scope.subjectSlug,
      title: titleCase(scope.subjectSlug),
    };

    const subject = await prisma.subject.upsert({
      where: { provider_slug: { provider: provider.name, slug: subjectSpec.slug } },
      create: {
        provider: provider.name,
        slug: subjectSpec.slug,
        title: subjectSpec.title,
        icon: SUBJECT_ICONS[subjectSpec.slug] ?? null,
      },
      update: { title: subjectSpec.title },
    });

    const providerSlug = `${programmeSpec.sequenceSlug}:${programmeSpec.yearGroup}`;
    const programme = await prisma.programme.upsert({
      where: { provider_providerSlug: { provider: provider.name, providerSlug } },
      create: {
        provider: provider.name,
        providerSlug,
        sequenceSlug: programmeSpec.sequenceSlug,
        subjectId: subject.id,
        yearGroup: programmeSpec.yearGroup,
        keyStage: programmeSpec.keyStage,
        phase: programmeSpec.phase ?? null,
        title: programmeSpec.title,
        syncedAt: new Date(),
      },
      update: { title: programmeSpec.title, keyStage: programmeSpec.keyStage, syncedAt: new Date() },
    });

    const licences = await provider
      .getLicences(programmeSpec.keyStage, subjectSpec.slug)
      .catch((err: Error) => {
        log(`Licence check unavailable (${err.message}); lessons will be marked UNKNOWN`);
        return {} as Record<string, "ogl-compatible" | "restricted">;
      });

    const unitRefs = await provider.getUnits(programmeSpec.sequenceSlug, programmeSpec.yearGroup);
    log(`${unitRefs.length} units`);

    for (const unitRef of unitRefs) {
      const unitDetail = await provider.getUnit(unitRef.slug);
      if (!unitDetail) {
        log(`Unit ${unitRef.slug}: no summary available, skipped`);
        stats.skipped += 1;
        continue;
      }

      const unit = await prisma.unit.upsert({
        where: { programmeId_providerSlug: { programmeId: programme.id, providerSlug: unitRef.slug } },
        create: {
          provider: provider.name,
          providerSlug: unitRef.slug,
          programmeId: programme.id,
          title: unitDetail.title || unitRef.title,
          order: unitRef.order,
          description: unitDetail.description ?? null,
          whyThisWhyNow: unitDetail.whyThisWhyNow ?? null,
          priorKnowledge: unitDetail.priorKnowledge as Prisma.InputJsonValue,
          nationalCurriculum: unitDetail.nationalCurriculum as Prisma.InputJsonValue,
          threads: unitDetail.threads as Prisma.InputJsonValue,
          categories: unitDetail.categories as Prisma.InputJsonValue,
          rawSummary: (unitDetail.raw ?? null) as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
        update: {
          title: unitDetail.title || unitRef.title,
          order: unitRef.order,
          description: unitDetail.description ?? undefined,
          whyThisWhyNow: unitDetail.whyThisWhyNow ?? undefined,
          priorKnowledge: unitDetail.priorKnowledge as Prisma.InputJsonValue,
          nationalCurriculum: unitDetail.nationalCurriculum as Prisma.InputJsonValue,
          threads: unitDetail.threads as Prisma.InputJsonValue,
          categories: unitDetail.categories as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
      });
      stats.units += 1;

      const wanted = scope.lessonSlugs
        ? unitDetail.lessons.filter((l) => scope.lessonSlugs!.includes(l.slug))
        : unitDetail.lessons;

      for (const lessonRef of wanted) {
        try {
          const detail = await provider.getLesson(lessonRef.slug);
          if (!detail) {
            log(`  Lesson ${lessonRef.slug}: no summary, skipped`);
            stats.skipped += 1;
            continue;
          }

          const [quiz, transcript, assets] = await Promise.all([
            provider.getQuiz(lessonRef.slug).catch(() => null),
            provider.getTranscript(lessonRef.slug).catch(() => null),
            provider.getAssets(lessonRef.slug).catch(() => null),
          ]);

          const assetList = assets?.assets ?? [];
          const hasVideo = assetList.some((a) => a.type === "video");
          const hasWorksheet = assetList.some((a) => a.type === "worksheet");

          const lessonData = {
            title: detail.title || lessonRef.title,
            order: lessonRef.order,
            pupilOutcome: detail.pupilOutcome ?? null,
            keyLearningPoints: detail.keyLearningPoints as Prisma.InputJsonValue,
            keywords: detail.keywords as Prisma.InputJsonValue,
            misconceptions: detail.misconceptions as Prisma.InputJsonValue,
            teacherTips: detail.teacherTips as Prisma.InputJsonValue,
            contentGuidance: (detail.contentGuidance ?? null) as Prisma.InputJsonValue,
            supervisionLevel: detail.supervisionLevel ?? null,
            transcript: transcript?.transcript ?? null,
            transcriptVtt: transcript?.vtt ?? null,
            estimatedMinutes: estimateMinutes(hasVideo, hasWorksheet),
            licence: toLicence(licences[lessonRef.slug]),
            canonicalUrl: detail.canonicalUrl ?? null,
            providerUrl: detail.providerUrl ?? null,
            downloadsAvailable: detail.downloadsAvailable,
            state: lessonRef.state,
            syncedAt: new Date(),
          };

          const lesson = await prisma.lesson.upsert({
            where: { provider_providerSlug: { provider: provider.name, providerSlug: lessonRef.slug } },
            create: {
              provider: provider.name,
              providerSlug: lessonRef.slug,
              unitId: unit.id,
              rawSummary: (detail.raw ?? null) as Prisma.InputJsonValue,
              ...lessonData,
            },
            update: { unitId: unit.id, ...lessonData },
          });
          stats.lessons += 1;

          // Quiz questions → STARTER and CHECK stages.
          if (quiz) {
            const starter = quiz.starterQuiz
              .map((q, i) => mapOakQuizQuestion(q, "STARTER", i + 1))
              .filter((q): q is MappedQuestion => q !== null);
            const exit = quiz.exitQuiz
              .map((q, i) => mapOakQuizQuestion(q, "CHECK", i + 1))
              .filter((q): q is MappedQuestion => q !== null);

            stats.questions += await upsertQuestions(lesson.id, starter, () => "OAK_STARTER_QUIZ");
            stats.questions += await upsertQuestions(lesson.id, exit, () => "OAK_EXIT_QUIZ");

            const dropped =
              quiz.starterQuiz.length - starter.length + (quiz.exitQuiz.length - exit.length);
            if (dropped > 0) log(`  Lesson ${lessonRef.slug}: ${dropped} unsupported quiz question(s) skipped`);
          }

          // Worksheet → PRACTICE stage. Fixture content carries native questions; Oak
          // worksheets are PDFs and go through the worksheet pipeline separately, with the
          // PDF always kept as a fallback resource so a child is never left with nothing.
          if (provider instanceof FixtureProvider) {
            const worksheet = await provider.getWorksheetQuestions(lessonRef.slug);
            if (worksheet?.length) {
              const mapped = worksheet.map((q, i) => mapWorksheetQuestion(q, i + 1));
              stats.questions += await upsertQuestions(lesson.id, mapped, () => "OAK_WORKSHEET");
            }
          }

          // Resources.
          for (const asset of assetList) {
            const type = RESOURCE_TYPE_BY_ASSET[asset.type];
            if (!type) continue;
            const storedPath = scope.includeAssets ? await downloadAsset(lessonRef.slug, asset, log) : null;
            const existing = await prisma.lessonResource.findFirst({ where: { lessonId: lesson.id, type } });
            if (existing) {
              await prisma.lessonResource.update({
                where: { id: existing.id },
                data: {
                  label: asset.label,
                  providerUrl: asset.url,
                  storedPath: storedPath ?? existing.storedPath,
                  syncedAt: new Date(),
                },
              });
            } else {
              await prisma.lessonResource.create({
                data: {
                  lessonId: lesson.id,
                  type,
                  label: asset.label,
                  providerUrl: asset.url,
                  storedPath,
                  metadata: { attribution: assets?.attribution ?? [] } as Prisma.InputJsonValue,
                  syncedAt: new Date(),
                },
              });
            }
            stats.resources += 1;
          }
        } catch (err) {
          stats.failed += 1;
          log(`  Lesson ${lessonRef.slug} FAILED: ${(err as Error).message}`);
        }
      }
    }

    log(
      `Done: ${stats.units} units, ${stats.lessons} lessons, ${stats.questions} questions, ` +
        `${stats.resources} resources, ${stats.skipped} skipped, ${stats.failed} failed`,
    );

    await prisma.curriculumSyncJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        stats: stats as Prisma.InputJsonValue,
        log: lines.join("\n"),
      },
    });

    return { jobId: job.id, programmeId: programme.id, stats };
  } catch (err) {
    // Running out of Oak's quota is not a failure of this import — it is the import being
    // interrupted. Everything already written stays, and the next run picks up where this one
    // stopped, because the sync is idempotent. Calling that FAILED would tell the parent to go
    // looking for a fault that does not exist.
    const outOfQuota = err instanceof OakRateLimitError;
    const message = outOfQuota
      ? `${(err as Error).message} Nothing already imported was lost; the next sync continues from here.`
      : (err as Error).message;

    log(outOfQuota ? `STOPPED: ${message}` : `FAILED: ${message}`);
    await prisma.curriculumSyncJob.update({
      where: { id: job.id },
      data: {
        status: outOfQuota ? "PARTIAL" : "FAILED",
        finishedAt: new Date(),
        error: message,
        stats: stats as Prisma.InputJsonValue,
        log: lines.join("\n"),
      },
    });
    throw err;
  }
}

/** Runs several scopes in sequence (the provider rate-limits, so serial is deliberate). */
export async function syncMany(
  scopes: SyncScope[],
  opts: SyncOptions = {},
): Promise<{ jobIds: string[]; programmeIds: string[]; failures: { scope: SyncScope; error: string }[] }> {
  const jobIds: string[] = [];
  const programmeIds: string[] = [];
  const failures: { scope: SyncScope; error: string }[] = [];

  for (const scope of scopes) {
    try {
      const result = await syncProgramme(scope, opts);
      jobIds.push(result.jobId);
      programmeIds.push(result.programmeId);
    } catch (err) {
      failures.push({ scope, error: (err as Error).message });
    }
  }

  return { jobIds, programmeIds, failures };
}
