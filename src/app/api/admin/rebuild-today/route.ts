/**
 * POST /api/admin/rebuild-today — replan every child's day, now.
 *
 * The repairs — wrong year group, placeholder programmes, a board buried in reviews — all run
 * inside `ensureDayPlanned`, which only happens when a child opens their own page. So a parent
 * looking at a broken timetable had no way to fix it: they could see the problem and not touch
 * it, and had to wait for a child to reload something. This is that missing control.
 */
import { jsonError, requireParentApi } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { ensureDayPlanned } from "@/lib/scheduling/planner";
import { schoolDayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    await requireParentApi(req);

    const students = await prisma.studentProfile.findMany({
      include: { user: { select: { displayName: true } } },
    });
    const dateKey = schoolDayKey();

    const results: { name: string; lessons: number; reviews: number; problem?: string }[] = [];
    for (const student of students) {
      try {
        const assignments = await ensureDayPlanned(student.id, dateKey);
        const live = assignments.filter((a) => a.status !== "MOVED");
        results.push({
          name: student.user.displayName,
          lessons: live.filter((a) => a.kind === "LESSON").length,
          reviews: live.filter((a) => a.kind === "REVIEW").length,
        });
      } catch (err) {
        // One child's broken day must not stop the others being repaired.
        results.push({
          name: student.user.displayName,
          lessons: 0,
          reviews: 0,
          problem: (err as Error).message,
        });
      }
    }

    return Response.json({ dateKey, results });
  } catch (err) {
    return jsonError(err);
  }
}
