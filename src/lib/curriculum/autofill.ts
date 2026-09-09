/**
 * Fetching the lessons a child needs *today*, without anybody pressing anything.
 *
 * A timetable that comes out short because a subject has nothing imported is not a thing to
 * report to a parent and wait on. Children are sitting in front of it now. So when a day is
 * planned and comes out short, this goes and gets what is missing.
 *
 * Everything here is shaped by having taken the server down once already by running a long job
 * in the request path:
 *   - it never blocks a page render — the caller does not await it
 *   - it never throws into a request
 *   - one run at a time, enforced in the database rather than in memory, so restarts and two
 *     instances cannot both start one
 *   - one week, not two, and no writing lessons out — the slow half waits until a child opens
 *     a lesson, because the urgent thing is that there is a lesson to open
 */
import { prisma } from "@/lib/db";
import { importLessonsAhead } from "./ahead";

/** Marks this job's rows apart from a parent's manual syncs and the weekly run. */
export const AUTOFILL_PROVIDER = "autofill";

/** A run that started this recently is still going, or failed recently enough to leave alone. */
const COOLDOWN_MS = 10 * 60 * 1000;

let inFlight = false;

/**
 * Starts a catch-up import if one is not already running. Returns whether one is now in flight,
 * so a page can say "getting your lessons ready" instead of showing an unexplained short day.
 */
export async function catchUpImport(): Promise<boolean> {
  // Cheap in-process guard first, so a burst of page loads does not all hit the database.
  if (inFlight) return true;

  const recent = await prisma.curriculumSyncJob
    .findFirst({
      where: { provider: AUTOFILL_PROVIDER, createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null);
  if (recent) return recent.status === "RUNNING" || recent.status === "PENDING";

  const job = await prisma.curriculumSyncJob
    .create({
      data: {
        provider: AUTOFILL_PROVIDER,
        scope: { reason: "short_day" },
        status: "RUNNING",
        startedAt: new Date(),
      },
    })
    .catch(() => null);
  if (!job) return false;

  inFlight = true;

  // Deliberately not awaited by the caller. The page renders now; the lessons arrive behind it.
  void (async () => {
    const lines: string[] = [];
    try {
      const result = await importLessonsAhead({
        weeks: 1,
        skipExplainers: true,
        log: (line) => lines.push(line),
      });
      await prisma.curriculumSyncJob.update({
        where: { id: job.id },
        data: {
          status: result.failures.length > 0 ? "FAILED" : "SUCCESS",
          finishedAt: new Date(),
          stats: {
            subjectYears: result.targets.length,
            lessons: result.targets.reduce((n, t) => n + t.lessonSlugs.length + t.discover, 0),
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
      await prisma.curriculumSyncJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: (err as Error).message,
            log: lines.join("\n"),
          },
        })
        .catch(() => undefined);
    } finally {
      inFlight = false;
    }
  })();

  return true;
}

/** Whether a catch-up is running now, for a page that wants to say so. */
export async function catchUpRunning(): Promise<boolean> {
  if (inFlight) return true;
  const recent = await prisma.curriculumSyncJob
    .findFirst({
      where: { provider: AUTOFILL_PROVIDER, status: "RUNNING", createdAt: { gt: new Date(Date.now() - COOLDOWN_MS) } },
    })
    .catch(() => null);
  return recent !== null;
}
