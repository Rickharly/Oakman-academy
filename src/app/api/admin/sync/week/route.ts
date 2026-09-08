/**
 * POST /api/admin/sync/week — import exactly what the next two weeks of school will use.
 *
 * Two callers: a parent pressing the button in Admin → Curriculum, and a scheduler (Railway
 * cron, or anything that can send a header) presenting `CRON_SECRET`. The scheduled path
 * exists because a weekly import that depends on someone remembering to press a button is not
 * an automated weekly import.
 */
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { importLessonsAhead, WEEKS_AHEAD } from "@/lib/curriculum/ahead";

export const maxDuration = 800;

/** Constant-time-ish comparison, so a wrong secret does not leak its length by timing. */
function secretMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const secret = process.env.CRON_SECRET;
    const offered = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const fromScheduler = Boolean(secret && offered && secretMatches(offered, secret));

    // A parent's session or the scheduler's secret. Never both optional: without one of them
    // this would be an unauthenticated way to spend the family's provider quota.
    if (!fromScheduler) await requireParentApi(req);

    const lines: string[] = [];
    const result = await importLessonsAhead({ log: (line) => lines.push(line) });

    return Response.json({
      weeks: WEEKS_AHEAD,
      nothingToDo: result.nothingToDo,
      targets: result.targets.map((t) => ({
        subjectSlug: t.subjectSlug,
        yearGroup: t.yearGroup,
        lessons: t.lessonSlugs.length,
        students: t.students,
      })),
      jobIds: result.jobIds,
      failures: result.failures.map((f) => ({
        subjectSlug: f.scope.subjectSlug,
        yearGroup: f.scope.yearGroup,
        error: f.error,
      })),
      log: lines,
    });
  } catch (err) {
    return jsonError(err);
  }
}
