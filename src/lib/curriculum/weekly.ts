/**
 * The weekly import, running itself.
 *
 * An import that depends on someone remembering to press a button is not a weekly import — it
 * is a weekly chance to forget, and the cost of forgetting is a child opening Tuesday's lesson
 * to an empty page. So the server checks, roughly hourly, whether the fortnight ahead is
 * stocked, and tops it up when it is not.
 *
 * Deliberately "is it due?" rather than "is it Sunday at 6pm?". A container restarts, deploys
 * happen, and a job pinned to a single minute of the week is a job that silently never runs.
 * Due-ness is read from the database, so restarting the server does not re-run it and running
 * two servers does not run it twice.
 */
import { prisma } from "@/lib/db";
import { importLessonsAhead } from "./ahead";

/** Marks the scheduler's own rows in `CurriculumSyncJob`, apart from a provider's jobs. */
export const SCHEDULER_PROVIDER = "scheduler";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Slightly under a week, so a run that drifts later each time does not become fortnightly. */
const DUE_AFTER_SUCCESS_MS = 6.5 * DAY_MS;
/** After a failure, try again the same day — but not on every restart. */
const DUE_AFTER_FAILURE_MS = 12 * HOUR_MS;
/** How often the server asks. Cheap: one indexed query. */
const CHECK_INTERVAL_MS = HOUR_MS;

export async function lastWeeklyRun() {
  return prisma.curriculumSyncJob.findFirst({
    where: { provider: SCHEDULER_PROVIDER },
    orderBy: { createdAt: "desc" },
  });
}

export async function weeklyImportDue(now: Date = new Date()): Promise<boolean> {
  const last = await lastWeeklyRun();
  if (!last) return true;
  const age = now.getTime() - last.createdAt.getTime();
  if (last.status === "RUNNING" || last.status === "PENDING") {
    // A run that has been "running" for over an hour died with the process that started it.
    return age > HOUR_MS;
  }
  return age >= (last.status === "SUCCESS" ? DUE_AFTER_SUCCESS_MS : DUE_AFTER_FAILURE_MS);
}

/**
 * Runs the import and records it, whatever happens.
 *
 * The record is the point: a parent looking at Recent sync jobs can see that the weekly import
 * ran, what it did, and what it could not do — rather than inferring it from lessons being
 * present.
 */
export async function runWeeklyImport(): Promise<void> {
  const job = await prisma.curriculumSyncJob.create({
    data: {
      provider: SCHEDULER_PROVIDER,
      scope: { weekly: true },
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  const lines: string[] = [];
  try {
    const result = await importLessonsAhead({ log: (line) => lines.push(line) });
    await prisma.curriculumSyncJob.update({
      where: { id: job.id },
      data: {
        // A failure to import one subject is still a failure: someone has to look at it.
        status: result.failures.length > 0 ? "FAILED" : "SUCCESS",
        finishedAt: new Date(),
        stats: {
          subjectYears: result.targets.length,
          lessons: result.targets.reduce((n, t) => n + t.lessonSlugs.length, 0),
          failed: result.failures.length,
        },
        error:
          result.failures.length > 0
            ? result.failures.map((f) => `${f.scope.subjectSlug} y${f.scope.yearGroup}: ${f.error}`).join("; ")
            : null,
        log: lines.join("\n"),
      },
    });
  } catch (err) {
    await prisma.curriculumSyncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: (err as Error).message,
        log: lines.join("\n"),
      },
    });
  }
}

let started = false;

/**
 * Starts the hourly check. Called once per server process, from `instrumentation.ts`.
 *
 * Never throws and never blocks startup: an import problem must not stop the app booting —
 * that lesson was learned the hard way, with children waiting.
 */
export function startWeeklyImportScheduler(): void {
  if (started) return;
  // Off unless asked for. This runs a long job — provider calls, then writing lessons out with
  // the model — inside the web server process, and a web server that is busy for ten minutes is
  // a web server that fails its health check and gets restarted, over and over. Set
  // WEEKLY_IMPORT=1 to turn it on once that job is proven to fit; until then the button in
  // Admin and `pnpm oak:week` do the same work where nobody is waiting on the response.
  if (process.env.WEEKLY_IMPORT !== "1") return;
  if (process.env.DISABLE_WEEKLY_IMPORT === "1") return;
  started = true;

  const tick = async () => {
    try {
      if (await weeklyImportDue()) {
        console.log("[weekly-import] due — importing the lessons the next two weeks need");
        await runWeeklyImport();
      }
    } catch (err) {
      console.error("[weekly-import] check failed", err);
    }
  };

  // A minute after boot, not at boot: a deploy has migrations to finish and children may be
  // mid-lesson, and this is never the urgent thing.
  const first = setTimeout(() => void tick(), 60_000);
  const interval = setInterval(() => void tick(), CHECK_INTERVAL_MS);
  // Nothing should be held open by this — if the process wants to exit, let it.
  first.unref?.();
  interval.unref?.();
}
