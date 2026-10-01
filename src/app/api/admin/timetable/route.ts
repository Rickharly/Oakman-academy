/**
 * POST /api/admin/timetable — put every child on the family's week.
 *
 * The week is a decision, not a default, so applying it is a thing a parent does rather than
 * something that happens to them. It is safe to press twice, and it says which subjects are
 * still waiting for material to be written.
 */
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { applyCoreTimetable, CORE_TIMETABLE } from "@/lib/admin/timetable";
import { sweepPlaceholders } from "@/lib/admin/no-placeholders";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { schoolDayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const parent = await requireParentApi(req);
    const students = await prisma.studentProfile.findMany({
      where: { user: { studentLinks: { some: { parentId: parent.id } } } },
      include: { user: { select: { displayName: true } } },
    });

    const dateKey = schoolDayKey();
    const results: {
      name: string;
      awaitingMaterial: string[];
      placeholdersRemoved: number;
      /** A timetable subject with nothing real behind it — a gap a parent needs to see. */
      subjectsWithNoRealMaterial: string[];
    }[] = [];

    for (const student of students) {
      const { awaitingMaterial } = await applyCoreTimetable(student.id);

      /**
       * And the sample curriculum goes, every time.
       *
       * Invented lessons with `fixture://` videos are not a curriculum. Removing them has been
       * a preference expressed in several places — "prefer Oak where Oak exists" — and a
       * preference fails whenever an enrolment is wrong in a way nobody predicted. Setting the
       * week sweeps them out, so there is one button that makes the statement true rather than
       * several that make it likely.
       */
      const swept = await sweepPlaceholders(student.id).catch(() => null);

      // Replan straight away, so the change is visible on the board rather than tomorrow.
      await ensureDayPlanned(student.id, dateKey).catch(() => undefined);
      results.push({
        name: student.user.displayName,
        awaitingMaterial,
        placeholdersRemoved:
          (swept?.assignmentsRemoved ?? 0) +
          (swept?.enrolmentsDeactivated ?? 0) +
          (swept?.schedulesDeactivated ?? 0),
        subjectsWithNoRealMaterial: swept?.subjectsLeftEmpty ?? [],
      });
    }

    return Response.json({
      ok: true,
      week: CORE_TIMETABLE.map((r) => `${r.title} ${r.weeklyFrequency}/week`),
      results,
    });
  } catch (err) {
    return jsonError(err);
  }
}
